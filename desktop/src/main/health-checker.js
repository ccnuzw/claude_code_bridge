/**
 * HealthChecker — Provider daemon 健康检测
 *
 * 对每个 provider daemon 执行定时健康检查：
 *   1. 检查 state file 是否存在及内容
 *   2. 检查 PID 是否存活
 *   3. 通过 socket/HTTP ping 测试响应
 *
 * 状态: operational | degraded | offline | unknown
 */
import { readFileSync, existsSync } from 'fs'
import { join } from 'path'
import { homedir } from 'os'
import { EventEmitter } from 'events'
import { execSync } from 'child_process'
import configManager, { PROVIDER_SPECS } from './config-manager.js'

const CCB_DIR = join(homedir(), '.ccb')

class HealthChecker extends EventEmitter {
    constructor() {
        super()
        this._statuses = new Map()
        this._interval = null
        this._checkIntervalMs = 5000 // 5s heartbeat
    }

    /** 获取所有 provider 的当前状态 */
    getAllStatuses() {
        const result = {}
        for (const [name, spec] of Object.entries(PROVIDER_SPECS)) {
            result[name] = this._statuses.get(name) || {
                name,
                label: spec.label,
                status: 'unknown',
                pid: null,
                uptime: null,
                latency: null,
                load: null,
                stateFile: spec.stateFile,
                lastCheck: null
            }
        }
        return result
    }

    /** 获取单个 provider 状态 */
    getStatus(providerName) {
        return this._statuses.get(providerName) || null
    }

    /** 检查单个 provider */
    async checkProvider(providerName) {
        const spec = PROVIDER_SPECS[providerName]
        if (!spec) return null

        const stateFilePath = join(CCB_DIR, spec.stateFile)
        const logFilePath = join(CCB_DIR, spec.logFile)
        const now = Date.now()

        let status = 'offline'
        let pid = null
        let uptime = null
        let port = null
        let latency = null

        // 1. 读取 state file
        if (existsSync(stateFilePath)) {
            try {
                const raw = readFileSync(stateFilePath, 'utf-8')
                const state = JSON.parse(raw)
                pid = state.pid || state.PID || null
                port = state.port || state.PORT || null

                if (state.started_at || state.start_time) {
                    const startTime = state.started_at || state.start_time
                    const startMs = typeof startTime === 'number'
                        ? (startTime > 1e12 ? startTime : startTime * 1000)
                        : new Date(startTime).getTime()
                    uptime = now - startMs
                }

                // 2. 检查 PID 是否存活
                if (pid) {
                    try {
                        execSync(`kill -0 ${pid} 2>/dev/null`, { stdio: 'ignore' })
                        status = 'operational'
                    } catch {
                        status = 'offline'
                        pid = null
                    }
                }
            } catch {
                status = 'offline'
            }
        }

        // 3. 如果有端口，尝试 Socket ping 检测延迟
        if (status === 'operational' && port) {
            const pingStart = Date.now()
            try {
                await this._tcpPing('127.0.0.1', port, 2000)
                latency = Date.now() - pingStart
            } catch {
                status = 'degraded'
                latency = null
            }
        }

        const statusObj = {
            name: providerName,
            label: spec.label,
            icon: spec.icon,
            daemonKey: spec.daemonKey,
            status,
            pid,
            port,
            uptime: uptime ? this._formatUptime(uptime) : null,
            uptimeMs: uptime,
            latency: latency !== null ? `${latency}ms` : null,
            latencyMs: latency,
            stateFile: spec.stateFile,
            logFile: spec.logFile,
            hasLog: existsSync(logFilePath),
            lastCheck: now
        }

        this._statuses.set(providerName, statusObj)
        return statusObj
    }

    /** 检查所有已启用的 provider */
    async checkAll() {
        const enabled = configManager.getEnabledProviders()
        const results = {}
        for (const name of enabled) {
            results[name] = await this.checkProvider(name)
        }

        // 也检查 askd 主进程
        results._askd = await this._checkAskd()

        // 也检查 maild
        results._maild = await this._checkMaild()

        this.emit('health-update', results)
        return results
    }

    /** Ping 单个 provider（供 UI 手动触发） */
    async pingProvider(providerName) {
        const result = await this.checkProvider(providerName)
        this.emit('ping-result', { provider: providerName, result })
        return result
    }

    /** 启动定时检查 */
    startPeriodicCheck(intervalMs) {
        this._checkIntervalMs = intervalMs || this._checkIntervalMs
        this.stopPeriodicCheck()
        this.checkAll() // 立即检查一次
        this._interval = setInterval(() => this.checkAll(), this._checkIntervalMs)
    }

    /** 停止定时检查 */
    stopPeriodicCheck() {
        if (this._interval) {
            clearInterval(this._interval)
            this._interval = null
        }
    }

    // ── 内部方法 ────────────────────────────────────────────

    async _checkAskd() {
        const stateFile = join(CCB_DIR, 'askd.json')
        if (!existsSync(stateFile)) {
            return { name: 'askd', label: 'Ask Daemon', status: 'offline', pid: null }
        }
        try {
            const state = JSON.parse(readFileSync(stateFile, 'utf-8'))
            const pid = state.pid || null
            let status = 'offline'
            if (pid) {
                try {
                    execSync(`kill -0 ${pid} 2>/dev/null`, { stdio: 'ignore' })
                    status = 'operational'
                } catch { /* offline */ }
            }
            return { name: 'askd', label: 'Ask Daemon', status, pid, port: state.port || null }
        } catch {
            return { name: 'askd', label: 'Ask Daemon', status: 'offline', pid: null }
        }
    }

    async _checkMaild() {
        const stateFile = join(CCB_DIR, 'maild.json')
        if (!existsSync(stateFile)) {
            return { name: 'maild', label: 'Mail Daemon', status: 'offline', pid: null }
        }
        try {
            const state = JSON.parse(readFileSync(stateFile, 'utf-8'))
            const pid = state.pid || null
            let status = 'offline'
            if (pid) {
                try {
                    execSync(`kill -0 ${pid} 2>/dev/null`, { stdio: 'ignore' })
                    status = 'operational'
                } catch { /* offline */ }
            }
            return { name: 'maild', label: 'Mail Daemon', status, pid, port: state.port || null }
        } catch {
            return { name: 'maild', label: 'Mail Daemon', status: 'offline', pid: null }
        }
    }

    /** TCP ping 检测端口是否通 */
    _tcpPing(host, port, timeout) {
        return new Promise((resolve, reject) => {
            const net = require('net')
            const socket = new net.Socket()
            socket.setTimeout(timeout)
            socket.on('connect', () => {
                socket.destroy()
                resolve(true)
            })
            socket.on('timeout', () => {
                socket.destroy()
                reject(new Error('timeout'))
            })
            socket.on('error', (err) => {
                socket.destroy()
                reject(err)
            })
            socket.connect(port, host)
        })
    }

    /** 格式化 uptime 毫秒为可读格式 */
    _formatUptime(ms) {
        const s = Math.floor(ms / 1000)
        const m = Math.floor(s / 60)
        const h = Math.floor(m / 60)
        const d = Math.floor(h / 24)
        if (d > 0) return `${d}d ${h % 24}h`
        if (h > 0) return `${h}h ${m % 60}m`
        if (m > 0) return `${m}m`
        return `${s}s`
    }
}

export default new HealthChecker()
