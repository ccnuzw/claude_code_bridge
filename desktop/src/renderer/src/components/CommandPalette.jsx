import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAppStore } from '../store'
import useAskStore from '../store/askStore'

/**
 * Command Palette — Spotlight / VS Code 风格命令面板
 * Cmd+Shift+P 全局触发
 *
 * 动态数据源：
 *  - Providers：从 useAppStore 实时获取 + healthStatuses
 *  - Recent Sessions：从 tasksGetRecent IPC 获取
 *  - Skills：从 extensionsGetSkills IPC 获取
 *  - Commands / Settings：静态列表
 */
const api = typeof window !== 'undefined' ? window.electronAPI : null

// 仅保留 commands / settings 静态条目
const STATIC_COMMANDS = [
    { id: 'cmd-ask', label: 'Ask Claude', icon: 'smart_toy', group: 'commands', shortcut: '⌘⇧A', action: '/ask' },
    { id: 'cmd-ping', label: 'Ping All Providers', icon: 'cell_tower', group: 'commands', action: 'ping' },
    { id: 'cmd-new-terminal', label: 'New Terminal', icon: 'terminal', group: 'commands', shortcut: '⌘T', action: '/terminal' },
    { id: 'cmd-workflow', label: 'Create New Workflow', icon: 'add_circle', group: 'commands', shortcut: '⌘N', action: '/tasks' },
    { id: 'cmd-ctx', label: 'Context Transfer', icon: 'swap_horiz', group: 'commands', action: '/ask' },
    { id: 'cmd-save-session', label: 'Save Ask Session', icon: 'save', group: 'commands', shortcut: '⌘S', action: 'save-session' },
    { id: 'cmd-new-session', label: 'New Ask Session', icon: 'note_add', group: 'commands', action: 'new-session' },

    { id: 'set-theme', label: 'Toggle Theme', icon: 'dark_mode', group: 'settings', action: '/settings' },
    { id: 'set-keys', label: 'API Keys & Tokens', icon: 'key', group: 'settings', action: '/settings' },
    { id: 'set-shortcuts', label: 'Keyboard Shortcuts', icon: 'keyboard', group: 'settings', shortcut: '⌘,', action: '/settings' }
]

export default function CommandPalette({ isOpen, onClose }) {
    const { t } = useTranslation()
    const [query, setQuery] = useState('')
    const [selectedIndex, setSelectedIndex] = useState(0)
    const [recentSessions, setRecentSessions] = useState([])
    const [skills, setSkills] = useState([])
    const inputRef = useRef(null)
    const listRef = useRef(null)
    const searchTimer = useRef(null)
    const [globalResults, setGlobalResults] = useState([])
    const navigate = useNavigate()

    // 真实 Provider 和健康状态
    const appProviders = useAppStore(s => s.providers)
    const healthStatuses = useAppStore(s => s.healthStatuses)

    // 打开时加载数据
    useEffect(() => {
        if (isOpen) {
            setQuery('')
            setSelectedIndex(0)
            setTimeout(() => inputRef.current?.focus(), 50)

            // 加载 provider 数据
            if (appProviders.length === 0) {
                useAppStore.getState().fetchProviders()
                useAppStore.getState().fetchHealth()
            }

            // 加载最近 sessions（真实 IPC）
            if (api?.tasksGetRecent) {
                api.tasksGetRecent(5).then(sessions => {
                    if (Array.isArray(sessions)) setRecentSessions(sessions)
                }).catch(() => { })
            }

            // 加载 skills（真实 IPC）
            if (api?.extensionsGetSkills) {
                api.extensionsGetSkills().then(result => {
                    if (Array.isArray(result)) setSkills(result)
                }).catch(() => { })
            }

            setGlobalResults([])
        }
    }, [isOpen, appProviders.length])

    // B4: 防抖 searchGlobal
    useEffect(() => {
        if (!isOpen || !query.trim() || !api?.searchGlobal) {
            setGlobalResults([])
            return
        }
        clearTimeout(searchTimer.current)
        searchTimer.current = setTimeout(async () => {
            try {
                const results = await api.searchGlobal(query.trim(), { limit: 10 })
                if (Array.isArray(results)) setGlobalResults(results)
            } catch { setGlobalResults([]) }
        }, 300)
        return () => clearTimeout(searchTimer.current)
    }, [query, isOpen])

    // ── 构建完全动态的命令列表 ──
    const allItems = useMemo(() => {
        const items = [...STATIC_COMMANDS]

        // 真实 Provider 条目（动态）
        appProviders.forEach(p => {
            const health = healthStatuses[p.name]
            const status = health?.status === 'operational' ? 'online'
                : health?.status === 'degraded' ? 'degraded'
                    : 'offline'
            items.push({
                id: `prov-${p.name}`,
                label: p.label,
                description: p.name + (health?.latency ? ` • ${health.latency}` : ''),
                icon: p.icon,
                group: 'providers',
                status,
                action: '/providers'
            })
        })

        // 真实 Recent Sessions（动态）
        recentSessions.forEach(s => {
            const timeAgo = formatTimeAgo(s.timestamp)
            items.push({
                id: `session-${s.id}`,
                label: s.title || s.id,
                description: `${s.provider} • ${s.status}`,
                icon: 'history',
                group: 'recent',
                time: timeAgo,
                action: '/tasks'
            })
        })

        // 真实 Skills（动态）
        skills.forEach(skill => {
            items.push({
                id: `skill-${skill.name || skill.id}`,
                label: skill.name || skill.id,
                description: skill.description || '',
                icon: 'psychology_alt',
                group: 'skills',
                action: '/extensions'
            })
        })

        // B4: 全局搜索结果
        globalResults.forEach(r => {
            if (items.some(i => i.id === `search-${r.id}`)) return
            items.push({
                id: `search-${r.id}`,
                label: r.title || r.id,
                description: r.preview || '',
                icon: r.type === 'session' ? 'chat' : 'psychology_alt',
                group: r.type === 'session' ? 'recent' : 'skills',
                time: r.timestamp ? formatTimeAgo(r.timestamp) : '',
                action: r.type === 'session' ? `load-session:${r.id}` : '/extensions'
            })
        })

        return items
    }, [appProviders, healthStatuses, recentSessions, skills, globalResults])

    // ── 前缀过滤 & 模糊搜索 ──
    const filteredItems = useMemo(() => {
        let items = [...allItems]
        let q = query.trim()

        if (q.startsWith('>')) {
            items = items.filter(i => i.group === 'commands')
            q = q.slice(1).trim()
        } else if (q.startsWith('@')) {
            items = items.filter(i => i.group === 'providers')
            q = q.slice(1).trim()
        } else if (q.startsWith('#')) {
            items = items.filter(i => i.group === 'recent' || i.group === 'tasks' || i.group === 'skills')
            q = q.slice(1).trim()
        }

        if (q) {
            const lower = q.toLowerCase()
            items = items.filter(i =>
                i.label.toLowerCase().includes(lower) ||
                (i.description && i.description.toLowerCase().includes(lower))
            )
        }

        return items
    }, [query, allItems])

    // 按分组聚合
    const grouped = useMemo(() => {
        const groups = {}
        const labelMap = {
            commands: t('commandPalette.commands'),
            providers: t('commandPalette.providers'),
            settings: t('commandPalette.settings'),
            recent: t('commandPalette.recent'),
            tasks: t('commandPalette.tasks'),
            skills: t('commandPalette.skills')
        }
        filteredItems.forEach(item => {
            const g = item.group || 'other'
            if (!groups[g]) groups[g] = { label: labelMap[g] || g, items: [] }
            groups[g].items.push(item)
        })
        return groups
    }, [filteredItems, t])

    const flatItems = filteredItems

    // ── 键盘导航 ──
    const handleKeyDown = useCallback((e) => {
        if (e.key === 'Escape') { onClose(); return }
        if (e.key === 'ArrowDown') {
            e.preventDefault()
            setSelectedIndex(prev => Math.min(prev + 1, flatItems.length - 1))
        }
        if (e.key === 'ArrowUp') {
            e.preventDefault()
            setSelectedIndex(prev => Math.max(prev - 1, 0))
        }
        if (e.key === 'Enter') {
            e.preventDefault()
            const item = flatItems[selectedIndex]
            if (item) executeItem(item)
        }
    }, [flatItems, selectedIndex, onClose])

    const executeItem = (item) => {
        onClose()
        if (item.action?.startsWith('/')) {
            navigate(item.action)
        } else if (item.action === 'save-session') {
            useAskStore.getState().saveSession()
        } else if (item.action === 'new-session') {
            useAskStore.getState().newSession()
            navigate('/ask')
        } else if (item.action === 'ping') {
            useAppStore.getState().fetchHealth()
        } else if (item.action?.startsWith('load-session:')) {
            const sessionId = item.action.split(':')[1]
            useAskStore.getState().loadSession(sessionId)
            navigate('/ask')
        }
    }

    useEffect(() => {
        if (!listRef.current) return
        const el = listRef.current.querySelector(`[data-index="${selectedIndex}"]`)
        if (el) el.scrollIntoView({ block: 'nearest' })
    }, [selectedIndex])

    useEffect(() => { setSelectedIndex(0) }, [query])

    if (!isOpen) return null

    let globalIdx = -1

    return (
        <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh] px-4 animate-fade-in">
            <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={onClose} />

            <div className="relative w-full max-w-2xl rounded-xl bg-[#161d2a] shadow-2xl ring-1 ring-white/5 overflow-hidden animate-slide-up">
                {/* 搜索输入 */}
                <div className="relative border-b border-slate-700/60">
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4">
                        <span className="material-symbols-outlined text-slate-400 text-[22px]">search</span>
                    </div>
                    <input
                        ref={inputRef}
                        autoFocus
                        className="h-14 w-full border-0 bg-transparent pl-12 pr-14 text-white placeholder:text-slate-400 focus:ring-0 text-sm font-medium outline-none"
                        placeholder={t('commandPalette.placeholder')}
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        onKeyDown={handleKeyDown}
                    />
                    <div className="absolute inset-y-0 right-0 flex items-center pr-3">
                        <kbd className="hidden sm:inline-block rounded border border-slate-700 bg-slate-800 px-1.5 py-0.5 text-[10px] font-semibold text-slate-400">ESC</kbd>
                    </div>
                </div>

                {/* 结果列表 */}
                <div ref={listRef} className="max-h-[60vh] overflow-y-auto custom-thin-scrollbar scroll-py-3">
                    {Object.entries(grouped).length === 0 ? (
                        <div className="px-6 py-8 text-center text-slate-500 text-sm">
                            <span className="material-symbols-outlined text-3xl text-slate-600 mb-2 block">search_off</span>
                            {t('commandPalette.noResults')}
                        </div>
                    ) : (
                        Object.entries(grouped).map(([key, group], gi) => (
                            <div key={key} className={`px-2 py-2 ${gi > 0 ? 'border-t border-slate-700/50' : 'pt-3'}`}>
                                <h3 className="mb-1.5 px-3 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                                    {group.label}
                                </h3>
                                {group.items.map((item) => {
                                    globalIdx++
                                    const isSelected = globalIdx === selectedIndex
                                    const idx = globalIdx

                                    return (
                                        <button
                                            key={item.id}
                                            data-index={idx}
                                            onClick={() => executeItem(item)}
                                            onMouseEnter={() => setSelectedIndex(idx)}
                                            className={`group flex w-full items-center gap-3 rounded-lg px-3 py-2.5 transition-colors
                                                ${isSelected
                                                    ? 'bg-[var(--color-primary)] text-white shadow-lg shadow-blue-900/20'
                                                    : 'text-slate-300 hover:bg-slate-800/50'
                                                }`}
                                        >
                                            {item.group === 'providers' ? (
                                                <div className="flex size-5 items-center justify-center rounded-sm" style={{ backgroundColor: `${item.status === 'online' ? '#10b981' : item.status === 'degraded' ? '#f59e0b' : '#6b7280'}15` }}>
                                                    <span className={`block size-2 rounded-full ${item.status === 'online' ? 'bg-emerald-500' : item.status === 'degraded' ? 'bg-yellow-500' : 'bg-slate-500'}`}
                                                        style={{ boxShadow: item.status === 'online' ? '0 0 8px rgba(16,185,129,0.6)' : item.status === 'degraded' ? '0 0 8px rgba(245,158,11,0.4)' : 'none' }}
                                                    />
                                                </div>
                                            ) : (
                                                <span className={`material-symbols-outlined text-[18px] ${isSelected ? 'text-white' : 'text-slate-500'}`}>
                                                    {item.icon}
                                                </span>
                                            )}

                                            <div className="flex flex-1 flex-col items-start text-left min-w-0">
                                                <span className="font-medium text-sm truncate w-full">{item.label}</span>
                                                {item.description && (
                                                    <span className={`text-[11px] truncate w-full ${isSelected ? 'text-blue-100/80' : 'text-slate-500'}`}>
                                                        {item.description}
                                                    </span>
                                                )}
                                            </div>

                                            {item.shortcut && (
                                                <span className={`text-[11px] font-mono shrink-0 ${isSelected ? 'text-blue-100/70' : 'text-slate-600'}`}>
                                                    {item.shortcut}
                                                </span>
                                            )}
                                            {item.time && (
                                                <span className={`text-[11px] shrink-0 ${isSelected ? 'text-blue-100/70' : 'text-slate-600'}`}>
                                                    {item.time}
                                                </span>
                                            )}
                                            {item.group === 'providers' && (
                                                <span className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-medium ring-1 ring-inset shrink-0
                                                    ${item.status === 'online'
                                                        ? 'text-emerald-400 bg-emerald-400/10 ring-emerald-400/20'
                                                        : item.status === 'degraded'
                                                            ? 'text-yellow-400 bg-yellow-400/10 ring-yellow-400/20'
                                                            : 'text-slate-400 bg-slate-400/10 ring-slate-400/20'
                                                    }`}
                                                >
                                                    {item.status === 'online' ? t('commandPalette.online')
                                                        : item.status === 'degraded' ? t('commandPalette.degraded')
                                                            : t('commandPalette.offline')}
                                                </span>
                                            )}
                                        </button>
                                    )
                                })}
                            </div>
                        ))
                    )}
                </div>

                {/* 底部提示栏 */}
                <div className="flex items-center justify-between border-t border-slate-700/60 bg-slate-800/40 px-4 py-2">
                    <div className="flex gap-4">
                        <div className="flex items-center gap-1.5">
                            <span className="material-symbols-outlined text-[12px] text-slate-500">arrow_upward</span>
                            <span className="material-symbols-outlined text-[12px] text-slate-500">arrow_downward</span>
                            <span className="text-[10px] font-medium text-slate-500">{t('commandPalette.navigate')}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <span className="material-symbols-outlined text-[12px] text-slate-500">keyboard_return</span>
                            <span className="text-[10px] font-medium text-slate-500">{t('commandPalette.select')}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <span className="text-[10px] font-mono text-slate-600">&gt; {t('common.cmd')}</span>
                            <span className="text-[10px] font-mono text-slate-600">@ {t('common.provider')}</span>
                            <span className="text-[10px] font-mono text-slate-600"># {t('common.task')}</span>
                        </div>
                    </div>
                    <span className="text-[10px] text-slate-600">CCB Desktop v0.1.0</span>
                </div>
            </div>
        </div>
    )
}

// 时间格式化
function formatTimeAgo(timestamp) {
    if (!timestamp) return ''
    const diff = Date.now() - new Date(timestamp).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 1) return 'Now'
    if (mins < 60) return `${mins}m`
    const hours = Math.floor(mins / 60)
    if (hours < 24) return `${hours}h`
    const days = Math.floor(hours / 24)
    return `${days}d`
}
