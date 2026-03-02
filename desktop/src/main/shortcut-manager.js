/**
 * ShortcutManager — 全局快捷键管理
 *
 * 读取 desktop-settings.json 中的 shortcuts 配置，
 * 使用 Electron globalShortcut API 注册全局快捷键。
 * 当设置变更时自动重新注册。
 */
import { globalShortcut } from 'electron'

class ShortcutManager {
    constructor() {
        this._registered = new Map() // action → accelerator
        this._handlers = new Map()   // action → handler function
        this._mainWindow = null
    }

    /** 设置主窗口引用 */
    setMainWindow(win) {
        this._mainWindow = win
    }

    /** 注册所有快捷键 */
    registerAll(shortcuts, mainWindow) {
        if (mainWindow) this._mainWindow = mainWindow

        // 先注销全部
        this.unregisterAll()

        const actionHandlers = {
            commandPalette: () => this._sendToRenderer('shortcut:command-palette'),
            newTerminal: () => this._sendToRenderer('shortcut:new-terminal'),
            askFocus: () => this._sendToRenderer('shortcut:ask-focus'),
            toggleSidebar: () => this._sendToRenderer('shortcut:toggle-sidebar'),
            refreshDashboard: () => this._sendToRenderer('shortcut:refresh-dashboard'),
            quit: () => {
                const { app } = require('electron')
                app.quit()
            },
            toggleFullscreen: () => {
                if (this._mainWindow && !this._mainWindow.isDestroyed()) {
                    this._mainWindow.setFullScreen(!this._mainWindow.isFullScreen())
                }
            },
            zoomIn: () => this._sendToRenderer('shortcut:zoom-in'),
            zoomOut: () => this._sendToRenderer('shortcut:zoom-out'),
            zoomReset: () => this._sendToRenderer('shortcut:zoom-reset')
        }

        for (const [action, accelerator] of Object.entries(shortcuts || {})) {
            const handler = actionHandlers[action]
            if (!handler || !accelerator) continue

            try {
                const success = globalShortcut.register(accelerator, handler)
                if (success) {
                    this._registered.set(action, accelerator)
                    this._handlers.set(action, handler)
                } else {
                    console.warn(`[ShortcutManager] Failed to register: ${action} → ${accelerator}`)
                }
            } catch (e) {
                console.warn(`[ShortcutManager] Error registering ${action}: ${e.message}`)
            }
        }
    }

    /** 注销所有快捷键 */
    unregisterAll() {
        globalShortcut.unregisterAll()
        this._registered.clear()
        this._handlers.clear()
    }

    /** 获取当前已注册的快捷键列表 */
    getRegistered() {
        const result = {}
        for (const [action, accelerator] of this._registered) {
            result[action] = accelerator
        }
        return result
    }

    /** 向渲染进程发送快捷键事件 */
    _sendToRenderer(channel, data) {
        if (this._mainWindow && !this._mainWindow.isDestroyed()) {
            this._mainWindow.webContents.send(channel, data)
        }
    }
}

export default new ShortcutManager()
