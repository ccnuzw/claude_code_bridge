import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useAppStore } from '../store'
import { useToastStore } from '../components/ToastContainer'
import i18n from '../i18n'

const api = typeof window !== 'undefined' ? window.electronAPI : null

const sectionKeys = [
    { id: 'appearance', icon: 'palette', labelKey: 'settings.appearance' },
    { id: 'general', icon: 'tune', labelKey: 'settings.general' },
    { id: 'shortcuts', icon: 'keyboard', labelKey: 'settings.shortcuts' },
    { id: 'terminal', icon: 'terminal', labelKey: 'terminal.title' },
    { id: 'provider', icon: 'dns', labelKey: 'settings.providerDefaults' },
    { id: 'askd', icon: 'smart_toy', labelKey: 'settings.askd' },
    { id: 'mail', icon: 'mail', labelKey: 'mail.title' },
    { id: 'diagnostics', icon: 'monitor_heart', labelKey: 'settings.diagnostics' }
]

// ── 快捷键名称映射 ──────────────────────────────────────────
const SHORTCUT_META = [
    { key: 'commandPalette', labelKey: 'settings.scCommandPalette', icon: 'search' },
    { key: 'newTerminal', labelKey: 'settings.scNewTerminal', icon: 'terminal' },
    { key: 'askFocus', labelKey: 'settings.scFocusAsk', icon: 'chat' },
    { key: 'toggleSidebar', labelKey: 'settings.scToggleSidebar', icon: 'view_sidebar' },
    { key: 'refreshDashboard', labelKey: 'settings.scRefreshDashboard', icon: 'refresh' },
    { key: 'quit', labelKey: 'settings.scQuit', icon: 'close' },
    { key: 'toggleFullscreen', labelKey: 'settings.scToggleFullscreen', icon: 'fullscreen' },
    { key: 'zoomIn', labelKey: 'settings.scZoomIn', icon: 'zoom_in' },
    { key: 'zoomOut', labelKey: 'settings.scZoomOut', icon: 'zoom_out' },
    { key: 'zoomReset', labelKey: 'settings.scZoomReset', icon: 'fit_screen' }
]

// ── 通用 Section 编辑组件 ────────────────────────────────────

function ToggleRow({ label, desc, value, onChange }) {
    return (
        <div className="flex items-center justify-between py-3 border-b border-[var(--color-border-dark)]/50">
            <div>
                <p className="text-white text-sm font-medium">{label}</p>
                {desc && <p className="text-slate-500 text-xs mt-0.5">{desc}</p>}
            </div>
            <button
                onClick={() => onChange(!value)}
                className={`relative w-10 h-5 rounded-full transition-colors ${value ? 'bg-[var(--color-primary)]' : 'bg-slate-600'}`}
            >
                <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${value ? 'left-5' : 'left-0.5'}`} />
            </button>
        </div>
    )
}

function NumberRow({ label, desc, value, onChange, min, max, step = 1, unit }) {
    return (
        <div className="flex items-center justify-between py-3 border-b border-[var(--color-border-dark)]/50">
            <div>
                <p className="text-white text-sm font-medium">{label}</p>
                {desc && <p className="text-slate-500 text-xs mt-0.5">{desc}</p>}
            </div>
            <div className="flex items-center gap-2">
                <input
                    type="number"
                    value={value ?? ''}
                    min={min}
                    max={max}
                    step={step}
                    onChange={(e) => onChange(Number(e.target.value))}
                    className="w-24 bg-[var(--color-surface-dark)] border border-[var(--color-border-dark)] text-white text-sm rounded-lg px-3 py-1.5 outline-none focus:ring-1 focus:ring-[var(--color-primary)] text-right"
                />
                {unit && <span className="text-slate-500 text-xs">{unit}</span>}
            </div>
        </div>
    )
}

function SelectRow({ label, desc, value, onChange, options }) {
    return (
        <div className="flex items-center justify-between py-3 border-b border-[var(--color-border-dark)]/50">
            <div>
                <p className="text-white text-sm font-medium">{label}</p>
                {desc && <p className="text-slate-500 text-xs mt-0.5">{desc}</p>}
            </div>
            <select
                value={value ?? ''}
                onChange={(e) => onChange(e.target.value)}
                className="bg-[var(--color-surface-dark)] border border-[var(--color-border-dark)] text-slate-300 text-sm rounded-lg px-3 py-1.5 outline-none focus:ring-1 focus:ring-[var(--color-primary)]"
            >
                {options.map(o => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                ))}
            </select>
        </div>
    )
}

function TextRow({ label, desc, value, onChange, placeholder }) {
    return (
        <div className="flex items-center justify-between py-3 border-b border-[var(--color-border-dark)]/50">
            <div className="shrink-0 mr-4">
                <p className="text-white text-sm font-medium">{label}</p>
                {desc && <p className="text-slate-500 text-xs mt-0.5">{desc}</p>}
            </div>
            <input
                type="text"
                value={value ?? ''}
                placeholder={placeholder}
                onChange={(e) => onChange(e.target.value)}
                className="w-48 bg-[var(--color-surface-dark)] border border-[var(--color-border-dark)] text-white text-sm rounded-lg px-3 py-1.5 outline-none focus:ring-1 focus:ring-[var(--color-primary)]"
            />
        </div>
    )
}

const BUILTIN_PROVIDERS = [
    { value: 'claude', label: 'Claude', icon: 'psychology' },
    { value: 'codex', label: 'Codex', icon: 'code' },
    { value: 'gemini', label: 'Gemini', icon: 'auto_awesome' },
    { value: 'opencode', label: 'OpenCode', icon: 'code_blocks' },
    { value: 'droid', label: 'Droid', icon: 'smart_toy' }
]

function ProviderTagSelect({ label, desc, value, onChange }) {
    return (
        <div className="py-3 border-b border-[var(--color-border-dark)]/50">
            <div className="mb-3">
                <p className="text-white text-sm font-medium">{label}</p>
                {desc && <p className="text-slate-500 text-xs mt-0.5">{desc}</p>}
            </div>
            <div className="flex flex-wrap gap-2">
                {BUILTIN_PROVIDERS.map(p => (
                    <button
                        key={p.value}
                        onClick={() => onChange(p.value)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border transition-all ${value === p.value
                                ? 'bg-[var(--color-primary)]/15 text-[var(--color-primary)] border-[var(--color-primary)]/40 font-medium shadow-sm shadow-[var(--color-primary)]/10'
                                : 'bg-[var(--color-surface-dark)] text-slate-400 border-[var(--color-border-dark)] hover:text-slate-200 hover:border-slate-500'
                            }`}
                    >
                        <span className="material-symbols-outlined text-[14px]">{p.icon}</span>
                        {p.label}
                    </button>
                ))}
            </div>
        </div>
    )
}

function SectionHeader({ title, desc, onReset }) {
    return (
        <div className="flex items-center justify-between mb-6">
            <div>
                <h2 className="text-2xl font-bold text-white mb-1">{title}</h2>
                {desc && <p className="text-slate-400 text-sm">{desc}</p>}
            </div>
            {onReset && (
                <button
                    onClick={onReset}
                    className="px-3 py-1.5 text-xs rounded-lg bg-white/5 text-slate-400 border border-[var(--color-border-dark)] hover:bg-white/10 hover:text-white transition-colors flex items-center gap-1"
                >
                    <span className="material-symbols-outlined text-[14px]">restart_alt</span>
                    {i18n.t('settings.reset')}
                </button>
            )}
        </div>
    )
}

// ── Auto-Updater Component ──────────────────────────────────
function UpdateChecker() {
    const [status, setStatus] = useState('idle')
    const [info, setInfo] = useState(null)
    const { t } = useTranslation()

    useEffect(() => {
        api?.getUpdaterStatus?.().then(s => s && setStatus(s.status || 'idle')).catch(() => { })
        const cleanup = api?.onUpdaterStatus?.((data) => {
            if (data?.status) setStatus(data.status)
            if (data?.info) setInfo(data.info)
        })
        return () => cleanup?.()
    }, [])

    const check = async () => {
        setStatus('checking')
        try {
            const result = await api?.checkForUpdates()
            setStatus(result?.updateAvailable ? 'available' : 'up-to-date')
            if (result?.info) setInfo(result.info)
        } catch { setStatus('error') }
    }

    const download = async () => {
        setStatus('downloading')
        try { await api?.downloadUpdate() } catch { setStatus('error') }
    }

    const install = () => api?.installUpdate()

    return (
        <div className="flex items-center gap-4">
            {status === 'idle' && (
                <button onClick={check} className="flex items-center gap-2 px-4 py-2 text-sm rounded-lg bg-[var(--color-surface-dark)] border border-[var(--color-border-dark)] text-slate-300 hover:text-white hover:border-slate-500 transition-colors">
                    <span className="material-symbols-outlined text-[18px]">system_update</span>
                    {t('settings.checkUpdates')}
                </button>
            )}
            {status === 'checking' && (
                <span className="flex items-center gap-2 text-sm text-slate-400">
                    <span className="material-symbols-outlined text-[18px] animate-spin">sync</span>
                    {t('settings.checking')}
                </span>
            )}
            {status === 'up-to-date' && (
                <span className="flex items-center gap-2 text-sm text-emerald-400">
                    <span className="material-symbols-outlined text-[18px]">check_circle</span>
                    {t('settings.upToDate')}
                    <button onClick={check} className="ml-2 text-xs text-slate-500 hover:text-white">{t('settings.recheck')}</button>
                </span>
            )}
            {status === 'available' && (
                <div className="flex items-center gap-3">
                    <span className="text-sm text-amber-400 flex items-center gap-1">
                        <span className="material-symbols-outlined text-[18px]">update</span>
                        {t('settings.updateAvailable')}{info?.version ? ` (v${info.version})` : ''}
                    </span>
                    <button onClick={download} className="px-3 py-1.5 text-xs rounded-lg bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white font-medium transition-colors">
                        {t('settings.download')}
                    </button>
                </div>
            )}
            {status === 'downloading' && (
                <span className="flex items-center gap-2 text-sm text-blue-400">
                    <span className="material-symbols-outlined text-[18px] animate-spin">downloading</span>
                    {t('settings.downloading')}
                </span>
            )}
            {status === 'ready' && (
                <div className="flex items-center gap-3">
                    <span className="text-sm text-emerald-400">{t('settings.readyInstall')}</span>
                    <button onClick={install} className="px-3 py-1.5 text-xs rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white font-medium transition-colors">
                        {t('settings.installRestart')}
                    </button>
                </div>
            )}
            {status === 'error' && (
                <span className="flex items-center gap-2 text-sm text-red-400">
                    <span className="material-symbols-outlined text-[18px]">error</span>
                    {t('settings.updateFailed')}
                    <button onClick={check} className="ml-2 text-xs text-slate-500 hover:text-white">{t('settings.retry')}</button>
                </span>
            )}
        </div>
    )
}

// ── Diagnostics Panel ───────────────────────────────────────
function DiagnosticsPanel({ t, providers = [], healthStatuses = {}, appInfo }) {
    const [checks, setChecks] = useState([])
    const [running, setRunning] = useState(false)
    const [exporting, setExporting] = useState(false)

    const DIAG_CHECKS = [
        { id: 'node', label: 'Node.js Runtime', icon: 'memory', check: () => ({ ok: !!appInfo?.nodeVersion, detail: `v${appInfo?.nodeVersion || 'N/A'}` }) },
        { id: 'electron', label: 'Electron Framework', icon: 'desktop_windows', check: () => ({ ok: !!appInfo?.electronVersion, detail: `v${appInfo?.electronVersion || 'N/A'}` }) },
        { id: 'python', label: 'Python Environment', icon: 'code', check: async () => { try { const r = await api?.systemCheck('python'); return { ok: r?.ok, detail: r?.version || 'Not found' } } catch { return { ok: false, detail: 'Error' } } } },
        { id: 'askd', label: 'askd Daemon', icon: 'smart_toy', check: () => { const h = healthStatuses._askd; return { ok: h?.status === 'operational', detail: h?.status || 'offline' } } },
        { id: 'maild', label: 'maild Daemon', icon: 'mail', check: () => { const h = healthStatuses._maild; return { ok: h?.status === 'operational', detail: h?.status || 'offline' } } },
        { id: 'providers', label: 'Providers Health', icon: 'dns', check: () => { const online = providers.filter(p => healthStatuses[p.name]?.status === 'operational').length; return { ok: online > 0, detail: `${online}/${providers.length} online` } } },
        { id: 'disk', label: 'Disk Space (~/.ccb)', icon: 'storage', check: async () => { try { const r = await api?.systemCheck('disk'); return { ok: r?.ok, detail: r?.usage || 'N/A' } } catch { return { ok: true, detail: 'OK' } } } },
        { id: 'network', label: 'Network Connectivity', icon: 'wifi', check: async () => { try { await fetch('https://httpbin.org/get', { signal: AbortSignal.timeout(5000) }); return { ok: true, detail: 'Connected' } } catch { return { ok: false, detail: 'Unreachable' } } } },
        { id: 'config', label: 'Configuration Files', icon: 'settings', check: async () => { try { const r = await api?.systemCheck('config'); return { ok: r?.ok !== false, detail: r?.detail || 'OK' } } catch { return { ok: true, detail: 'OK' } } } },
        { id: 'sessions', label: 'Session Storage', icon: 'folder', check: async () => { try { const r = await api?.systemCheck('sessions'); return { ok: r?.ok !== false, detail: r?.count != null ? `${r.count} sessions` : 'OK' } } catch { return { ok: true, detail: 'OK' } } } }
    ]

    const runAll = async () => {
        setRunning(true)
        const results = []
        for (const c of DIAG_CHECKS) {
            try { results.push({ ...c, result: await c.check() }) }
            catch { results.push({ ...c, result: { ok: false, detail: 'Error' } }) }
        }
        setChecks(results)
        setRunning(false)
    }

    const exportDiagnostics = async () => {
        setExporting(true)
        const report = {
            timestamp: new Date().toISOString(),
            app: appInfo,
            checks: checks.map(c => ({ id: c.id, label: c.label, ...c.result })),
            providers: providers.map(p => ({ name: p.name, health: healthStatuses[p.name] }))
        }
        const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url; a.download = `ccb-diagnostics-${Date.now()}.json`; a.click()
        URL.revokeObjectURL(url)
        setExporting(false)
    }

    return (
        <div className="space-y-6">
            <SectionHeader title={t('settings.diagnostics')} desc={t('settings.diagnosticsDesc')} />
            <div className="flex gap-3 mb-4">
                <button onClick={runAll} disabled={running}
                    className="flex items-center gap-2 px-4 py-2 text-sm rounded-lg bg-[var(--color-primary)] text-white font-medium hover:opacity-90 disabled:opacity-50 transition-colors">
                    <span className={`material-symbols-outlined text-[18px] ${running ? 'animate-spin' : ''}`}>{running ? 'progress_activity' : 'play_arrow'}</span>
                    {t('settings.runDiagnostics')}
                </button>
                {checks.length > 0 && (
                    <button onClick={exportDiagnostics} disabled={exporting}
                        className="flex items-center gap-2 px-4 py-2 text-sm rounded-lg bg-white/5 text-slate-300 border border-[var(--color-border-dark)] hover:bg-white/10 transition-colors">
                        <span className="material-symbols-outlined text-[18px]">download</span>
                        {t('settings.exportDiagnostics')}
                    </button>
                )}
            </div>

            <div className="space-y-2">
                {(checks.length > 0 ? checks : DIAG_CHECKS.map(c => ({ ...c, result: null }))).map(c => (
                    <div key={c.id} className="bg-[var(--color-surface-dark)] border border-[var(--color-border-dark)] rounded-xl p-4 flex items-center gap-4">
                        <span className={`material-symbols-outlined text-[20px] ${c.result ? (c.result.ok ? 'text-emerald-500' : 'text-red-500') : 'text-slate-500'}`}>
                            {c.result ? (c.result.ok ? 'check_circle' : 'error') : c.icon}
                        </span>
                        <div className="flex-1">
                            <p className="text-white text-sm font-medium">{c.label}</p>
                            {c.result && <p className={`text-xs mt-0.5 ${c.result.ok ? 'text-slate-400' : 'text-red-400'}`}>{c.result.detail}</p>}
                        </div>
                        {c.result && (
                            <span className={`text-[10px] px-2 py-0.5 rounded-full border ${c.result.ok ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' : 'bg-red-500/10 text-red-500 border-red-500/20'}`}>
                                {c.result.ok ? 'PASS' : 'FAIL'}
                            </span>
                        )}
                    </div>
                ))}
            </div>
        </div>
    )
}

// ── 主组件 ───────────────────────────────────────────────────

export default function Settings() {
    const [active, setActive] = useState('appearance')
    const [searchQuery, setSearchQuery] = useState('')
    // 使用稳定选择器
    const settings = useAppStore(s => s.settings)
    const providers = useAppStore(s => s.providers)
    const healthStatuses = useAppStore(s => s.healthStatuses)

    // Section 数据
    const [shortcuts, setShortcuts] = useState({})
    const [terminalCfg, setTerminalCfg] = useState({})
    const [providerDefaults, setProviderDefaults] = useState({})
    const [askdCfg, setAskdCfg] = useState({})
    const [mailCfg, setMailCfg] = useState({})
    const [editingShortcut, setEditingShortcut] = useState(null)
    const [providerAction, setProviderAction] = useState(null)
    const [appInfo, setAppInfo] = useState(null)
    const { t, i18n } = useTranslation()

    // B12: 加载 App Info
    useEffect(() => {
        api?.getAppInfo?.().then(info => info && setAppInfo(info)).catch(() => { })
    }, [])

    // 搜索过滤 section
    const filteredSections = sectionKeys.filter(s => {
        if (!searchQuery) return true
        const q = searchQuery.toLowerCase()
        return s.id.includes(q) || t(s.labelKey).toLowerCase().includes(q)
    })

    useEffect(() => { useAppStore.getState().fetchSettings() }, [])

    // 切换 section 时加载对应数据
    useEffect(() => {
        if (!api?.getSettingsSection) return
        const loaders = {
            shortcuts: async () => {
                const data = api.getShortcuts ? await api.getShortcuts() : await api.getSettingsSection('shortcuts')
                setShortcuts(data || {})
            },
            terminal: async () => {
                const data = await api.getSettingsSection('terminal')
                setTerminalCfg(data || {})
            },
            provider: async () => {
                const data = await api.getSettingsSection('providerDefaults')
                setProviderDefaults(data || {})
                useAppStore.getState().fetchProviders()
                useAppStore.getState().fetchHealth()
            },
            askd: async () => {
                const data = await api.getSettingsSection('askd')
                setAskdCfg(data || {})
            },
            mail: async () => {
                const data = await api.getSettingsSection('mail')
                setMailCfg(data || {})
            }
        }
        if (loaders[active]) loaders[active]().catch(console.error)
    }, [active])

    // 更新 section 配置
    const updateSection = async (section, key, value) => {
        if (!api?.updateSettingsSection) return
        try {
            await api.updateSettingsSection(section, { [key]: value })
            // 本地同步
            const setters = { terminal: setTerminalCfg, providerDefaults: setProviderDefaults, askd: setAskdCfg, mail: setMailCfg }
            setters[section]?.(prev => ({ ...prev, [key]: value }))
        } catch (err) {
            console.error(`Failed to update ${section}.${key}:`, err)
        }
    }

    const resetSection = async (section) => {
        if (!api?.resetSettingsSection) return
        try {
            await api.resetSettingsSection(section)
            const data = await api.getSettingsSection(section)
            const setters = { shortcuts: setShortcuts, terminal: setTerminalCfg, providerDefaults: setProviderDefaults, askd: setAskdCfg, mail: setMailCfg }
            setters[section]?.(data || {})
            useToastStore.getState().success(i18n.t('toast.sectionReset', { section }))
        } catch (err) {
            console.error(`Failed to reset ${section}:`, err)
        }
    }

    // 快捷键录入
    const handleShortcutRecord = (key) => {
        setEditingShortcut(key)
        const handler = (e) => {
            e.preventDefault()
            e.stopPropagation()
            const parts = []
            if (e.metaKey || e.ctrlKey) parts.push('CmdOrCtrl')
            if (e.shiftKey) parts.push('Shift')
            if (e.altKey) parts.push('Alt')
            if (e.key && !['Meta', 'Control', 'Shift', 'Alt'].includes(e.key)) {
                parts.push(e.key.length === 1 ? e.key.toUpperCase() : e.key)
            }
            if (parts.length > 1) {
                const combo = parts.join('+')
                setShortcuts(prev => ({ ...prev, [key]: combo }))
                api?.setShortcut?.(key, combo)
                setEditingShortcut(null)
                window.removeEventListener('keydown', handler, true)
            }
        }
        window.addEventListener('keydown', handler, true)
        // 超时取消
        setTimeout(() => {
            setEditingShortcut(null)
            window.removeEventListener('keydown', handler, true)
        }, 5000)
    }

    // Provider 操作
    const handleProviderAction = async (name, action) => {
        setProviderAction(`${name}:${action}`)
        try {
            if (action === 'start') await useAppStore.getState().startProvider(name)
            else if (action === 'stop') await useAppStore.getState().stopProvider(name)
            else if (action === 'restart') await useAppStore.getState().restartProvider(name)
            await useAppStore.getState().fetchHealth()
        } catch (err) {
            console.error(`Provider ${action} failed:`, err)
        }
        setProviderAction(null)
    }

    // Appearance handlers
    const handleThemeChange = (theme) => { useAppStore.getState().updateSetting('theme', theme); useAppStore.getState().applyTheme(theme) }
    const handleAccentChange = (color) => useAppStore.getState().updateSetting('accentColor', color)
    const handleScaleChange = (delta) => {
        const newScale = Math.max(75, Math.min(150, settings.interfaceScale + delta))
        useAppStore.getState().updateSetting('interfaceScale', newScale)
        useAppStore.getState().applyScale(newScale)
    }
    const handleLangChange = (lang) => { i18n.changeLanguage(lang); useAppStore.getState().updateSetting('language', lang) }
    const handleToggle = (key, value) => {
        useAppStore.getState().updateSetting(key, value)
        if (key === 'launchAtLogin') useAppStore.getState().syncLoginSettings(value)
    }

    const accentColors = [
        { value: '#135bec', class: 'bg-blue-500' },
        { value: '#8b5cf6', class: 'bg-purple-500' },
        { value: '#d946ef', class: 'bg-fuchsia-500' },
        { value: '#f43f5e', class: 'bg-rose-500' },
        { value: '#f97316', class: 'bg-orange-500' },
        { value: '#eab308', class: 'bg-yellow-500' },
        { value: '#10b981', class: 'bg-emerald-500' },
        { value: '#94a3b8', class: 'bg-slate-400' }
    ]

    return (
        <div className="flex h-full overflow-hidden">
            {/* 左侧导航 */}
            <aside className="w-52 shrink-0 border-r border-[var(--color-border-dark)] bg-[var(--color-surface-darker)] flex flex-col">
                <div className="p-4">
                    <div className="relative">
                        <input
                            className="w-full bg-[var(--color-surface-dark)] border border-[var(--color-border-dark)] text-slate-300 text-xs rounded-lg pl-8 pr-3 py-2 outline-none focus:ring-1 focus:ring-[var(--color-primary)] placeholder-slate-500"
                            placeholder={t('nav.search')}
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                        <span className="material-symbols-outlined absolute left-2.5 top-2 text-slate-500 text-[14px]">search</span>
                        {searchQuery && (
                            <button onClick={() => setSearchQuery('')} className="absolute right-2 top-2 text-slate-500 hover:text-white">
                                <span className="material-symbols-outlined text-[14px]">close</span>
                            </button>
                        )}
                    </div>
                </div>
                <nav className="flex-1 px-2 space-y-0.5">
                    {filteredSections.map((s) => (
                        <button
                            key={s.id}
                            onClick={() => setActive(s.id)}
                            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${active === s.id ? 'bg-[var(--color-primary)]/10 text-[var(--color-primary)] font-medium' : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'}`}
                        >
                            <span className="material-symbols-outlined text-[18px]">{s.icon}</span>
                            {t(s.labelKey)}
                        </button>
                    ))}
                    {filteredSections.length === 0 && (
                        <p className="text-slate-600 text-xs text-center py-4">{t('settings.noMatch')}</p>
                    )}
                </nav>
                <div className="p-4 border-t border-[var(--color-border-dark)]">
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                        <span className="size-2 rounded-full bg-emerald-500" />
                        {appInfo ? `${appInfo.name || 'CCB Desktop'} v${appInfo.version || '0.1.0'}` : 'CCB Desktop v0.1.0'}
                    </div>
                    {appInfo && (
                        <div className="mt-1 text-[9px] text-slate-600 space-y-0.5">
                            <p>Electron {appInfo.electronVersion} · Node {appInfo.nodeVersion}</p>
                            <p>{appInfo.platform} {appInfo.arch}</p>
                        </div>
                    )}
                </div>
            </aside>

            {/* 右侧内容区 */}
            <div className="flex-1 overflow-y-auto p-8">

                {/* ═══ Appearance ═══ */}
                {active === 'appearance' && (
                    <div className="space-y-8">
                        <SectionHeader title={t('settings.appearance')} desc={t('settings.title')} />
                        <div>
                            <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-4">{t('settings.theme')}</h3>
                            <div className="grid grid-cols-3 gap-4">
                                {['light', 'dark', 'auto'].map((theme) => (
                                    <button key={theme} onClick={() => handleThemeChange(theme)} className={`rounded-xl border-2 p-1 transition-all ${settings.theme === theme ? 'border-[var(--color-primary)]' : 'border-[var(--color-border-dark)] hover:border-slate-600'}`}>
                                        <div className={`h-24 rounded-lg ${theme === 'light' ? 'bg-slate-200' : theme === 'dark' ? 'bg-slate-800' : 'bg-gradient-to-br from-slate-200 to-slate-800'}`} />
                                        <p className="text-xs text-slate-300 mt-2 text-center capitalize">{t(`settings.theme${theme.charAt(0).toUpperCase() + theme.slice(1)}`)}</p>
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div>
                            <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-4">{t('settings.accentColor')}</h3>
                            <div className="flex gap-3">
                                {accentColors.map((c) => (
                                    <button key={c.value} onClick={() => handleAccentChange(c.value)} className={`size-9 rounded-full ${c.class} transition-all ${settings.accentColor === c.value ? 'ring-2 ring-offset-2 ring-offset-[var(--color-bg-dark)] ring-white/50' : 'hover:ring-2 hover:ring-offset-2 hover:ring-offset-[var(--color-bg-dark)] hover:ring-white/30'}`} />
                                ))}
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-8">
                            <div>
                                <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-4">{t('settings.scale')}</h3>
                                <div className="flex items-center gap-2 bg-[var(--color-surface-dark)] border border-[var(--color-border-dark)] rounded-lg p-1">
                                    <button onClick={() => handleScaleChange(-5)} className="px-3 py-1.5 text-xs text-slate-400 hover:text-white">A-</button>
                                    <span className="text-sm text-white font-medium flex-1 text-center">{settings.interfaceScale}%</span>
                                    <button onClick={() => handleScaleChange(5)} className="px-3 py-1.5 text-xs text-slate-400 hover:text-white">A+</button>
                                </div>
                            </div>
                            <div>
                                <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-4">{t('settings.language')}</h3>
                                <select value={settings.language} onChange={(e) => handleLangChange(e.target.value)} className="w-full bg-[var(--color-surface-dark)] border border-[var(--color-border-dark)] text-slate-300 text-sm rounded-lg px-3 py-2 outline-none focus:ring-1 focus:ring-[var(--color-primary)]">
                                    <option value="en">English (US)</option>
                                    <option value="zh">中文 (简体)</option>
                                </select>
                            </div>
                        </div>
                        <div>
                            <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-4">{t('settings.terminalScheme')}</h3>
                            <div className="grid grid-cols-2 gap-4">
                                {[{ key: 'classic', labelKey: 'settings.classic', desc: t('terminal.schemeA') }, { key: 'block', labelKey: 'settings.block', desc: t('terminal.schemeB') }].map((scheme) => (
                                    <button key={scheme.key} onClick={() => useAppStore.getState().updateSetting('terminalScheme', scheme.key)} className={`p-4 rounded-xl border-2 text-left transition-all ${settings.terminalScheme === scheme.key ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/5' : 'border-[var(--color-border-dark)] hover:border-slate-600'}`}>
                                        <p className="text-white text-sm font-medium">{t(scheme.labelKey)}</p>
                                        <p className="text-slate-500 text-xs mt-1">{scheme.desc}</p>
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {/* ═══ General ═══ */}
                {active === 'general' && (
                    <div className="space-y-4">
                        <SectionHeader title={t('settings.general')} />
                        {[
                            { key: 'closeToTray', labelKey: 'settings.closeToTray', descKey: 'settings.closeToTrayDesc' },
                            { key: 'launchAtLogin', labelKey: 'settings.launchAtLogin', descKey: 'settings.launchAtLoginDesc' },
                            { key: 'enableSmartClipboard', labelKey: 'settings.smartClipboard', descKey: 'settings.smartClipboardDesc' },
                            { key: 'enableNotifications', labelKey: 'settings.notifications', descKey: 'settings.notificationsDesc' }
                        ].map((item) => (
                            <ToggleRow key={item.key} label={t(item.labelKey)} desc={t(item.descKey)} value={settings[item.key]} onChange={(v) => handleToggle(item.key, v)} />
                        ))}

                        {/* B8: Data Export/Import */}
                        <div className="mt-6 pt-6 border-t border-[var(--color-border-dark)]">
                            <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-4">{t('settings.dataManagement')}</h3>
                            <div className="flex gap-3">
                                <button
                                    onClick={async () => {
                                        if (!api?.dataExport) return
                                        try {
                                            const { data } = await api.dataExport()
                                            const blob = new Blob([data], { type: 'application/json' })
                                            const url = URL.createObjectURL(blob)
                                            const a = document.createElement('a')
                                            a.href = url
                                            a.download = `ccb-backup-${Date.now()}.json`
                                            a.click()
                                            URL.revokeObjectURL(url)
                                            useToastStore.getState().success(i18n.t('toast.dataExported'))
                                        } catch (err) {
                                            useToastStore.getState().error(i18n.t('toast.exportFailed', { error: err.message }))
                                        }
                                    }}
                                    className="flex items-center gap-2 px-4 py-2 text-sm rounded-lg bg-[var(--color-surface-dark)] border border-[var(--color-border-dark)] text-slate-300 hover:text-white hover:border-slate-500 transition-colors"
                                >
                                    <span className="material-symbols-outlined text-[18px]">download</span>
                                    {t('settings.exportAll')}
                                </button>
                                <label className="flex items-center gap-2 px-4 py-2 text-sm rounded-lg bg-[var(--color-surface-dark)] border border-[var(--color-border-dark)] text-slate-300 hover:text-white hover:border-slate-500 transition-colors cursor-pointer">
                                    <span className="material-symbols-outlined text-[18px]">upload</span>
                                    {t('settings.importData')}
                                    <input type="file" accept=".json" className="hidden" onChange={async (e) => {
                                        const file = e.target.files?.[0]
                                        if (!file || !api?.dataImport) return
                                        try {
                                            const text = await file.text()
                                            const result = await api.dataImport(text)
                                            useToastStore.getState().success(i18n.t('toast.importSuccess', { count: result.sessionsRestored || 0 }))
                                        } catch (err) {
                                            useToastStore.getState().error(i18n.t('toast.importFailed', { error: err.message }))
                                        }
                                    }} />
                                </label>
                            </div>
                        </div>

                        {/* Auto-Updater */}
                        <div className="mt-6 pt-6 border-t border-[var(--color-border-dark)]">
                            <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-4">{t('settings.softwareUpdate')}</h3>
                            <UpdateChecker />
                        </div>
                    </div>
                )}

                {/* ═══ Shortcuts ═══ */}
                {active === 'shortcuts' && (
                    <div className="space-y-4">
                        <SectionHeader title={t('settings.shortcuts')} desc={t('settings.shortcutsDesc')} onReset={() => resetSection('shortcuts')} />
                        {SHORTCUT_META.map(s => (
                            <div key={s.key} className="flex items-center justify-between py-3 border-b border-[var(--color-border-dark)]/50">
                                <div className="flex items-center gap-3">
                                    <span className="material-symbols-outlined text-[18px] text-slate-500">{s.icon}</span>
                                    <p className="text-white text-sm font-medium">{t(s.labelKey)}</p>
                                </div>
                                <button
                                    onClick={() => handleShortcutRecord(s.key)}
                                    className={`px-3 py-1.5 text-xs rounded-lg font-mono transition-all ${editingShortcut === s.key
                                        ? 'bg-[var(--color-primary)]/20 text-[var(--color-primary)] border border-[var(--color-primary)] animate-pulse'
                                        : 'bg-[var(--color-surface-dark)] text-slate-300 border border-[var(--color-border-dark)] hover:border-slate-500'}`}
                                >
                                    {editingShortcut === s.key ? t('settings.recording') : (shortcuts[s.key] || '—')}
                                </button>
                            </div>
                        ))}
                    </div>
                )}

                {/* ═══ Terminal ═══ */}
                {active === 'terminal' && (
                    <div className="space-y-4">
                        <SectionHeader title={t('terminal.title')} onReset={() => resetSection('terminal')} />
                        <NumberRow label={t('settings.termFontSize')} value={terminalCfg.fontSize} onChange={(v) => updateSection('terminal', 'fontSize', v)} min={8} max={28} unit="px" />
                        <TextRow label={t('settings.termFontFamily')} value={terminalCfg.fontFamily} onChange={(v) => updateSection('terminal', 'fontFamily', v)} placeholder="monospace" />
                        <SelectRow label={t('settings.termCursorStyle')} value={terminalCfg.cursorStyle} onChange={(v) => updateSection('terminal', 'cursorStyle', v)} options={[
                            { value: 'block', label: t('settings.termCursorBlock') },
                            { value: 'underline', label: t('settings.termCursorUnderline') },
                            { value: 'bar', label: t('settings.termCursorBar') }
                        ]} />
                        <ToggleRow label={t('settings.termCursorBlink')} value={terminalCfg.cursorBlink} onChange={(v) => updateSection('terminal', 'cursorBlink', v)} />
                        <NumberRow label={t('settings.termScrollback')} desc={t('settings.termScrollbackDesc')} value={terminalCfg.scrollback} onChange={(v) => updateSection('terminal', 'scrollback', v)} min={100} max={100000} step={100} unit={t('settings.lines')} />
                        <ToggleRow label={t('settings.termCopyOnSelect')} desc={t('settings.termCopyOnSelectDesc')} value={terminalCfg.copyOnSelect} onChange={(v) => updateSection('terminal', 'copyOnSelect', v)} />
                        <ToggleRow label={t('settings.termRightClickPaste')} value={terminalCfg.rightClickPaste} onChange={(v) => updateSection('terminal', 'rightClickPaste', v)} />
                        <ToggleRow label={t('settings.termBellSound')} value={terminalCfg.bellSound} onChange={(v) => updateSection('terminal', 'bellSound', v)} />
                    </div>
                )}

                {/* ═══ Provider Defaults ═══ */}
                {active === 'provider' && (
                    <div className="space-y-6">
                        <SectionHeader title={t('settings.providerDefaults')} desc={t('settings.providerDefaultsDesc')} onReset={() => resetSection('providerDefaults')} />

                        {/* Global Defaults */}
                        <div className="space-y-2">
                            <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-3">{t('settings.globalDefaults')}</h3>
                            <ToggleRow label={t('settings.autoRestart')} desc={t('settings.autoRestartDesc')} value={providerDefaults.autoRestart} onChange={(v) => updateSection('providerDefaults', 'autoRestart', v)} />
                            <NumberRow label={t('settings.healthCheckInterval')} value={providerDefaults.healthCheckInterval} onChange={(v) => updateSection('providerDefaults', 'healthCheckInterval', v)} min={5} max={300} unit="sec" />
                            <NumberRow label={t('settings.maxRetries')} value={providerDefaults.maxRetries} onChange={(v) => updateSection('providerDefaults', 'maxRetries', v)} min={0} max={10} />
                            <NumberRow label={t('settings.timeout')} value={providerDefaults.timeoutMs} onChange={(v) => updateSection('providerDefaults', 'timeoutMs', v)} min={1000} max={120000} step={1000} unit="ms" />
                            <SelectRow label={t('settings.logLevel')} value={providerDefaults.logLevel} onChange={(v) => updateSection('providerDefaults', 'logLevel', v)} options={[
                                { value: 'debug', label: t('settings.logDebug') },
                                { value: 'info', label: t('settings.logInfo') },
                                { value: 'warn', label: t('settings.logWarn') },
                                { value: 'error', label: t('settings.logError') }
                            ]} />
                        </div>

                        {/* Provider Control */}
                        <div>
                            <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-3">{t('settings.providerControl')}</h3>
                            <div className="space-y-2">
                                {providers.map(p => {
                                    const health = healthStatuses[p.name] || {}
                                    const isOnline = health.status === 'operational'
                                    const isActing = providerAction?.startsWith(p.name)
                                    return (
                                        <div key={p.name} className="flex items-center justify-between bg-[var(--color-surface-dark)] border border-[var(--color-border-dark)] rounded-xl p-4">
                                            <div className="flex items-center gap-3">
                                                <span className={`size-2.5 rounded-full ${isOnline ? 'bg-emerald-500' : 'bg-red-500'}`} />
                                                <div>
                                                    <p className="text-white text-sm font-medium">{p.label || p.name}</p>
                                                    <p className="text-slate-500 text-xs">{health.status || 'unknown'} {health.pid ? `• PID ${health.pid}` : ''}</p>
                                                </div>
                                            </div>
                                            <div className="flex gap-2">
                                                {!isOnline && (
                                                    <button onClick={() => handleProviderAction(p.name, 'start')} disabled={isActing} className="px-3 py-1 text-xs rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 disabled:opacity-50 transition-colors">
                                                        {isActing ? '...' : t('settings.start')}
                                                    </button>
                                                )}
                                                {isOnline && (
                                                    <>
                                                        <button onClick={() => handleProviderAction(p.name, 'restart')} disabled={isActing} className="px-3 py-1 text-xs rounded-lg bg-orange-500/10 text-orange-400 border border-orange-500/20 hover:bg-orange-500/20 disabled:opacity-50 transition-colors">
                                                            {t('settings.restart')}
                                                        </button>
                                                        <button onClick={() => handleProviderAction(p.name, 'stop')} disabled={isActing} className="px-3 py-1 text-xs rounded-lg bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 disabled:opacity-50 transition-colors">
                                                            {t('settings.stop')}
                                                        </button>
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    </div>
                )}

                {/* ═══ Askd ═══ */}
                {active === 'askd' && (
                    <div className="space-y-4">
                        <SectionHeader title={t('settings.askd')} desc={t('settings.askdDesc')} onReset={() => resetSection('askd')} />
                        <TextRow label={t('settings.askdHost')} value={askdCfg.host} onChange={(v) => updateSection('askd', 'host', v)} placeholder="127.0.0.1" />
                        <NumberRow label={t('settings.askdPort')} value={askdCfg.port} onChange={(v) => updateSection('askd', 'port', v)} min={1} max={65535} />
                        <ToggleRow label={t('settings.askdAutoStart')} desc={t('settings.askdAutoStartDesc')} value={askdCfg.autoStart} onChange={(v) => updateSection('askd', 'autoStart', v)} />
                        <NumberRow label={t('settings.askdTimeout')} value={askdCfg.timeoutMs} onChange={(v) => updateSection('askd', 'timeoutMs', v)} min={1000} max={120000} step={1000} unit="ms" />
                        <NumberRow label={t('settings.askdMaxConcurrent')} desc={t('settings.askdMaxConcurrentDesc')} value={askdCfg.maxConcurrent} onChange={(v) => updateSection('askd', 'maxConcurrent', v)} min={1} max={20} />
                        <NumberRow label={t('settings.askdStreamChunk')} value={askdCfg.streamChunkMs} onChange={(v) => updateSection('askd', 'streamChunkMs', v)} min={10} max={1000} unit="ms" />
                        <ProviderTagSelect label={t('settings.askdDefaultProvider')} value={askdCfg.defaultProvider} onChange={(v) => updateSection('askd', 'defaultProvider', v)} />
                        {/* B7: Apply Config 按钮 */}
                        <div className="pt-4 border-t border-[var(--color-border-dark)]">
                            <button
                                onClick={async () => {
                                    if (!api?.applyAskdConfig) return
                                    try {
                                        await api.applyAskdConfig(askdCfg)
                                        useToastStore.getState().success(i18n.t('toast.askdApplied'))
                                    } catch (err) {
                                        useToastStore.getState().error(i18n.t('toast.applyFailed', { error: err.message }))
                                    }
                                }}
                                className="flex items-center gap-2 px-4 py-2 text-sm rounded-lg bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white font-medium transition-colors"
                            >
                                <span className="material-symbols-outlined text-[18px]">play_arrow</span>
                                {t('settings.applyRestart')}
                            </button>
                        </div>
                    </div>
                )}

                {/* ═══ Mail ═══ */}
                {active === 'mail' && (
                    <div className="space-y-4">
                        <SectionHeader title={t('mail.title')} onReset={() => resetSection('mail')} />
                        <ToggleRow label={t('common.enabled')} value={mailCfg.enabled} onChange={(v) => updateSection('mail', 'enabled', v)} />
                        <TextRow label={t('mail.serviceEmail')} value={mailCfg.serviceEmail} onChange={(v) => updateSection('mail', 'serviceEmail', v)} placeholder="bot@example.com" />
                        <ProviderTagSelect label={t('mail.defaultProvider')} value={mailCfg.defaultProvider} onChange={(v) => updateSection('mail', 'defaultProvider', v)} />
                        <NumberRow label={t('mail.pollInterval')} value={mailCfg.pollIntervalMs} onChange={(v) => updateSection('mail', 'pollIntervalMs', v)} min={5000} max={300000} step={5000} unit="ms" />
                        <SelectRow label={t('mail.notifyMode')} value={mailCfg.notifyMode} onChange={(v) => updateSection('mail', 'notifyMode', v)} options={[
                            { value: 'on_completion', label: t('mail.onCompletion') },
                            { value: 'realtime', label: t('mail.realtime') },
                            { value: 'periodic', label: t('mail.periodic') },
                            { value: 'on_request', label: t('mail.onRequest') }
                        ]} />
                        <ToggleRow label={t('settings.mailAutoProcess')} desc={t('settings.mailAutoProcessDesc')} value={mailCfg.autoProcessTokens} onChange={(v) => updateSection('mail', 'autoProcessTokens', v)} />
                        <NumberRow label={t('settings.mailMaxThreads')} value={mailCfg.maxThreads} onChange={(v) => updateSection('mail', 'maxThreads', v)} min={1} max={50} />
                    </div>
                )}

                {/* ═══ Diagnostics ═══ */}
                {active === 'diagnostics' && (
                    <DiagnosticsPanel t={t} providers={providers} healthStatuses={healthStatuses} appInfo={appInfo} />
                )}
            </div>
        </div>
    )
}
