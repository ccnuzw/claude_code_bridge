/**
 * TokenDetector — 检测本地 CLI 已安装的 AI 工具 Token
 *
 * 扫描常见路径：
 *   - ~/.claude/credentials.json    → Claude CLI (Anthropic)
 *   - ~/.codex/             → Codex CLI (OpenAI)
 *   - ~/.config/gemini/     → Gemini CLI (Google)
 *   - ~/.opencode/          → OpenCode
 *   - ANTHROPIC_API_KEY, OPENAI_API_KEY, GEMINI_API_KEY 环境变量
 *
 * 返回检测结果，用于 Onboarding 时自动导入。
 */
import { existsSync, readFileSync, readdirSync } from 'fs'
import { join } from 'path'
import { homedir } from 'os'

const HOME = homedir()

/** 所有检测规则 */
const DETECTION_RULES = [
    {
        provider: 'claude',
        label: 'Claude (Anthropic)',
        checks: [
            {
                type: 'file',
                path: join(HOME, '.claude', 'credentials.json'),
                extract: (content) => {
                    try {
                        const data = JSON.parse(content)
                        // Claude CLI stores OAuth tokens or API keys
                        if (data.apiKey) return { apiKey: data.apiKey, source: '~/.claude/credentials.json' }
                        if (data.oauth_token) return { oauthToken: data.oauth_token, source: '~/.claude/credentials.json' }
                        // Search for any key-like value
                        for (const [k, v] of Object.entries(data)) {
                            if (typeof v === 'string' && v.startsWith('sk-ant-')) {
                                return { apiKey: v, source: `~/.claude/credentials.json [${k}]` }
                            }
                        }
                    } catch { /* invalid JSON */ }
                    return null
                }
            },
            {
                type: 'file',
                path: join(HOME, '.claude', '.credentials.json'),
                extract: (content) => {
                    try {
                        const data = JSON.parse(content)
                        if (data.claudeAiOauth) {
                            return { oauthToken: data.claudeAiOauth.accessToken, source: '~/.claude/.credentials.json' }
                        }
                    } catch { /* */ }
                    return null
                }
            },
            { type: 'env', key: 'ANTHROPIC_API_KEY', prefix: 'sk-ant-' }
        ]
    },
    {
        provider: 'codex',
        label: 'Codex (OpenAI)',
        checks: [
            {
                type: 'dir',
                path: join(HOME, '.codex'),
                description: 'Codex CLI config directory',
                extract: (dirPath) => {
                    // Look for auth files in .codex/
                    for (const name of ['auth.json', 'config.json', 'credentials.json']) {
                        const fp = join(dirPath, name)
                        if (existsSync(fp)) {
                            try {
                                const data = JSON.parse(readFileSync(fp, 'utf-8'))
                                if (data.apiKey) return { apiKey: data.apiKey, source: `~/.codex/${name}` }
                                if (data.api_key) return { apiKey: data.api_key, source: `~/.codex/${name}` }
                            } catch { /* */ }
                        }
                    }
                    return { dirExists: true, source: '~/.codex/' }
                }
            },
            { type: 'env', key: 'OPENAI_API_KEY', prefix: 'sk-' }
        ]
    },
    {
        provider: 'gemini',
        label: 'Gemini (Google)',
        checks: [
            {
                type: 'dir',
                path: join(HOME, '.config', 'gemini'),
                description: 'Gemini CLI config',
                extract: (dirPath) => {
                    for (const name of ['credentials.json', 'config.json']) {
                        const fp = join(dirPath, name)
                        if (existsSync(fp)) {
                            try {
                                const data = JSON.parse(readFileSync(fp, 'utf-8'))
                                if (data.apiKey) return { apiKey: data.apiKey, source: `~/.config/gemini/${name}` }
                            } catch { /* */ }
                        }
                    }
                    return { dirExists: true, source: '~/.config/gemini/' }
                }
            },
            {
                type: 'file',
                path: join(HOME, '.gemini', 'settings.json'),
                extract: (content) => {
                    try {
                        const data = JSON.parse(content)
                        if (data.apiKey) return { apiKey: data.apiKey, source: '~/.gemini/settings.json' }
                    } catch { /* */ }
                    return null
                }
            },
            { type: 'env', key: 'GEMINI_API_KEY' },
            { type: 'env', key: 'GOOGLE_API_KEY' }
        ]
    },
    {
        provider: 'opencode',
        label: 'OpenCode',
        checks: [
            {
                type: 'dir',
                path: join(HOME, '.opencode'),
                description: 'OpenCode config',
                extract: (dirPath) => {
                    for (const name of ['config.json', 'auth.json']) {
                        const fp = join(dirPath, name)
                        if (existsSync(fp)) {
                            try {
                                const data = JSON.parse(readFileSync(fp, 'utf-8'))
                                if (data.apiKey) return { apiKey: data.apiKey, source: `~/.opencode/${name}` }
                            } catch { /* */ }
                        }
                    }
                    return { dirExists: true, source: '~/.opencode/' }
                }
            }
        ]
    }
]

export default class TokenDetector {
    /**
     * 扫描所有 provider 的本地 token
     * @returns {Array<{ provider, label, found, tokens: Array<{ apiKey?, oauthToken?, source }> }>}
     */
    detectAll() {
        const results = []

        for (const rule of DETECTION_RULES) {
            const tokens = []

            for (const check of rule.checks) {
                try {
                    if (check.type === 'file') {
                        if (existsSync(check.path)) {
                            const content = readFileSync(check.path, 'utf-8')
                            const result = check.extract(content)
                            if (result) tokens.push(result)
                        }
                    } else if (check.type === 'dir') {
                        if (existsSync(check.path)) {
                            const result = check.extract(check.path)
                            if (result) tokens.push(result)
                        }
                    } else if (check.type === 'env') {
                        const val = process.env[check.key]
                        if (val && val.length > 5) {
                            if (!check.prefix || val.startsWith(check.prefix)) {
                                tokens.push({ apiKey: val, source: `env:${check.key}` })
                            }
                        }
                    }
                } catch (err) {
                    console.error(`[TokenDetector] Error checking ${rule.provider}:`, err.message)
                }
            }

            results.push({
                provider: rule.provider,
                label: rule.label,
                found: tokens.length > 0,
                tokens
            })
        }

        return results
    }

    /**
     * 检测单个 provider
     * @param {string} providerName
     * @returns {{ provider, label, found, tokens }}
     */
    detect(providerName) {
        const all = this.detectAll()
        return all.find(r => r.provider === providerName) || {
            provider: providerName,
            label: providerName,
            found: false,
            tokens: []
        }
    }
}
