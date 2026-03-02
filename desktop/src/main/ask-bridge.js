/**
 * AskBridge — 连接 askd daemon 的 Node.js 客户端
 *
 * askd 使用 TCP socket 协议：
 *   请求: { type: "ask.request", v: 1, id, token, provider, message, work_dir, caller, timeout_s }
 *   响应: { type: "ask.response", v: 1, id, exit_code, reply, provider, meta }
 *
 * daemon state (host/port/token) 存储在 CCB_RUN_DIR/askd.json
 */
import { createConnection } from 'net'
import { readFileSync, existsSync, readdirSync } from 'fs'
import { join } from 'path'
import { homedir } from 'os'
import { EventEmitter } from 'events'
import processManager from './process-manager.js'

const HOME = homedir()

class AskBridge extends EventEmitter {
    constructor() {
        super()
        this._requestCounter = 0
        this._configOverrides = null
        this._activeStreams = new Map()  // nodeId → { interval, socket, provider }
        this._sessionsDir = join(HOME, '.ccb', 'ask-sessions')
    }

    /** 运行时更新配置（从 Settings → askd 面板） */
    updateConfig(config) {
        this._configOverrides = config
    }

    // ── Session 文件管理 ────────────────────────────────────

    /** 确保 sessions 目录存在 */
    _ensureSessionsDir() {
        if (!existsSync(this._sessionsDir)) {
            const { mkdirSync } = require('fs')
            mkdirSync(this._sessionsDir, { recursive: true })
        }
    }

    /** 保存会话到文件 */
    saveSession(data) {
        this._ensureSessionsDir()
        const id = data.id || `session-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
        const savedAt = Date.now()
        const payload = {
            id,
            title: data.title || 'Untitled',
            nodes: data.nodes || [],
            edges: data.edges || [],
            viewport: data.viewport || { x: 0, y: 0, scale: 1 },
            selectedProviders: data.selectedProviders || [],
            savedAt
        }
        const filePath = join(this._sessionsDir, `${id}.json`)
        const { writeFileSync } = require('fs')
        writeFileSync(filePath, JSON.stringify(payload, null, 2), 'utf-8')
        return { id, savedAt }
    }

    /** 加载单个会话 */
    loadSession(id) {
        const filePath = join(this._sessionsDir, `${id}.json`)
        if (!existsSync(filePath)) {
            throw new Error(`Session not found: ${id}`)
        }
        return JSON.parse(readFileSync(filePath, 'utf-8'))
    }

    /** 删除会话 */
    deleteSession(id) {
        const filePath = join(this._sessionsDir, `${id}.json`)
        if (existsSync(filePath)) {
            const { unlinkSync } = require('fs')
            unlinkSync(filePath)
        }
        return { success: true }
    }

    // ── Abort 中断 ──────────────────────────────────────────

    /** 中断正在进行的流式请求 */
    abort(nodeId) {
        const stream = this._activeStreams.get(nodeId)
        if (!stream) {
            return { aborted: false, nodeId, reason: 'No active stream' }
        }

        // 清除模拟流式 interval
        if (stream.interval) {
            clearInterval(stream.interval)
        }
        // 关闭 TCP socket
        if (stream.socket) {
            try { stream.socket.destroy() } catch { /* ok */ }
        }

        this._activeStreams.delete(nodeId)

        // 推送 abort 事件
        this.emit('ask:stream-abort', {
            nodeId,
            provider: stream.provider,
            aborted: true
        })

        return { aborted: true, nodeId }
    }

    /** 读取 askd daemon 的 state 文件获取 host/port/token */
    _readDaemonState() {
        const candidates = [
            process.env.CCB_ASKD_STATE_FILE,
            join(HOME, '.ccb', 'run', 'askd.json'),
            join(processManager.getCcbRoot() || '', '.ccb', 'askd.json')
        ].filter(Boolean)

        for (const p of candidates) {
            if (existsSync(p)) {
                try {
                    const state = JSON.parse(readFileSync(p, 'utf-8'))
                    if (state.port && state.token) {
                        return {
                            host: state.connect_host || state.host || '127.0.0.1',
                            port: parseInt(state.port),
                            token: state.token
                        }
                    }
                } catch { /* skip corrupt state */ }
            }
        }
        return null
    }

    /** 检查 askd 是否在运行 */
    isRunning() {
        return this._readDaemonState() !== null
    }

    /**
     * 发送请求到 askd 并等待完整响应
     * @param {string} provider - 'claude' | 'codex' | 'gemini' | 'opencode' | 'droid'
     * @param {string} message - 用户消息
     * @param {object} [options] - { workDir, timeout, quiet }
     * @returns {Promise<{reply: string, exitCode: number, provider: string, meta: object}>}
     */
    async send(provider, message, options = {}) {
        const state = this._readDaemonState()
        if (!state) {
            throw new Error('askd daemon is not running. Start it with: askd --listen')
        }

        const id = `desktop-${++this._requestCounter}-${Date.now()}`
        const workDir = options.workDir || processManager.getCcbRoot() || process.cwd()

        const payload = {
            type: 'ask.request',
            v: 1,
            id,
            token: state.token,
            provider,
            message,
            work_dir: workDir,
            timeout_s: options.timeout || 300,
            quiet: options.quiet || false,
            caller: 'desktop'
        }

        return new Promise((resolve, reject) => {
            const sock = createConnection({ host: state.host, port: state.port }, () => {
                sock.write(JSON.stringify(payload) + '\n')
            })

            let buf = ''
            const deadline = setTimeout(() => {
                sock.destroy()
                reject(new Error(`askd request timed out after ${options.timeout || 300}s`))
            }, (options.timeout || 300) * 1000 + 5000)

            sock.on('data', (chunk) => {
                buf += chunk.toString('utf-8')
                const nlIdx = buf.indexOf('\n')
                if (nlIdx >= 0) {
                    clearTimeout(deadline)
                    const line = buf.slice(0, nlIdx)
                    sock.destroy()

                    try {
                        const resp = JSON.parse(line)
                        if (resp.type !== 'ask.response') {
                            reject(new Error(`Unexpected response type: ${resp.type}`))
                            return
                        }
                        resolve({
                            reply: resp.reply || '',
                            exitCode: resp.exit_code || 0,
                            provider: resp.provider || provider,
                            reqId: resp.req_id || id,
                            meta: resp.meta || {}
                        })
                    } catch (e) {
                        reject(new Error(`Failed to parse askd response: ${e.message}`))
                    }
                }
            })

            sock.on('error', (err) => {
                clearTimeout(deadline)
                reject(new Error(`askd connection failed: ${err.message}`))
            })

            sock.on('close', () => {
                clearTimeout(deadline)
            })
        })
    }

    /**
     * 流式发送 — 发送请求并通过事件推送进度
     * 由于 askd 不支持真正的流式（等待完成后一次性返回），
     * 我们在收到完整回复后模拟流式推送给前端
     *
     * @emits 'ask:stream-start' { nodeId, provider }
     * @emits 'ask:stream-chunk' { nodeId, provider, delta, content }
     * @emits 'ask:stream-end' { nodeId, provider, reply, exitCode, meta }
     * @emits 'ask:stream-error' { nodeId, provider, error }
     */
    async sendStream(provider, message, nodeId, options = {}) {
        this.emit('ask:stream-start', { nodeId, provider })

        try {
            const result = await this.send(provider, message, options)

            // 模拟流式推送（按字符分块）
            const fullText = result.reply
            const chunkSize = 3
            let idx = 0
            const startTime = Date.now()

            return new Promise((resolve) => {
                const interval = setInterval(() => {
                    // 检查是否已被 abort
                    if (!this._activeStreams.has(nodeId)) {
                        clearInterval(interval)
                        return
                    }

                    const end = Math.min(idx + chunkSize + Math.floor(Math.random() * 3), fullText.length)
                    const delta = fullText.slice(idx, end)
                    idx = end

                    this.emit('ask:stream-chunk', {
                        nodeId,
                        provider,
                        delta,
                        content: fullText.slice(0, idx),
                        tokens: Math.floor(idx * 0.8),
                        responseTime: ((Date.now() - startTime) / 1000).toFixed(1)
                    })

                    if (idx >= fullText.length) {
                        clearInterval(interval)
                        this._activeStreams.delete(nodeId)
                        this.emit('ask:stream-end', {
                            nodeId,
                            provider,
                            reply: fullText,
                            exitCode: result.exitCode,
                            meta: result.meta,
                            tokens: Math.floor(fullText.length * 0.8),
                            responseTime: ((Date.now() - startTime) / 1000).toFixed(1)
                        })
                        resolve(result)
                    }
                }, 25)

                // 注册 active stream 以便 abort
                this._activeStreams.set(nodeId, { interval, provider, socket: null })
            })
        } catch (err) {
            this._activeStreams.delete(nodeId)
            this.emit('ask:stream-error', { nodeId, provider, error: err.message })
            throw err
        }
    }

    /**
     * 多 Provider 对比请求 — 并发发送到多个 provider
     * @param {string[]} providers - Provider 名称数组
     * @param {string} message - 用户消息
     * @param {object} nodeIds - { providerId: nodeId } 映射
     */
    async compare(providers, message, nodeIds, options = {}) {
        const promises = providers.map(provider =>
            this.sendStream(provider, message, nodeIds[provider] || `${provider}-${Date.now()}`, options)
                .catch(err => ({
                    reply: `Error: ${err.message}`,
                    exitCode: 1,
                    provider,
                    meta: {}
                }))
        )
        return Promise.all(promises)
    }

    /** 获取 Ask 会话历史 — 优先从 ask-sessions/ 读取，回退到 Claude sessions */
    getSessions() {
        const sessions = []

        // 1. 从 ask-sessions/ 目录读取桌面保存的会话
        if (existsSync(this._sessionsDir)) {
            try {
                const files = readdirSync(this._sessionsDir).filter(f => f.endsWith('.json'))
                for (const f of files) {
                    try {
                        const data = JSON.parse(readFileSync(join(this._sessionsDir, f), 'utf-8'))
                        sessions.push({
                            id: data.id,
                            title: data.title || 'Untitled',
                            preview: data.nodes?.[0]?.content?.slice(0, 80) || '',
                            time: new Date(data.savedAt || Date.now()).toISOString(),
                            timestamp: data.savedAt || Date.now(),
                            active: false,
                            provider: data.selectedProviders?.[0] || 'claude',
                            nodeCount: data.nodes?.length || 0,
                            source: 'desktop'
                        })
                    } catch { /* skip corrupt */ }
                }
            } catch { /* skip */ }
        }

        // 2. 从 Claude projects 读取
        const projectsRoot = join(HOME, '.claude', 'projects')
        if (existsSync(projectsRoot)) {
            try {
                const dirs = readdirSync(projectsRoot, { withFileTypes: true }).filter(d => d.isDirectory())
                for (const dir of dirs) {
                    const sessionsFile = join(projectsRoot, dir.name, '.sessions.json')
                    if (!existsSync(sessionsFile)) continue
                    try {
                        const data = JSON.parse(readFileSync(sessionsFile, 'utf-8'))
                        if (Array.isArray(data)) {
                            for (const s of data.slice(-10)) {
                                sessions.push({
                                    id: s.id || s.session_id || `${dir.name}-${sessions.length}`,
                                    title: s.name || s.title || 'Untitled Session',
                                    preview: s.description || '',
                                    time: s.updated_at || new Date(s.timestamp || Date.now()).toISOString(),
                                    timestamp: new Date(s.updated_at || s.timestamp || Date.now()).getTime(),
                                    active: false,
                                    provider: 'claude',
                                    project: dir.name,
                                    nodeCount: s.message_count || s.turn_count || 0,
                                    source: 'claude'
                                })
                            }
                        }
                    } catch { /* skip */ }
                }
            } catch { /* skip */ }
        }

        // 按时间降序
        sessions.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))
        return sessions.slice(0, 30)
    }
}

export default new AskBridge()
