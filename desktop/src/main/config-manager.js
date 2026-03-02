/**
 * ConfigManager — 读写 CCB 配置文件
 *
 * 配置路径优先级：
 *   1. 项目级: <workDir>/.ccb/ccb.config
 *   2. 遗留级: <workDir>/.ccb_config/ccb.config
 *   3. 全局级: ~/.ccb/ccb.config
 *
 * 同时管理 desktop-specific 设置: ~/.ccb/desktop-settings.json
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync, watchFile, unwatchFile } from 'fs'
import { join } from 'path'
import { homedir } from 'os'
import { EventEmitter } from 'events'

const CCB_DIR = join(homedir(), '.ccb')
const CONFIG_FILENAME = 'ccb.config'
const DESKTOP_SETTINGS_FILENAME = 'desktop-settings.json'
const ALLOWED_PROVIDERS = new Set(['codex', 'gemini', 'opencode', 'claude', 'droid'])

// Provider daemon 规格表（对应 lib/providers.py）
export const PROVIDER_SPECS = {
    codex: {
        daemonKey: 'caskd',
        prefix: 'cask',
        stateFile: 'caskd.json',
        logFile: 'caskd.log',
        label: 'Codex',
        icon: 'code'
    },
    gemini: {
        daemonKey: 'gaskd',
        prefix: 'gask',
        stateFile: 'gaskd.json',
        logFile: 'gaskd.log',
        label: 'Gemini',
        icon: 'auto_awesome'
    },
    opencode: {
        daemonKey: 'oaskd',
        prefix: 'oask',
        stateFile: 'oaskd.json',
        logFile: 'oaskd.log',
        label: 'OpenCode',
        icon: 'code_blocks'
    },
    claude: {
        daemonKey: 'laskd',
        prefix: 'lask',
        stateFile: 'laskd.json',
        logFile: 'laskd.log',
        label: 'Claude',
        icon: 'psychology'
    },
    droid: {
        daemonKey: 'daskd',
        prefix: 'dask',
        stateFile: 'daskd.json',
        logFile: 'daskd.log',
        label: 'Droid',
        icon: 'smart_toy'
    }
}

// Desktop 默认设置
const DEFAULT_DESKTOP_SETTINGS = {
    theme: 'dark',          // 'light' | 'dark' | 'auto'
    accentColor: '#135bec',
    language: 'en',         // 'en' | 'zh'
    interfaceScale: 100,
    terminalScheme: 'classic', // 'classic' | 'block'
    closeToTray: true,
    launchAtLogin: false,
    enableSmartClipboard: true,
    enableNotifications: true,

    // ── Shortcuts（快捷键） ─────────────────────────────────
    shortcuts: {
        commandPalette: 'CmdOrCtrl+Shift+P',
        newTerminal: 'CmdOrCtrl+Shift+T',
        askFocus: 'CmdOrCtrl+L',
        toggleSidebar: 'CmdOrCtrl+B',
        refreshDashboard: 'CmdOrCtrl+R',
        quit: 'CmdOrCtrl+Q',
        toggleFullscreen: 'F11',
        zoomIn: 'CmdOrCtrl+=',
        zoomOut: 'CmdOrCtrl+-',
        zoomReset: 'CmdOrCtrl+0'
    },

    // ── Terminal 配置 ──────────────────────────────────────
    terminal: {
        fontSize: 13,
        fontFamily: 'Menlo, Monaco, "Courier New", monospace',
        cursorStyle: 'block',     // 'block' | 'underline' | 'bar'
        cursorBlink: true,
        scrollback: 5000,
        copyOnSelect: true,
        rightClickPaste: true,
        bellSound: false
    },

    // ── Provider 默认行为 ──────────────────────────────────
    providerDefaults: {
        autoRestart: true,
        healthCheckInterval: 5000,  // ms
        maxRetries: 3,
        timeoutMs: 30000,
        logLevel: 'info'    // 'debug' | 'info' | 'warn' | 'error'
    },

    // ── askd 配置 ─────────────────────────────────────────
    askd: {
        host: '127.0.0.1',
        port: 7199,
        autoStart: false,
        timeoutMs: 60000,
        maxConcurrent: 3,
        streamChunkMs: 50,
        defaultProvider: 'claude'
    },

    // ── Mail 配置 ──────────────────────────────────────────
    mail: {
        enabled: false,
        serviceEmail: '',
        defaultProvider: 'claude',
        pollIntervalMs: 30000,
        notifyMode: 'onCompletion',  // 'onCompletion' | 'realtime' | 'periodic' | 'onRequest'
        autoProcessTokens: false,
        maxThreads: 50
    }
}

class ConfigManager extends EventEmitter {
    constructor() {
        super()
        this._ccbDir = CCB_DIR
        this._desktopSettingsPath = join(CCB_DIR, DESKTOP_SETTINGS_FILENAME)
        this._watchers = new Map()
    }

    // ── CCB Config (providers list) ─────────────────────────

    /** 获取全局 ccb.config 路径 */
    get globalConfigPath() {
        return join(this._ccbDir, CONFIG_FILENAME)
    }

    /** 确保 ~/.ccb/ 存在，首次运行时创建默认配置 */
    ensureCcbDir() {
        if (!existsSync(this._ccbDir)) {
            mkdirSync(this._ccbDir, { recursive: true })
        }
        // 创建默认 ccb.config（如果不存在）
        const configPath = this.globalConfigPath
        if (!existsSync(configPath)) {
            const defaultConfig = {
                providers: ['codex', 'gemini', 'claude'],
                port: 9200,
                host: '127.0.0.1',
                providerSettings: {
                    codex: { enabled: true, apiKey: '', baseUrl: '' },
                    gemini: { enabled: true, apiKey: '', baseUrl: '' },
                    claude: { enabled: true, apiKey: '', baseUrl: '' },
                    opencode: { enabled: false, apiKey: '', baseUrl: '' },
                    droid: { enabled: false, apiKey: '', baseUrl: '' }
                }
            }
            try {
                writeFileSync(configPath, JSON.stringify(defaultConfig, null, 2), 'utf-8')
            } catch (err) {
                console.error('Failed to create default ccb.config:', err)
            }
        }
    }

    /** 读取已启用的 provider 列表 */
    getEnabledProviders() {
        const path = this.globalConfigPath
        if (!existsSync(path)) {
            return ['codex', 'gemini', 'opencode', 'claude']
        }
        try {
            const raw = readFileSync(path, 'utf-8').trim()
            // 尝试 JSON 解析
            try {
                const obj = JSON.parse(raw)
                if (Array.isArray(obj)) return obj.filter(p => ALLOWED_PROVIDERS.has(p))
                if (obj.providers) {
                    if (Array.isArray(obj.providers)) return obj.providers.filter(p => ALLOWED_PROVIDERS.has(p))
                    if (typeof obj.providers === 'string') {
                        return obj.providers.split(/[,\s]+/).filter(p => ALLOWED_PROVIDERS.has(p))
                    }
                }
                return ['codex', 'gemini', 'opencode', 'claude']
            } catch {
                // 纯文本格式: "codex,gemini,opencode,claude"
                return raw.split(/[,\s]+/).filter(p => ALLOWED_PROVIDERS.has(p))
            }
        } catch {
            return ['codex', 'gemini', 'opencode', 'claude']
        }
    }

    /** 写入 provider 列表 */
    setEnabledProviders(providers) {
        this.ensureCcbDir()
        const filtered = providers.filter(p => ALLOWED_PROVIDERS.has(p))
        writeFileSync(this.globalConfigPath, filtered.join(',') + '\n', 'utf-8')
        this.emit('config-changed', { key: 'providers', value: filtered })
        return filtered
    }

    /** 获取 provider 的完整规格信息 */
    getProviderSpecs() {
        const enabled = this.getEnabledProviders()
        return enabled.map(name => ({
            name,
            enabled: true,
            ...PROVIDER_SPECS[name]
        }))
    }

    /** 获取所有 provider（含未启用） */
    getAllProviders() {
        const enabled = new Set(this.getEnabledProviders())
        return Object.entries(PROVIDER_SPECS).map(([name, spec]) => ({
            name,
            enabled: enabled.has(name),
            ...spec
        }))
    }

    // ── Desktop Settings ────────────────────────────────────

    /** 读取 desktop 设置 */
    getDesktopSettings() {
        if (!existsSync(this._desktopSettingsPath)) {
            return { ...DEFAULT_DESKTOP_SETTINGS }
        }
        try {
            const raw = readFileSync(this._desktopSettingsPath, 'utf-8')
            return { ...DEFAULT_DESKTOP_SETTINGS, ...JSON.parse(raw) }
        } catch {
            return { ...DEFAULT_DESKTOP_SETTINGS }
        }
    }

    /** 写入 desktop 设置 */
    saveDesktopSettings(settings) {
        this.ensureCcbDir()
        const merged = { ...this.getDesktopSettings(), ...settings }
        writeFileSync(this._desktopSettingsPath, JSON.stringify(merged, null, 2), 'utf-8')
        this.emit('settings-changed', merged)
        return merged
    }

    /** 更新单项设置 */
    updateSetting(key, value) {
        return this.saveDesktopSettings({ [key]: value })
    }

    // ── File Watching ───────────────────────────────────────

    /** 开始监控配置文件变化 */
    startWatching() {
        const paths = [this.globalConfigPath, this._desktopSettingsPath]
        for (const p of paths) {
            if (existsSync(p)) {
                watchFile(p, { interval: 2000 }, () => {
                    this.emit('file-changed', p)
                    if (p === this.globalConfigPath) {
                        this.emit('config-changed', { key: 'providers', value: this.getEnabledProviders() })
                    } else {
                        this.emit('settings-changed', this.getDesktopSettings())
                    }
                })
                this._watchers.set(p, true)
            }
        }
    }

    /** 停止监控 */
    stopWatching() {
        for (const p of this._watchers.keys()) {
            unwatchFile(p)
        }
        this._watchers.clear()
    }
}

export default new ConfigManager()
