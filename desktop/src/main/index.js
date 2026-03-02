import { app, BrowserWindow, shell, Tray, Menu, nativeImage, ipcMain, dialog } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { registerAllHandlers, setMainWindow } from './ipc-handlers.js'
import configManager from './config-manager.js'
import healthChecker from './health-checker.js'
import processManager from './process-manager.js'
import PythonEnvManager from './python-env-manager.js'
import fileWatcher from './file-watcher.js'
import notificationManager from './notification-manager.js'
import shortcutManager from './shortcut-manager.js'
import { appendFileSync, existsSync, statSync, renameSync } from 'fs'
import { homedir } from 'os'

// ── 日志 ───────────────────────────────────────────────────

const LOG_PATH = join(homedir(), '.ccb', 'desktop.log')
const MAX_LOG_SIZE = 5 * 1024 * 1024 // 5MB

function log(level, msg) {
    const ts = new Date().toISOString()
    const line = `[${ts}] [${level}] ${msg}\n`
    try {
        // 日志轮转
        if (existsSync(LOG_PATH)) {
            const size = statSync(LOG_PATH).size
            if (size > MAX_LOG_SIZE) {
                try { renameSync(LOG_PATH, LOG_PATH + '.old') } catch { /* ok */ }
            }
        }
        appendFileSync(LOG_PATH, line)
    } catch { /* ignore log write failures */ }
    if (level === 'ERROR') console.error(line.trim())
}

// ── 全局异常捕获 ───────────────────────────────────────────

process.on('uncaughtException', (err) => {
    log('ERROR', `Uncaught exception: ${err.stack || err.message}`)
    // 开发模式下弹窗，生产模式静默记录
    if (is.dev) {
        dialog.showErrorBox('CCB Desktop — Uncaught Exception', err.stack || err.message)
    }
})

process.on('unhandledRejection', (reason) => {
    log('ERROR', `Unhandled rejection: ${reason?.stack || reason}`)
})

let mainWindow = null
let tray = null
let pythonEnvManager = null

// ── 读取桌面设置 ──────────────────────────────────────────

function getDesktopSettings() {
    try {
        return configManager.getDesktopSettings() || {}
    } catch {
        return {}
    }
}

// ── 创建主窗口 ────────────────────────────────────────────

function createWindow() {
    // F1: 从设置中恢复窗口状态
    const settings = getDesktopSettings()
    const ws = settings.windowState || {}
    const defaults = { width: 1440, height: 900, x: undefined, y: undefined }

    mainWindow = new BrowserWindow({
        width: ws.width || defaults.width,
        height: ws.height || defaults.height,
        x: ws.x,
        y: ws.y,
        minWidth: 1080,
        minHeight: 720,
        show: false,
        titleBarStyle: 'hiddenInset',
        trafficLightPosition: { x: 16, y: 18 },
        backgroundColor: '#101622',
        webPreferences: {
            preload: join(__dirname, '../preload/index.js'),
            sandbox: false,
            contextIsolation: true,
            nodeIntegration: false
        }
    })

    // 恢复最大化状态
    if (ws.isMaximized) {
        mainWindow.maximize()
    }

    mainWindow.on('ready-to-show', () => {
        mainWindow.show()
    })

    // F1: 保存窗口状态（防抖 500ms）
    let saveTimer = null
    function saveWindowState() {
        if (saveTimer) clearTimeout(saveTimer)
        saveTimer = setTimeout(() => {
            if (!mainWindow || mainWindow.isDestroyed()) return
            const isMaximized = mainWindow.isMaximized()
            const bounds = isMaximized ? (ws._lastBounds || mainWindow.getBounds()) : mainWindow.getBounds()
            configManager.updateSetting('windowState', {
                width: bounds.width,
                height: bounds.height,
                x: bounds.x,
                y: bounds.y,
                isMaximized,
                _lastBounds: isMaximized ? bounds : undefined
            })
        }, 500)
    }
    mainWindow.on('resize', saveWindowState)
    mainWindow.on('move', saveWindowState)
    mainWindow.on('maximize', saveWindowState)
    mainWindow.on('unmaximize', saveWindowState)

    // 关闭行为：根据设置决定是隐藏到托盘还是直接退出
    mainWindow.on('close', (e) => {
        if (app.isQuitting) return

        const settings = getDesktopSettings()
        if (settings.closeToTray) {
            e.preventDefault()
            mainWindow.hide()
        }
        // 如果 closeToTray 为 false，正常关闭窗口
    })

    mainWindow.webContents.setWindowOpenHandler((details) => {
        shell.openExternal(details.url)
        return { action: 'deny' }
    })

    if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
        mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
    } else {
        mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
    }

    // 注册 IPC 推送目标窗口
    setMainWindow(mainWindow)
}

// ── Tray 托盘 ─────────────────────────────────────────────

function createTrayIcon() {
    // 优先尝试从 resources/ 加载文件图标（打包后可用）
    const trayPath = join(__dirname, '..', '..', 'resources', 'trayTemplate.png')
    const trayPath2 = join(__dirname, '..', 'resources', 'trayTemplate.png')

    for (const p of [trayPath, trayPath2]) {
        if (existsSync(p)) {
            const icon = nativeImage.createFromPath(p)
            icon.setTemplateImage(true)
            return icon
        }
    }

    // 回退：程序化创建 16x16 "C" 形 macOS 模板图标
    const size = 16
    const canvas = Buffer.alloc(size * size * 4)
    const drawPixel = (x, y) => {
        const offset = (y * size + x) * 4
        canvas[offset] = 255     // R
        canvas[offset + 1] = 255 // G
        canvas[offset + 2] = 255 // B
        canvas[offset + 3] = 255 // A
    }
    // "C" 形
    for (let x = 4; x <= 12; x++) { drawPixel(x, 3); drawPixel(x, 12) }
    for (let y = 3; y <= 12; y++) { drawPixel(3, y) }
    for (let x = 4; x <= 6; x++) { drawPixel(x, 4); drawPixel(x, 11) }

    const icon = nativeImage.createFromBuffer(canvas, { width: size, height: size })
    icon.setTemplateImage(true)
    return icon
}

function createTray() {
    const icon = createTrayIcon()
    tray = new Tray(icon)
    tray.setToolTip('CCB Desktop')
    updateTrayMenu()

    tray.on('click', () => {
        if (mainWindow) {
            if (mainWindow.isVisible() && mainWindow.isFocused()) {
                mainWindow.hide()
            } else {
                mainWindow.show()
                mainWindow.focus()
            }
        }
    })
}

function updateTrayMenu() {
    if (!tray) return
    const settings = getDesktopSettings()

    const template = [
        {
            label: 'Show CCB Desktop',
            click: () => {
                if (mainWindow) {
                    mainWindow.show()
                    mainWindow.focus()
                }
            }
        },
        { type: 'separator' },
        {
            label: 'Dashboard',
            click: () => {
                mainWindow?.show()
                mainWindow?.focus()
                mainWindow?.webContents.send('navigate', '/dashboard')
            }
        },
        {
            label: 'Ask Canvas',
            click: () => {
                mainWindow?.show()
                mainWindow?.focus()
                mainWindow?.webContents.send('navigate', '/ask')
            }
        },
        {
            label: 'Terminal',
            click: () => {
                mainWindow?.show()
                mainWindow?.focus()
                mainWindow?.webContents.send('navigate', '/terminal')
            }
        },
        { type: 'separator' },
        {
            label: 'Close to Tray',
            type: 'checkbox',
            checked: settings.closeToTray || false,
            click: (menuItem) => {
                configManager.updateSetting('closeToTray', menuItem.checked)
            }
        },
        {
            label: 'Launch at Login',
            type: 'checkbox',
            checked: app.getLoginItemSettings().openAtLogin,
            click: (menuItem) => {
                app.setLoginItemSettings({ openAtLogin: menuItem.checked })
                configManager.updateSetting('launchAtLogin', menuItem.checked)
            }
        },
        { type: 'separator' },
        {
            label: 'Quit CCB Desktop',
            accelerator: 'CmdOrCtrl+Q',
            click: () => {
                app.isQuitting = true
                app.quit()
            }
        }
    ]

    tray.setContextMenu(Menu.buildFromTemplate(template))
}

// ── Basic IPC Handlers ────────────────────────────────────

ipcMain.handle('app:get-version', () => app.getVersion())
ipcMain.handle('app:get-platform', () => process.platform)

ipcMain.handle('window:minimize', () => mainWindow?.minimize())
ipcMain.handle('window:maximize', () => {
    if (mainWindow?.isMaximized()) {
        mainWindow.unmaximize()
    } else {
        mainWindow?.maximize()
    }
})
ipcMain.handle('window:close', () => mainWindow?.close())
ipcMain.handle('window:toggle-fullscreen', () => {
    if (mainWindow) {
        mainWindow.setFullScreen(!mainWindow.isFullScreen())
    }
})
ipcMain.handle('window:is-maximized', () => mainWindow?.isMaximized())
ipcMain.handle('window:is-fullscreen', () => mainWindow?.isFullScreen())

// 开机自启控制
ipcMain.handle('app:get-login-settings', () => {
    return app.getLoginItemSettings()
})
ipcMain.handle('app:set-login-settings', (_event, openAtLogin) => {
    app.setLoginItemSettings({ openAtLogin })
    configManager.updateSetting('launchAtLogin', openAtLogin)
    updateTrayMenu()
    return { openAtLogin }
})

// ── App Lifecycle ─────────────────────────────────────────

// Deep Linking: ccb:// 协议处理
function handleDeepLink(url) {
    if (!url || !mainWindow) return
    try {
        // ccb://dashboard → /dashboard
        // ccb://ask/session123 → /ask?session=session123
        const parsed = new URL(url)
        const route = `/${parsed.hostname}${parsed.pathname || ''}`
        mainWindow.show()
        mainWindow.focus()
        mainWindow.webContents.send('navigate', route)
        log('INFO', `Deep link: ${url} → ${route}`)
    } catch (e) {
        log('ERROR', `Deep link parse error: ${e.message}`)
    }
}

// macOS: 注册为默认协议处理器
if (process.defaultApp) {
    if (process.argv.length >= 2) {
        app.setAsDefaultProtocolClient('ccb', process.execPath, [process.argv[1]])
    }
} else {
    app.setAsDefaultProtocolClient('ccb')
}

// macOS: open-url 事件
app.on('open-url', (event, url) => {
    event.preventDefault()
    handleDeepLink(url)
})

app.whenReady().then(() => {
    electronApp.setAppUserModelId('com.ccb.desktop')

    app.on('browser-window-created', (_, window) => {
        optimizer.watchWindowShortcuts(window)
    })

    // 初始化核心模块
    configManager.ensureCcbDir()
    configManager.startWatching()
    processManager.detectCcbRoot()

    // 初始化 Python 环境管理器（后台运行，不阻塞启动）
    pythonEnvManager = new PythonEnvManager()
    pythonEnvManager.on('status', (s) => {
        log('INFO', `[PythonEnv] ${s.phase}: ${s.message}`)
        mainWindow?.webContents.send('python-env-status', s)
    })
    pythonEnvManager.on('ready', () => {
        processManager.setPythonPath(pythonEnvManager.getPythonPath())
        log('INFO', `[PythonEnv] Ready, python: ${pythonEnvManager.getPythonPath()}`)
    })
    pythonEnvManager.on('error', (e) => {
        log('ERROR', `[PythonEnv] ${e.code}: ${e.message}`)
        mainWindow?.webContents.send('python-env-error', e)
    })
    // 异步初始化，不阻塞窗口创建
    pythonEnvManager.initialize().catch(err => {
        log('ERROR', `[PythonEnv] init failed: ${err.message}`)
    })

    // 从设置恢复开机自启状态（仅打包模式，dev 模式无权限）
    const settings = getDesktopSettings()
    if (!is.dev && settings.launchAtLogin !== undefined) {
        try {
            app.setLoginItemSettings({ openAtLogin: settings.launchAtLogin })
        } catch { /* platform may not support */ }
    }

    // 注册所有 IPC handlers
    registerAllHandlers()

    createWindow()
    createTray()

    // F2: macOS 应用菜单栏
    if (process.platform === 'darwin') {
        const appMenu = Menu.buildFromTemplate([
            {
                label: app.name,
                submenu: [
                    { role: 'about' },
                    { type: 'separator' },
                    { label: 'Settings…', accelerator: 'CmdOrCtrl+,', click: () => mainWindow?.webContents.send('navigate', '/settings') },
                    { type: 'separator' },
                    { role: 'services' },
                    { type: 'separator' },
                    { role: 'hide' },
                    { role: 'hideOthers' },
                    { role: 'unhide' },
                    { type: 'separator' },
                    { role: 'quit' }
                ]
            },
            {
                label: 'Edit',
                submenu: [
                    { role: 'undo' },
                    { role: 'redo' },
                    { type: 'separator' },
                    { role: 'cut' },
                    { role: 'copy' },
                    { role: 'paste' },
                    { role: 'selectAll' }
                ]
            },
            {
                label: 'View',
                submenu: [
                    { role: 'reload' },
                    { role: 'forceReload' },
                    { role: 'toggleDevTools' },
                    { type: 'separator' },
                    { role: 'resetZoom' },
                    { role: 'zoomIn' },
                    { role: 'zoomOut' },
                    { type: 'separator' },
                    { role: 'togglefullscreen' }
                ]
            },
            {
                label: 'Window',
                submenu: [
                    { role: 'minimize' },
                    { role: 'zoom' },
                    { type: 'separator' },
                    { role: 'front' },
                    { type: 'separator' },
                    { role: 'window' }
                ]
            }
        ])
        Menu.setApplicationMenu(appMenu)
    }

    // 启动健康检查心跳（每 5 秒）
    healthChecker.startPeriodicCheck(5000)

    // 启动文件监控
    fileWatcher.start()

    // 通知设置同步
    const ns = getDesktopSettings()
    notificationManager.setEnabled(ns.enableNotifications !== false)

    // 启动快捷键注册
    const shortcuts = getDesktopSettings().shortcuts
    if (shortcuts) {
        shortcutManager.registerAll(shortcuts, mainWindow)
    }

    // 设置变更时更新 Tray 菜单 + 重新注册快捷键
    configManager.on('settings-changed', (newSettings) => {
        updateTrayMenu()
        if (newSettings?.shortcuts) {
            shortcutManager.registerAll(newSettings.shortcuts, mainWindow)
        }
    })

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow()
        } else {
            mainWindow?.show()
        }
    })
})

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit()
    }
})

app.on('before-quit', () => {
    app.isQuitting = true
    healthChecker.stopPeriodicCheck()
    configManager.stopWatching()
    fileWatcher.stop()
    shortcutManager.unregisterAll()
})
