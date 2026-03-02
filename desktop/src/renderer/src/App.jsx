import { Routes, Route, useNavigate, useLocation } from 'react-router-dom'
import { useState, useEffect, useCallback, Suspense, lazy } from 'react'
import TopNavBar from './components/TopNavBar'
import CommandPalette from './components/CommandPalette'
import OnboardingWizard from './components/OnboardingWizard'
import QuickAsk from './components/QuickAsk'
import ClipboardSense from './components/ClipboardSense'
import GlobalSearch from './components/GlobalSearch'
import ErrorBoundary from './components/ErrorBoundary'
import ToastContainer, { useToastStore } from './components/ToastContainer'
import { useAppStore } from './store'
import useAskStore from './store/askStore'
import i18n from './i18n'

// ── 路由懒加载 ──
const Dashboard = lazy(() => import('./pages/Dashboard'))
const Ask = lazy(() => import('./pages/Ask'))
const Providers = lazy(() => import('./pages/Providers'))
const Tasks = lazy(() => import('./pages/Tasks'))
const Terminal = lazy(() => import('./pages/Terminal'))
const Mail = lazy(() => import('./pages/Mail'))
const Settings = lazy(() => import('./pages/Settings'))
const Extensions = lazy(() => import('./pages/Extensions'))

// ── 路由加载骨架 ──
function RouteFallback() {
    return (
        <div className="flex items-center justify-center h-full animate-fade-in">
            <div className="flex flex-col items-center gap-3">
                <div className="w-8 h-8 border-2 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin" />
                <span className="text-slate-500 text-sm">{i18n.t('common.loading')}</span>
            </div>
        </div>
    )
}

const api = typeof window !== 'undefined' ? window.electronAPI : null

export default function App() {
    const [paletteOpen, setPaletteOpen] = useState(false)
    const [onboardingOpen, setOnboardingOpen] = useState(false)
    const [quickAskOpen, setQuickAskOpen] = useState(false)
    const [searchOpen, setSearchOpen] = useState(false)
    const [trayHighlight, setTrayHighlight] = useState(false)
    const navigate = useNavigate()
    const location = useLocation()

    // ── Cmd+Shift+P → 命令面板 ──
    const TAB_ROUTES = ['/', '/ask', '/providers', '/tasks', '/terminal', '/mail', '/extensions']
    const handleKeyDown = useCallback((e) => {
        if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'p') {
            e.preventDefault()
            setPaletteOpen(prev => !prev)
        }
        // Cmd+Shift+A → Quick Ask 浮窗
        if ((e.metaKey || e.ctrlKey) && e.shiftKey && (e.key === 'a' || e.key === 'A')) {
            e.preventDefault()
            setQuickAskOpen(prev => !prev)
        }
        // Cmd+1~7 → Tab 切换
        if ((e.metaKey || e.ctrlKey) && !e.shiftKey && e.key >= '1' && e.key <= '7') {
            e.preventDefault()
            const idx = parseInt(e.key) - 1
            if (TAB_ROUTES[idx]) navigate(TAB_ROUTES[idx])
        }
        // Cmd+, → Settings
        if ((e.metaKey || e.ctrlKey) && e.key === ',') {
            e.preventDefault()
            navigate('/settings')
        }
        // Cmd+F → 全局搜索
        if ((e.metaKey || e.ctrlKey) && e.key === 'f' && !e.shiftKey) {
            e.preventDefault()
            setSearchOpen(prev => !prev)
        }
    }, [navigate])

    useEffect(() => {
        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [handleKeyDown])

    // ── 首次启动 Onboarding ──
    useEffect(() => {
        const done = localStorage.getItem(OnboardingWizard.STORAGE_KEY)
        if (!done) {
            setOnboardingOpen(true)
        }
    }, [])

    // ── Theme + Scale 初始化 & 动态同步 ──
    useEffect(() => {
        function applyTheme(theme) {
            document.documentElement.setAttribute('data-theme', theme || 'dark')
        }
        function applyScale(scale) {
            const s = Math.max(75, Math.min(150, scale || 100))
            document.documentElement.setAttribute('data-scale', String(s))
            document.documentElement.style.setProperty('--app-scale', String(s / 100))
        }

        // 读取当前设置并应用
        const settings = useAppStore.getState().settings
        applyTheme(settings.theme)
        applyScale(settings.interfaceScale)

        // 订阅 store 变更
        const unsubscribe = useAppStore.subscribe((state, prev) => {
            if (state.settings.theme !== prev?.settings?.theme) {
                applyTheme(state.settings.theme)
            }
            if (state.settings.interfaceScale !== prev?.settings?.interfaceScale) {
                applyScale(state.settings.interfaceScale)
            }
        })

        return () => unsubscribe()
    }, [])

    // ── 初始化：加载数据 + 启动实时事件监听 ──
    useEffect(() => {
        // Ask 模块初始化
        useAskStore.getState().loadSessions()
        useAskStore.getState().checkAskdStatus()

        // 全局 store 实时事件监听
        const appStore = useAppStore.getState()
        appStore.initRealtimeListeners()

        // 注入 Process 事件 → Toast 通知
        appStore.setProcessEventHandler((type, data) => {
            const toast = useToastStore.getState()
            const name = data?.name || 'Unknown'
            switch (type) {
                case 'started':
                    toast.success(i18n.t('toast.providerStarted', { name, pid: data?.pid || '?' }))
                    break
                case 'stopped':
                    toast.info(i18n.t('toast.providerStopped', { name }))
                    break
                case 'error':
                    toast.error(i18n.t('toast.providerError', { name, error: data?.error || i18n.t('toast.processError') }))
                    break
            }
        })

        return () => {
            useAppStore.getState().cleanupListeners()
        }
    }, [])

    // ── Tray 导航事件：从托盘菜单跳转页面 ──
    useEffect(() => {
        const cleanup = api?.onNavigate?.((path) => {
            navigate(path)
            setTrayHighlight(true)
            setTimeout(() => setTrayHighlight(false), 800)
        })
        return () => cleanup?.()
    }, [navigate])

    // ── B3: 快捷键事件监听（主进程 shortcut-manager 推送） ──
    useEffect(() => {
        if (!api) return
        const cleanups = []

        if (api.onShortcutCommandPalette) {
            cleanups.push(api.onShortcutCommandPalette(() => setPaletteOpen(true)))
        }
        if (api.onShortcutAskFocus) {
            cleanups.push(api.onShortcutAskFocus(() => navigate('/ask')))
        }
        if (api.onShortcutRefreshDashboard) {
            cleanups.push(api.onShortcutRefreshDashboard(() => {
                useAppStore.getState().fetchDashboard()
                useToastStore.getState().info(i18n.t('toast.dashboardRefreshed'))
            }))
        }
        if (api.onShortcutZoomIn) {
            cleanups.push(api.onShortcutZoomIn(() => {
                const cur = parseFloat(document.documentElement.style.zoom || '1')
                document.documentElement.style.zoom = String(Math.min(cur + 0.1, 2))
            }))
        }
        if (api.onShortcutZoomOut) {
            cleanups.push(api.onShortcutZoomOut(() => {
                const cur = parseFloat(document.documentElement.style.zoom || '1')
                document.documentElement.style.zoom = String(Math.max(cur - 0.1, 0.5))
            }))
        }
        if (api.onShortcutZoomReset) {
            cleanups.push(api.onShortcutZoomReset(() => {
                document.documentElement.style.zoom = '1'
            }))
        }

        return () => cleanups.forEach(fn => typeof fn === 'function' && fn())
    }, [navigate])

    // ── B9: Crash Recovery ──
    useEffect(() => {
        if (!api?.getCrashState) return
        api.getCrashState().then(state => {
            if (state?.recovered && state.route) {
                navigate(state.route)
                if (state.sessionId) {
                    useAskStore.getState().loadSession(state.sessionId)
                }
                useToastStore.getState().info(i18n.t('toast.sessionRestored'))
            }
        }).catch(() => { })
    }, [])

    // B9: 路由变更时保存崩溃状态
    useEffect(() => {
        if (!api?.saveCrashState) return
        const sessionId = useAskStore.getState().activeSessionId
        api.saveCrashState({ route: location.pathname, sessionId }).catch(() => { })
    }, [location.pathname])

    // ── 注册 Ask 流式事件监听器 ──
    useEffect(() => {
        if (!api) return
        const cleanups = []

        if (api.onAskStreamStart) {
            cleanups.push(api.onAskStreamStart((data) => {
                useAskStore.getState().handleStreamStart(data)
            }))
        }
        if (api.onAskStreamChunk) {
            cleanups.push(api.onAskStreamChunk((data) => {
                useAskStore.getState().handleStreamChunk(data)
            }))
        }
        if (api.onAskStreamEnd) {
            cleanups.push(api.onAskStreamEnd((data) => {
                useAskStore.getState().handleStreamEnd(data)

                // Ask 完成后发送桌面通知 + Toast
                const provider = data?.provider || 'AI'
                useToastStore.getState().success(i18n.t('toast.askComplete', { provider }))
                useAppStore.getState().sendDesktopNotification(
                    i18n.t('notify.askComplete'),
                    i18n.t('notify.askCompleteBody', { provider })
                )
            }))
        }
        if (api.onAskStreamError) {
            cleanups.push(api.onAskStreamError((data) => {
                useAskStore.getState().handleStreamError(data)
                useToastStore.getState().error(i18n.t('toast.streamError', { error: data?.error || i18n.t('toast.unknownError') }))
            }))
        }
        if (api.onAskStreamAbort) {
            cleanups.push(api.onAskStreamAbort((data) => {
                useAskStore.getState().handleStreamAbort(data)
                useToastStore.getState().info(i18n.t('toast.streamAborted', { provider: data?.provider || 'Stream' }))
            }))
        }

        return () => {
            cleanups.forEach(cleanup => {
                if (typeof cleanup === 'function') cleanup()
            })
        }
    }, [])

    // ── FileWatcher 事件（文件系统变更推送） ──
    useEffect(() => {
        if (!api) return
        const cleanups = []

        if (api.onFileChanged) {
            cleanups.push(api.onFileChanged(() => {
                useAppStore.getState().fetchDashboard()
            }))
        }
        if (api.onSessionsChanged) {
            cleanups.push(api.onSessionsChanged(() => {
                useAskStore.getState().loadSessions()
            }))
        }
        if (api.onDaemonChanged) {
            cleanups.push(api.onDaemonChanged(() => {
                useAppStore.getState().fetchHealth()
            }))
        }

        return () => cleanups.forEach(fn => typeof fn === 'function' && fn())
    }, [])

    return (
        <div className={`flex flex-col h-screen w-full overflow-hidden ${trayHighlight ? 'animate-tray-flash' : ''}`}>
            <TopNavBar />
            <main className="flex-1 overflow-hidden">
                <ErrorBoundary>
                    <Suspense fallback={<RouteFallback />}>
                        <Routes>
                            <Route path="/" element={<Dashboard />} />
                            <Route path="/ask" element={<Ask />} />
                            <Route path="/providers" element={<Providers />} />
                            <Route path="/tasks" element={<Tasks />} />
                            <Route path="/terminal" element={<Terminal />} />
                            <Route path="/mail" element={<Mail />} />
                            <Route path="/settings" element={<Settings />} />
                            <Route path="/extensions" element={<Extensions />} />
                        </Routes>
                    </Suspense>
                </ErrorBoundary>
            </main>

            {/* 全局浮层 */}
            <CommandPalette isOpen={paletteOpen} onClose={() => setPaletteOpen(false)} />
            <OnboardingWizard isOpen={onboardingOpen} onClose={() => setOnboardingOpen(false)} />
            <QuickAsk isOpen={quickAskOpen} onClose={() => setQuickAskOpen(false)} />
            <ClipboardSense />
            <GlobalSearch isOpen={searchOpen} onClose={() => setSearchOpen(false)} />
            <ToastContainer />
        </div>
    )
}
