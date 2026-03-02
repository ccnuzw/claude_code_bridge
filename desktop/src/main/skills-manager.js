/**
 * SkillsManager — 扫描 CCB Skills / MCP / Roles
 *
 * 数据来源：
 *   - claude_skills/ （SKILL.md 含 YAML frontmatter）
 *   - .mcp.json（MCP server 配置）
 *   - roles/（角色文件）
 *   - .agent/workflows/（工作流文件）
 */
import { readdirSync, readFileSync, existsSync, statSync } from 'fs'
import { join, basename } from 'path'
import { homedir } from 'os'
import { EventEmitter } from 'events'
import processManager from './process-manager.js'

class SkillsManager extends EventEmitter {
    constructor() {
        super()
        this._cache = null
    }

    /** 获取 CCB 项目根目录 */
    _getCcbRoot() {
        return processManager.getCcbRoot() || join(homedir(), 'Progame', 'claude_code_bridge')
    }

    /** 扫描所有 skills */
    scanSkills() {
        const root = this._getCcbRoot()
        const skillsDir = join(root, 'claude_skills')
        if (!existsSync(skillsDir)) return []

        try {
            return readdirSync(skillsDir, { withFileTypes: true })
                .filter(d => d.isDirectory())
                .map(d => {
                    const skillPath = join(skillsDir, d.name)
                    const skillMd = join(skillPath, 'SKILL.md')
                    let meta = { name: d.name, description: '' }

                    if (existsSync(skillMd)) {
                        try {
                            const content = readFileSync(skillMd, 'utf-8')
                            // 解析 YAML frontmatter
                            const fmMatch = content.match(/^---\n([\s\S]*?)\n---/)
                            if (fmMatch) {
                                const yml = fmMatch[1]
                                const nameMatch = yml.match(/name:\s*(.+)/)
                                const descMatch = yml.match(/description:\s*(.+)/)
                                const shortDescMatch = yml.match(/short-description:\s*(.+)/)
                                if (nameMatch) meta.name = nameMatch[1].trim()
                                if (descMatch) meta.description = descMatch[1].trim()
                                if (shortDescMatch) meta.shortDescription = shortDescMatch[1].trim()
                            }
                            meta.hasContent = content.length > 100
                        } catch { /* skip */ }
                    }

                    const stat = statSync(skillPath)
                    return {
                        id: `skill-${d.name}`,
                        name: d.name,
                        label: meta.name,
                        description: meta.description || meta.shortDescription || '',
                        path: skillPath,
                        modified: stat.mtimeMs,
                        type: 'skill'
                    }
                })
                .sort((a, b) => a.name.localeCompare(b.name))
        } catch {
            return []
        }
    }

    /** 扫描 MCP servers（从 .mcp.json） */
    scanMcpServers() {
        const root = this._getCcbRoot()
        const mcpFile = join(root, '.mcp.json')
        if (!existsSync(mcpFile)) return []

        try {
            const config = JSON.parse(readFileSync(mcpFile, 'utf-8'))
            const servers = config.mcpServers || config.servers || {}
            return Object.entries(servers).map(([name, cfg]) => ({
                id: `mcp-${name}`,
                name,
                command: cfg.command || '',
                args: cfg.args || [],
                env: Object.keys(cfg.env || {}),
                type: 'mcp'
            }))
        } catch {
            return []
        }
    }

    /** 扫描 Roles */
    scanRoles() {
        const root = this._getCcbRoot()
        const rolesDir = join(root, 'roles')
        if (!existsSync(rolesDir)) return []

        try {
            return readdirSync(rolesDir)
                .filter(f => f.endsWith('.md') || f.endsWith('.txt'))
                .map(f => {
                    const filePath = join(rolesDir, f)
                    const stat = statSync(filePath)
                    let preview = ''
                    try {
                        preview = readFileSync(filePath, 'utf-8').slice(0, 100).replace(/\n/g, ' ')
                    } catch { /* skip */ }
                    return {
                        id: `role-${basename(f, '.md')}`,
                        name: basename(f, '.md').replace(/-/g, ' '),
                        filename: f,
                        path: filePath,
                        preview,
                        modified: stat.mtimeMs,
                        type: 'role'
                    }
                })
        } catch {
            return []
        }
    }

    /** 扫描 Workflows */
    scanWorkflows() {
        const root = this._getCcbRoot()
        const dirs = [
            join(root, '.agent', 'workflows'),
            join(root, '.agents', 'workflows'),
            join(root, '_agent', 'workflows')
        ]

        const workflows = []
        for (const dir of dirs) {
            if (!existsSync(dir)) continue
            try {
                const files = readdirSync(dir).filter(f => f.endsWith('.md'))
                for (const f of files) {
                    const filePath = join(dir, f)
                    const stat = statSync(filePath)
                    let description = ''
                    try {
                        const content = readFileSync(filePath, 'utf-8')
                        const descMatch = content.match(/description:\s*(.+)/)
                        if (descMatch) description = descMatch[1].trim()
                    } catch { /* skip */ }
                    workflows.push({
                        id: `wf-${basename(f, '.md')}`,
                        name: basename(f, '.md'),
                        filename: f,
                        path: filePath,
                        description,
                        modified: stat.mtimeMs,
                        type: 'workflow'
                    })
                }
            } catch { /* skip */ }
        }
        return workflows
    }

    /** 获取全部扩展概览 */
    getOverview() {
        const skills = this.scanSkills()
        const mcpServers = this.scanMcpServers()
        const roles = this.scanRoles()
        const workflows = this.scanWorkflows()

        this._cache = { skills, mcpServers, roles, workflows }
        return this._cache
    }

    /** 获取缓存 */
    getCached() {
        return this._cache || this.getOverview()
    }
}

export default new SkillsManager()
