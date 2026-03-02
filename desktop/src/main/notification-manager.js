/**
 * NotificationManager — 原生桌面通知
 *
 * 通过 Electron Notification API 发送系统级通知。
 * 支持任务完成/失败、Mail 新邮件、askd 状态变化。
 */
import { Notification, nativeImage } from 'electron'

class NotificationManager {
    constructor() {
        this._enabled = true
    }

    /** 设置是否启用通知 */
    setEnabled(enabled) {
        this._enabled = enabled
    }

    /** 发送通用通知 */
    send(title, body, options = {}) {
        if (!this._enabled || !Notification.isSupported()) return

        const notification = new Notification({
            title,
            body,
            silent: options.silent || false,
            icon: options.icon || undefined,
            urgency: options.urgency || 'normal'
        })

        if (options.onClick) {
            notification.on('click', options.onClick)
        }

        notification.show()
        return notification
    }

    /** 任务完成通知 */
    taskCompleted(provider, title) {
        return this.send(
            `✅ Task Completed — ${provider}`,
            title || 'Session finished successfully',
            { urgency: 'normal' }
        )
    }

    /** 任务失败通知 */
    taskFailed(provider, title, error) {
        return this.send(
            `❌ Task Failed — ${provider}`,
            error || title || 'Session encountered an error',
            { urgency: 'critical' }
        )
    }

    /** Mail 通知 */
    newMail(from, subject) {
        return this.send(
            '📧 New Mail',
            `From: ${from}\n${subject || 'New message received'}`,
            { urgency: 'normal' }
        )
    }

    /** askd 状态变化通知 */
    askdStatusChanged(status) {
        if (status === 'operational') {
            return this.send('🟢 askd Online', 'Ask daemon is now running')
        } else {
            return this.send('🔴 askd Offline', 'Ask daemon has stopped')
        }
    }

    /** Provider 状态变化通知 */
    providerStatusChanged(name, oldStatus, newStatus) {
        if (oldStatus === newStatus) return
        const emoji = newStatus === 'operational' ? '🟢' : newStatus === 'degraded' ? '🟡' : '🔴'
        return this.send(
            `${emoji} ${name} — ${newStatus}`,
            `Provider status changed from ${oldStatus} to ${newStatus}`
        )
    }
}

export default new NotificationManager()
