/**
 * MailManager — 读取/管理 CCB Mail 配置和状态
 *
 * 数据来源：
 *   - ~/.ccb/mail/config.json（mail daemon 配置 v3）
 *   - ~/.ccb/mail/threads.json（邮件线程记录）
 *   - maild 进程状态
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, statSync } from 'fs'
import { join } from 'path'
import { homedir } from 'os'
import { EventEmitter } from 'events'

const HOME = homedir()
const MAIL_DIR = join(HOME, '.ccb', 'mail')
const CONFIG_FILE = join(MAIL_DIR, 'config.json')
const THREADS_FILE = join(MAIL_DIR, 'threads.json')
const TOKENS_DIR = join(HOME, '.ccb', 'tokens')

const DEFAULT_CONFIG = {
    version: 3,
    enabled: false,
    service_account: { email: '', password_ref: '', provider: 'gmail' },
    target_email: '',
    ask_mode: {
        default_provider: 'claude',
        supported_providers: ['claude', 'codex', 'gemini', 'opencode', 'droid'],
        auto_reply: true
    },
    notification: { mode: 'on_completion', include_output: true },
    polling: { interval_seconds: 30, idle_timeout_minutes: 5 }
}

class MailManager extends EventEmitter {
    constructor() {
        super()
        this._config = null
    }

    /** 获取 mail 配置 */
    getConfig() {
        if (this._config) return this._config
        if (!existsSync(CONFIG_FILE)) return { ...DEFAULT_CONFIG }
        try {
            this._config = JSON.parse(readFileSync(CONFIG_FILE, 'utf-8'))
            return this._config
        } catch {
            return { ...DEFAULT_CONFIG }
        }
    }

    /** 保存 mail 配置 */
    saveConfig(config) {
        if (!existsSync(MAIL_DIR)) {
            mkdirSync(MAIL_DIR, { recursive: true })
        }
        writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2))
        this._config = config
        this.emit('config-changed', config)
        return config
    }

    /** 更新单个配置项 */
    updateConfig(key, value) {
        const config = this.getConfig()
        config[key] = value
        return this.saveConfig(config)
    }

    /** 获取邮件线程列表 */
    getThreads() {
        if (!existsSync(THREADS_FILE)) return []
        try {
            const threads = JSON.parse(readFileSync(THREADS_FILE, 'utf-8'))
            return Array.isArray(threads) ? threads : []
        } catch {
            return []
        }
    }

    /** 获取 token 文件列表（cloud mail tokens） */
    getTokenFiles() {
        if (!existsSync(TOKENS_DIR)) return []
        try {
            return readdirSync(TOKENS_DIR)
                .filter(f => f.endsWith('.json'))
                .map(f => {
                    const filePath = join(TOKENS_DIR, f)
                    const stat = statSync(filePath)
                    let tokenData = {}
                    try {
                        tokenData = JSON.parse(readFileSync(filePath, 'utf-8'))
                    } catch { /* skip corrupt */ }
                    return {
                        filename: f,
                        path: filePath,
                        size: stat.size,
                        modified: stat.mtimeMs,
                        ...tokenData
                    }
                })
                .sort((a, b) => b.modified - a.modified)
        } catch {
            return []
        }
    }

    /** 获取 mail 概览数据 */
    getOverview() {
        const config = this.getConfig()
        const threads = this.getThreads()
        const tokens = this.getTokenFiles()

        return {
            config,
            enabled: config.enabled,
            serviceEmail: config.service_account?.email || '',
            targetEmail: config.target_email || '',
            defaultProvider: config.ask_mode?.default_provider || 'claude',
            notifyMode: config.notification?.mode || 'on_completion',
            pollInterval: config.polling?.interval_seconds || 30,
            threads: threads.slice(0, 20),
            threadCount: threads.length,
            tokens,
            tokenCount: tokens.length
        }
    }
}

export default new MailManager()
