/**
 * SessionParser — 解析多种 AI Agent 的 session/log 文件
 *
 * 支持：
 *   - Claude: ~/.claude/projects/<key>/.sessions.json + conversation JSONL
 *   - Codex:  ~/.codex/sessions/<id>/
 *   - Gemini: ~/.gemini/tmp/ JSONL logs
 *   - OpenCode: ~/.opencode/ SQLite (读取 metadata only)
 *   - Droid: ~/.droid/ session files
 *
 * 输出统一的 TaskEntry 格式供 Tasks 页面展示。
 */
import { readdirSync, readFileSync, existsSync, statSync } from 'fs'
import { join, basename } from 'path'
import { homedir } from 'os'
import { EventEmitter } from 'events'

/**
 * @typedef TaskEntry
 * @property {string} id
 * @property {string} provider - 'claude' | 'codex' | 'gemini' | 'opencode' | 'droid'
 * @property {string} title
 * @property {string} status - 'completed' | 'running' | 'failed' | 'unknown'
 * @property {string} preview
 * @property {number} timestamp
 * @property {string} [duration]
 * @property {string} [sessionFile]
 * @property {object} [metadata]
 */

const HOME = homedir()

class SessionParser extends EventEmitter {
    constructor() {
        super()
        this._cache = []
        this._lastScanTime = 0
    }

    /** 扫描所有 provider 的 session，返回统一 TaskEntry 列表 */
    scanAll() {
        const entries = [
            ...this._scanClaude(),
            ...this._scanCodex(),
            ...this._scanGemini(),
            ...this._scanDroid()
        ]

        // 按时间降序排列
        entries.sort((a, b) => b.timestamp - a.timestamp)
        this._cache = entries
        this._lastScanTime = Date.now()
        return entries
    }

    /** 获取缓存结果 */
    getCached() {
        return this._cache
    }

    /** 获取最近 N 条 */
    getRecent(limit = 20) {
        if (this._cache.length === 0 || Date.now() - this._lastScanTime > 30000) {
            this.scanAll()
        }
        return this._cache.slice(0, limit)
    }

    // ── Claude Sessions ─────────────────────────────────────

    _scanClaude() {
        const entries = []
        const projectsRoot = join(HOME, '.claude', 'projects')
        if (!existsSync(projectsRoot)) return entries

        try {
            const projectDirs = readdirSync(projectsRoot, { withFileTypes: true })
                .filter(d => d.isDirectory())

            for (const dir of projectDirs) {
                const sessionsFile = join(projectsRoot, dir.name, '.sessions.json')
                if (!existsSync(sessionsFile)) continue

                try {
                    const sessions = JSON.parse(readFileSync(sessionsFile, 'utf-8'))
                    if (Array.isArray(sessions)) {
                        for (const s of sessions.slice(-20)) {
                            entries.push({
                                id: `claude-${s.id || s.session_id || dir.name}`,
                                provider: 'claude',
                                title: s.name || s.title || `Claude Session`,
                                status: 'completed',
                                preview: s.description || s.preview || '',
                                timestamp: s.updated_at ? new Date(s.updated_at).getTime() : (s.timestamp || Date.now()),
                                sessionFile: sessionsFile,
                                metadata: { project: dir.name, ...s }
                            })
                        }
                    }
                } catch { /* skip corrupt files */ }
            }
        } catch { /* projects dir not readable */ }

        return entries
    }

    // ── Codex Sessions ──────────────────────────────────────

    _scanCodex() {
        const entries = []
        const sessionsRoot = join(HOME, '.codex', 'sessions')
        if (!existsSync(sessionsRoot)) return entries

        try {
            const sessionDirs = readdirSync(sessionsRoot, { withFileTypes: true })
                .filter(d => d.isDirectory())
                .slice(-20) // 最近 20 个

            for (const dir of sessionDirs) {
                const sessionDir = join(sessionsRoot, dir.name)
                const stat = statSync(sessionDir)

                entries.push({
                    id: `codex-${dir.name}`,
                    provider: 'codex',
                    title: `Codex Session ${dir.name.slice(0, 8)}`,
                    status: 'completed',
                    preview: '',
                    timestamp: stat.mtimeMs,
                    sessionFile: sessionDir,
                    metadata: { sessionId: dir.name }
                })
            }
        } catch { /* skip */ }

        return entries
    }

    // ── Gemini JSONL Logs ──────────────────────────────────

    _scanGemini() {
        const entries = []
        const tmpRoot = join(HOME, '.gemini', 'tmp')
        if (!existsSync(tmpRoot)) return entries

        try {
            const files = readdirSync(tmpRoot)
                .filter(f => f.endsWith('.jsonl'))
                .slice(-20)

            for (const file of files) {
                const filePath = join(tmpRoot, file)
                const stat = statSync(filePath)

                // 读取第一行获取元数据
                let title = `Gemini Log ${basename(file, '.jsonl')}`
                try {
                    const firstLine = readFileSync(filePath, 'utf-8').split('\n')[0]
                    if (firstLine) {
                        const meta = JSON.parse(firstLine)
                        title = meta.prompt?.slice(0, 60) || meta.title || title
                    }
                } catch { /* use default title */ }

                entries.push({
                    id: `gemini-${basename(file, '.jsonl')}`,
                    provider: 'gemini',
                    title,
                    status: 'completed',
                    preview: '',
                    timestamp: stat.mtimeMs,
                    sessionFile: filePath,
                    metadata: { logFile: file }
                })
            }
        } catch { /* skip */ }

        return entries
    }

    // ── Droid Sessions ──────────────────────────────────────

    _scanDroid() {
        const entries = []
        const droidRoot = join(HOME, '.droid')
        if (!existsSync(droidRoot)) return entries

        try {
            const files = readdirSync(droidRoot)
                .filter(f => f.endsWith('.json') && f.startsWith('session'))
                .slice(-20)

            for (const file of files) {
                const filePath = join(droidRoot, file)
                const stat = statSync(filePath)

                entries.push({
                    id: `droid-${basename(file, '.json')}`,
                    provider: 'droid',
                    title: `Droid Session`,
                    status: 'completed',
                    preview: '',
                    timestamp: stat.mtimeMs,
                    sessionFile: filePath,
                    metadata: {}
                })
            }
        } catch { /* skip */ }

        return entries
    }
}

export default new SessionParser()
