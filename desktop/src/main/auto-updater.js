/**
 * AutoUpdater — 自动更新模块
 *
 * 使用 electron-updater 检查 GitHub Releases 新版本，
 * 下载更新，通知渲染进程弹出提示。
 *
 * 注意：electron-updater 需要 electron-builder 打包模式才能工作，
 * 开发模式下功能降级为手动检查。
 */
import { EventEmitter } from 'events'

let autoUpdater = null

class AutoUpdaterManager extends EventEmitter {
    constructor() {
        super()
        this._initialized = false
        this._updateAvailable = false
        this._updateInfo = null
        this._downloadProgress = null
    }

    /** 初始化自动更新（仅在打包模式下） */
    init() {
        if (this._initialized) return

        try {
            // electron-updater 仅在打包后可用
            const { autoUpdater: au } = require('electron-updater')
            autoUpdater = au

            autoUpdater.autoDownload = false
            autoUpdater.autoInstallOnAppQuit = true

            autoUpdater.on('checking-for-update', () => {
                this.emit('status', { status: 'checking' })
            })

            autoUpdater.on('update-available', (info) => {
                this._updateAvailable = true
                this._updateInfo = info
                this.emit('status', { status: 'available', version: info.version, releaseNotes: info.releaseNotes })
            })

            autoUpdater.on('update-not-available', (info) => {
                this._updateAvailable = false
                this.emit('status', { status: 'up-to-date', version: info.version })
            })

            autoUpdater.on('download-progress', (progress) => {
                this._downloadProgress = progress
                this.emit('status', { status: 'downloading', percent: Math.round(progress.percent), bytesPerSecond: progress.bytesPerSecond })
            })

            autoUpdater.on('update-downloaded', (info) => {
                this.emit('status', { status: 'downloaded', version: info.version })
            })

            autoUpdater.on('error', (err) => {
                this.emit('status', { status: 'error', error: err.message })
            })

            this._initialized = true
        } catch {
            // 开发模式下 electron-updater 不可用 — 静默跳过
        }
    }

    /** 检查更新 */
    async checkForUpdates() {
        if (!autoUpdater) {
            return { status: 'dev-mode', message: 'Auto-update not available in development mode' }
        }
        try {
            const result = await autoUpdater.checkForUpdates()
            return {
                status: this._updateAvailable ? 'available' : 'up-to-date',
                version: result?.updateInfo?.version,
                currentVersion: require('electron').app.getVersion()
            }
        } catch (e) {
            return { status: 'error', error: e.message }
        }
    }

    /** 下载更新 */
    async downloadUpdate() {
        if (!autoUpdater) return { status: 'error', error: 'Not available' }
        try {
            await autoUpdater.downloadUpdate()
            return { status: 'downloading' }
        } catch (e) {
            return { status: 'error', error: e.message }
        }
    }

    /** 安装更新并重启 */
    installUpdate() {
        if (!autoUpdater) return
        autoUpdater.quitAndInstall()
    }

    /** 获取当前状态 */
    getStatus() {
        const { app } = require('electron')
        return {
            currentVersion: app.getVersion(),
            updateAvailable: this._updateAvailable,
            updateInfo: this._updateInfo,
            downloadProgress: this._downloadProgress,
            autoUpdaterAvailable: !!autoUpdater
        }
    }
}

export default new AutoUpdaterManager()
