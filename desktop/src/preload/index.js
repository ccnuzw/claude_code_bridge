import { contextBridge, ipcRenderer } from 'electron'

// 暴露安全的 API 到渲染进程
contextBridge.exposeInMainWorld('electronAPI', {
    // ── 应用信息 ─────────────────────────────────────────────
    getVersion: () => ipcRenderer.invoke('app:get-version'),
    getPlatform: () => ipcRenderer.invoke('app:get-platform'),

    // ── 窗口控制 ─────────────────────────────────────────────
    minimize: () => ipcRenderer.invoke('window:minimize'),
    maximize: () => ipcRenderer.invoke('window:maximize'),
    close: () => ipcRenderer.invoke('window:close'),
    toggleFullscreen: () => ipcRenderer.invoke('window:toggle-fullscreen'),
    isMaximized: () => ipcRenderer.invoke('window:is-maximized'),
    isFullscreen: () => ipcRenderer.invoke('window:is-fullscreen'),

    // ── 开机自启 ──────────────────────────────────────────────
    getLoginSettings: () => ipcRenderer.invoke('app:get-login-settings'),
    setLoginSettings: (openAtLogin) => ipcRenderer.invoke('app:set-login-settings', openAtLogin),

    // ── Tray 导航事件 ─────────────────────────────────────────
    onNavigate: (callback) => {
        const handler = (_event, path) => callback(path)
        ipcRenderer.on('navigate', handler)
        return () => ipcRenderer.removeListener('navigate', handler)
    },

    // ── Config ───────────────────────────────────────────────
    getProviders: () => ipcRenderer.invoke('config:get-providers'),
    getEnabledProviders: () => ipcRenderer.invoke('config:get-enabled-providers'),
    setEnabledProviders: (providers) => ipcRenderer.invoke('config:set-enabled-providers', providers),
    getDesktopSettings: () => ipcRenderer.invoke('config:get-desktop-settings'),
    saveDesktopSettings: (settings) => ipcRenderer.invoke('config:save-desktop-settings', settings),
    updateSetting: (key, value) => ipcRenderer.invoke('config:update-setting', key, value),

    // ── Settings 子面板 ──────────────────────────────────────
    getSettingsSection: (section) => ipcRenderer.invoke('settings:get-section', section),
    updateSettingsSection: (section, updates) => ipcRenderer.invoke('settings:update-section', section, updates),
    resetSettingsSection: (section) => ipcRenderer.invoke('settings:reset-section', section),
    getShortcuts: () => ipcRenderer.invoke('settings:get-shortcuts'),
    setShortcut: (action, keys) => ipcRenderer.invoke('settings:set-shortcut', action, keys),

    // ── Health ───────────────────────────────────────────────
    getHealthAll: () => ipcRenderer.invoke('health:get-all'),
    checkHealthAll: () => ipcRenderer.invoke('health:check-all'),
    pingProvider: (name) => ipcRenderer.invoke('health:ping-provider', name),
    checkProvider: (name) => ipcRenderer.invoke('health:check-provider', name),

    // ── Process ──────────────────────────────────────────────
    startAskd: () => ipcRenderer.invoke('process:start-askd'),
    stopAskd: () => ipcRenderer.invoke('process:stop-askd'),
    restartAskd: () => ipcRenderer.invoke('process:restart-askd'),
    startProvider: (name) => ipcRenderer.invoke('process:start-provider', name),
    stopProvider: (name) => ipcRenderer.invoke('process:stop-provider', name),
    restartProvider: (name) => ipcRenderer.invoke('process:restart-provider', name),
    getCcbRoot: () => ipcRenderer.invoke('process:get-ccb-root'),

    // ── Dashboard ────────────────────────────────────────────
    getDashboardOverview: () => ipcRenderer.invoke('dashboard:get-overview'),

    // ── 事件监听（主进程 → 渲染进程 推送） ────────────────────
    onHealthUpdate: (callback) => {
        const handler = (_event, data) => callback(data)
        ipcRenderer.on('health:status-update', handler)
        return () => ipcRenderer.removeListener('health:status-update', handler)
    },
    onPingResult: (callback) => {
        const handler = (_event, data) => callback(data)
        ipcRenderer.on('health:ping-result', handler)
        return () => ipcRenderer.removeListener('health:ping-result', handler)
    },
    onConfigChanged: (callback) => {
        const handler = (_event, data) => callback(data)
        ipcRenderer.on('config:changed', handler)
        return () => ipcRenderer.removeListener('config:changed', handler)
    },
    onSettingsChanged: (callback) => {
        const handler = (_event, data) => callback(data)
        ipcRenderer.on('config:settings-changed', handler)
        return () => ipcRenderer.removeListener('config:settings-changed', handler)
    },
    onPythonEnvStatus: (callback) => {
        const handler = (_event, data) => callback(data)
        ipcRenderer.on('python-env-status', handler)
        return () => ipcRenderer.removeListener('python-env-status', handler)
    },
    onPythonEnvError: (callback) => {
        const handler = (_event, data) => callback(data)
        ipcRenderer.on('python-env-error', handler)
        return () => ipcRenderer.removeListener('python-env-error', handler)
    },
    onProcessStarted: (callback) => {
        const handler = (_event, data) => callback(data)
        ipcRenderer.on('process:started', handler)
        return () => ipcRenderer.removeListener('process:started', handler)
    },
    onProcessStopped: (callback) => {
        const handler = (_event, data) => callback(data)
        ipcRenderer.on('process:stopped', handler)
        return () => ipcRenderer.removeListener('process:stopped', handler)
    },
    onProcessError: (callback) => {
        const handler = (_event, data) => callback(data)
        ipcRenderer.on('process:error', handler)
        return () => ipcRenderer.removeListener('process:error', handler)
    },

    // F3: maild 进程管理
    startMaild: () => ipcRenderer.invoke('process:start-maild'),
    stopMaild: () => ipcRenderer.invoke('process:stop-maild'),
    restartMaild: () => ipcRenderer.invoke('process:restart-maild'),

    // F4: 日志查看
    getProviderLog: (name, lines) => ipcRenderer.invoke('provider:get-log', name, lines),
    getAskdLog: (lines) => ipcRenderer.invoke('askd:get-log', lines),
    getMaildLog: (lines) => ipcRenderer.invoke('maild:get-log', lines),

    // ── Terminal PTY ─────────────────────────────────────────
    ptyCreate: (options) => ipcRenderer.invoke('pty:create', options),
    ptyWrite: (id, data) => ipcRenderer.invoke('pty:write', id, data),
    ptyResize: (id, cols, rows) => ipcRenderer.invoke('pty:resize', id, cols, rows),
    ptyDestroy: (id) => ipcRenderer.invoke('pty:destroy', id),
    ptyList: () => ipcRenderer.invoke('pty:list'),

    onPtyData: (callback) => {
        const handler = (_event, data) => callback(data)
        ipcRenderer.on('pty:data', handler)
        return () => ipcRenderer.removeListener('pty:data', handler)
    },
    onPtyExit: (callback) => {
        const handler = (_event, data) => callback(data)
        ipcRenderer.on('pty:exit', handler)
        return () => ipcRenderer.removeListener('pty:exit', handler)
    },

    // ── Tasks / Sessions ─────────────────────────────────────
    tasksScanAll: () => ipcRenderer.invoke('tasks:scan-all'),
    tasksGetRecent: (limit) => ipcRenderer.invoke('tasks:get-recent', limit),

    // ── System ───────────────────────────────────────────────
    systemCheckEnv: () => ipcRenderer.invoke('system:check-env'),

    // Token 检测
    detectTokens: () => ipcRenderer.invoke('token:detect-all'),
    detectToken: (providerName) => ipcRenderer.invoke('token:detect', providerName),

    // Provider Settings (含 base_url)
    getProviderSettings: () => ipcRenderer.invoke('config:get-provider-settings'),
    saveProviderSettings: (settings) => ipcRenderer.invoke('config:save-provider-settings', settings),

    // ── Mail ─────────────────────────────────────────────────
    mailGetOverview: () => ipcRenderer.invoke('mail:get-overview'),
    mailGetConfig: () => ipcRenderer.invoke('mail:get-config'),
    mailSaveConfig: (config) => ipcRenderer.invoke('mail:save-config', config),
    mailUpdateConfig: (key, value) => ipcRenderer.invoke('mail:update-config', key, value),
    mailGetTokens: () => ipcRenderer.invoke('mail:get-tokens'),
    mailGetThreads: () => ipcRenderer.invoke('mail:get-threads'),

    // ── Extensions ───────────────────────────────────────────
    extensionsGetOverview: () => ipcRenderer.invoke('extensions:get-overview'),
    extensionsGetSkills: () => ipcRenderer.invoke('extensions:get-skills'),
    extensionsGetMcp: () => ipcRenderer.invoke('extensions:get-mcp'),
    extensionsGetRoles: () => ipcRenderer.invoke('extensions:get-roles'),
    extensionsGetWorkflows: () => ipcRenderer.invoke('extensions:get-workflows'),
    extensionsGetSkillContent: (name) => ipcRenderer.invoke('extensions:get-skill-content', name),
    extensionsGetRoleContent: (filename) => ipcRenderer.invoke('extensions:get-role-content', filename),
    extensionsGetWorkflowContent: (filename) => ipcRenderer.invoke('extensions:get-workflow-content', filename),

    // ── Ask Bridge ───────────────────────────────────────────
    askSend: (provider, message, options) => ipcRenderer.invoke('ask:send', provider, message, options),
    askStream: (provider, message, nodeId, options) => ipcRenderer.invoke('ask:stream', provider, message, nodeId, options),
    askCompare: (providers, message, nodeIds, options) => ipcRenderer.invoke('ask:compare', providers, message, nodeIds, options),
    askGetSessions: () => ipcRenderer.invoke('ask:get-sessions'),
    askStatus: () => ipcRenderer.invoke('ask:status'),
    askSaveSession: (data) => ipcRenderer.invoke('ask:save-session', data),
    askLoadSession: (id) => ipcRenderer.invoke('ask:load-session', id),
    askDeleteSession: (id) => ipcRenderer.invoke('ask:delete-session', id),
    askAbort: (nodeId) => ipcRenderer.invoke('ask:abort', nodeId),

    onAskStreamStart: (callback) => {
        const handler = (_event, data) => callback(data)
        ipcRenderer.on('ask:stream-start', handler)
        return () => ipcRenderer.removeListener('ask:stream-start', handler)
    },
    onAskStreamChunk: (callback) => {
        const handler = (_event, data) => callback(data)
        ipcRenderer.on('ask:stream-chunk', handler)
        return () => ipcRenderer.removeListener('ask:stream-chunk', handler)
    },
    onAskStreamEnd: (callback) => {
        const handler = (_event, data) => callback(data)
        ipcRenderer.on('ask:stream-end', handler)
        return () => ipcRenderer.removeListener('ask:stream-end', handler)
    },
    onAskStreamError: (callback) => {
        const handler = (_event, data) => callback(data)
        ipcRenderer.on('ask:stream-error', handler)
        return () => ipcRenderer.removeListener('ask:stream-error', handler)
    },
    onAskStreamAbort: (callback) => {
        const handler = (_event, data) => callback(data)
        ipcRenderer.on('ask:stream-abort', handler)
        return () => ipcRenderer.removeListener('ask:stream-abort', handler)
    },

    // ── FileWatcher 事件 ──────────────────────────────────────
    onFileChanged: (callback) => {
        const handler = (_event, data) => callback(data)
        ipcRenderer.on('file:changed', handler)
        return () => ipcRenderer.removeListener('file:changed', handler)
    },
    onSessionsChanged: (callback) => {
        const handler = (_event, data) => callback(data)
        ipcRenderer.on('file:sessions-changed', handler)
        return () => ipcRenderer.removeListener('file:sessions-changed', handler)
    },
    onDaemonChanged: (callback) => {
        const handler = (_event, data) => callback(data)
        ipcRenderer.on('file:daemon-changed', handler)
        return () => ipcRenderer.removeListener('file:daemon-changed', handler)
    },

    // ── Notifications ────────────────────────────────────────
    sendNotification: (title, body) => ipcRenderer.invoke('notify:send', title, body),
    setNotificationsEnabled: (enabled) => ipcRenderer.invoke('notify:set-enabled', enabled),

    // ── Settings 联动 ────────────────────────────────────────
    applyTheme: (theme) => ipcRenderer.invoke('app:apply-theme', theme),
    applyScale: (scale) => ipcRenderer.invoke('app:apply-scale', scale),
    onThemeChanged: (callback) => {
        const handler = (_event, data) => callback(data)
        ipcRenderer.on('theme-changed', handler)
        return () => ipcRenderer.removeListener('theme-changed', handler)
    },
    onScaleChanged: (callback) => {
        const handler = (_event, data) => callback(data)
        ipcRenderer.on('scale-changed', handler)
        return () => ipcRenderer.removeListener('scale-changed', handler)
    },

    // ── Shortcuts 事件 ───────────────────────────────────────
    getRegisteredShortcuts: () => ipcRenderer.invoke('shortcuts:get-registered'),
    onShortcutCommandPalette: (cb) => {
        ipcRenderer.on('shortcut:command-palette', cb)
        return () => ipcRenderer.removeListener('shortcut:command-palette', cb)
    },
    onShortcutAskFocus: (cb) => {
        ipcRenderer.on('shortcut:ask-focus', cb)
        return () => ipcRenderer.removeListener('shortcut:ask-focus', cb)
    },
    onShortcutRefreshDashboard: (cb) => {
        ipcRenderer.on('shortcut:refresh-dashboard', cb)
        return () => ipcRenderer.removeListener('shortcut:refresh-dashboard', cb)
    },
    onShortcutZoomIn: (cb) => {
        ipcRenderer.on('shortcut:zoom-in', cb)
        return () => ipcRenderer.removeListener('shortcut:zoom-in', cb)
    },
    onShortcutZoomOut: (cb) => {
        ipcRenderer.on('shortcut:zoom-out', cb)
        return () => ipcRenderer.removeListener('shortcut:zoom-out', cb)
    },
    onShortcutZoomReset: (cb) => {
        ipcRenderer.on('shortcut:zoom-reset', cb)
        return () => ipcRenderer.removeListener('shortcut:zoom-reset', cb)
    },

    // ── Terminal 配置联动 ────────────────────────────────────
    applyTerminalConfig: (config) => ipcRenderer.invoke('settings:apply-terminal', config),
    onTerminalConfigChanged: (callback) => {
        const handler = (_event, data) => callback(data)
        ipcRenderer.on('terminal:config-changed', handler)
        return () => ipcRenderer.removeListener('terminal:config-changed', handler)
    },

    // ── askd 配置联动 ────────────────────────────────────────
    applyAskdConfig: (config) => ipcRenderer.invoke('settings:apply-askd', config),

    // ── Auto-Updater ────────────────────────────────────────
    checkForUpdates: () => ipcRenderer.invoke('updater:check'),
    downloadUpdate: () => ipcRenderer.invoke('updater:download'),
    installUpdate: () => ipcRenderer.invoke('updater:install'),
    getUpdaterStatus: () => ipcRenderer.invoke('updater:status'),
    onUpdaterStatus: (callback) => {
        const handler = (_event, data) => callback(data)
        ipcRenderer.on('updater:status', handler)
        return () => ipcRenderer.removeListener('updater:status', handler)
    },

    // ── G1: 数据导出/导入 ──────────────────────────────────
    dataExport: () => ipcRenderer.invoke('data:export'),
    dataImport: (jsonString) => ipcRenderer.invoke('data:import', jsonString),

    // ── G2: 全局搜索 ────────────────────────────────────────
    searchGlobal: (query, options) => ipcRenderer.invoke('search:global', query, options),

    // ── G3: Crash Recovery ──────────────────────────────────
    getCrashState: () => ipcRenderer.invoke('app:get-crash-state'),
    saveCrashState: (state) => ipcRenderer.invoke('app:save-crash-state', state),

    // ── G4: App Info ────────────────────────────────────────
    getAppInfo: () => ipcRenderer.invoke('app:get-info')
})
