/**
 * Zustand Store — 全局状态管理
 *
 * 管理 provider 列表/状态、dashboard 数据、desktop 设置。
 * 通过 IPC 与主进程交互，通过事件监听接收实时推送。
 */
import { create } from 'zustand'

const api = typeof window !== 'undefined' ? window.electronAPI : null

export const useAppStore = create((set, get) => ({
    // ── Provider 状态 ────────────────────────────────────────
    providers: [],         // 全部 provider 列表 (含 enabled 标志)
    healthStatuses: {},    // provider 健康状态 map
    isLoadingProviders: false,

    fetchProviders: async () => {
        if (!api) return
        set({ isLoadingProviders: true })
        try {
            const providers = await api.getProviders()
            set({ providers, isLoadingProviders: false })
        } catch (err) {
            console.error('Failed to fetch providers:', err)
            set({ isLoadingProviders: false })
        }
    },

    fetchHealth: async () => {
        if (!api) return
        try {
            const statuses = await api.checkHealthAll()
            set({ healthStatuses: statuses })
        } catch (err) {
            console.error('Failed to check health:', err)
        }
    },

    pingProvider: async (name) => {
        if (!api) return null
        try {
            const result = await api.pingProvider(name)
            // 更新该 provider 的状态
            set((state) => ({
                healthStatuses: {
                    ...state.healthStatuses,
                    [name]: result
                }
            }))
            return result
        } catch (err) {
            console.error('Ping failed:', err)
            return null
        }
    },

    toggleProvider: async (name, enabled) => {
        if (!api) return
        const current = await api.getEnabledProviders()
        const updated = enabled
            ? [...new Set([...current, name])]
            : current.filter(p => p !== name)
        await api.setEnabledProviders(updated)
        await get().fetchProviders()
    },

    // ── Dashboard 数据 ──────────────────────────────────────
    dashboardData: null,
    isLoadingDashboard: false,

    fetchDashboard: async () => {
        if (!api) return
        set({ isLoadingDashboard: true })
        try {
            const data = await api.getDashboardOverview()
            const update = { dashboardData: data, isLoadingDashboard: false }
            // 仅在存在有效健康数据时更新，避免用 undefined 覆盖真实数据
            if (data?.healthStatuses && Object.keys(data.healthStatuses).length > 0) {
                update.healthStatuses = data.healthStatuses
            }
            set(update)
        } catch (err) {
            console.error('Failed to fetch dashboard:', err)
            set({ isLoadingDashboard: false })
        }
    },

    // ── 最近任务流 ──────────────────────────────────────────
    recentTasks: [],
    isLoadingRecentTasks: false,

    fetchRecentTasks: async (limit = 8) => {
        if (!api?.tasksGetRecent) return
        set({ isLoadingRecentTasks: true })
        try {
            const tasks = await api.tasksGetRecent(limit)
            set({ recentTasks: Array.isArray(tasks) ? tasks : [], isLoadingRecentTasks: false })
        } catch (err) {
            console.error('Failed to fetch recent tasks:', err)
            set({ isLoadingRecentTasks: false })
        }
    },

    // ── Desktop 设置 ────────────────────────────────────────
    settings: {
        theme: 'dark',
        accentColor: '#135bec',
        language: 'en',
        interfaceScale: 100,
        terminalScheme: 'classic',
        closeToTray: true,
        launchAtLogin: false
    },

    fetchSettings: async () => {
        if (!api) return
        try {
            const settings = await api.getDesktopSettings()
            set({ settings })
        } catch (err) {
            console.error('Failed to fetch settings:', err)
        }
    },

    updateSetting: async (key, value) => {
        if (!api) return
        try {
            const updated = await api.updateSetting(key, value)
            set({ settings: updated })
        } catch (err) {
            console.error('Failed to update setting:', err)
        }
    },

    // ── Process 控制 ────────────────────────────────────────
    startProvider: async (name) => {
        if (!api) return
        return api.startProvider(name)
    },

    stopProvider: async (name) => {
        if (!api) return
        return api.stopProvider(name)
    },

    restartProvider: async (name) => {
        if (!api) return
        return api.restartProvider(name)
    },

    // ── 主题/缩放 联动主进程 ─────────────────────────────────
    applyTheme: async (theme) => {
        if (!api?.applyTheme) return
        try {
            await api.applyTheme(theme)
        } catch (err) {
            console.error('Failed to apply theme:', err)
        }
    },

    applyScale: async (scale) => {
        if (!api?.applyScale) return
        try {
            await api.applyScale(scale)
        } catch (err) {
            console.error('Failed to apply scale:', err)
        }
    },

    // ── 开机自启联动系统 ─────────────────────────────────────
    syncLoginSettings: async (openAtLogin) => {
        if (!api?.setLoginSettings) return
        try {
            await api.setLoginSettings(openAtLogin)
        } catch (err) {
            console.error('Failed to set login settings:', err)
        }
    },

    // ── 桌面通知 ─────────────────────────────────────────────
    sendDesktopNotification: async (title, body) => {
        if (!api?.sendNotification) return
        try {
            await api.sendNotification(title, body)
        } catch (err) {
            console.error('Failed to send notification:', err)
        }
    },

    // ── 实时事件订阅 ────────────────────────────────────────
    _unsubscribers: [],

    initRealtimeListeners: () => {
        if (!api) return
        // 防止重复注册（React dev 模式 double-mount）
        const existing = get()._unsubscribers
        if (existing && existing.length > 0) {
            existing.forEach(unsub => unsub?.())
        }
        const unsubs = []

        // 健康状态推送 → 自动更新
        if (api.onHealthUpdate) {
            unsubs.push(api.onHealthUpdate((statuses) => {
                set({ healthStatuses: statuses })
            }))
        }

        // Settings 变更 → 自动同步
        if (api.onSettingsChanged) {
            unsubs.push(api.onSettingsChanged((settings) => {
                set({ settings })
            }))
        }

        // Config 变更 → 刷新 providers
        if (api.onConfigChanged) {
            unsubs.push(api.onConfigChanged(async () => {
                await get().fetchProviders()
            }))
        }

        // Session 文件变化 → 刷新最近任务
        if (api.onSessionsChanged) {
            unsubs.push(api.onSessionsChanged(async () => {
                await get().fetchRecentTasks()
            }))
        }

        // 进程启动/停止/报错 → 通知前端
        if (api.onProcessStarted) {
            unsubs.push(api.onProcessStarted((data) => {
                // data: { name, pid }
                get()._onProcessEvent?.('started', data)
            }))
        }
        if (api.onProcessStopped) {
            unsubs.push(api.onProcessStopped((data) => {
                get()._onProcessEvent?.('stopped', data)
            }))
        }
        if (api.onProcessError) {
            unsubs.push(api.onProcessError((data) => {
                get()._onProcessEvent?.('error', data)
            }))
        }

        // 主题/缩放 变更回推
        if (api.onThemeChanged) {
            unsubs.push(api.onThemeChanged((data) => {
                const theme = typeof data === 'object' ? data.theme : data
                set(state => ({ settings: { ...state.settings, theme } }))
            }))
        }
        if (api.onScaleChanged) {
            unsubs.push(api.onScaleChanged((data) => {
                const scale = typeof data === 'object' ? data.scale : data
                set(state => ({ settings: { ...state.settings, interfaceScale: scale } }))
            }))
        }

        set({ _unsubscribers: unsubs })
    },

    // ── NavBar Badge 通知管理 ─────────────────────────────────
    navBadges: {},  // { '/ask': { dot: true, shake: false }, '/providers': { dot: false, shake: true } }
    setNavBadge: (tab, badge) => set(state => ({
        navBadges: { ...state.navBadges, [tab]: { ...state.navBadges[tab], ...badge } }
    })),
    clearNavBadge: (tab) => set(state => {
        const badges = { ...state.navBadges }
        delete badges[tab]
        return { navBadges: badges }
    }),
    clearAllBadges: () => set({ navBadges: {} }),

    // ── 窗口布局记忆 ─────────────────────────────────────────
    lastTab: '/',
    setLastTab: (tab) => set({ lastTab: tab }),

    // 外部注入 process 事件回调（由 App.jsx 设置）
    _onProcessEvent: null,
    setProcessEventHandler: (handler) => set({ _onProcessEvent: handler }),

    cleanupListeners: () => {
        const { _unsubscribers } = get()
        _unsubscribers.forEach(unsub => unsub?.())
        set({ _unsubscribers: [] })
    }
}))

