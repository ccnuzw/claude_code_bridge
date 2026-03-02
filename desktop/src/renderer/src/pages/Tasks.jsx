/**
 * Tasks 页面 — 真实 Session 数据 + 链路追踪视图
 *
 * 通过 SessionParser 扫描多个 AI Agent 的 session/log 文件，
 * 展示统一的任务列表，支持分组、过滤、搜索和详情展开。
 * 新增：Jaeger 风格链路追踪甘特图视图。
 */
import { useState, useEffect, useCallback, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import i18n from '../i18n'

const api = typeof window !== 'undefined' ? window.electronAPI : null

const PROVIDER_META = {
    claude: { label: 'Claude', color: 'bg-blue-500', icon: 'psychology', tagClass: 'bg-blue-500/10 text-blue-400 border-blue-500/20', barColor: '#3b82f6' },
    codex: { label: 'Codex', color: 'bg-green-500', icon: 'code', tagClass: 'bg-green-500/10 text-green-400 border-green-500/20', barColor: '#22c55e' },
    gemini: { label: 'Gemini', color: 'bg-purple-500', icon: 'auto_awesome', tagClass: 'bg-purple-500/10 text-purple-400 border-purple-500/20', barColor: '#a855f7' },
    opencode: { label: 'OpenCode', color: 'bg-yellow-500', icon: 'memory', tagClass: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20', barColor: '#eab308' },
    droid: { label: 'Droid', color: 'bg-violet-500', icon: 'smart_toy', tagClass: 'bg-violet-500/10 text-violet-400 border-violet-500/20', barColor: '#8b5cf6' }
}

const STATUS_META = {
    completed: { badge: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20', icon: 'check_circle', barColor: '#10b981' },
    running: { badge: 'bg-blue-500/10 text-blue-500 border-blue-500/20', icon: 'sync', barColor: '#3b82f6' },
    failed: { badge: 'bg-red-500/10 text-red-500 border-red-500/20', icon: 'error', barColor: '#ef4444' },
    unknown: { badge: 'bg-slate-500/10 text-slate-500 border-slate-500/20', icon: 'help', barColor: '#64748b' }
}

function timeAgo(ts) {
    const diff = Date.now() - ts
    if (diff < 60000) return i18n.t('time.justNow')
    if (diff < 3600000) return i18n.t('time.minsAgo', { n: Math.floor(diff / 60000) })
    if (diff < 86400000) return i18n.t('time.hoursAgo', { n: Math.floor(diff / 3600000) })
    return i18n.t('time.daysAgo', { n: Math.floor(diff / 86400000) })
}

// ── 列表视图任务行 ──────────────────────────────────────────
function TaskRow({ task, expanded, onToggle, t }) {
    const pm = PROVIDER_META[task.provider] || PROVIDER_META.claude
    const sm = STATUS_META[task.status] || STATUS_META.unknown

    return (
        <div className={`border rounded-xl transition-colors overflow-hidden ${expanded ? 'border-[var(--color-primary)]/30 bg-[var(--color-surface-dark)]' : 'border-[var(--color-border-dark)] bg-[var(--color-surface-dark)]/50 hover:bg-[var(--color-surface-dark)]'
            }`}>
            <div className="flex items-center gap-4 px-4 py-3 cursor-pointer" onClick={() => onToggle(task.id)}>
                <div className={`shrink-0 size-9 rounded-lg flex items-center justify-center ${pm.color}/20`}>
                    <span className="material-symbols-outlined text-[20px] text-white/80">{pm.icon}</span>
                </div>
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                        <h4 className="text-white text-sm font-medium truncate">{task.title}</h4>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full border font-medium ${pm.tagClass}`}>{pm.label}</span>
                    </div>
                    {task.preview && <p className="text-slate-500 text-xs mt-0.5 truncate">{task.preview}</p>}
                </div>
                <div className="flex items-center gap-3 shrink-0">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full border ${sm.badge}`}>
                        {t(`tasks.status${task.status.charAt(0).toUpperCase() + task.status.slice(1)}`)}
                    </span>
                    <span className="text-slate-500 text-xs w-16 text-right">{timeAgo(task.timestamp)}</span>
                    <span className="material-symbols-outlined text-slate-500 text-[18px]">
                        {expanded ? 'expand_less' : 'expand_more'}
                    </span>
                </div>
            </div>
            {expanded && (
                <div className="px-4 pb-4 pt-1 border-t border-[var(--color-border-dark)]">
                    <div className="grid grid-cols-3 gap-4 text-xs mb-3">
                        <div>
                            <p className="text-slate-500 uppercase tracking-wider mb-1">{t('tasks.provider')}</p>
                            <p className="text-white font-medium">{pm.label}</p>
                        </div>
                        <div>
                            <p className="text-slate-500 uppercase tracking-wider mb-1">{t('tasks.sessionFile')}</p>
                            <p className="text-slate-300 font-mono text-[10px] truncate">{task.sessionFile || '--'}</p>
                        </div>
                        <div>
                            <p className="text-slate-500 uppercase tracking-wider mb-1">{t('tasks.timestamp')}</p>
                            <p className="text-white">{new Date(task.timestamp).toLocaleString()}</p>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <button className="px-3 py-1.5 text-xs rounded-lg bg-[var(--color-primary)]/10 text-[var(--color-primary)] hover:bg-[var(--color-primary)]/20 transition-colors flex items-center gap-1">
                            <span className="material-symbols-outlined text-[14px]">open_in_new</span>
                            {t('tasks.openSession')}
                        </button>
                        <button className="px-3 py-1.5 text-xs rounded-lg bg-white/5 text-slate-400 hover:text-white hover:bg-white/10 border border-[var(--color-border-dark)] transition-colors flex items-center gap-1">
                            <span className="material-symbols-outlined text-[14px]">content_copy</span>
                            {t('tasks.copyId')}
                        </button>
                    </div>
                </div>
            )}
        </div>
    )
}

// ── 链路追踪视图（Jaeger 风格甘特图）────────────────────────
function TraceView({ tasks, t }) {
    const [hoveredId, setHoveredId] = useState(null)

    if (tasks.length === 0) {
        return (
            <div className="text-center py-20 empty-state-glow">
                <span className="material-symbols-outlined text-[48px] text-slate-600 mb-4 block animate-float-icon">timeline</span>
                <h3 className="text-white font-semibold text-lg">{t('tasks.noSessions')}</h3>
                <p className="text-slate-500 text-sm mt-2">{t('tasks.noSessionsDesc')}</p>
            </div>
        )
    }

    // 按 provider 分组
    const providers = [...new Set(tasks.map(t => t.provider))]
    const sorted = [...tasks].sort((a, b) => a.timestamp - b.timestamp)
    const minTs = sorted[0]?.timestamp || 0
    const maxTs = sorted[sorted.length - 1]?.timestamp || Date.now()
    const timeRange = Math.max(maxTs - minTs, 1)

    // 生成时间轴刻度
    const ticks = 6
    const tickLabels = Array.from({ length: ticks }, (_, i) => {
        const ts = minTs + (timeRange / (ticks - 1)) * i
        const d = new Date(ts)
        return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    })

    return (
        <div className="animate-fade-in">
            {/* 时间轴头部 */}
            <div className="flex mb-1">
                <div className="w-28 shrink-0" />
                <div className="flex-1 flex justify-between px-2">
                    {tickLabels.map((label, i) => (
                        <span key={i} className="text-[10px] text-slate-600 font-mono">{label}</span>
                    ))}
                </div>
            </div>

            {/* 时间轴网格线 */}
            <div className="relative">
                <div className="absolute inset-0 flex ml-28">
                    {Array.from({ length: ticks }, (_, i) => (
                        <div key={i} className="flex-1 border-l border-[var(--color-border-dark)]/50" style={{ marginLeft: i === 0 ? 0 : undefined }} />
                    ))}
                </div>

                {/* Provider 行 */}
                {providers.map(providerName => {
                    const pm = PROVIDER_META[providerName] || PROVIDER_META.claude
                    const providerTasks = sorted.filter(t => t.provider === providerName)

                    return (
                        <div key={providerName} className="flex items-center border-b border-[var(--color-border-dark)]/30 relative">
                            {/* Provider 标签 */}
                            <div className="w-28 shrink-0 px-3 py-3 flex items-center gap-2">
                                <span className={`material-symbols-outlined text-[16px] text-white/70`}>{pm.icon}</span>
                                <span className="text-xs text-slate-300 font-medium">{pm.label}</span>
                            </div>

                            {/* 甘特条 */}
                            <div className="flex-1 relative h-10 flex items-center">
                                {providerTasks.map(task => {
                                    const left = ((task.timestamp - minTs) / timeRange) * 100
                                    const sm = STATUS_META[task.status] || STATUS_META.unknown
                                    const width = Math.max(2, Math.min(15, 100 / tasks.length * 3))
                                    const isHovered = hoveredId === task.id

                                    return (
                                        <div
                                            key={task.id}
                                            className="absolute h-6 rounded-md cursor-pointer transition-all"
                                            style={{
                                                left: `${left}%`,
                                                width: `${width}%`,
                                                minWidth: '8px',
                                                backgroundColor: sm.barColor,
                                                opacity: isHovered ? 1 : 0.75,
                                                transform: isHovered ? 'scaleY(1.3)' : 'scaleY(1)',
                                                zIndex: isHovered ? 10 : 1
                                            }}
                                            onMouseEnter={() => setHoveredId(task.id)}
                                            onMouseLeave={() => setHoveredId(null)}
                                        >
                                            {/* Tooltip */}
                                            {isHovered && (
                                                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-56 bg-[#1a2236] border border-[var(--color-border-dark)] rounded-lg p-3 shadow-xl z-50 pointer-events-none">
                                                    <p className="text-white text-xs font-medium truncate mb-1">{task.title}</p>
                                                    <div className="flex items-center gap-2 text-[10px] text-slate-400">
                                                        <span className={`text-${task.status === 'completed' ? 'emerald' : task.status === 'failed' ? 'red' : 'blue'}-400`}>
                                                            {t(`tasks.status${task.status.charAt(0).toUpperCase() + task.status.slice(1)}`)}
                                                        </span>
                                                        <span>•</span>
                                                        <span>{new Date(task.timestamp).toLocaleTimeString()}</span>
                                                    </div>
                                                    {task.preview && <p className="text-slate-500 text-[10px] mt-1 truncate">{task.preview}</p>}
                                                    <div className="absolute top-full left-1/2 -translate-x-1/2 w-2 h-2 bg-[#1a2236] border-r border-b border-[var(--color-border-dark)] rotate-45 -mt-1" />
                                                </div>
                                            )}
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    )
                })}
            </div>

            {/* 统计摘要 */}
            <div className="mt-4 flex items-center gap-4 text-[10px] text-slate-500">
                <span>{tasks.length} total spans</span>
                <span>•</span>
                {Object.entries(STATUS_META).map(([key, meta]) => {
                    const count = tasks.filter(t => t.status === key).length
                    if (count === 0) return null
                    return (
                        <span key={key} className="flex items-center gap-1">
                            <span className="size-2 rounded-full" style={{ backgroundColor: meta.barColor }} />
                            {t(`tasks.status${key.charAt(0).toUpperCase() + key.slice(1)}`)}: {count}
                        </span>
                    )
                })}
            </div>
        </div>
    )
}

// ── DAG 链路图视图（SVG 渲染）────────────────────────────────────
function DagView({ tasks, t }) {
    const [hoveredId, setHoveredId] = useState(null)
    const [scale, setScale] = useState(1)
    const [pan, setPan] = useState({ x: 60, y: 40 })
    const svgRef = useRef(null)
    const dragRef = useRef({ dragging: false, startX: 0, startY: 0, startPanX: 0, startPanY: 0 })

    if (tasks.length === 0) {
        return (
            <div className="text-center py-20 empty-state-glow">
                <span className="material-symbols-outlined text-[48px] text-slate-600 mb-4 block animate-float-icon">account_tree</span>
                <h3 className="text-white font-semibold text-lg">{t('tasks.noSessions')}</h3>
                <p className="text-slate-500 text-sm mt-2">{t('tasks.noSessionsDesc')}</p>
            </div>
        )
    }

    // 构建 DAG 连接关系：通过 callerId / reqId
    const taskMap = new Map(tasks.map(t => [t.id, t]))
    const edges = []
    const childSet = new Set()
    tasks.forEach(task => {
        const caller = task.callerId || task.meta?.CCB_CALLER
        if (caller && taskMap.has(caller)) {
            edges.push({ from: caller, to: task.id })
            childSet.add(task.id)
        }
    })

    // 拓扑排序（BFS 层级）
    const roots = tasks.filter(t => !childSet.has(t.id))
    const levels = []
    const visited = new Set()
    let queue = roots.map(r => r.id)
    while (queue.length > 0) {
        levels.push(queue)
        queue.forEach(id => visited.add(id))
        const next = []
        queue.forEach(parentId => {
            edges.filter(e => e.from === parentId).forEach(e => {
                if (!visited.has(e.to)) next.push(e.to)
            })
        })
        queue = [...new Set(next)]
    }
    // 尚未被访问的孤立节点
    tasks.filter(t => !visited.has(t.id)).forEach(t => levels.push([t.id]))

    // 计算节点位置
    const NODE_W = 180, NODE_H = 56, GAP_X = 60, GAP_Y = 28
    const nodePositions = new Map()
    levels.forEach((level, li) => {
        level.forEach((id, ni) => {
            nodePositions.set(id, { x: li * (NODE_W + GAP_X), y: ni * (NODE_H + GAP_Y) })
        })
    })

    const svgW = (levels.length) * (NODE_W + GAP_X) + 100
    const svgH = Math.max(...levels.map(l => l.length)) * (NODE_H + GAP_Y) + 100

    // 平移拖拽
    const handleMouseDown = (e) => {
        dragRef.current = { dragging: true, startX: e.clientX, startY: e.clientY, startPanX: pan.x, startPanY: pan.y }
        const handleMove = (ev) => {
            if (!dragRef.current.dragging) return
            setPan({ x: dragRef.current.startPanX + ev.clientX - dragRef.current.startX, y: dragRef.current.startPanY + ev.clientY - dragRef.current.startY })
        }
        const handleUp = () => { dragRef.current.dragging = false; window.removeEventListener('mousemove', handleMove); window.removeEventListener('mouseup', handleUp) }
        window.addEventListener('mousemove', handleMove)
        window.addEventListener('mouseup', handleUp)
    }
    const handleWheel = (e) => { e.preventDefault(); setScale(s => Math.max(0.3, Math.min(2, s + (e.deltaY > 0 ? -0.05 : 0.05)))) }

    return (
        <div className="animate-fade-in relative h-full">
            {/* 缩放控制 */}
            <div className="absolute top-2 right-2 flex gap-1 z-10">
                <button onClick={() => setScale(s => Math.min(2, s + 0.1))} className="size-7 rounded-lg bg-[var(--color-surface-dark)] border border-[var(--color-border-dark)] text-slate-400 hover:text-white flex items-center justify-center text-sm">+</button>
                <button onClick={() => setScale(s => Math.max(0.3, s - 0.1))} className="size-7 rounded-lg bg-[var(--color-surface-dark)] border border-[var(--color-border-dark)] text-slate-400 hover:text-white flex items-center justify-center text-sm">–</button>
                <button onClick={() => { setScale(1); setPan({ x: 60, y: 40 }) }} className="px-2 py-1 rounded-lg bg-[var(--color-surface-dark)] border border-[var(--color-border-dark)] text-slate-400 hover:text-white text-[10px]">1:1</button>
            </div>

            <svg
                ref={svgRef}
                className="w-full h-full cursor-grab active:cursor-grabbing"
                onMouseDown={handleMouseDown}
                onWheel={handleWheel}
            >
                <g transform={`translate(${pan.x},${pan.y}) scale(${scale})`}>
                    {/* 连线 */}
                    {edges.map((e, i) => {
                        const from = nodePositions.get(e.from)
                        const to = nodePositions.get(e.to)
                        if (!from || !to) return null
                        const x1 = from.x + NODE_W, y1 = from.y + NODE_H / 2
                        const x2 = to.x, y2 = to.y + NODE_H / 2
                        const cx1 = x1 + GAP_X * 0.4, cx2 = x2 - GAP_X * 0.4
                        return (
                            <g key={i}>
                                <path d={`M${x1},${y1} C${cx1},${y1} ${cx2},${y2} ${x2},${y2}`}
                                    fill="none" stroke="rgba(59,130,246,0.3)" strokeWidth="2" />
                                {/* 箭头 */}
                                <circle cx={x2 - 2} cy={y2} r="3" fill="rgba(59,130,246,0.5)" />
                            </g>
                        )
                    })}

                    {/* 节点 */}
                    {tasks.map(task => {
                        const pos = nodePositions.get(task.id)
                        if (!pos) return null
                        const pm = PROVIDER_META[task.provider] || PROVIDER_META.claude
                        const sm = STATUS_META[task.status] || STATUS_META.unknown
                        const isHovered = hoveredId === task.id

                        return (
                            <g key={task.id} onMouseEnter={() => setHoveredId(task.id)} onMouseLeave={() => setHoveredId(null)}>
                                <rect x={pos.x} y={pos.y} width={NODE_W} height={NODE_H} rx="10" ry="10"
                                    fill={isHovered ? 'rgba(30,41,59,0.95)' : 'rgba(15,23,42,0.85)'}
                                    stroke={isHovered ? sm.barColor : 'rgba(51,65,85,0.5)'}
                                    strokeWidth={isHovered ? 2 : 1} className="transition-all" />
                                {/* 状态条 */}
                                <rect x={pos.x} y={pos.y} width="4" height={NODE_H} rx="2" fill={sm.barColor} />
                                {/* 标题 */}
                                <text x={pos.x + 14} y={pos.y + 22} fill="white" fontSize="11" fontWeight="500">
                                    {task.title?.length > 18 ? task.title.slice(0, 18) + '…' : task.title}
                                </text>
                                {/* Provider */}
                                <text x={pos.x + 14} y={pos.y + 40} fill="rgba(148,163,184,0.7)" fontSize="9">
                                    {pm.label} · {task.status}
                                </text>
                            </g>
                        )
                    })}
                </g>
            </svg>
        </div>
    )
}

function SkeletonTasks() {
    return (
        <div className="p-6 space-y-3 animate-fade-in">
            {[1, 2, 3, 4, 5].map(i => <div key={i} className="skeleton skeleton-card rounded-xl" />)}
        </div>
    )
}

export default function Tasks() {
    const { t } = useTranslation()
    const [tasks, setTasks] = useState([])
    const [isLoading, setIsLoading] = useState(false)
    const [expandedId, setExpandedId] = useState(null)
    const [searchQuery, setSearchQuery] = useState('')
    const [filterProvider, setFilterProvider] = useState('all')
    const [filterStatus, setFilterStatus] = useState('all')
    const [viewMode, setViewMode] = useState('list') // list | trace | dag

    const fetchTasks = useCallback(async () => {
        if (!api) return
        setIsLoading(true)
        try {
            const results = await api.tasksScanAll()
            setTasks(results)
        } catch (err) {
            console.error('Failed to fetch tasks:', err)
        }
        setIsLoading(false)
    }, [])

    useEffect(() => {
        fetchTasks()
    }, [])

    const toggleExpand = (id) => {
        setExpandedId(prev => prev === id ? null : id)
    }

    // 过滤 + 搜索
    const filteredTasks = tasks.filter(t => {
        if (filterProvider !== 'all' && t.provider !== filterProvider) return false
        if (filterStatus !== 'all' && t.status !== filterStatus) return false
        if (searchQuery) {
            const q = searchQuery.toLowerCase()
            return t.title.toLowerCase().includes(q) || t.preview?.toLowerCase().includes(q)
        }
        return true
    })

    // 按天分组
    const groups = {}
    filteredTasks.forEach(task => {
        const date = new Date(task.timestamp)
        const key = date.toDateString() === new Date().toDateString()
            ? t('tasks.today')
            : date.toDateString() === new Date(Date.now() - 86400000).toDateString()
                ? t('tasks.yesterday')
                : date.toLocaleDateString()
        if (!groups[key]) groups[key] = []
        groups[key].push(task)
    })

    const providerCounts = {}
    tasks.forEach(task => {
        providerCounts[task.provider] = (providerCounts[task.provider] || 0) + 1
    })

    return (
        <div className="flex flex-col h-full overflow-hidden">
            {/* Header */}
            <header className="h-12 border-b border-[var(--color-border-dark)] flex items-center justify-between px-6 shrink-0 bg-[var(--color-surface-dark)]/50">
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                    {t('tasks.title')}
                    <span className="text-xs font-normal text-slate-500">{tasks.length} {t('tasks.sessionsFound')}</span>
                </h2>
                <div className="flex items-center gap-2">
                    {/* 视图切换 */}
                    <div className="flex bg-[var(--color-surface-darker)] rounded-lg border border-[var(--color-border-dark)] p-0.5">
                        <button
                            onClick={() => setViewMode('list')}
                            className={`px-3 py-1 text-xs rounded-md flex items-center gap-1 transition-colors ${viewMode === 'list'
                                ? 'bg-[var(--color-primary)] text-white shadow-sm'
                                : 'text-slate-400 hover:text-slate-200'}`}
                        >
                            <span className="material-symbols-outlined text-[14px]">list</span>
                            {t('dashboard.listView')}
                        </button>
                        <button
                            onClick={() => setViewMode('trace')}
                            className={`px-3 py-1 text-xs rounded-md flex items-center gap-1 transition-colors ${viewMode === 'trace'
                                ? 'bg-[var(--color-primary)] text-white shadow-sm'
                                : 'text-slate-400 hover:text-slate-200'}`}
                        >
                            <span className="material-symbols-outlined text-[14px]">timeline</span>
                            {t('dashboard.traceView')}
                        </button>
                        <button
                            onClick={() => setViewMode('dag')}
                            className={`px-3 py-1 text-xs rounded-md flex items-center gap-1 transition-colors ${viewMode === 'dag'
                                ? 'bg-[var(--color-primary)] text-white shadow-sm'
                                : 'text-slate-400 hover:text-slate-200'}`}
                        >
                            <span className="material-symbols-outlined text-[14px]">account_tree</span>
                            DAG
                        </button>
                    </div>

                    <button
                        onClick={fetchTasks}
                        disabled={isLoading}
                        className="px-3 py-1.5 text-xs rounded-lg bg-white/5 text-slate-300 border border-[var(--color-border-dark)] hover:bg-white/10 transition-colors disabled:opacity-50 flex items-center gap-1"
                    >
                        <span className={`material-symbols-outlined text-[14px] ${isLoading ? 'animate-spin' : ''}`}>refresh</span>
                        {t('common.rescan')}
                    </button>
                </div>
            </header >

            <div className="flex flex-1 overflow-hidden">
                {/* 左侧过滤栏 */}
                <aside className="w-48 shrink-0 border-r border-[var(--color-border-dark)] bg-[var(--color-surface-darker)] p-4 overflow-y-auto">
                    {/* 搜索 */}
                    <div className="relative mb-4">
                        <input
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full bg-[var(--color-surface-dark)] border border-[var(--color-border-dark)] text-slate-300 text-xs rounded-lg pl-8 pr-3 py-2 outline-none focus:ring-1 focus:ring-[var(--color-primary)] placeholder-slate-500"
                            placeholder={t('nav.search')}
                        />
                        <span className="material-symbols-outlined absolute left-2.5 top-2 text-slate-500 text-[14px]">search</span>
                    </div>

                    {/* Provider 过滤 */}
                    <p className="text-[10px] text-slate-500 uppercase tracking-wider font-bold mb-2">{t('tasks.provider')}</p>
                    <div className="space-y-1 mb-4">
                        <button
                            onClick={() => setFilterProvider('all')}
                            className={`w-full flex items-center justify-between text-xs rounded-lg px-2.5 py-1.5 transition-colors ${filterProvider === 'all' ? 'bg-[var(--color-primary)]/10 text-[var(--color-primary)]' : 'text-slate-400 hover:bg-white/5'
                                }`}
                        >
                            <span>{t('tasks.all')}</span>
                            <span className="text-slate-600">{tasks.length}</span>
                        </button>
                        {Object.entries(PROVIDER_META).map(([key, meta]) => (
                            <button
                                key={key}
                                onClick={() => setFilterProvider(key)}
                                className={`w-full flex items-center justify-between text-xs rounded-lg px-2.5 py-1.5 transition-colors ${filterProvider === key ? 'bg-[var(--color-primary)]/10 text-[var(--color-primary)]' : 'text-slate-400 hover:bg-white/5'
                                    }`}
                            >
                                <span className="flex items-center gap-1.5">
                                    <span className="material-symbols-outlined text-[14px]">{meta.icon}</span>
                                    {meta.label}
                                </span>
                                <span className="text-slate-600">{providerCounts[key] || 0}</span>
                            </button>
                        ))}
                    </div>

                    {/* Status 过滤 */}
                    <p className="text-[10px] text-slate-500 uppercase tracking-wider font-bold mb-2">{t('tasks.status')}</p>
                    <div className="space-y-1">
                        {['all', 'completed', 'running', 'failed'].map(s => (
                            <button
                                key={s}
                                onClick={() => setFilterStatus(s)}
                                className={`w-full text-left text-xs rounded-lg px-2.5 py-1.5 transition-colors ${filterStatus === s ? 'bg-[var(--color-primary)]/10 text-[var(--color-primary)]' : 'text-slate-400 hover:bg-white/5'
                                    }`}
                            >
                                {s === 'all' ? t('tasks.all') : t(`tasks.status${s.charAt(0).toUpperCase() + s.slice(1)}`)}
                            </button>
                        ))}
                    </div>
                </aside>

                {/* 右侧主区域 */}
                <div className="flex-1 overflow-y-auto p-6">
                    {isLoading ? (
                        <SkeletonTasks />
                    ) : viewMode === 'trace' ? (
                        <TraceView tasks={filteredTasks} t={t} />
                    ) : viewMode === 'dag' ? (
                        <DagView tasks={filteredTasks} t={t} />
                    ) : filteredTasks.length === 0 ? (
                        <div className="text-center py-20 empty-state-glow">
                            <span className="material-symbols-outlined text-[48px] text-slate-600 mb-4 block animate-float-icon">task</span>
                            <h3 className="text-white font-semibold text-lg">{t('tasks.noSessions')}</h3>
                            <p className="text-slate-500 text-sm mt-2">
                                {tasks.length === 0
                                    ? t('tasks.noSessionsDesc')
                                    : t('tasks.noMatch')}
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-6">
                            {Object.entries(groups).map(([dateLabel, groupTasks]) => (
                                <div key={dateLabel}>
                                    <p className="text-xs text-slate-500 uppercase tracking-wider font-bold mb-3 px-1">{dateLabel}</p>
                                    <div className="space-y-2">
                                        {groupTasks.map(task => (
                                            <TaskRow
                                                key={task.id}
                                                task={task}
                                                expanded={expandedId === task.id}
                                                onToggle={toggleExpand}
                                                t={t}
                                            />
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div >
    )
}
