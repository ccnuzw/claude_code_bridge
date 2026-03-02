/**
 * IPC Handlers — 统一 IPC 入口
 *
 * 将所有 renderer→main 的 IPC 调用分发到对应模块。
 * 约定：channel 格式为 "module:action"
 * 所有 handler 通过 safeHandle 包装，确保单个调用错误不会崩溃主进程。
 */
import { ipcMain } from 'electron'
import { readFileSync, existsSync } from 'fs'
import { join } from 'path'
import { homedir } from 'os'
import configManager from './config-manager.js'
import healthChecker from './health-checker.js'
import processManager from './process-manager.js'
import ptyManager from './pty-manager.js'
import sessionParser from './session-parser.js'
import systemChecker from './system-checker.js'
import mailManager from './mail-manager.js'
import skillsManager from './skills-manager.js'
import askBridge from './ask-bridge.js'
import fileWatcher from './file-watcher.js'
import notificationManager from './notification-manager.js'
import autoUpdater from './auto-updater.js'
import TokenDetector from './token-detector.js'

const tokenDetector = new TokenDetector()

/**
 * 安全的 IPC handler 包装器
 * 捕获所有异常并返回 { __error: true, message } 而非崩溃
 */
function safeHandle(channel, handler) {
    ipcMain.handle(channel, async (event, ...args) => {
        try {
            return await handler(event, ...args)
        } catch (err) {
            console.error(`[IPC] ${channel} error:`, err.message)
            return { __error: true, channel, message: err.message }
        }
    })
}

let _mainWindow = null

export function setMainWindow(win) {
    _mainWindow = win
}

/** 向渲染进程推送事件 */
function pushToRenderer(channel, data) {
    if (_mainWindow && !_mainWindow.isDestroyed()) {
        _mainWindow.webContents.send(channel, data)
    }
}

export function registerAllHandlers() {
    // ── Config 相关 ──────────────────────────────────────────

    ipcMain.handle('config:get-providers', () => {
        return configManager.getAllProviders()
    })

    ipcMain.handle('config:get-enabled-providers', () => {
        return configManager.getEnabledProviders()
    })

    ipcMain.handle('config:set-enabled-providers', (_event, providers) => {
        return configManager.setEnabledProviders(providers)
    })

    ipcMain.handle('config:get-desktop-settings', () => {
        return configManager.getDesktopSettings()
    })

    ipcMain.handle('config:save-desktop-settings', (_event, settings) => {
        return configManager.saveDesktopSettings(settings)
    })

    ipcMain.handle('config:update-setting', (_event, key, value) => {
        return configManager.updateSetting(key, value)
    })

    // ── Settings 子面板 API ──────────────────────────────────

    // 读取某个 section 的设置（如 shortcuts / terminal / askd / mail / providerDefaults）
    ipcMain.handle('settings:get-section', (_event, section) => {
        const all = configManager.getDesktopSettings()
        return all[section] || {}
    })

    // 更新某个 section 的设置（合并更新，不覆盖其他字段）
    ipcMain.handle('settings:update-section', (_event, section, updates) => {
        const all = configManager.getDesktopSettings()
        const current = all[section] || {}
        const merged = { ...current, ...updates }
        return configManager.updateSetting(section, merged)
    })

    // 重置某个 section 到默认值
    ipcMain.handle('settings:reset-section', (_event, section) => {
        // 从 DEFAULT_DESKTOP_SETTINGS 中读取默认值（通过读取 + 删除 + 重新写入）
        const all = configManager.getDesktopSettings()
        // 删除 section 的自定义值，getDesktopSettings 会填充默认值
        delete all[section]
        configManager.saveDesktopSettings(all)
        return configManager.getDesktopSettings()[section] || {}
    })

    // 读取快捷键列表
    ipcMain.handle('settings:get-shortcuts', () => {
        const all = configManager.getDesktopSettings()
        return all.shortcuts || {}
    })

    // 更新单个快捷键
    ipcMain.handle('settings:set-shortcut', (_event, action, keys) => {
        const all = configManager.getDesktopSettings()
        const shortcuts = all.shortcuts || {}
        shortcuts[action] = keys
        return configManager.updateSetting('shortcuts', shortcuts)
    })

    // ── Health 相关 ──────────────────────────────────────────

    ipcMain.handle('health:get-all', () => {
        return healthChecker.getAllStatuses()
    })

    ipcMain.handle('health:check-all', async () => {
        return await healthChecker.checkAll()
    })

    ipcMain.handle('health:ping-provider', async (_event, providerName) => {
        return await healthChecker.pingProvider(providerName)
    })

    ipcMain.handle('health:check-provider', async (_event, providerName) => {
        return await healthChecker.checkProvider(providerName)
    })

    // ── Process 相关 ─────────────────────────────────────────

    ipcMain.handle('process:start-askd', async () => {
        try {
            return { success: true, ...(await processManager.startAskd()) }
        } catch (err) {
            return { success: false, error: err.message }
        }
    })

    ipcMain.handle('process:stop-askd', async () => {
        return await processManager.stopAskd()
    })

    ipcMain.handle('process:restart-askd', async () => {
        try {
            return { success: true, ...(await processManager.restartAskd()) }
        } catch (err) {
            return { success: false, error: err.message }
        }
    })

    ipcMain.handle('process:start-provider', async (_event, providerName) => {
        try {
            return { success: true, ...(await processManager.startProvider(providerName)) }
        } catch (err) {
            return { success: false, error: err.message }
        }
    })

    ipcMain.handle('process:stop-provider', async (_event, providerName) => {
        return await processManager.stopProvider(providerName)
    })

    ipcMain.handle('process:restart-provider', async (_event, providerName) => {
        try {
            return { success: true, ...(await processManager.restartProvider(providerName)) }
        } catch (err) {
            return { success: false, error: err.message }
        }
    })

    ipcMain.handle('process:get-ccb-root', () => {
        return processManager.getCcbRoot()
    })

    // F3: maild 进程管理
    ipcMain.handle('process:start-maild', async () => {
        try {
            return { success: true, ...(await processManager.startMaild()) }
        } catch (err) {
            return { success: false, error: err.message }
        }
    })

    ipcMain.handle('process:stop-maild', async () => {
        return await processManager.stopMaild()
    })

    ipcMain.handle('process:restart-maild', async () => {
        try {
            await processManager.stopMaild()
            await new Promise(r => setTimeout(r, 1000))
            return { success: true, ...(await processManager.startMaild()) }
        } catch (err) {
            return { success: false, error: err.message }
        }
    })

    // F4: Provider 日志查看（tail 最后 N 行）
    ipcMain.handle('provider:get-log', (_event, providerName, lines = 100) => {
        const { PROVIDER_SPECS } = require('./config-manager.js')
        const spec = PROVIDER_SPECS[providerName]
        if (!spec) return { error: `Unknown provider: ${providerName}` }

        const logPath = join(homedir(), '.ccb', spec.logFile)
        if (!existsSync(logPath)) {
            return { lines: [], path: logPath, exists: false }
        }

        try {
            const content = readFileSync(logPath, 'utf-8')
            const allLines = content.split('\n')
            const tail = allLines.slice(-lines).filter(l => l.trim())
            return { lines: tail, path: logPath, exists: true, totalLines: allLines.length }
        } catch (err) {
            return { error: err.message, path: logPath }
        }
    })

    // askd 日志查看
    ipcMain.handle('askd:get-log', (_event, lines = 100) => {
        const logPath = join(homedir(), '.ccb', 'askd.log')
        if (!existsSync(logPath)) {
            return { lines: [], path: logPath, exists: false }
        }
        try {
            const content = readFileSync(logPath, 'utf-8')
            const allLines = content.split('\n')
            const tail = allLines.slice(-lines).filter(l => l.trim())
            return { lines: tail, path: logPath, exists: true, totalLines: allLines.length }
        } catch (err) {
            return { error: err.message, path: logPath }
        }
    })

    // maild 日志查看
    ipcMain.handle('maild:get-log', (_event, lines = 100) => {
        const logPath = join(homedir(), '.ccb', 'maild.log')
        if (!existsSync(logPath)) {
            return { lines: [], path: logPath, exists: false }
        }
        try {
            const content = readFileSync(logPath, 'utf-8')
            const allLines = content.split('\n')
            const tail = allLines.slice(-lines).filter(l => l.trim())
            return { lines: tail, path: logPath, exists: true, totalLines: allLines.length }
        } catch (err) {
            return { error: err.message, path: logPath }
        }
    })

    // ── Dashboard 聚合数据 ──────────────────────────────────

    ipcMain.handle('dashboard:get-overview', async () => {
        const providers = configManager.getAllProviders()
        const enabledProviders = configManager.getEnabledProviders()
        const healthStatuses = await healthChecker.checkAll()
        const settings = configManager.getDesktopSettings()

        const operationalCount = Object.values(healthStatuses)
            .filter(s => s && s.status === 'operational').length

        return {
            providers,
            enabledProviders,
            healthStatuses,
            settings,
            stats: {
                activeProviders: enabledProviders.length,
                operationalProviders: operationalCount,
                askdStatus: healthStatuses._askd?.status || 'offline',
                maildStatus: healthStatuses._maild?.status || 'offline'
            }
        }
    })

    // ── 设置 EventEmitter → Renderer 推送 ──────────────────

    healthChecker.on('health-update', (statuses) => {
        pushToRenderer('health:status-update', statuses)
    })

    healthChecker.on('ping-result', (result) => {
        pushToRenderer('health:ping-result', result)
    })

    configManager.on('config-changed', (change) => {
        pushToRenderer('config:changed', change)
    })

    configManager.on('settings-changed', (settings) => {
        pushToRenderer('config:settings-changed', settings)
    })

    processManager.on('process-started', (info) => {
        pushToRenderer('process:started', info)
    })

    processManager.on('process-stopped', (info) => {
        pushToRenderer('process:stopped', info)
    })

    processManager.on('process-error', (info) => {
        pushToRenderer('process:error', info)
    })

    // ── Terminal PTY ──────────────────────────────────────────

    ipcMain.handle('pty:create', (_event, options) => {
        return ptyManager.createTerminal(options)
    })

    ipcMain.handle('pty:write', (_event, id, data) => {
        return ptyManager.write(id, data)
    })

    ipcMain.handle('pty:resize', (_event, id, cols, rows) => {
        return ptyManager.resize(id, cols, rows)
    })

    ipcMain.handle('pty:destroy', (_event, id) => {
        return ptyManager.destroy(id)
    })

    ipcMain.handle('pty:list', () => {
        return ptyManager.list()
    })

    ptyManager.on('terminal-data', ({ id, data }) => {
        pushToRenderer('pty:data', { id, data })
    })

    ptyManager.on('terminal-exit', ({ id, exitCode, signal }) => {
        pushToRenderer('pty:exit', { id, exitCode, signal })
    })

    ptyManager.on('terminal-created', (info) => {
        pushToRenderer('pty:created', info)
    })

    ptyManager.on('terminal-destroyed', (info) => {
        pushToRenderer('pty:destroyed', info)
    })

    // ── Tasks / Session ────────────────────────────────────────

    ipcMain.handle('tasks:scan-all', () => {
        return sessionParser.scanAll()
    })

    ipcMain.handle('tasks:get-recent', (_event, limit) => {
        return sessionParser.getRecent(limit || 20)
    })

    // ── System 环境检测 ────────────────────────────────────────

    ipcMain.handle('system:check-env', async () => {
        return await systemChecker.checkEnvironment()
    })

    // ── Token 检测 ──────────────────────────────────────────────

    ipcMain.handle('token:detect-all', () => {
        return tokenDetector.detectAll()
    })

    ipcMain.handle('token:detect', (_event, providerName) => {
        return tokenDetector.detect(providerName)
    })

    // ── Provider Settings (含 base_url) ───────────────────────

    ipcMain.handle('config:get-provider-settings', () => {
        const configPath = configManager.globalConfigPath
        if (!existsSync(configPath)) return {}
        try {
            const data = JSON.parse(readFileSync(configPath, 'utf-8'))
            return data.providerSettings || {}
        } catch { return {} }
    })

    ipcMain.handle('config:save-provider-settings', (_event, settings) => {
        const configPath = configManager.globalConfigPath
        let data = {}
        try {
            data = JSON.parse(readFileSync(configPath, 'utf-8'))
        } catch { /* new file */ }
        data.providerSettings = settings
        const { writeFileSync } = require('fs')
        writeFileSync(configPath, JSON.stringify(data, null, 2), 'utf-8')
        return { ok: true }
    })

    // ── Mail ──────────────────────────────────────────────────

    ipcMain.handle('mail:get-overview', () => {
        return mailManager.getOverview()
    })

    ipcMain.handle('mail:get-config', () => {
        return mailManager.getConfig()
    })

    ipcMain.handle('mail:save-config', (_event, config) => {
        return mailManager.saveConfig(config)
    })

    ipcMain.handle('mail:update-config', (_event, key, value) => {
        return mailManager.updateConfig(key, value)
    })

    ipcMain.handle('mail:get-tokens', () => {
        return mailManager.getTokenFiles()
    })

    ipcMain.handle('mail:get-threads', () => {
        return mailManager.getThreads()
    })

    // ── Extensions ────────────────────────────────────────────

    ipcMain.handle('extensions:get-overview', () => {
        return skillsManager.getOverview()
    })

    ipcMain.handle('extensions:get-skills', () => {
        return skillsManager.scanSkills()
    })

    ipcMain.handle('extensions:get-mcp', () => {
        return skillsManager.scanMcpServers()
    })

    ipcMain.handle('extensions:get-roles', () => {
        return skillsManager.scanRoles()
    })

    ipcMain.handle('extensions:get-workflows', () => {
        return skillsManager.scanWorkflows()
    })

    // F6: 读取 skill/role/workflow 文件内容
    ipcMain.handle('extensions:get-skill-content', (_event, skillName) => {
        const root = processManager.getCcbRoot() || join(homedir(), 'Progame', 'claude_code_bridge')
        const skillMd = join(root, 'claude_skills', skillName, 'SKILL.md')
        if (!existsSync(skillMd)) return { error: 'SKILL.md not found', content: '' }
        try {
            return { content: readFileSync(skillMd, 'utf-8') }
        } catch (err) {
            return { error: err.message, content: '' }
        }
    })

    ipcMain.handle('extensions:get-role-content', (_event, filename) => {
        const root = processManager.getCcbRoot() || join(homedir(), 'Progame', 'claude_code_bridge')
        const filePath = join(root, 'roles', filename)
        if (!existsSync(filePath)) return { error: 'Role file not found', content: '' }
        try {
            return { content: readFileSync(filePath, 'utf-8') }
        } catch (err) {
            return { error: err.message, content: '' }
        }
    })

    ipcMain.handle('extensions:get-workflow-content', (_event, filename) => {
        const root = processManager.getCcbRoot() || join(homedir(), 'Progame', 'claude_code_bridge')
        const dirs = [
            join(root, '.agent', 'workflows'),
            join(root, '.agents', 'workflows'),
            join(root, '_agent', 'workflows')
        ]
        for (const dir of dirs) {
            const filePath = join(dir, filename)
            if (existsSync(filePath)) {
                try {
                    return { content: readFileSync(filePath, 'utf-8') }
                } catch (err) {
                    return { error: err.message, content: '' }
                }
            }
        }
        return { error: 'Workflow file not found', content: '' }
    })

    // ── Ask Bridge ──────────────────────────────────────────

    ipcMain.handle('ask:send', async (_event, provider, message, options) => {
        try {
            return { success: true, ...(await askBridge.send(provider, message, options)) }
        } catch (err) {
            return { success: false, error: err.message }
        }
    })

    ipcMain.handle('ask:stream', async (_event, provider, message, nodeId, options) => {
        try {
            const result = await askBridge.sendStream(provider, message, nodeId, options)
            return { success: true, ...result }
        } catch (err) {
            return { success: false, error: err.message }
        }
    })

    ipcMain.handle('ask:compare', async (_event, providers, message, nodeIds, options) => {
        try {
            const results = await askBridge.compare(providers, message, nodeIds, options)
            return { success: true, results }
        } catch (err) {
            return { success: false, error: err.message }
        }
    })

    ipcMain.handle('ask:get-sessions', () => {
        return askBridge.getSessions()
    })

    ipcMain.handle('ask:save-session', (_event, data) => {
        try {
            return askBridge.saveSession(data)
        } catch (err) {
            return { error: err.message }
        }
    })

    ipcMain.handle('ask:load-session', (_event, id) => {
        try {
            return askBridge.loadSession(id)
        } catch (err) {
            return { error: err.message }
        }
    })

    ipcMain.handle('ask:delete-session', (_event, id) => {
        try {
            return askBridge.deleteSession(id)
        } catch (err) {
            return { success: false, error: err.message }
        }
    })

    ipcMain.handle('ask:abort', (_event, nodeId) => {
        return askBridge.abort(nodeId)
    })

    ipcMain.handle('ask:status', () => {
        return { running: askBridge.isRunning() }
    })

    // Ask stream 事件推送
    askBridge.on('ask:stream-start', (data) => pushToRenderer('ask:stream-start', data))
    askBridge.on('ask:stream-chunk', (data) => pushToRenderer('ask:stream-chunk', data))
    askBridge.on('ask:stream-end', (data) => pushToRenderer('ask:stream-end', data))
    askBridge.on('ask:stream-error', (data) => pushToRenderer('ask:stream-error', data))
    askBridge.on('ask:stream-abort', (data) => pushToRenderer('ask:stream-abort', data))

    // ── FileWatcher 事件推送 ──────────────────────────────────

    fileWatcher.on('file-changed', (data) => pushToRenderer('file:changed', data))
    fileWatcher.on('sessions-changed', () => pushToRenderer('file:sessions-changed', {}))
    fileWatcher.on('daemon-changed', () => pushToRenderer('file:daemon-changed', {}))
    fileWatcher.on('config-changed', () => pushToRenderer('file:config-changed', {}))

    // ── Notifications ────────────────────────────────────────

    ipcMain.handle('notify:send', (_event, title, body) => {
        return notificationManager.send(title, body)
    })

    ipcMain.handle('notify:set-enabled', (_event, enabled) => {
        notificationManager.setEnabled(enabled)
    })

    // ── Settings 联动 ────────────────────────────────────────

    ipcMain.handle('app:apply-theme', (_event, theme) => {
        // 将主题变更推送给渲染进程（通过 CSS 变量或 class 切换）
        pushToRenderer('theme-changed', { theme })
        configManager.updateSetting('theme', theme)
    })

    ipcMain.handle('app:apply-scale', (_event, scale) => {
        pushToRenderer('scale-changed', { scale })
        configManager.updateSetting('interfaceScale', scale)
    })

    // ── E5: Terminal 配置联动 ────────────────────────────────

    ipcMain.handle('settings:apply-terminal', (_event, terminalConfig) => {
        // 推送给渲染进程的 xterm 实例
        pushToRenderer('terminal:config-changed', terminalConfig)
        configManager.updateSetting('terminal', terminalConfig)
    })

    // ── E6: askd 配置联动 ────────────────────────────────────

    ipcMain.handle('settings:apply-askd', (_event, askdConfig) => {
        // 更新 askBridge 运行时配置
        if (askBridge.updateConfig) {
            askBridge.updateConfig(askdConfig)
        }
        configManager.updateSetting('askd', askdConfig)
        return { success: true }
    })

    // ── 获取已注册的快捷键 ──────────────────────────────────

    ipcMain.handle('shortcuts:get-registered', () => {
        try {
            const { default: sm } = require('./shortcut-manager.js')
            return sm.getRegistered()
        } catch {
            return {}
        }
    })

    // ── Auto-Updater ──────────────────────────────────────

    autoUpdater.init()
    autoUpdater.on('status', (data) => pushToRenderer('updater:status', data))

    ipcMain.handle('updater:check', async () => {
        return await autoUpdater.checkForUpdates()
    })

    ipcMain.handle('updater:download', async () => {
        return await autoUpdater.downloadUpdate()
    })

    ipcMain.handle('updater:install', () => {
        autoUpdater.installUpdate()
    })

    ipcMain.handle('updater:status', () => {
        return autoUpdater.getStatus()
    })

    // ── G1: 数据导出/导入 ────────────────────────────────────

    ipcMain.handle('data:export', () => {
        try {
            const settings = configManager.getDesktopSettings()
            const sessionsDir = join(homedir(), '.ccb', 'ask-sessions')
            const sessions = []
            if (existsSync(sessionsDir)) {
                const { readdirSync } = require('fs')
                for (const f of readdirSync(sessionsDir).filter(f => f.endsWith('.json'))) {
                    try {
                        sessions.push(JSON.parse(readFileSync(join(sessionsDir, f), 'utf-8')))
                    } catch { /* skip corrupt */ }
                }
            }
            const bundle = {
                version: 1,
                exportedAt: Date.now(),
                appVersion: require('electron').app.getVersion(),
                settings,
                sessions
            }
            return { success: true, data: JSON.stringify(bundle, null, 2) }
        } catch (err) {
            return { success: false, error: err.message }
        }
    })

    ipcMain.handle('data:import', (_event, jsonString) => {
        try {
            const bundle = JSON.parse(jsonString)
            if (bundle.version !== 1) return { success: false, error: 'Unsupported backup version' }

            // 恢复设置
            if (bundle.settings) {
                const { writeFileSync } = require('fs')
                const settingsPath = join(homedir(), '.ccb', 'desktop-settings.json')
                writeFileSync(settingsPath, JSON.stringify(bundle.settings, null, 2), 'utf-8')
            }

            // 恢复会话
            if (bundle.sessions && Array.isArray(bundle.sessions)) {
                const { writeFileSync, mkdirSync } = require('fs')
                const sessionsDir = join(homedir(), '.ccb', 'ask-sessions')
                if (!existsSync(sessionsDir)) mkdirSync(sessionsDir, { recursive: true })
                for (const s of bundle.sessions) {
                    if (s.id) {
                        writeFileSync(join(sessionsDir, `${s.id}.json`), JSON.stringify(s, null, 2), 'utf-8')
                    }
                }
            }

            return { success: true, settingsRestored: !!bundle.settings, sessionsRestored: bundle.sessions?.length || 0 }
        } catch (err) {
            return { success: false, error: err.message }
        }
    })

    // ── G2: 全局搜索 ─────────────────────────────────────────

    ipcMain.handle('search:global', (_event, query, options = {}) => {
        const results = []
        const q = (query || '').toLowerCase().trim()
        if (!q) return results

        const limit = options.limit || 20

        // 搜索 ask sessions
        const sessionsDir = join(homedir(), '.ccb', 'ask-sessions')
        if (existsSync(sessionsDir)) {
            try {
                const { readdirSync } = require('fs')
                for (const f of readdirSync(sessionsDir).filter(f => f.endsWith('.json'))) {
                    if (results.length >= limit) break
                    try {
                        const data = JSON.parse(readFileSync(join(sessionsDir, f), 'utf-8'))
                        const titleMatch = (data.title || '').toLowerCase().includes(q)
                        const contentMatch = (data.nodes || []).some(n =>
                            (n.content || '').toLowerCase().includes(q)
                        )
                        if (titleMatch || contentMatch) {
                            results.push({
                                type: 'session',
                                id: data.id,
                                title: data.title,
                                preview: titleMatch ? data.title : data.nodes?.find(n => n.content?.toLowerCase().includes(q))?.content?.slice(0, 100),
                                timestamp: data.savedAt
                            })
                        }
                    } catch { /* skip */ }
                }
            } catch { /* skip */ }
        }

        // 搜索 skills
        try {
            const skills = skillsManager.scanSkills()
            for (const s of skills) {
                if (results.length >= limit) break
                if (s.name.toLowerCase().includes(q) || s.description?.toLowerCase().includes(q)) {
                    results.push({
                        type: 'skill',
                        id: s.id,
                        title: s.label || s.name,
                        preview: s.description,
                        path: s.path
                    })
                }
            }
        } catch { /* skip */ }

        return results
    })

    // ── G3: Crash Recovery ───────────────────────────────────

    ipcMain.handle('app:get-crash-state', () => {
        const crashFile = join(homedir(), '.ccb', '.crash-state.json')
        if (existsSync(crashFile)) {
            try {
                const data = JSON.parse(readFileSync(crashFile, 'utf-8'))
                // 读取后删除标记
                const { unlinkSync } = require('fs')
                unlinkSync(crashFile)
                return { recovered: true, ...data }
            } catch {
                return { recovered: false }
            }
        }
        return { recovered: false }
    })

    ipcMain.handle('app:save-crash-state', (_event, state) => {
        try {
            const { writeFileSync } = require('fs')
            const crashFile = join(homedir(), '.ccb', '.crash-state.json')
            writeFileSync(crashFile, JSON.stringify({
                ...state,
                savedAt: Date.now()
            }, null, 2), 'utf-8')
            return { success: true }
        } catch (err) {
            return { success: false, error: err.message }
        }
    })

    // ── G4: App Info ─────────────────────────────────────────

    ipcMain.handle('app:get-info', () => {
        const { app } = require('electron')
        return {
            version: app.getVersion(),
            name: app.getName(),
            electronVersion: process.versions.electron,
            nodeVersion: process.versions.node,
            chromeVersion: process.versions.chrome,
            platform: process.platform,
            arch: process.arch,
            ccbRoot: processManager.getCcbRoot()
        }
    })
}
