import { useEffect, useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useAppStore } from '../store'

const STATUS_STYLES = {
    operational: { badge: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20', dot: 'bg-emerald-500' },
    degraded: { badge: 'bg-orange-500/10 text-orange-500 border-orange-500/20', dot: 'bg-orange-500' },
    offline: { badge: 'bg-red-500/10 text-red-500 border-red-500/20', dot: 'bg-red-500' },
    unknown: { badge: 'bg-slate-500/10 text-slate-500 border-slate-500/20', dot: 'bg-slate-500' }
}

const PROVIDER_ICONS = {
    claude: { icon: 'psychology', gradient: 'from-orange-500 to-amber-600' },
    codex: { icon: 'code', gradient: 'from-blue-500 to-cyan-600' },
    gemini: { icon: 'auto_awesome', gradient: 'from-purple-500 to-violet-600' },
    opencode: { icon: 'memory', gradient: 'from-cyan-500 to-teal-600' },
    droid: { icon: 'smart_toy', gradient: 'from-emerald-500 to-green-600' }
}

// ── Inspector 详情抽屉 ──────────────────────────────────────
function InspectorDrawer({ provider, health, onClose, onPing, onStart, onStop, onRestart, pinging, t }) {
    const [paneContent, setPaneContent] = useState(null)
    const [paneLoading, setPaneLoading] = useState(false)
    const [logLines, setLogLines] = useState([])
    const [logLoading, setLogLoading] = useState(false)
    const [activeTab, setActiveTab] = useState('overview') // overview | pane | log | config

    const api = typeof window !== 'undefined' ? window.electronAPI : null
    const pi = PROVIDER_ICONS[provider.name] || { icon: 'smart_toy', gradient: 'from-slate-500 to-slate-600' }
    const status = health?.status || 'unknown'
    const s = STATUS_STYLES[status] || STATUS_STYLES.unknown

    // 获取 Pane 内容
    const fetchPane = useCallback(async () => {
        if (!api?.capturePane) return
        setPaneLoading(true)
        try {
            const result = await api.capturePane(provider.name)
            setPaneContent(result?.content || 'No pane content available')
        } catch {
            setPaneContent('Failed to capture pane')
        }
        setPaneLoading(false)
    }, [api, provider.name])

    // 获取日志
    const fetchLog = useCallback(async () => {
        setLogLoading(true)
        try {
            const result = await api?.getProviderLog(provider.name, 100)
            setLogLines(result?.lines || ['No log available'])
        } catch {
            setLogLines(['Failed to load log'])
        }
        setLogLoading(false)
    }, [api, provider.name])

    useEffect(() => {
        if (activeTab === 'pane') fetchPane()
        if (activeTab === 'log') fetchLog()
    }, [activeTab, fetchPane, fetchLog])

    const tabs = [
        { id: 'overview', label: t('providers.overview'), icon: 'dashboard' },
        { id: 'pane', label: t('providers.panePreview'), icon: 'preview' },
        { id: 'log', label: t('common.log'), icon: 'description' },
        { id: 'config', label: t('providers.config'), icon: 'tune' }
    ]

    return (
        <div className="w-[420px] shrink-0 border-l border-[var(--color-border-dark)] bg-[var(--color-surface-dark)] flex flex-col animate-slide-in-right overflow-hidden">
            {/* Header */}
            <div className="p-4 border-b border-[var(--color-border-dark)] bg-[var(--color-surface-darker)]/50">
                <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                        <div className={`size-12 rounded-xl bg-gradient-to-br ${pi.gradient} flex items-center justify-center shadow-lg`}>
                            <span className="material-symbols-outlined text-white text-[24px]">{pi.icon}</span>
                        </div>
                        <div>
                            <h3 className="text-white text-base font-bold">{provider.label || provider.name}</h3>
                            <p className="text-slate-500 text-xs uppercase tracking-wider">{provider.daemonKey || provider.name}</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-white/5 transition-colors">
                        <span className="material-symbols-outlined text-[20px]">close</span>
                    </button>
                </div>

                {/* 状态 + 操作 */}
                <div className="flex items-center gap-2">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full border ${s.badge}`}>{status}</span>
                    {health?.pid && <span className="text-[10px] text-slate-500 font-mono">PID {health.pid}</span>}
                    <div className="flex-1" />
                    <button onClick={() => onPing(provider.name)} disabled={pinging} className="px-2.5 py-1 text-[10px] rounded-lg bg-[var(--color-primary)]/10 text-[var(--color-primary)] hover:bg-[var(--color-primary)]/20 transition-colors flex items-center gap-1 disabled:opacity-50">
                        <span className={`material-symbols-outlined text-[12px] ${pinging ? 'animate-spin' : ''}`}>{pinging ? 'sync' : 'network_ping'}</span>
                        Ping
                    </button>
                    {status === 'offline' ? (
                        <button onClick={() => onStart(provider.name)} className="px-2.5 py-1 text-[10px] rounded-lg bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20 transition-colors">Start</button>
                    ) : (
                        <button onClick={() => onRestart(provider.name)} className="px-2.5 py-1 text-[10px] rounded-lg bg-orange-500/10 text-orange-500 hover:bg-orange-500/20 transition-colors">Restart</button>
                    )}
                </div>
            </div>

            {/* Tab 切换 */}
            <div className="flex border-b border-[var(--color-border-dark)]">
                {tabs.map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`flex-1 py-2.5 text-[11px] font-medium flex items-center justify-center gap-1 transition-colors border-b-2 ${activeTab === tab.id
                            ? 'text-[var(--color-primary)] border-[var(--color-primary)]'
                            : 'text-slate-500 border-transparent hover:text-slate-300'}`}
                    >
                        <span className="material-symbols-outlined text-[14px]">{tab.icon}</span>
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Tab 内容 */}
            <div className="flex-1 overflow-y-auto p-4 custom-thin-scrollbar">
                {activeTab === 'overview' && (
                    <div className="space-y-4 animate-fade-in">
                        {/* 指标网格 */}
                        <div className="grid grid-cols-2 gap-3">
                            {[
                                { label: t('providers.latency'), value: health?.latency || '--', icon: 'speed' },
                                { label: 'Uptime', value: health?.uptime || '--', icon: 'schedule' },
                                { label: 'Port', value: health?.port || '--', icon: 'lan' },
                                { label: t('providers.status'), value: status, icon: 'monitor_heart' }
                            ].map(m => (
                                <div key={m.label} className="bg-[var(--color-surface-darker)] rounded-lg p-3 border border-[var(--color-border-dark)]">
                                    <div className="flex items-center gap-1.5 mb-1">
                                        <span className="material-symbols-outlined text-slate-500 text-[14px]">{m.icon}</span>
                                        <p className="text-[10px] text-slate-500 uppercase tracking-wider">{m.label}</p>
                                    </div>
                                    <p className="text-white font-semibold text-sm">{m.value}</p>
                                </div>
                            ))}
                        </div>

                        {/* Sparkline 区域 */}
                        <div className="bg-[var(--color-surface-darker)] rounded-lg p-3 border border-[var(--color-border-dark)]">
                            <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-2">{t('providers.responseTrend')}</p>
                            <svg width="100%" height="48" className="overflow-visible">
                                <polyline
                                    fill="none"
                                    points={Array.from({ length: 20 }, (_, i) => {
                                        const x = (i / 19) * 360
                                        const y = 24 + Math.sin(i * 0.5 + Date.now() / 1000) * 15
                                        return `${x},${y}`
                                    }).join(' ')}
                                    stroke={status === 'operational' ? '#10b981' : '#64748b'}
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                />
                            </svg>
                        </div>

                        {/* Worker 状态 */}
                        <div>
                            <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-2">{t('providers.workerQueue')}</p>
                            <div className="space-y-1.5">
                                {['idle', 'processing', 'idle'].map((ws, i) => (
                                    <div key={i} className="flex items-center gap-2 px-3 py-2 bg-[var(--color-surface-darker)] rounded-lg border border-[var(--color-border-dark)]">
                                        <span className={`size-2 rounded-full ${ws === 'processing' ? 'bg-blue-400 animate-pulse' : 'bg-emerald-500'}`} />
                                        <span className="text-xs text-slate-300">Worker #{i + 1}</span>
                                        <span className="flex-1" />
                                        <span className={`text-[10px] ${ws === 'processing' ? 'text-blue-400' : 'text-slate-500'}`}>{ws}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'pane' && (
                    <div className="animate-fade-in">
                        <div className="flex items-center justify-between mb-2">
                            <p className="text-xs text-slate-400">{t('providers.panePreview')}</p>
                            <button onClick={fetchPane} className="text-xs text-[var(--color-primary)] hover:text-blue-400 flex items-center gap-1">
                                <span className={`material-symbols-outlined text-[12px] ${paneLoading ? 'animate-spin' : ''}`}>refresh</span>
                                {t('common.refresh')}
                            </button>
                        </div>
                        <div className="bg-black rounded-lg p-3 font-mono text-[11px] text-green-400 leading-relaxed min-h-[200px] border border-slate-800">
                            {paneLoading ? (
                                <div className="animate-pulse space-y-1">
                                    {[1, 2, 3, 4].map(i => <div key={i} className="h-3 bg-slate-800 rounded w-full" />)}
                                </div>
                            ) : (
                                <pre className="whitespace-pre-wrap break-all">{paneContent || 'Click refresh to capture pane'}</pre>
                            )}
                        </div>
                    </div>
                )}

                {activeTab === 'log' && (
                    <div className="animate-fade-in">
                        <div className="flex items-center justify-between mb-2">
                            <p className="text-xs text-slate-400">{t('common.log')}</p>
                            <button onClick={fetchLog} className="text-xs text-[var(--color-primary)] hover:text-blue-400 flex items-center gap-1">
                                <span className={`material-symbols-outlined text-[12px] ${logLoading ? 'animate-spin' : ''}`}>refresh</span>
                                {t('common.refresh')}
                            </button>
                        </div>
                        <div className="bg-[#0d1117] rounded-lg p-3 font-mono text-[10px] text-slate-300 leading-relaxed min-h-[200px] max-h-[400px] overflow-y-auto border border-slate-800 custom-thin-scrollbar">
                            {logLoading ? (
                                <div className="animate-pulse space-y-1">
                                    {[1, 2, 3, 4, 5].map(i => <div key={i} className="h-2.5 bg-slate-800 rounded w-full" />)}
                                </div>
                            ) : (
                                <pre className="whitespace-pre-wrap break-all">{logLines.join('\n')}</pre>
                            )}
                        </div>
                    </div>
                )}

                {activeTab === 'config' && (
                    <div className="space-y-4 animate-fade-in">
                        <p className="text-[10px] text-slate-500 uppercase tracking-wider">{t('providers.runtimeConfig')}</p>
                        {[
                            { label: t('settings.timeout'), value: '30s', type: 'text' },
                            { label: t('settings.maxRetries'), value: '3', type: 'number' },
                            { label: t('settings.logLevel'), value: 'info', type: 'select', options: ['debug', 'info', 'warn', 'error'] }
                        ].map(cfg => (
                            <div key={cfg.label} className="flex items-center justify-between">
                                <span className="text-xs text-slate-300">{cfg.label}</span>
                                {cfg.type === 'select' ? (
                                    <select className="bg-[var(--color-surface-darker)] border border-[var(--color-border-dark)] text-slate-300 text-xs rounded-lg px-2 py-1 outline-none">
                                        {cfg.options.map(o => <option key={o} value={o}>{o}</option>)}
                                    </select>
                                ) : (
                                    <input
                                        defaultValue={cfg.value}
                                        className="w-20 bg-[var(--color-surface-darker)] border border-[var(--color-border-dark)] text-slate-300 text-xs rounded-lg px-2 py-1 outline-none text-right"
                                    />
                                )}
                            </div>
                        ))}
                        <div className="pt-3 border-t border-[var(--color-border-dark)] flex gap-2">
                            <button onClick={() => onStop(provider.name)} className="flex-1 px-3 py-2 text-xs rounded-lg bg-red-500/10 text-red-500 hover:bg-red-500/20 transition-colors">
                                {t('settings.stop')}
                            </button>
                            <button onClick={() => onRestart(provider.name)} className="flex-1 px-3 py-2 text-xs rounded-lg bg-[var(--color-primary)]/10 text-[var(--color-primary)] hover:bg-[var(--color-primary)]/20 transition-colors">
                                {t('settings.restart')}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}

export default function Providers() {
    const { t } = useTranslation()
    const providers = useAppStore(s => s.providers)
    const healthStatuses = useAppStore(s => s.healthStatuses)
    const [pinging, setPinging] = useState(null)
    const [selectedProvider, setSelectedProvider] = useState(null)
    const [selectedSet, setSelectedSet] = useState(new Set())
    const [batchMode, setBatchMode] = useState(false)
    const [dragIdx, setDragIdx] = useState(null)
    const [providerOrder, setProviderOrder] = useState(null)

    const api = typeof window !== 'undefined' ? window.electronAPI : null

    useEffect(() => {
        useAppStore.getState().fetchProviders()
        useAppStore.getState().fetchHealth()
    }, [])

    const handlePing = async (name) => {
        setPinging(name)
        await useAppStore.getState().pingProvider(name)
        setPinging(null)
    }

    const handlePingAll = async () => {
        setPinging('_all')
        await useAppStore.getState().fetchHealth()
        setPinging(null)
    }

    // 批量操作
    const toggleSelect = (name) => {
        setSelectedSet(prev => {
            const next = new Set(prev)
            next.has(name) ? next.delete(name) : next.add(name)
            return next
        })
    }
    const selectAll = () => setSelectedSet(new Set(providers.map(p => p.name)))
    const deselectAll = () => setSelectedSet(new Set())

    const batchAction = async (action) => {
        const store = useAppStore.getState()
        for (const name of selectedSet) {
            if (action === 'start') await store.startProvider(name)
            else if (action === 'stop') await store.stopProvider(name)
            else if (action === 'restart') await store.restartProvider(name)
            else if (action === 'ping') await store.pingProvider(name)
        }
        if (action === 'ping') await store.fetchHealth()
    }

    // 拖拽排序
    const orderedProviders = providerOrder || providers
    const handleDragStart = (idx) => setDragIdx(idx)
    const handleDragOver = (e, idx) => {
        e.preventDefault()
        if (dragIdx === null || dragIdx === idx) return
        const items = [...orderedProviders]
        const [dragged] = items.splice(dragIdx, 1)
        items.splice(idx, 0, dragged)
        setProviderOrder(items)
        setDragIdx(idx)
    }
    const handleDragEnd = () => setDragIdx(null)

    const selected = selectedProvider ? providers.find(p => p.name === selectedProvider) : null

    return (
        <div className="flex flex-col h-full overflow-hidden">
            <header className="h-12 border-b border-[var(--color-border-dark)] flex items-center justify-between px-6 shrink-0 bg-[var(--color-surface-dark)]/50">
                <h2 className="text-base font-bold text-white">{t('providers.title')}</h2>
                <div className="flex items-center gap-2">
                    {/* 批量模式切换 */}
                    <button
                        onClick={() => { setBatchMode(!batchMode); deselectAll() }}
                        className={`px-3 py-1.5 text-xs rounded-lg border transition-colors flex items-center gap-1 ${batchMode
                            ? 'bg-[var(--color-primary)]/10 text-[var(--color-primary)] border-[var(--color-primary)]/30'
                            : 'bg-white/5 text-slate-300 border-[var(--color-border-dark)] hover:bg-white/10'}`}
                    >
                        <span className="material-symbols-outlined text-[14px]">checklist</span>
                        {t('providers.batchMode')}
                    </button>

                    {/* 批量操作工具栏 */}
                    {batchMode && selectedSet.size > 0 && (
                        <div className="flex items-center gap-1 ml-1">
                            <span className="text-[10px] text-slate-500 mr-1">{selectedSet.size} selected</span>
                            <button onClick={() => batchAction('start')} className="px-2 py-1 text-[10px] rounded bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 transition-colors">Start</button>
                            <button onClick={() => batchAction('stop')} className="px-2 py-1 text-[10px] rounded bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors">Stop</button>
                            <button onClick={() => batchAction('restart')} className="px-2 py-1 text-[10px] rounded bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 transition-colors">Restart</button>
                            <button onClick={() => batchAction('ping')} className="px-2 py-1 text-[10px] rounded bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 transition-colors">Ping</button>
                        </div>
                    )}
                    {batchMode && (
                        <button onClick={selectedSet.size === providers.length ? deselectAll : selectAll}
                            className="px-2 py-1 text-[10px] rounded bg-white/5 text-slate-400 hover:bg-white/10 transition-colors">
                            {selectedSet.size === providers.length ? t('common.deselectAll') : t('common.selectAll')}
                        </button>
                    )}

                    <button
                        onClick={handlePingAll}
                        disabled={pinging === '_all'}
                        className="px-3 py-1.5 text-xs rounded-lg bg-white/5 text-slate-300 border border-[var(--color-border-dark)] hover:bg-white/10 transition-colors disabled:opacity-50 flex items-center gap-1"
                    >
                        <span className={`material-symbols-outlined text-[14px] ${pinging === '_all' ? 'animate-spin' : ''}`}>refresh</span>
                        {t('providers.ping')} {t('tasks.all')}
                    </button>
                </div>
            </header>

            <div className="flex flex-1 overflow-hidden">
                {/* 卡片网格 */}
                <div className={`flex-1 overflow-y-auto p-6 transition-all ${selected ? 'max-w-[calc(100%-420px)]' : ''}`}>
                    {providers.length === 0 ? (
                        <div className="text-center py-20 empty-state-glow">
                            <span className="material-symbols-outlined text-[48px] text-slate-600 mb-4 block animate-float-icon">dns</span>
                            <h3 className="text-white font-semibold text-lg">{t('providers.title')}</h3>
                            <p className="text-slate-500 text-sm mt-2">{t('providers.subtitle')}</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                            {orderedProviders.map((p, idx) => {
                                const health = healthStatuses[p.name] || {}
                                const status = health.status || 'unknown'
                                const s = STATUS_STYLES[status] || STATUS_STYLES.unknown
                                const pi = PROVIDER_ICONS[p.name] || { icon: 'smart_toy', gradient: 'from-slate-500 to-slate-600' }
                                const isSelected = selectedProvider === p.name
                                const isChecked = selectedSet.has(p.name)

                                return (
                                    <div
                                        key={p.name}
                                        draggable
                                        onDragStart={() => handleDragStart(idx)}
                                        onDragOver={(e) => handleDragOver(e, idx)}
                                        onDragEnd={handleDragEnd}
                                        onClick={() => batchMode ? toggleSelect(p.name) : setSelectedProvider(isSelected ? null : p.name)}
                                        className={`bg-[var(--color-surface-dark)] border rounded-xl p-5 transition-all cursor-pointer group animate-stagger-in ${isSelected
                                            ? 'border-[var(--color-primary)] ring-1 ring-[var(--color-primary)]/30 shadow-lg shadow-[var(--color-primary)]/5'
                                            : isChecked
                                                ? 'border-blue-500/40 ring-1 ring-blue-500/20 bg-blue-500/5'
                                                : p.enabled
                                                    ? 'border-[var(--color-border-dark)] hover:border-[var(--color-primary)]/30'
                                                    : 'border-[var(--color-border-dark)]/50 opacity-60'
                                            } ${dragIdx === idx ? 'opacity-50 scale-95' : ''}`}
                                        style={{ animationDelay: `${idx * 60}ms` }}
                                    >
                                        <div className="flex items-start justify-between mb-3">
                                            <div className="flex items-center gap-3">
                                                {/* 批量模式 checkbox */}
                                                {batchMode && (
                                                    <div className={`size-5 rounded border-2 flex items-center justify-center transition-colors ${isChecked
                                                        ? 'bg-[var(--color-primary)] border-[var(--color-primary)]'
                                                        : 'border-slate-600 hover:border-slate-400'}`}
                                                        onClick={(e) => { e.stopPropagation(); toggleSelect(p.name) }}
                                                    >
                                                        {isChecked && <span className="material-symbols-outlined text-white text-[14px]">check</span>}
                                                    </div>
                                                )}
                                                {/* 拖拽手柄 */}
                                                <span className="material-symbols-outlined text-[14px] text-slate-600 cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100 transition-opacity">drag_indicator</span>
                                                <div className={`size-10 rounded-lg bg-gradient-to-br ${pi.gradient} flex items-center justify-center shadow-md`}>
                                                    <span className="material-symbols-outlined text-white text-[20px]">{pi.icon}</span>
                                                </div>
                                                <div>
                                                    <h4 className="text-white font-semibold text-sm">{p.label || p.name}</h4>
                                                    <p className="text-slate-500 text-[10px] uppercase tracking-wider">{p.daemonKey}</p>
                                                </div>
                                            </div>
                                            <span className={`text-[10px] px-2 py-0.5 rounded-full border ${s.badge}`}>{status}</span>
                                        </div>

                                        {/* 状态指标 */}
                                        <div className="grid grid-cols-3 gap-2 text-center mt-4 mb-4">
                                            <div>
                                                <p className="text-white text-sm font-semibold">{health.pid ? `${health.pid}` : '--'}</p>
                                                <p className="text-slate-500 text-[10px]">PID</p>
                                            </div>
                                            <div>
                                                <p className="text-white text-sm font-semibold">{health.latency || '--'}</p>
                                                <p className="text-slate-500 text-[10px]">{t('providers.latency')}</p>
                                            </div>
                                            <div>
                                                <p className="text-white text-sm font-semibold">{health.uptime || '--'}</p>
                                                <p className="text-slate-500 text-[10px]">Uptime</p>
                                            </div>
                                        </div>

                                        {/* 操作按钮 */}
                                        <div className="flex items-center justify-between pt-3 border-t border-[var(--color-border-dark)]">
                                            <button
                                                onClick={(e) => { e.stopPropagation(); handlePing(p.name) }}
                                                disabled={pinging === p.name}
                                                className="px-3 py-1 text-xs rounded-lg bg-[var(--color-primary)]/10 text-[var(--color-primary)] hover:bg-[var(--color-primary)]/20 transition-colors flex items-center gap-1 disabled:opacity-50"
                                            >
                                                <span className={`material-symbols-outlined text-[14px] ${pinging === p.name ? 'animate-spin' : ''}`}>
                                                    {pinging === p.name ? 'sync' : 'network_ping'}
                                                </span>
                                                {pinging === p.name ? t('providers.pinging') : t('providers.ping')}
                                            </button>

                                            <div className="flex items-center gap-2">
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); useAppStore.getState().toggleProvider(p.name, !p.enabled) }}
                                                    className={`relative w-9 h-5 rounded-full transition-colors ${p.enabled ? 'bg-[var(--color-primary)]' : 'bg-slate-600'}`}
                                                >
                                                    <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${p.enabled ? 'left-4' : 'left-0.5'}`} />
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </div>

                {/* Inspector 抽屉 */}
                {selected && (
                    <InspectorDrawer
                        provider={selected}
                        health={healthStatuses[selectedProvider]}
                        onClose={() => setSelectedProvider(null)}
                        onPing={handlePing}
                        onStart={(name) => useAppStore.getState().startProvider(name)}
                        onStop={(name) => useAppStore.getState().stopProvider(name)}
                        onRestart={(name) => useAppStore.getState().restartProvider(name)}
                        pinging={pinging === selectedProvider}
                        t={t}
                    />
                )}
            </div>
        </div>
    )
}
