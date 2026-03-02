/**
 * Terminal — 双引擎终端主页面
 *
 * 顶部 Tab 栏管理多个终端 session，可切换方案 A (Classic) / 方案 B (Block)
 * 右侧 Ops & Daemon Center 侧栏显示 daemon 状态
 *
 * 设计参考：integrated_terminal_split_view + super_terminal_ai_augmented_workstation prototypes
 */
import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import ClassicTerminal from '../components/ClassicTerminal'
import BlockTerminal from '../components/BlockTerminal'
import NL2BashPanel from '../components/NL2BashPanel'
import { useAppStore } from '../store'

const api = typeof window !== 'undefined' ? window.electronAPI : null

const STATUS_STYLES = {
    operational: { dot: 'bg-emerald-500', text: 'text-emerald-500', badge: 'bg-emerald-500/20 text-emerald-500 border-emerald-500/20' },
    degraded: { dot: 'bg-orange-500', text: 'text-orange-500', badge: 'bg-orange-500/20 text-orange-500 border-orange-500/20' },
    offline: { dot: 'bg-red-500', text: 'text-red-500', badge: 'bg-red-500/20 text-red-500 border-red-500/20' },
    unknown: { dot: 'bg-slate-500', text: 'text-slate-500', badge: 'bg-slate-500/20 text-slate-500 border-slate-500/20' }
}

export default function Terminal() {
    const { t } = useTranslation()
    // 使用稳定选择器避免每次 store 变化重渲染
    const settings = useAppStore(s => s.settings)
    const healthStatuses = useAppStore(s => s.healthStatuses)
    const providers = useAppStore(s => s.providers)
    const [tabs, setTabs] = useState([])
    const [activeTab, setActiveTab] = useState(null)
    const [scheme, setScheme] = useState(settings?.terminalScheme || 'classic')
    const [showOps, setShowOps] = useState(true)
    const [splitMode, setSplitMode] = useState(null) // null | 'vertical' | 'horizontal'
    const [splitTabId, setSplitTabId] = useState(null)
    const [nl2bashOpen, setNl2bashOpen] = useState(false)
    const [nl2bashQuery, setNl2bashQuery] = useState('')

    // Cmd+D / Cmd+Shift+D 分屏快捷键
    useEffect(() => {
        const handler = (e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'd' && !e.shiftKey) {
                e.preventDefault()
                if (splitMode === 'vertical') { setSplitMode(null); setSplitTabId(null) }
                else { setSplitMode('vertical'); if (tabs.length > 1) setSplitTabId(tabs.find(t => t.id !== activeTab)?.id || null) }
            }
            if ((e.metaKey || e.ctrlKey) && e.shiftKey && (e.key === 'd' || e.key === 'D')) {
                e.preventDefault()
                if (splitMode === 'horizontal') { setSplitMode(null); setSplitTabId(null) }
                else { setSplitMode('horizontal'); if (tabs.length > 1) setSplitTabId(tabs.find(t => t.id !== activeTab)?.id || null) }
            }
        }
        window.addEventListener('keydown', handler)
        return () => window.removeEventListener('keydown', handler)
    }, [splitMode, tabs, activeTab])

    // ?? NL2Bash 快捷键
    useEffect(() => {
        const handler = (e) => {
            if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === '/') {
                e.preventDefault()
                setNl2bashOpen(prev => !prev)
                setNl2bashQuery('')
            }
        }
        window.addEventListener('keydown', handler)
        return () => window.removeEventListener('keydown', handler)
    }, [])

    // NL2Bash 执行命令 → 注入 PTY
    const executeNl2bash = useCallback((cmd) => {
        if (!api || !activeTab) return
        api.ptyWrite(activeTab, cmd + '\n')
    }, [activeTab])

    // 第一次进入自动创建一个终端 + 获取健康状态
    useEffect(() => {
        createNewTab()
        useAppStore.getState().fetchHealth()
    }, [])

    // B6: 订阅终端配置变更
    const [termConfig, setTermConfig] = useState(null)
    useEffect(() => {
        // 加载初始配置
        if (api?.getSettingsSection) {
            api.getSettingsSection('terminal').then(cfg => cfg && setTermConfig(cfg)).catch(() => { })
        }
        // 实时监听变更
        const cleanup = api?.onTerminalConfigChanged?.((config) => {
            setTermConfig(config)
        })
        return () => cleanup?.()
    }, [])

    const createNewTab = useCallback(async () => {
        if (!api) return
        try {
            const result = await api.ptyCreate()
            const newTab = {
                id: result.id,
                label: `zsh`,
                cwd: result.cwd,
                shell: result.shell,
                icon: 'terminal',
                iconColor: 'text-[var(--color-primary)]'
            }
            setTabs(prev => [...prev, newTab])
            setActiveTab(result.id)
        } catch (err) {
            console.error('Failed to create terminal:', err)
        }
    }, [])

    const closeTab = useCallback(async (id) => {
        if (api) {
            await api.ptyDestroy(id)
        }
        setTabs(prev => {
            const next = prev.filter(t => t.id !== id)
            if (activeTab === id) {
                setActiveTab(next.length > 0 ? next[next.length - 1].id : null)
            }
            return next
        })
    }, [activeTab])

    // 监听终端退出
    useEffect(() => {
        if (!api) return
        const unsub = api.onPtyExit(({ id: exitedId }) => {
            setTabs(prev => {
                const next = prev.filter(t => t.id !== exitedId)
                // 如果当前活跃的 tab 被退出，切换到最后一个
                setActiveTab(current => {
                    if (current === exitedId) {
                        return next.length > 0 ? next[next.length - 1].id : null
                    }
                    return current
                })
                return next
            })
        })
        return unsub
    }, [])

    // Daemon 列表（Ops Center）
    const daemons = [
        { key: '_askd', label: 'askd', sublabel: 'Query Service', color: 'indigo', icon: 'question_answer' },
        { key: '_maild', label: 'maild', sublabel: 'SMTP Worker', color: 'orange', icon: 'mail' }
    ]

    // 在 render body 中 filter，不在 selector 中（避免新引用触发 re-render 循环）
    const enabledProviders = providers.filter(p => p.enabled)

    return (
        <div className="flex h-full overflow-hidden">
            {/* 左侧：终端主区域 */}
            <div className="flex-1 flex flex-col min-w-0">
                {/* Tab 栏 */}
                <div className="flex items-center justify-between px-4 py-2 border-b border-[var(--color-border-dark)] bg-[var(--color-surface-darker)] shrink-0">
                    <div className="flex items-center gap-1 overflow-x-auto">
                        {tabs.map((tab) => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`flex items-center gap-2 px-3 py-1.5 rounded text-xs font-mono font-medium transition-colors border group relative ${activeTab === tab.id
                                    ? 'text-white bg-[var(--color-surface-dark)] border-[var(--color-border-dark)] shadow-sm'
                                    : 'text-slate-400 hover:text-slate-200 hover:bg-[var(--color-surface-dark)] border-transparent hover:border-[var(--color-border-dark)]'
                                    }`}
                            >
                                <span className={`material-symbols-outlined text-[14px] ${tab.iconColor}`}>{tab.icon}</span>
                                {tab.label}
                                {activeTab === tab.id && <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-primary)] ml-1" />}
                                {tabs.length > 1 && (
                                    <span
                                        onClick={(e) => { e.stopPropagation(); closeTab(tab.id) }}
                                        className="material-symbols-outlined text-[12px] text-slate-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity ml-1"
                                    >close</span>
                                )}
                            </button>
                        ))}
                        <button
                            onClick={createNewTab}
                            className="p-1.5 text-slate-500 hover:text-slate-300 rounded hover:bg-[var(--color-surface-dark)] transition-colors"
                        >
                            <span className="material-symbols-outlined text-[16px]">add</span>
                        </button>
                    </div>

                    <div className="flex items-center gap-3 shrink-0 ml-4">
                        {/* 方案切换 */}
                        <div className="flex bg-[var(--color-surface-dark)] rounded p-0.5 border border-[var(--color-border-dark)]">
                            <button
                                onClick={() => setScheme('classic')}
                                className={`p-1.5 rounded transition-colors ${scheme === 'classic' ? 'text-white bg-[var(--color-border-dark)] shadow-sm' : 'text-slate-400 hover:text-white'}`}
                                title="Classic Terminal (Scheme A)"
                            >
                                <span className="material-symbols-outlined text-[16px]">terminal</span>
                            </button>
                            <button
                                onClick={() => setScheme('block')}
                                className={`p-1.5 rounded transition-colors ${scheme === 'block' ? 'text-white bg-[var(--color-border-dark)] shadow-sm' : 'text-slate-400 hover:text-white'}`}
                                title="Block Terminal (Scheme B)"
                            >
                                <span className="material-symbols-outlined text-[16px]">view_agenda</span>
                            </button>
                        </div>

                        {/* Ops 侧栏切换 */}
                        <button
                            onClick={() => setShowOps(!showOps)}
                            className={`p-1.5 rounded transition-colors border ${showOps ? 'text-white bg-[var(--color-surface-dark)] border-[var(--color-border-dark)]' : 'text-slate-400 hover:text-white border-transparent'
                                }`}
                            title="Toggle Ops Center"
                        >
                            <span className="material-symbols-outlined text-[16px]">hub</span>
                        </button>

                        {/* 分屏按钮 */}
                        <div className="flex bg-[var(--color-surface-dark)] rounded p-0.5 border border-[var(--color-border-dark)]">
                            <button
                                onClick={() => {
                                    if (splitMode === 'vertical') {
                                        setSplitMode(null); setSplitTabId(null)
                                    } else if (tabs.length >= 2) {
                                        setSplitMode('vertical')
                                        const other = tabs.find(t => t.id !== activeTab)
                                        if (other) setSplitTabId(other.id)
                                    }
                                }}
                                className={`p-1.5 rounded transition-colors ${splitMode === 'vertical' ? 'text-white bg-[var(--color-border-dark)] shadow-sm' : 'text-slate-400 hover:text-white'}`}
                                title={t('terminal.splitVertical')}
                            >
                                <span className="material-symbols-outlined text-[16px]">vertical_split</span>
                            </button>
                            <button
                                onClick={() => {
                                    if (splitMode === 'horizontal') {
                                        setSplitMode(null); setSplitTabId(null)
                                    } else if (tabs.length >= 2) {
                                        setSplitMode('horizontal')
                                        const other = tabs.find(t => t.id !== activeTab)
                                        if (other) setSplitTabId(other.id)
                                    }
                                }}
                                className={`p-1.5 rounded transition-colors ${splitMode === 'horizontal' ? 'text-white bg-[var(--color-border-dark)] shadow-sm' : 'text-slate-400 hover:text-white'}`}
                                title={t('terminal.splitHorizontal')}
                            >
                                <span className="material-symbols-outlined text-[16px]">horizontal_split</span>
                            </button>
                        </div>

                        <button
                            onClick={createNewTab}
                            className="flex items-center gap-1.5 px-3 py-1 bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white rounded text-xs font-medium transition-colors shadow-lg shadow-[var(--color-primary)]/20"
                        >
                            <span className="material-symbols-outlined text-[14px]">add</span>
                            New Session
                        </button>
                    </div>
                </div>

                {/* NL2Bash 面板 */}
                {nl2bashOpen && (
                    <div className="px-3 py-2 shrink-0">
                        <NL2BashPanel
                            query={nl2bashQuery}
                            onExecute={executeNl2bash}
                            onClose={() => setNl2bashOpen(false)}
                        />
                    </div>
                )}

                {/* 终端内容区 */}
                <div className="flex-1 min-h-0">
                    {tabs.length === 0 ? (
                        <div className="flex items-center justify-center h-full text-center">
                            <div className="empty-state-glow">
                                <span className="material-symbols-outlined text-[48px] text-slate-600 mb-4 block animate-float-icon">terminal</span>
                                <h3 className="text-white font-semibold text-lg">{t('terminal.noSessions')}</h3>
                                <p className="text-slate-500 text-sm mt-2">{t('terminal.noSessionsDesc')}</p>
                            </div>
                        </div>
                    ) : splitMode && splitTabId ? (
                        /* 分屏布局 */
                        <div className={`h-full flex ${splitMode === 'horizontal' ? 'flex-col' : 'flex-row'}`}>
                            <div className={`${splitMode === 'horizontal' ? 'h-1/2' : 'w-1/2'} min-h-0 min-w-0`}>
                                {scheme === 'classic' ? (
                                    <ClassicTerminal terminalId={activeTab} isActive={true} termConfig={termConfig} />
                                ) : (
                                    <BlockTerminal terminalId={activeTab} isActive={true} termConfig={termConfig} />
                                )}
                            </div>
                            <div className={`${splitMode === 'horizontal' ? 'h-px bg-[var(--color-border-dark)]' : 'w-px bg-[var(--color-border-dark)]'} shrink-0`} />
                            <div className={`${splitMode === 'horizontal' ? 'h-1/2' : 'w-1/2'} min-h-0 min-w-0`}>
                                {scheme === 'classic' ? (
                                    <ClassicTerminal terminalId={splitTabId} isActive={true} termConfig={termConfig} />
                                ) : (
                                    <BlockTerminal terminalId={splitTabId} isActive={true} termConfig={termConfig} />
                                )}
                            </div>
                        </div>
                    ) : (
                        /* 单终端布局 */
                        tabs.map((tab) => (
                            <div key={tab.id} className={`h-full ${activeTab === tab.id ? '' : 'hidden'}`}>
                                {scheme === 'classic' ? (
                                    <ClassicTerminal terminalId={tab.id} isActive={activeTab === tab.id} termConfig={termConfig} />
                                ) : (
                                    <BlockTerminal terminalId={tab.id} isActive={activeTab === tab.id} termConfig={termConfig} />
                                )}
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* 右侧：Ops & Daemon Center */}
            {showOps && (
                <aside className="w-72 min-w-[280px] border-l border-[var(--color-border-dark)] bg-[var(--color-surface-dark)] flex flex-col shrink-0">
                    <div className="p-4 border-b border-[var(--color-border-dark)] flex items-center justify-between bg-[var(--color-surface-darker)]">
                        <h3 className="text-white text-sm font-bold uppercase tracking-wider flex items-center gap-2">
                            <span className="material-symbols-outlined text-[var(--color-primary)] text-[18px]">hub</span>
                            Ops & Daemon Center
                        </h3>
                        <span className="flex size-2 rounded-full bg-emerald-500 shadow-[0_0_8px_#22c55e]" />
                    </div>

                    <div className="flex-1 overflow-y-auto p-4 space-y-4">
                        {/* Daemon Cards */}
                        {daemons.map(d => {
                            const health = healthStatuses[d.key]
                            const status = health?.status || 'offline'
                            const st = STATUS_STYLES[status] || STATUS_STYLES.unknown

                            return (
                                <div key={d.key} className="bg-[var(--color-bg-dark)] border border-[var(--color-border-dark)] rounded-xl p-4 shadow-sm">
                                    <div className="flex items-center justify-between mb-3">
                                        <div className="flex items-center gap-3">
                                            <div className={`size-8 rounded-lg bg-${d.color}-500/20 text-${d.color}-400 flex items-center justify-center border border-${d.color}-500/30`}>
                                                <span className="material-symbols-outlined text-[18px]">{d.icon}</span>
                                            </div>
                                            <div>
                                                <h4 className="text-white text-sm font-bold">{d.label}</h4>
                                                <p className="text-slate-500 text-[10px] uppercase font-mono tracking-wide">{d.sublabel}</p>
                                            </div>
                                        </div>
                                        <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full border ${st.badge}`}>{status}</span>
                                    </div>

                                    {/* Activity sparkline */}
                                    <div className="h-10 w-full relative rounded overflow-hidden mb-2">
                                        <svg className="w-full h-full" preserveAspectRatio="none">
                                            <path d="M0,20 Q10,25 20,20 T40,25 T60,15 T80,30 T100,20 T120,25 T140,10 T160,20 T180,25 T200,20 L200,40 L0,40 Z"
                                                fill={`rgba(99,102,241,0.15)`} stroke="none" />
                                            <path d="M0,20 Q10,25 20,20 T40,25 T60,15 T80,30 T100,20 T120,25 T140,10 T160,20 T180,25 T200,20"
                                                fill="none" stroke="#6366f1" strokeWidth="2" />
                                        </svg>
                                    </div>

                                    <div className="flex justify-between text-[10px] font-mono text-slate-500">
                                        <span>PID: <span className="text-white">{health?.pid || '--'}</span></span>
                                        <span>Latency: <span className="text-white">{health?.latency || '--'}</span></span>
                                        <span>Up: <span className="text-white">{health?.uptime || '--'}</span></span>
                                    </div>
                                </div>
                            )
                        })}

                        {/* Provider Worker Cards */}
                        {enabledProviders.map(p => {
                            const health = healthStatuses[p.name]
                            const status = health?.status || 'offline'
                            const st = STATUS_STYLES[status] || STATUS_STYLES.unknown
                            return (
                                <div key={p.name} className="bg-[var(--color-bg-dark)] border border-[var(--color-border-dark)] rounded-xl p-4 shadow-sm">
                                    <div className="flex items-center justify-between mb-2">
                                        <div className="flex items-center gap-3">
                                            <div className="size-8 rounded-lg bg-purple-500/20 text-purple-400 flex items-center justify-center border border-purple-500/30">
                                                <span className="material-symbols-outlined text-[18px]">psychology</span>
                                            </div>
                                            <div>
                                                <h4 className="text-white text-sm font-bold">{p.label}</h4>
                                                <p className="text-slate-500 text-[10px] uppercase font-mono tracking-wide">{p.daemonKey}</p>
                                            </div>
                                        </div>
                                        <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full border ${st.badge}`}>{status}</span>
                                    </div>
                                    <div className="flex justify-between text-[10px] font-mono text-slate-500 mt-2">
                                        <span>PID: <span className="text-white">{health?.pid || '--'}</span></span>
                                        <span>{health?.latency || '--'}</span>
                                    </div>
                                </div>
                            )
                        })}

                        {/* Cluster Health */}
                        <div className="mt-4 pt-4 border-t border-[var(--color-border-dark)]">
                            <h5 className="text-xs text-slate-500 uppercase tracking-wider font-bold mb-3">System Load</h5>
                            <div className="space-y-3">
                                {[
                                    { label: 'CPU Load', value: '12%', pct: 12, color: 'bg-[var(--color-primary)]' },
                                    { label: 'Memory', value: '45%', pct: 45, color: 'bg-purple-500' },
                                    { label: 'Network I/O', value: '0.8 GB/s', pct: 15, color: 'bg-emerald-500' }
                                ].map(m => (
                                    <div key={m.label}>
                                        <div className="flex justify-between text-xs mb-1">
                                            <span className="text-white">{m.label}</span>
                                            <span className="text-slate-500">{m.value}</span>
                                        </div>
                                        <div className="h-1.5 w-full bg-[var(--color-border-dark)] rounded-full overflow-hidden">
                                            <div className={`h-full ${m.color} rounded-full transition-all`} style={{ width: `${m.pct}%` }} />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </aside>
            )}
        </div>
    )
}
