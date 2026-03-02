import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { NavLink, useLocation } from 'react-router-dom'
import { useAppStore } from '../store'

const navItems = [
    { to: '/', icon: 'dashboard', labelKey: 'nav.dashboard' },
    { to: '/ask', icon: 'chat', labelKey: 'nav.ask' },
    { to: '/providers', icon: 'dns', labelKey: 'nav.providers' },
    { to: '/tasks', icon: 'task_alt', labelKey: 'nav.tasks' },
    { to: '/terminal', icon: 'terminal', labelKey: 'nav.terminal' },
    { to: '/mail', icon: 'mail', labelKey: 'nav.mail' },
    { to: '/extensions', icon: 'extension', labelKey: 'nav.extensions' }
]

export default function TopNavBar() {
    const { t, i18n } = useTranslation()
    const [isCompact, setIsCompact] = useState(false)
    const [showOverflow, setShowOverflow] = useState(false)
    const location = useLocation()

    // Badge 通知状态
    const navBadges = useAppStore(s => s.navBadges)

    // 响应式折叠：窗口 < 1200px 仅图标，< 800px 收纳到 ... 菜单
    const handleResize = useCallback(() => {
        setIsCompact(window.innerWidth < 1200)
    }, [])

    useEffect(() => {
        handleResize()
        window.addEventListener('resize', handleResize)
        return () => window.removeEventListener('resize', handleResize)
    }, [handleResize])

    // 访问 Tab 时自动清除该 Tab 的 Badge
    useEffect(() => {
        const currentPath = location.pathname === '/' ? '/' : `/${location.pathname.split('/')[1]}`
        if (navBadges[currentPath]) {
            useAppStore.getState().clearNavBadge(currentPath)
        }
        // 记忆最后 Tab
        useAppStore.getState().setLastTab(currentPath)
    }, [location.pathname])

    const toggleLang = () => {
        i18n.changeLanguage(i18n.language === 'en' ? 'zh' : 'en')
    }

    const visibleThreshold = 800
    const isNarrow = typeof window !== 'undefined' && window.innerWidth < visibleThreshold

    // 可见和溢出 nav items
    const visibleItems = isNarrow ? navItems.slice(0, 3) : navItems
    const overflowItems = isNarrow ? navItems.slice(3) : []

    return (
        <nav className="titlebar-drag h-14 w-full nav-glassmorphism border-b border-[var(--color-border-dark)] flex items-center justify-between px-4 shrink-0 z-50 select-none">
            {/* 左侧：macOS 红绿灯占位 + Logo + Tab 导航 */}
            <div className="titlebar-no-drag flex items-center gap-2">
                {/* macOS Traffic Light 占位: 约 70px */}
                <div className="w-[70px] shrink-0" />

                {/* Logo */}
                <div className="flex items-center gap-2 mr-2">
                    <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-blue-600 to-cyan-400 flex items-center justify-center shadow-lg shadow-blue-900/30">
                        <span className="text-white text-xs font-bold">CC</span>
                    </div>
                    {!isCompact && (
                        <div className="flex flex-col leading-none">
                            <span className="text-white text-sm font-bold tracking-tight">CCB Desktop</span>
                            <span className="text-slate-500 text-[9px] font-medium uppercase tracking-wider">Control Center</span>
                        </div>
                    )}
                </div>

                <div className="h-5 w-px bg-[var(--color-border-dark)] mx-1" />

                {/* Tab 导航 */}
                <div className="flex items-center gap-0.5">
                    {visibleItems.map((item) => {
                        const badge = navBadges[item.to]
                        return (
                            <NavLink
                                key={item.to}
                                to={item.to}
                                end={item.to === '/'}
                                className={({ isActive }) =>
                                    `relative flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${isActive
                                        ? 'bg-[var(--color-primary)]/10 text-[var(--color-primary)]'
                                        : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'
                                    }`
                                }
                            >
                                {({ isActive }) => (
                                    <>
                                        <span className={`material-symbols-outlined text-[18px] ${badge?.shake ? 'animate-shake' : ''}`}>
                                            {item.icon}
                                        </span>
                                        {!isCompact && <span>{t(item.labelKey)}</span>}

                                        {/* Badge 红点 */}
                                        {badge?.dot && !isActive && (
                                            <span className="absolute top-1 right-1 size-2 rounded-full bg-red-500 shadow-lg shadow-red-500/50 animate-pulse" />
                                        )}

                                        {/* 活跃 Tab 底部渐变指示条 */}
                                        {isActive && (
                                            <span className="absolute -bottom-[9px] left-2 right-2 h-[3px] rounded-full bg-gradient-to-r from-blue-500 to-cyan-400 shadow-sm shadow-blue-500/30" />
                                        )}
                                    </>
                                )}
                            </NavLink>
                        )
                    })}

                    {/* 溢出菜单 */}
                    {overflowItems.length > 0 && (
                        <div className="relative">
                            <button
                                onClick={() => setShowOverflow(!showOverflow)}
                                className="flex items-center justify-center size-8 rounded-lg text-slate-400 hover:bg-white/5 hover:text-white transition-colors"
                            >
                                <span className="material-symbols-outlined text-[18px]">more_horiz</span>
                                {/* 溢出菜单中有 badge 时显示红点 */}
                                {overflowItems.some(i => navBadges[i.to]?.dot) && (
                                    <span className="absolute top-0.5 right-0.5 size-2 rounded-full bg-red-500 animate-pulse" />
                                )}
                            </button>
                            {showOverflow && (
                                <>
                                    <div className="fixed inset-0 z-40" onClick={() => setShowOverflow(false)} />
                                    <div className="absolute top-full left-0 mt-1 w-44 bg-[var(--color-surface-dark)] border border-[var(--color-border-dark)] rounded-xl shadow-xl z-50 py-1 animate-slide-up">
                                        {overflowItems.map(item => {
                                            const badge = navBadges[item.to]
                                            return (
                                                <NavLink
                                                    key={item.to}
                                                    to={item.to}
                                                    onClick={() => setShowOverflow(false)}
                                                    className={({ isActive }) =>
                                                        `flex items-center gap-2 px-3 py-2 text-sm transition-colors ${isActive
                                                            ? 'text-[var(--color-primary)] bg-[var(--color-primary)]/5'
                                                            : 'text-slate-400 hover:bg-white/5 hover:text-white'
                                                        }`
                                                    }
                                                >
                                                    <span className={`material-symbols-outlined text-[16px] ${badge?.shake ? 'animate-shake' : ''}`}>{item.icon}</span>
                                                    {t(item.labelKey)}
                                                    {badge?.dot && <span className="size-2 rounded-full bg-red-500 ml-auto" />}
                                                </NavLink>
                                            )
                                        })}
                                    </div>
                                </>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* 右侧：搜索 + 工具按钮 */}
            <div className="titlebar-no-drag flex items-center gap-3">
                {/* 搜索框 */}
                <div className="relative hidden md:block">
                    <button
                        onClick={() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true }))}
                        className="bg-[var(--color-surface-dark)] border border-[var(--color-border-dark)] text-slate-500 text-xs rounded-lg pl-8 pr-2 py-1.5 w-44 hover:bg-[var(--color-surface-dark)]/80 transition-all text-left flex items-center justify-between gap-1 whitespace-nowrap"
                    >
                        <span className="truncate">{t('nav.search')}</span>
                        <kbd className="shrink-0 text-[10px] bg-[var(--color-border-dark)] px-1.5 py-0.5 rounded font-mono">⌘K</kbd>
                    </button>
                    <span className="material-symbols-outlined absolute left-2 top-1.5 text-slate-500 text-[16px] pointer-events-none">search</span>
                </div>

                {/* 语言切换 */}
                <button
                    onClick={toggleLang}
                    className="flex items-center justify-center h-8 px-2 rounded-lg text-slate-400 hover:bg-white/5 hover:text-white transition-colors text-xs font-medium"
                    title="Switch Language"
                >
                    {i18n.language === 'en' ? '中文' : 'EN'}
                </button>

                {/* 通知 */}
                <button className="relative flex items-center justify-center size-8 rounded-lg text-slate-400 hover:bg-white/5 hover:text-white transition-colors" aria-label="Notifications">
                    <span className="material-symbols-outlined text-[20px]">notifications</span>
                    {Object.values(navBadges).some(b => b?.dot) && (
                        <span className="absolute top-0.5 right-0.5 size-2.5 rounded-full bg-red-500 border-2 border-[var(--color-bg-dark)] animate-pulse" />
                    )}
                </button>

                {/* 设置 */}
                <NavLink
                    to="/settings"
                    className={({ isActive }) =>
                        `relative flex items-center justify-center size-8 rounded-lg transition-colors ${isActive ? 'text-[var(--color-primary)] bg-[var(--color-primary)]/10' : 'text-slate-400 hover:bg-white/5 hover:text-white'
                        }`
                    }
                >
                    <span className="material-symbols-outlined text-[20px]">settings</span>
                </NavLink>
            </div>
        </nav>
    )
}
