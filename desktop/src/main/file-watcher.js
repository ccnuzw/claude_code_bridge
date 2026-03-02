/**
 * FileWatcher — 实时文件监控
 *
 * 使用 Node.js fs.watch 监控 ~/.ccb/ 目录变化，
 * 当 session 文件更新时推送事件到渲染进程。
 */
import { watch, existsSync, readdirSync, statSync } from 'fs'
import { join, basename } from 'path'
import { homedir } from 'os'
import { EventEmitter } from 'events'

const HOME = homedir()

class FileWatcher extends EventEmitter {
    constructor() {
        super()
        this._watchers = []
        this._debounceTimers = new Map()
    }

    /** 开始监控关键目录 */
    start() {
        const watchDirs = [
            join(HOME, '.ccb'),
            join(HOME, '.ccb', 'run'),
            join(HOME, '.ccb', 'mail'),
            join(HOME, '.ccb', 'tokens'),
            join(HOME, '.claude', 'projects')
        ]

        for (const dir of watchDirs) {
            if (!existsSync(dir)) continue
            try {
                const watcher = watch(dir, { recursive: false }, (eventType, filename) => {
                    this._handleChange(dir, eventType, filename)
                })
                this._watchers.push(watcher)
            } catch (e) {
                console.error(`[FileWatcher] Cannot watch ${dir}:`, e.message)
            }
        }

        // 监控 Claude sessions 子目录变化
        const claudeProjects = join(HOME, '.claude', 'projects')
        if (existsSync(claudeProjects)) {
            try {
                const subdirs = readdirSync(claudeProjects, { withFileTypes: true })
                    .filter(d => d.isDirectory())
                for (const sub of subdirs.slice(0, 20)) {
                    const subPath = join(claudeProjects, sub.name)
                    try {
                        const w = watch(subPath, { recursive: false }, (eventType, filename) => {
                            this._handleChange(subPath, eventType, filename)
                        })
                        this._watchers.push(w)
                    } catch { /* skip */ }
                }
            } catch { /* skip */ }
        }
    }

    /** 防抖处理文件变化 */
    _handleChange(dir, eventType, filename) {
        if (!filename) return
        const key = `${dir}/${filename}`

        // 防抖 500ms
        if (this._debounceTimers.has(key)) {
            clearTimeout(this._debounceTimers.get(key))
        }

        this._debounceTimers.set(key, setTimeout(() => {
            this._debounceTimers.delete(key)

            const fullPath = join(dir, filename)
            const category = this._categorize(dir, filename)

            this.emit('file-changed', {
                path: fullPath,
                filename,
                directory: dir,
                category,
                event: eventType,
                timestamp: Date.now()
            })

            // 发射分类事件
            if (category) {
                this.emit(`${category}-changed`, { path: fullPath, filename })
            }
        }, 500))
    }

    /** 分类文件变化 */
    _categorize(dir, filename) {
        if (dir.includes('.ccb/run') || filename.endsWith('.json')) return 'daemon'
        if (dir.includes('.ccb/mail')) return 'mail'
        if (dir.includes('.ccb/tokens')) return 'tokens'
        if (dir.includes('.claude/projects')) return 'sessions'
        if (filename === 'ccb.config') return 'config'
        if (filename === 'desktop-settings.json') return 'settings'
        return 'other'
    }

    /** 停止所有监控 */
    stop() {
        for (const w of this._watchers) {
            try { w.close() } catch { /* ok */ }
        }
        this._watchers = []
        for (const timer of this._debounceTimers.values()) {
            clearTimeout(timer)
        }
        this._debounceTimers.clear()
    }
}

export default new FileWatcher()
