/**
 * ProcessManager — 管理 CCB daemon 进程生命周期
 *
 * 管理 askd / provider daemon (caskd, gaskd, oaskd, laskd, daskd) / maild 的
 * 启动 / 停止 / 重启操作。
 *
 * 启动方式：通过 spawn python3 来调用 CCB 项目的入口模块。
 */
import { spawn, execSync } from 'child_process'
import { readFileSync, existsSync } from 'fs'
import { join } from 'path'
import { homedir } from 'os'
import { EventEmitter } from 'events'
import { PROVIDER_SPECS } from './config-manager.js'

const CCB_DIR = join(homedir(), '.ccb')

class ProcessManager extends EventEmitter {
    constructor() {
        super()
        this._processes = new Map() // key -> ChildProcess
        this._ccbRoot = null       // CCB 项目根路径
        this._pythonPath = null    // venv Python 路径（由 PythonEnvManager 提供）
    }

    /** 设置 CCB 项目根路径 */
    setCcbRoot(root) {
        this._ccbRoot = root
    }

    /** 设置 venv Python 路径（由 PythonEnvManager 提供） */
    setPythonPath(pythonPath) {
        this._pythonPath = pythonPath
    }

    /** 自动检测 CCB 项目根路径（支持打包后的 Resources 路径） */
    detectCcbRoot() {
        // 优先检查 Electron 打包后的 extraResources 路径
        if (process.resourcesPath) {
            const bundledPath = join(process.resourcesPath, 'ccb')
            if (existsSync(join(bundledPath, 'bin'))) {
                this._ccbRoot = bundledPath
                return bundledPath
            }
        }

        // Fallback: 尝试常见开发路径
        const candidates = [
            join(homedir(), 'Progame', 'claude_code_bridge'),
            join(homedir(), 'claude_code_bridge'),
            join(homedir(), 'Projects', 'claude_code_bridge')
        ]
        for (const p of candidates) {
            if (existsSync(join(p, 'bin'))) {
                this._ccbRoot = p
                return p
            }
        }
        return null
    }

    /** 获取 CCB 根路径 */
    getCcbRoot() {
        if (!this._ccbRoot) this.detectCcbRoot()
        return this._ccbRoot
    }

    // ── askd 进程管理 ───────────────────────────────────────

    /** 启动 askd */
    async startAskd() {
        const root = this.getCcbRoot()
        if (!root) throw new Error('CCB project root not found')

        const binPath = join(root, 'bin', 'askd')
        if (!existsSync(binPath)) {
            throw new Error(`askd binary not found at ${binPath}`)
        }

        // 使用 venv Python 运行脚本，或直接执行
        if (this._pythonPath) {
            return this._spawnDaemon('askd', this._pythonPath, [binPath], {
                cwd: root,
                env: { ...process.env, PYTHONPATH: join(root, 'lib') }
            })
        }
        return this._spawnDaemon('askd', binPath, [], {
            cwd: root,
            env: { ...process.env, PYTHONPATH: join(root, 'lib') }
        })
    }

    /** 停止 askd */
    async stopAskd() {
        return this._stopDaemon('askd', 'askd.json')
    }

    /** 重启 askd */
    async restartAskd() {
        await this.stopAskd()
        await new Promise(resolve => setTimeout(resolve, 1000))
        return this.startAskd()
    }

    // ── Provider daemon 管理 ────────────────────────────────

    /** 启动指定 provider 的 daemon */
    async startProvider(providerName) {
        const spec = PROVIDER_SPECS[providerName]
        if (!spec) throw new Error(`Unknown provider: ${providerName}`)

        const root = this.getCcbRoot()
        if (!root) throw new Error('CCB project root not found')

        const binPath = join(root, 'bin', 'askd')
        const args = ['--daemon', spec.daemonKey]

        if (this._pythonPath) {
            return this._spawnDaemon(spec.daemonKey, this._pythonPath, [binPath, ...args], {
                cwd: root,
                env: { ...process.env, PYTHONPATH: join(root, 'lib') }
            })
        }
        return this._spawnDaemon(spec.daemonKey, binPath, args, {
            cwd: root,
            env: { ...process.env, PYTHONPATH: join(root, 'lib') }
        })
    }

    /** 停止指定 provider 的 daemon */
    async stopProvider(providerName) {
        const spec = PROVIDER_SPECS[providerName]
        if (!spec) throw new Error(`Unknown provider: ${providerName}`)
        return this._stopDaemon(spec.daemonKey, spec.stateFile)
    }

    /** 重启指定 provider */
    async restartProvider(providerName) {
        await this.stopProvider(providerName)
        await new Promise(resolve => setTimeout(resolve, 1000))
        return this.startProvider(providerName)
    }

    // ── maild 管理 ──────────────────────────────────────────

    async startMaild() {
        const root = this.getCcbRoot()
        if (!root) throw new Error('CCB project root not found')

        const binPath = join(root, 'bin', 'maild')
        if (!existsSync(binPath)) {
            throw new Error(`maild binary not found at ${binPath}`)
        }

        if (this._pythonPath) {
            return this._spawnDaemon('maild', this._pythonPath, [binPath], {
                cwd: root,
                env: { ...process.env, PYTHONPATH: join(root, 'lib') }
            })
        }
        return this._spawnDaemon('maild', binPath, [], {
            cwd: root,
            env: { ...process.env, PYTHONPATH: join(root, 'lib') }
        })
    }

    async stopMaild() {
        return this._stopDaemon('maild', 'maild.json')
    }

    // ── 通用内部方法 ────────────────────────────────────────

    /** Spawn 一个 daemon 进程（后台运行） */
    _spawnDaemon(key, binPath, args = [], options = {}) {
        // 如果已在管理中先停止
        if (this._processes.has(key)) {
            try { this._processes.get(key).kill() } catch { /* ignore */ }
        }

        return new Promise((resolve, reject) => {
            try {
                const child = spawn(binPath, args, {
                    ...options,
                    stdio: ['ignore', 'pipe', 'pipe'],
                    detached: true
                })

                child.on('error', (err) => {
                    this._processes.delete(key)
                    this.emit('process-error', { key, error: err.message })
                    reject(err)
                })

                child.on('exit', (code) => {
                    this._processes.delete(key)
                    this.emit('process-exit', { key, code })
                })

                // 收集 stderr 用于错误诊断
                let stderr = ''
                child.stderr?.on('data', (chunk) => {
                    stderr += chunk.toString()
                })

                this._processes.set(key, child)
                child.unref()

                // 等待短暂时间确认启动成功
                setTimeout(() => {
                    if (child.exitCode !== null) {
                        reject(new Error(`${key} exited immediately with code ${child.exitCode}: ${stderr}`))
                    } else {
                        this.emit('process-started', { key, pid: child.pid })
                        resolve({ key, pid: child.pid })
                    }
                }, 500)
            } catch (err) {
                reject(err)
            }
        })
    }

    /** 根据 state file 中的 PID 停止 daemon */
    async _stopDaemon(key, stateFileName) {
        // 先尝试通过管理的 child process 停止
        if (this._processes.has(key)) {
            try {
                this._processes.get(key).kill('SIGTERM')
                this._processes.delete(key)
                this.emit('process-stopped', { key })
                return { success: true }
            } catch { /* continue to try PID */ }
        }

        // 通过 state file 中的 PID 停止
        const stateFile = join(CCB_DIR, stateFileName)
        if (existsSync(stateFile)) {
            try {
                const state = JSON.parse(readFileSync(stateFile, 'utf-8'))
                const pid = state.pid || state.PID
                if (pid) {
                    execSync(`kill ${pid} 2>/dev/null`, { stdio: 'ignore' })
                    this.emit('process-stopped', { key, pid })
                    return { success: true, pid }
                }
            } catch { /* probably already dead */ }
        }

        return { success: false, reason: 'Process not found' }
    }

    /** 停止所有管理中的进程 */
    async stopAll() {
        const results = {}
        for (const [key] of this._processes) {
            try {
                this._processes.get(key).kill('SIGTERM')
                results[key] = { success: true }
            } catch {
                results[key] = { success: false }
            }
        }
        this._processes.clear()
        return results
    }
}

export default new ProcessManager()
