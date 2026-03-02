import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAppStore } from '../store'
import { useNavigate } from 'react-router-dom'

const STATUS_STYLES = {
    operational: { badge: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20', dot: 'bg-emerald-500' },
    degraded: { badge: 'bg-orange-500/10 text-orange-500 border-orange-500/20', dot: 'bg-orange-500' },
    offline: { badge: 'bg-red-500/10 text-red-500 border-red-500/20', dot: 'bg-red-500' },
    unknown: { badge: 'bg-slate-500/10 text-slate-500 border-slate-500/20', dot: 'bg-slate-500' }
}

// ── Mini Sparkline SVG ──────────────────────────────────────
function Sparkline({ data = [], color = '#135bec', height = 32, width = 80 }) {
    if (data.length < 2) return null
    const max = Math.max(...data, 1)
    const min = Math.min(...data, 0)
    const range = max - min || 1
    const points = data.map((v, i) => {
        const x = (i / (data.length - 1)) * width
        const y = height - ((v - min) / range) * (height - 4) - 2
        return `${x},${y}`
    }).join(' ')
    const areaPoints = `0,${height} ${points} ${width},${height}`
    return (
        <svg width={width} height={height} className="overflow-visible">
            <defs>
                <linearGradient id={`sg-${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={color} stopOpacity="0.3" />
                    <stop offset="100%" stopColor={color} stopOpacity="0" />
                </linearGradient>
            </defs>
            <polyline fill={`url(#sg-${color.replace('#', '')})`} points={areaPoints} />
            <polyline fill="none" points={points} stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    )
}

// ── Hero Metric Card ────────────────────────────────────────
function HeroCard({ label, value, unit, change, changeColor, icon, iconColor, sparkData, sparkColor, delay = 0 }) {
    return (
        <div
            className="relative bg-[var(--color-surface-dark)] border border-[var(--color-border-dark)] rounded-xl p-4 flex flex-col gap-2 shadow-sm hover:border-[var(--color-primary)]/50 transition-all group overflow-hidden animate-stagger-in"
            style={{ animationDelay: `${delay}ms` }}
        >
            {/* 背景 sparkline */}
            {sparkData && sparkData.length > 1 && (
                <div className="absolute bottom-0 right-0 opacity-40 group-hover:opacity-70 transition-opacity">
                    <Sparkline data={sparkData} color={sparkColor || '#135bec'} height={40} width={120} />
                </div>
            )}
            <div className="flex justify-between items-start relative z-10">
                <p className="text-slate-400 text-xs font-medium uppercase tracking-wider">{label}</p>
                <span className={`material-symbols-outlined text-[20px] opacity-70 group-hover:opacity-100 transition-opacity ${iconColor}`}>{icon}</span>
            </div>
            <div className="flex items-baseline gap-2 mt-1 relative z-10">
                <p className="text-white text-2xl font-bold tabular-nums">
                    {value}{unit && <span className="text-sm font-normal text-slate-400 ml-1">{unit}</span>}
                </p>
                {change && <span className={`text-xs font-medium ${changeColor || 'text-slate-500'}`}>{change}</span>}
            </div>
        </div>
    )
}

// ── Activity Heatmap (30 days) ──────────────────────────────
function ActivityHeatmap({ tasks = [], t }) {
    const days = 30
    const today = new Date()
    const heatData = Array.from({ length: days }, (_, i) => {
        const d = new Date(today)
        d.setDate(d.getDate() - (days - 1 - i))
        const dateStr = d.toDateString()
        const count = tasks.filter(t => new Date(t.timestamp).toDateString() === dateStr).length
        return { date: d, count }
    })
    const maxCount = Math.max(...heatData.map(d => d.count), 1)

    const getColor = (count) => {
        if (count === 0) return 'bg-slate-800'
        const intensity = count / maxCount
        if (intensity < 0.25) return 'bg-blue-900/60'
        if (intensity < 0.5) return 'bg-blue-700/70'
        if (intensity < 0.75) return 'bg-blue-500/80'
        return 'bg-blue-400'
    }

    return (
        <div className="bg-[var(--color-surface-dark)] border border-[var(--color-border-dark)] rounded-xl p-4 animate-stagger-in" style={{ animationDelay: '400ms' }}>
            <div className="flex items-center justify-between mb-3">
                <h3 className="text-white font-semibold text-sm">{t('dashboard.activityHeatmap')}</h3>
                <span className="text-xs text-slate-500">{t('dashboard.last30Days')}</span>
            </div>
            <div className="flex gap-1 flex-wrap">
                {heatData.map((d, i) => (
                    <div
                        key={i}
                        className={`size-4 rounded-sm ${getColor(d.count)} hover:ring-1 hover:ring-white/30 transition-all cursor-default`}
                        title={`${d.date.toLocaleDateString()}: ${d.count} tasks`}
                    />
                ))}
            </div>
            <div className="flex items-center gap-2 mt-2 text-[10px] text-slate-500">
                <span>{t('dashboard.less')}</span>
                <div className="flex gap-0.5">
                    {['bg-slate-800', 'bg-blue-900/60', 'bg-blue-700/70', 'bg-blue-500/80', 'bg-blue-400'].map((c, i) => (
                        <div key={i} className={`size-3 rounded-sm ${c}`} />
                    ))}
                </div>
                <span>{t('dashboard.more')}</span>
            </div>
        </div>
    )
}

// ── Quick Actions Panel ─────────────────────────────────────
function QuickActions({ t, navigate }) {
    const actions = [
        { label: t('dashboard.newAsk'), icon: 'chat', gradient: 'from-blue-600 to-cyan-500', to: '/ask' },
        { label: t('dashboard.pingAll'), icon: 'cell_tower', gradient: 'from-emerald-600 to-teal-500', action: 'pingAll' },
        { label: t('dashboard.openTerminal'), icon: 'terminal', gradient: 'from-purple-600 to-violet-500', to: '/terminal' },
        { label: t('dashboard.checkMail'), icon: 'mail', gradient: 'from-orange-600 to-amber-500', to: '/mail' },
        { label: t('dashboard.goSettings'), icon: 'settings', gradient: 'from-slate-600 to-slate-500', to: '/settings' }
    ]

    const handleClick = (a) => {
        if (a.to) navigate(a.to)
        else if (a.action === 'pingAll') useAppStore.getState().fetchHealth()
    }

    return (
        <div className="bg-[var(--color-surface-dark)] border border-[var(--color-border-dark)] rounded-xl p-4 animate-stagger-in" style={{ animationDelay: '300ms' }}>
            <h3 className="text-white font-semibold text-sm mb-3">{t('dashboard.quickActions')}</h3>
            <div className="grid grid-cols-5 gap-2">
                {actions.map(a => (
                    <button
                        key={a.label}
                        onClick={() => handleClick(a)}
                        className="flex flex-col items-center gap-1.5 p-3 rounded-xl bg-gradient-to-br hover:scale-105 active:scale-95 transition-transform shadow-md group"
                        style={{ backgroundImage: `linear-gradient(135deg, var(--tw-gradient-stops))` }}
                    >
                        <div className={`size-10 rounded-lg bg-gradient-to-br ${a.gradient} flex items-center justify-center shadow-lg`}>
                            <span className="material-symbols-outlined text-white text-[20px]">{a.icon}</span>
                        </div>
                        <span className="text-[10px] text-slate-300 font-medium">{a.label}</span>
                    </button>
                ))}
            </div>
        </div>
    )
}

// ── Hero Chart (全景动图 — 平滑曲线 + 渐变面积) ─────────────
function HeroChart({ providers = [], healthStatuses = {}, t }) {
    const [hoverX, setHoverX] = useState(null)
    // 生成 24h 模拟性能数据
    const chartW = 600, chartH = 120, pad = 24
    const ticks = 24
    const providerLines = providers.slice(0, 4).map((p, idx) => {
        const colors = ['#3b82f6', '#10b981', '#a855f7', '#f59e0b']
        const base = healthStatuses[p.name]?.status === 'operational' ? 60 : 30
        const pts = Array.from({ length: ticks }, (_, i) => base + Math.sin(i * 0.4 + idx) * 20 + (Math.random() - 0.5) * 15)
        return { name: p.label || p.name, color: colors[idx % 4], data: pts }
    })

    const allVals = providerLines.flatMap(l => l.data)
    const maxV = Math.max(...allVals, 100)
    const minV = Math.min(...allVals, 0)
    const rangeV = maxV - minV || 1

    const toPath = (data) => {
        return data.map((v, i) => {
            const x = pad + (i / (ticks - 1)) * (chartW - pad * 2)
            const y = pad + (1 - (v - minV) / rangeV) * (chartH - pad * 2)
            return `${i === 0 ? 'M' : 'L'}${x},${y}`
        }).join(' ')
    }

    const toArea = (data) => {
        const line = data.map((v, i) => {
            const x = pad + (i / (ticks - 1)) * (chartW - pad * 2)
            const y = pad + (1 - (v - minV) / rangeV) * (chartH - pad * 2)
            return `${x},${y}`
        }).join(' ')
        return `${pad},${chartH - pad} ${line} ${chartW - pad},${chartH - pad}`
    }

    const tickLabels = ['0h', '6h', '12h', '18h', '24h']

    return (
        <div className="bg-[var(--color-surface-dark)] border border-[var(--color-border-dark)] rounded-xl overflow-hidden animate-stagger-in" style={{ animationDelay: '120ms' }}>
            <div className="p-4 border-b border-[var(--color-border-dark)] flex items-center justify-between">
                <h3 className="text-white font-semibold text-sm">{t('dashboard.performanceTrend')}</h3>
                <div className="flex gap-3">
                    {providerLines.map(l => (
                        <span key={l.name} className="flex items-center gap-1 text-[10px] text-slate-400">
                            <span className="size-2 rounded-full" style={{ backgroundColor: l.color }} />
                            {l.name}
                        </span>
                    ))}
                </div>
            </div>
            <div className="px-4 pt-2 pb-3">
                <svg
                    viewBox={`0 0 ${chartW} ${chartH}`}
                    className="w-full h-auto"
                    onMouseMove={(e) => {
                        const rect = e.currentTarget.getBoundingClientRect()
                        setHoverX(((e.clientX - rect.left) / rect.width) * chartW)
                    }}
                    onMouseLeave={() => setHoverX(null)}
                >
                    {/* 水平网格线 */}
                    {[0.25, 0.5, 0.75].map(r => (
                        <line key={r} x1={pad} y1={pad + r * (chartH - pad * 2)} x2={chartW - pad} y2={pad + r * (chartH - pad * 2)}
                            stroke="rgba(148,163,184,0.08)" strokeWidth="1" />
                    ))}
                    {/* 面积 + 线 */}
                    {providerLines.map(l => (
                        <g key={l.name}>
                            <defs>
                                <linearGradient id={`hg-${l.color.slice(1)}`} x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor={l.color} stopOpacity="0.15" />
                                    <stop offset="100%" stopColor={l.color} stopOpacity="0" />
                                </linearGradient>
                            </defs>
                            <polygon fill={`url(#hg-${l.color.slice(1)})`} points={toArea(l.data)} />
                            <path d={toPath(l.data)} fill="none" stroke={l.color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        </g>
                    ))}
                    {/* Crosshair */}
                    {hoverX !== null && hoverX >= pad && hoverX <= chartW - pad && (
                        <line x1={hoverX} y1={pad} x2={hoverX} y2={chartH - pad} stroke="rgba(255,255,255,0.15)" strokeWidth="1" strokeDasharray="3,3" />
                    )}
                </svg>
                {/* X 轴标签 */}
                <div className="flex justify-between px-6 -mt-1">
                    {tickLabels.map(l => <span key={l} className="text-[9px] text-slate-600 font-mono">{l}</span>)}
                </div>
            </div>
        </div>
    )
}

// ── Fleet Stream (Provider 队列 + 任务时间线) ────────────────
function FleetStream({ providers = [], healthStatuses = {}, recentTasks = [], t, navigate }) {
    const FLEET_COLORS = {
        claude: { bg: 'bg-orange-500/10', border: 'border-orange-500/20', text: 'text-orange-400', glow: '#f97316' },
        codex: { bg: 'bg-blue-500/10', border: 'border-blue-500/20', text: 'text-blue-400', glow: '#3b82f6' },
        gemini: { bg: 'bg-purple-500/10', border: 'border-purple-500/20', text: 'text-purple-400', glow: '#a855f7' },
        opencode: { bg: 'bg-cyan-500/10', border: 'border-cyan-500/20', text: 'text-cyan-400', glow: '#06b6d4' },
        droid: { bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', text: 'text-emerald-400', glow: '#10b981' }
    }
    const STATUS_ICONS = { operational: 'radio_button_checked', degraded: 'radio_button_partial', offline: 'radio_button_unchecked', unknown: 'help' }

    return (
        <div className="bg-[var(--color-surface-dark)] border border-[var(--color-border-dark)] rounded-xl overflow-hidden animate-stagger-in" style={{ animationDelay: '200ms' }}>
            <div className="p-4 border-b border-[var(--color-border-dark)] flex items-center justify-between">
                <h3 className="text-white font-semibold text-sm">{t('dashboard.fleetStream')}</h3>
                <span className="text-[10px] text-slate-500">{providers.length} {t('dashboard.providers')} • {recentTasks.length} {t('dashboard.events')}</span>
            </div>
            <div className="flex min-h-[200px]">
                {/* 左侧 Provider 舰队 (30%) */}
                <div className="w-[35%] border-r border-[var(--color-border-dark)] p-3 space-y-2">
                    {providers.length === 0 ? (
                        <p className="text-slate-500 text-xs text-center py-8">{t('dashboard.noProviders')}</p>
                    ) : providers.map(p => {
                        const h = healthStatuses[p.name] || {}
                        const status = h.status || 'offline'
                        const fc = FLEET_COLORS[p.name] || FLEET_COLORS.claude
                        return (
                            <div key={p.name}
                                className={`rounded-lg p-3 border transition-all cursor-pointer hover:scale-[1.02] ${fc.bg} ${fc.border}`}
                                onClick={() => navigate('/providers')}
                            >
                                <div className="flex items-center gap-2 mb-1">
                                    <span className={`material-symbols-outlined text-[16px] ${fc.text} ${status === 'operational' ? 'animate-pulse' : ''}`}>
                                        {STATUS_ICONS[status] || 'help'}
                                    </span>
                                    <span className="text-white text-xs font-semibold">{p.label || p.name}</span>
                                </div>
                                <div className="flex items-center justify-between text-[9px] text-slate-500">
                                    <span>{status}</span>
                                    <span>{h.latency || '--'}</span>
                                </div>
                            </div>
                        )
                    })}
                </div>
                {/* 右侧任务时间线 (70%) */}
                <div className="flex-1 p-3 overflow-y-auto max-h-[280px] custom-thin-scrollbar">
                    {recentTasks.length === 0 ? (
                        <p className="text-slate-500 text-xs text-center py-8">{t('dashboard.noRecentSessions')}</p>
                    ) : recentTasks.slice(0, 10).map((task, i) => {
                        const diff = Date.now() - new Date(task.timestamp).getTime()
                        const ago = diff < 60000 ? 'now' : diff < 3600000 ? `${Math.floor(diff / 60000)}m` : `${Math.floor(diff / 3600000)}h`
                        const pc = FLEET_COLORS[task.provider] || FLEET_COLORS.claude
                        return (
                            <div key={task.id || i} className="flex items-start gap-3 py-2 group hover:bg-white/[0.02] rounded-lg px-2 -mx-2 transition-colors">
                                <div className="flex flex-col items-center mt-1">
                                    <span className={`size-2 rounded-full ${pc.text === 'text-orange-400' ? 'bg-orange-400' : pc.text === 'text-blue-400' ? 'bg-blue-400' : pc.text === 'text-purple-400' ? 'bg-purple-400' : 'bg-slate-400'}`} />
                                    {i < recentTasks.slice(0, 10).length - 1 && <div className="w-px h-6 bg-[var(--color-border-dark)] mt-1" />}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                        <span className="text-white text-xs font-medium truncate">{task.title || 'Untitled'}</span>
                                        <span className={`text-[9px] px-1.5 py-0.5 rounded-full ${pc.bg} ${pc.text} ${pc.border} border`}>{task.provider}</span>
                                    </div>
                                    <p className="text-slate-600 text-[10px] truncate mt-0.5">{task.preview || ''}</p>
                                </div>
                                <span className="text-slate-600 text-[10px] shrink-0 font-mono">{ago}</span>
                                {/* Hover 操作 */}
                                <div className="opacity-0 group-hover:opacity-100 flex gap-1 transition-opacity shrink-0">
                                    <button className="size-5 rounded bg-white/5 flex items-center justify-center hover:bg-white/10 transition-colors">
                                        <span className="material-symbols-outlined text-[11px] text-slate-400">open_in_new</span>
                                    </button>
                                    <button className="size-5 rounded bg-white/5 flex items-center justify-center hover:bg-white/10 transition-colors">
                                        <span className="material-symbols-outlined text-[11px] text-slate-400">replay</span>
                                    </button>
                                </div>
                            </div>
                        )
                    })}
                </div>
            </div>
        </div>
    )
}

function StatusBadge({ status }) {
    const s = STATUS_STYLES[status] || STATUS_STYLES.unknown
    return <span className={`text-[10px] px-2 py-0.5 rounded-full border shrink-0 ${s.badge}`}>{status}</span>
}

function SkeletonDashboard() {
    return (
        <div className="p-6 space-y-6 animate-fade-in">
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                {[1, 2, 3, 4].map(i => <div key={i} className="skeleton skeleton-hero rounded-xl" />)}
            </div>
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                <div className="xl:col-span-2 space-y-3">
                    {[1, 2, 3, 4].map(i => <div key={i} className="skeleton skeleton-card rounded-xl" />)}
                </div>
                <div className="skeleton rounded-xl h-[340px]" />
            </div>
        </div>
    )
}

export default function Dashboard() {
    const { t } = useTranslation()
    const navigate = useNavigate()
    const providers = useAppStore(s => s.providers)
    const healthStatuses = useAppStore(s => s.healthStatuses)
    const dashboardData = useAppStore(s => s.dashboardData)
    const isLoadingDashboard = useAppStore(s => s.isLoadingDashboard)
    const recentTasks = useAppStore(s => s.recentTasks)
    const isLoadingRecentTasks = useAppStore(s => s.isLoadingRecentTasks)

    useEffect(() => {
        useAppStore.getState().fetchDashboard()
        useAppStore.getState().fetchRecentTasks(8)
        const interval = setInterval(() => {
            useAppStore.getState().fetchDashboard()
        }, 30000)
        return () => clearInterval(interval)
    }, [])

    const enabledProviders = providers.filter(p => p.enabled)
    const operationalCount = Object.values(healthStatuses).filter(s => s?.status === 'operational').length
    const askdStatus = healthStatuses._askd?.status || 'offline'
    const maildStatus = healthStatuses._maild?.status || 'offline'

    const today = new Date().toDateString()
    const todayTasks = recentTasks.filter(t => new Date(t.timestamp).toDateString() === today)

    // 模拟 sparkline 数据（真实数据可从 health history 获取）
    const genSparkData = (base, variance) => Array.from({ length: 12 }, () => base + (Math.random() - 0.5) * variance)

    const heroCards = [
        { label: t('dashboard.activeProviders'), value: String(enabledProviders.length), change: t('dashboard.nOnline', { n: operationalCount }), changeColor: operationalCount > 0 ? 'text-emerald-500' : 'text-red-500', icon: 'dns', iconColor: 'text-[var(--color-primary)]', sparkData: genSparkData(operationalCount, 2), sparkColor: '#10b981' },
        { label: t('dashboard.todayTasks'), value: String(todayTasks.length), change: `${recentTasks.length} ${t('tasks.sessionsFound')}`, changeColor: 'text-slate-400', icon: 'task_alt', iconColor: 'text-amber-400', sparkData: genSparkData(todayTasks.length, 5), sparkColor: '#f59e0b' },
        { label: t('dashboard.askdUptime'), value: askdStatus === 'operational' ? healthStatuses._askd?.uptime || t('dashboard.statusUp') : t('dashboard.statusDown'), change: askdStatus === 'operational' ? t('common.online') : t('common.offline'), changeColor: askdStatus === 'operational' ? 'text-emerald-500' : 'text-red-500', icon: 'cloud_queue', iconColor: 'text-purple-400', sparkData: genSparkData(askdStatus === 'operational' ? 8 : 2, 3), sparkColor: '#a855f7' },
        { label: t('dashboard.mailDaemon'), value: maildStatus === 'operational' ? t('dashboard.statusActive') : t('dashboard.statusDown'), change: maildStatus === 'operational' ? t('common.stable') : t('common.offline'), changeColor: maildStatus === 'operational' ? 'text-emerald-500' : 'text-red-500', icon: 'mark_email_read', iconColor: 'text-pink-400', sparkData: genSparkData(maildStatus === 'operational' ? 6 : 1, 3), sparkColor: '#ec4899' }
    ]

    const providerList = enabledProviders.map(p => {
        const health = healthStatuses[p.name] || {}
        return {
            name: health.label || p.label || p.name,
            providerName: p.name,
            status: health.status || 'unknown',
            pid: health.pid ? `PID ${health.pid}` : 'N/A',
            latency: health.latency || '--',
            uptime: health.uptime || '--',
            sparkColor: health.status === 'operational' ? '#10b981' : health.status === 'degraded' ? '#f97316' : '#64748b',
            sparkData: genSparkData(health.status === 'operational' ? 8 : 3, 4)
        }
    })

    function relativeTime(ts) {
        const diff = Date.now() - new Date(ts).getTime()
        const mins = Math.floor(diff / 60000)
        if (mins < 1) return 'just now'
        if (mins < 60) return `${mins}m ago`
        const hrs = Math.floor(mins / 60)
        if (hrs < 24) return `${hrs}h ago`
        return `${Math.floor(hrs / 24)}d ago`
    }

    const PROVIDER_COLORS = {
        claude: 'bg-orange-500/20 text-orange-400',
        codex: 'bg-blue-500/20 text-blue-400',
        gemini: 'bg-purple-500/20 text-purple-400',
        opencode: 'bg-cyan-500/20 text-cyan-400',
        droid: 'bg-emerald-500/20 text-emerald-400'
    }

    const TASK_STATUS = {
        completed: { color: 'text-emerald-500', icon: 'check_circle' },
        running: { color: 'text-blue-400', icon: 'play_circle' },
        failed: { color: 'text-red-500', icon: 'error' },
        unknown: { color: 'text-slate-500', icon: 'help' }
    }

    return (
        <div className="flex flex-col h-full overflow-hidden">
            <header className="h-12 border-b border-[var(--color-border-dark)] flex items-center justify-between px-6 shrink-0 bg-[var(--color-surface-dark)]/50">
                <h2 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
                    {t('dashboard.title')}
                    <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${operationalCount > 0 ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' : 'bg-red-500/10 text-red-500 border-red-500/20'
                        }`}>
                        {operationalCount > 0 ? t('dashboard.live') : t('common.offline')}
                    </span>
                </h2>
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1.5 text-xs text-slate-400">
                        <span className={`size-2 rounded-full ${operationalCount > 0 ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`} />
                        {operationalCount > 0 ? t('dashboard.systemOperational') : t('dashboard.systemOffline')}
                    </div>
                    <button
                        onClick={() => { useAppStore.getState().fetchDashboard(); useAppStore.getState().fetchRecentTasks(8) }}
                        className="flex items-center justify-center rounded-lg h-8 px-3 bg-white/5 border border-[var(--color-border-dark)] text-slate-300 text-xs font-medium transition-colors hover:bg-white/10 gap-1.5"
                    >
                        <span className={`material-symbols-outlined text-[14px] ${isLoadingDashboard ? 'animate-spin' : ''}`}>refresh</span>
                        <span>{t('common.refresh')}</span>
                    </button>
                </div>
            </header>

            <div className="flex-1 overflow-y-auto p-6 scroll-smooth">
                {/* Hero 指标行 */}
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
                    {heroCards.map((card, i) => <HeroCard key={card.label} {...card} delay={i * 80} />)}
                </div>

                {/* Hero Chart — 全景性能曲线 */}
                <div className="mb-6">
                    <HeroChart providers={enabledProviders} healthStatuses={healthStatuses} t={t} />
                </div>

                {/* Quick Actions */}
                <div className="mb-6">
                    <QuickActions t={t} navigate={navigate} />
                </div>

                {/* Fleet Stream — Provider 队列 + 任务时间线 */}
                <div className="mb-6">
                    <FleetStream providers={enabledProviders} healthStatuses={healthStatuses} recentTasks={recentTasks} t={t} navigate={navigate} />
                </div>

                {/* Provider Status + Daemon Panel */}
                <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 mb-6">
                    <div className="xl:col-span-2 flex flex-col gap-4 animate-stagger-in" style={{ animationDelay: '150ms' }}>
                        <div className="flex items-center justify-between">
                            <h3 className="text-white font-semibold">{t('dashboard.providerStatus')}</h3>
                            <button
                                onClick={() => navigate('/providers')}
                                className="text-xs text-[var(--color-primary)] hover:text-blue-400 font-medium flex items-center gap-1"
                            >
                                {t('dashboard.viewAll')} <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
                            </button>
                        </div>

                        {providerList.length === 0 ? (
                            <div className="bg-[var(--color-surface-dark)] border border-[var(--color-border-dark)] rounded-xl p-8 text-center">
                                <span className="material-symbols-outlined text-[32px] text-slate-600 mb-2 block">dns</span>
                                <p className="text-slate-400 text-sm">{t('dashboard.noProviders')}</p>
                                <p className="text-slate-500 text-xs mt-1">{t('dashboard.noProvidersDesc')}</p>
                            </div>
                        ) : (
                            providerList.map((p) => (
                                <div key={p.providerName} className="bg-[var(--color-surface-dark)] border border-[var(--color-border-dark)] rounded-xl p-4 flex items-center justify-between shadow-sm hover:border-[var(--color-primary)]/30 transition-all gap-4">
                                    <div className="flex items-center gap-4">
                                        <div className="bg-[var(--color-surface-darker)] p-2.5 rounded-lg border border-[var(--color-border-dark)]">
                                            <span className={`material-symbols-outlined text-white text-[22px]`}>smart_toy</span>
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2 mb-0.5">
                                                <h4 className="text-white font-semibold text-sm">{p.name}</h4>
                                                <StatusBadge status={p.status} />
                                            </div>
                                            <p className="text-slate-400 text-xs">{p.pid} • Latency: {p.latency} • Uptime: {p.uptime}</p>
                                        </div>
                                    </div>
                                    <div className="hidden lg:block w-28 h-8 shrink-0">
                                        <Sparkline data={p.sparkData} color={p.sparkColor} height={32} width={112} />
                                    </div>
                                    <button
                                        onClick={() => navigate('/providers')}
                                        className="bg-[var(--color-surface-darker)] hover:bg-white/5 text-slate-300 p-2 rounded-lg border border-[var(--color-border-dark)] transition-colors"
                                    >
                                        <span className="material-symbols-outlined text-[18px]">settings</span>
                                    </button>
                                </div>
                            ))
                        )}
                    </div>

                    {/* Daemon Status Panel */}
                    <div className="flex flex-col bg-[var(--color-surface-dark)] border border-[var(--color-border-dark)] rounded-xl overflow-hidden animate-stagger-in" style={{ animationDelay: '250ms' }}>
                        <div className="p-4 border-b border-[var(--color-border-dark)] bg-[var(--color-surface-darker)]/50 flex justify-between items-center">
                            <h3 className="text-white font-semibold text-sm">{t('dashboard.daemonStatus')}</h3>
                            <span className={`size-2 rounded-full ${operationalCount > 0 ? 'bg-emerald-500' : 'bg-red-500'}`} />
                        </div>
                        <div className="flex flex-col p-2">
                            {['_askd', '_maild'].map(key => {
                                const d = healthStatuses[key]
                                if (!d) return null
                                return (
                                    <div key={key} className="flex items-center gap-3 p-3 rounded-lg hover:bg-white/5 transition-colors">
                                        <span className={`size-2 rounded-full ${STATUS_STYLES[d.status]?.dot || 'bg-slate-500'}`} />
                                        <div className="flex-1 min-w-0">
                                            <p className="text-white text-sm font-medium">{d.label}</p>
                                            <p className="text-slate-400 text-xs">
                                                {d.status} {d.pid ? `• PID ${d.pid}` : ''} {d.port ? `• Port ${d.port}` : ''}
                                            </p>
                                        </div>
                                        <StatusBadge status={d.status} />
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                </div>

                {/* Activity Heatmap + Recent Tasks */}
                <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 mb-6">
                    <div className="xl:col-span-2">
                        {/* Recent Task Stream */}
                        <div className="animate-stagger-in" style={{ animationDelay: '350ms' }}>
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-white font-semibold">{t('dashboard.recentTaskStream')}</h3>
                                <span className="text-xs text-slate-500">{recentTasks.length} sessions</span>
                            </div>

                            {isLoadingRecentTasks ? (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    {[1, 2, 3, 4].map(i => <div key={i} className="skeleton skeleton-card" />)}
                                </div>
                            ) : recentTasks.length === 0 ? (
                                <div className="bg-[var(--color-surface-dark)] border border-[var(--color-border-dark)] rounded-xl p-8 text-center">
                                    <div className="empty-state-glow inline-block">
                                        <span className="material-symbols-outlined text-[32px] text-slate-600 animate-float-icon block">history</span>
                                    </div>
                                    <p className="text-slate-400 text-sm mt-3">{t('dashboard.noRecentSessions')}</p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    {recentTasks.map((task, idx) => {
                                        const st = TASK_STATUS[task.status] || TASK_STATUS.unknown
                                        const pc = PROVIDER_COLORS[task.provider] || 'bg-slate-500/20 text-slate-400'
                                        return (
                                            <div key={task.id || idx}
                                                className="bg-[var(--color-surface-dark)] border border-[var(--color-border-dark)] rounded-xl p-3.5 flex items-start gap-3 hover:border-[var(--color-primary)]/30 transition-all cursor-pointer group"
                                            >
                                                <span className={`material-symbols-outlined text-[18px] mt-0.5 ${st.color}`}>{st.icon}</span>
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <p className="text-white text-sm font-medium truncate">{task.title || 'Untitled'}</p>
                                                        <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium shrink-0 ${pc}`}>{task.provider}</span>
                                                    </div>
                                                    <p className="text-slate-500 text-xs truncate">{task.preview || task.sessionFile || ''}</p>
                                                </div>
                                                <span className="text-slate-600 text-[10px] shrink-0 mt-0.5">{relativeTime(task.timestamp)}</span>
                                            </div>
                                        )
                                    })}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Activity Heatmap */}
                    <ActivityHeatmap tasks={recentTasks} t={t} />
                </div>
            </div>
        </div>
    )
}
