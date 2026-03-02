/**
 * PtyManager — 管理多个 node-pty 终端实例
 *
 * 每个终端实例通过唯一 ID 标识，支持：
 *   - 创建/销毁终端
 *   - 向终端写入
 *   - 调整终端大小
 *   - 读取终端输出（通过 IPC 推送到渲染进程）
 */
import { spawn as ptySpawn } from 'node-pty'
import { EventEmitter } from 'events'
import { homedir } from 'os'

class PtyManager extends EventEmitter {
    constructor() {
        super()
        this._terminals = new Map() // id -> { pty, cols, rows }
        this._counter = 0
    }

    /** 创建新终端实例 */
    createTerminal(options = {}) {
        const id = `term-${++this._counter}`
        const shell = options.shell || process.env.SHELL || '/bin/zsh'
        const cwd = options.cwd || homedir()
        const cols = options.cols || 120
        const rows = options.rows || 30

        const pty = ptySpawn(shell, [], {
            name: 'xterm-256color',
            cols,
            rows,
            cwd,
            env: {
                ...process.env,
                TERM: 'xterm-256color',
                COLORTERM: 'truecolor',
                TERM_PROGRAM: 'CCBDesktop'
            }
        })

        // 监听输出，推送到渲染进程
        pty.onData((data) => {
            this.emit('terminal-data', { id, data })
        })

        pty.onExit(({ exitCode, signal }) => {
            this._terminals.delete(id)
            this.emit('terminal-exit', { id, exitCode, signal })
        })

        this._terminals.set(id, { pty, cols, rows, cwd, shell, createdAt: Date.now() })
        this.emit('terminal-created', { id, cwd, shell })

        return { id, cwd, shell, cols, rows }
    }

    /** 向终端写入数据 */
    write(id, data) {
        const term = this._terminals.get(id)
        if (term) {
            term.pty.write(data)
            return true
        }
        return false
    }

    /** 调整终端大小 */
    resize(id, cols, rows) {
        const term = this._terminals.get(id)
        if (term) {
            term.pty.resize(cols, rows)
            term.cols = cols
            term.rows = rows
            return true
        }
        return false
    }

    /** 销毁终端实例 */
    destroy(id) {
        const term = this._terminals.get(id)
        if (term) {
            term.pty.kill()
            this._terminals.delete(id)
            this.emit('terminal-destroyed', { id })
            return true
        }
        return false
    }

    /** 获取所有终端列表 */
    list() {
        const result = []
        for (const [id, term] of this._terminals) {
            result.push({
                id,
                cwd: term.cwd,
                shell: term.shell,
                cols: term.cols,
                rows: term.rows,
                createdAt: term.createdAt
            })
        }
        return result
    }

    /** 获取终端数量 */
    get count() {
        return this._terminals.size
    }

    /** 销毁所有终端 */
    destroyAll() {
        for (const [id, term] of this._terminals) {
            try { term.pty.kill() } catch { /* ignore */ }
        }
        this._terminals.clear()
    }
}

export default new PtyManager()
