/**
 * Extensions 页面 — 6 分类 Master-Detail 布局
 *
 * 左侧导航：Skills / MCP Servers / Project Config / Roles & Rubrics / Workflows / Sessions
 * 右侧内容：从文件系统扫描的真实数据
 */
import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

const api = typeof window !== 'undefined' ? window.electronAPI : null

// ── MCP Server 管理面板 ──────────────────────────────────
function McpPanel({ servers = [], t }) {
    const [expanded, setExpanded] = useState(null)
    return (
        <div className="space-y-4">
            {servers.length === 0 ? (
                <div className="text-center py-16 empty-state-glow">
                    <span className="material-symbols-outlined text-[48px] text-slate-600 mb-4 block animate-float-icon">hub</span>
                    <h3 className="text-white font-semibold text-lg">{t('extensions.mcpNoServers')}</h3>
                    <button className="mt-4 px-4 py-2 rounded-lg bg-[var(--color-primary)] text-white text-sm hover:opacity-90">
                        <span className="material-symbols-outlined text-[14px] mr-1 align-middle">add</span>
                        {t('extensions.mcpServers')}
                    </button>
                </div>
            ) : (
                <div className="space-y-3">
                    {servers.map((s, i) => (
                        <div key={s.id || i} className="bg-[var(--color-surface-dark)] border border-[var(--color-border-dark)] rounded-xl overflow-hidden hover:border-purple-500/30 transition-all">
                            {/* 头部 */}
                            <div className="p-4 flex items-center justify-between cursor-pointer" onClick={() => setExpanded(expanded === i ? null : i)}>
                                <div className="flex items-center gap-3">
                                    <div className="bg-purple-500/10 p-2 rounded-lg border border-purple-500/20">
                                        <span className="material-symbols-outlined text-purple-400 text-[20px]">hub</span>
                                    </div>
                                    <div>
                                        <h4 className="text-white font-semibold text-sm">{s.name}</h4>
                                        <p className="text-slate-500 text-[10px] font-mono">{s.command} {(s.args || []).join(' ')}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <span className={`text-[10px] px-2 py-0.5 rounded-full border ${s.status === 'running' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' : 'bg-slate-500/10 text-slate-500 border-slate-500/20'}`}>
                                        {s.status || 'stopped'}
                                    </span>
                                    <span className={`material-symbols-outlined text-[18px] text-slate-500 transition-transform ${expanded === i ? 'rotate-180' : ''}`}>expand_more</span>
                                </div>
                            </div>
                            {/* 展开详情 */}
                            {expanded === i && (
                                <div className="border-t border-[var(--color-border-dark)] p-4 space-y-4 animate-fade-in">
                                    {/* Tools */}
                                    <div>
                                        <h5 className="text-xs font-semibold text-slate-400 uppercase mb-2">{t('extensions.mcpTools')}</h5>
                                        <div className="flex flex-wrap gap-2">
                                            {(s.tools || ['No tools registered']).map((tool, ti) => (
                                                <span key={ti} className="text-[10px] px-2 py-1 rounded-lg bg-purple-500/5 text-purple-300 border border-purple-500/10 font-mono">{typeof tool === 'string' ? tool : tool.name || 'unknown'}</span>
                                            ))}
                                        </div>
                                    </div>
                                    {/* Env */}
                                    {s.env?.length > 0 && (
                                        <div>
                                            <h5 className="text-xs font-semibold text-slate-400 uppercase mb-2">Environment</h5>
                                            <div className="flex flex-wrap gap-1">
                                                {s.env.map(e => <span key={e} className="text-[9px] px-1.5 py-0.5 rounded bg-slate-700/50 text-slate-400 font-mono">{e}</span>)}
                                            </div>
                                        </div>
                                    )}
                                    {/* 操作 */}
                                    <div className="flex gap-2 pt-2">
                                        <button className="px-3 py-1.5 text-xs rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20">Start</button>
                                        <button className="px-3 py-1.5 text-xs rounded-lg bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20">Stop</button>
                                        <button className="px-3 py-1.5 text-xs rounded-lg bg-white/5 text-slate-400 border border-[var(--color-border-dark)] hover:bg-white/10">Config</button>
                                    </div>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}

// ── Project Config 面板 ──────────────────────────────────
function ProjectConfigPanel({ t }) {
    const configFiles = [
        { name: 'CLAUDE.md', provider: 'Claude', icon: '📋', exists: true },
        { name: 'GEMINI.md', provider: 'Gemini', icon: '💎', exists: true },
        { name: 'AGENTS.md', provider: 'Codex', icon: '🤖', exists: false },
        { name: '.openclaw.json', provider: 'OpenCode', icon: '⚙️', exists: false }
    ]
    const modules = [
        { name: 'AI Collaboration', key: 'collab', enabled: true },
        { name: 'Async Guardrail', key: 'guardrail', enabled: true },
        { name: 'Role Assignment', key: 'roles', enabled: false },
        { name: 'Review Framework', key: 'review', enabled: true },
        { name: 'Inspiration', key: 'inspire', enabled: false }
    ]
    const [enabledModules, setEnabledModules] = useState(
        Object.fromEntries(modules.map(m => [m.key, m.enabled]))
    )

    return (
        <div className="space-y-6">
            {/* 指令文件 */}
            <div>
                <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-3">{t('extensions.configFiles')}</h3>
                <div className="grid grid-cols-2 gap-3">
                    {configFiles.map(f => (
                        <div key={f.name} className={`bg-[var(--color-surface-dark)] border rounded-xl p-4 transition-all ${f.exists ? 'border-[var(--color-border-dark)] hover:border-[var(--color-primary)]/30' : 'border-dashed border-slate-700 opacity-60'}`}>
                            <div className="flex items-center gap-3 mb-2">
                                <span className="text-lg">{f.icon}</span>
                                <div>
                                    <h4 className="text-white text-sm font-mono font-medium">{f.name}</h4>
                                    <p className="text-slate-500 text-[10px]">{f.provider}</p>
                                </div>
                            </div>
                            <div className="flex gap-2">
                                {f.exists ? (
                                    <>
                                        <button className="px-2 py-1 text-[10px] rounded bg-[var(--color-primary)]/10 text-[var(--color-primary)] hover:bg-[var(--color-primary)]/20">Edit</button>
                                        <button className="px-2 py-1 text-[10px] rounded bg-white/5 text-slate-400 hover:bg-white/10">Preview</button>
                                    </>
                                ) : (
                                    <button className="px-2 py-1 text-[10px] rounded bg-white/5 text-slate-400 hover:bg-white/10">Create</button>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* 注入模块控制 */}
            <div>
                <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-3">{t('extensions.injectionModules')}</h3>
                <div className="space-y-2">
                    {modules.map(m => (
                        <div key={m.key} className="bg-[var(--color-surface-dark)] border border-[var(--color-border-dark)] rounded-xl p-3 flex items-center justify-between">
                            <span className="text-white text-sm">{m.name}</span>
                            <button
                                onClick={() => setEnabledModules(prev => ({ ...prev, [m.key]: !prev[m.key] }))}
                                className={`relative w-10 h-5 rounded-full transition-colors ${enabledModules[m.key] ? 'bg-[var(--color-primary)]' : 'bg-slate-600'}`}>
                                <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${enabledModules[m.key] ? 'left-5' : 'left-0.5'}`} />
                            </button>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    )
}

// ── Roles & Rubrics 面板 ─────────────────────────────────
function RolesPanel({ roles = [], t, onView }) {
    const providerOptions = ['claude', 'codex', 'gemini', 'opencode']
    return (
        <div className="space-y-6">
            {/* 角色映射 */}
            <div>
                <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-3">{t('extensions.roleMapping')}</h3>
                {roles.length === 0 ? (
                    <div className="text-center py-12 empty-state-glow">
                        <span className="material-symbols-outlined text-[40px] text-slate-600 block mb-3 animate-float-icon">badge</span>
                        <p className="text-slate-400 text-sm">{t('extensions.roles')} — {t('extensions.notFound')}</p>
                    </div>
                ) : (
                    <div className="space-y-2">
                        {roles.map(r => (
                            <div key={r.id} className="bg-[var(--color-surface-dark)] border border-[var(--color-border-dark)] rounded-xl p-4 flex items-center gap-4 group hover:border-emerald-500/30 transition-all">
                                <div className="bg-emerald-500/10 p-2 rounded-lg border border-emerald-500/20">
                                    <span className="material-symbols-outlined text-emerald-400 text-[20px]">badge</span>
                                </div>
                                <div className="flex-1 min-w-0">
                                    <h4 className="text-white font-semibold text-sm capitalize">{r.name}</h4>
                                    <p className="text-slate-500 text-xs truncate">{r.preview || r.filename}</p>
                                </div>
                                <select className="bg-[var(--color-surface-darker)] border border-[var(--color-border-dark)] rounded-lg px-2 py-1 text-xs text-slate-300 focus:outline-none">
                                    {providerOptions.map(p => <option key={p} value={p}>{p}</option>)}
                                </select>
                                <button onClick={() => onView?.('roles', r.filename)} className="opacity-0 group-hover:opacity-100 px-2 py-1 text-[10px] rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 transition-all">
                                    View
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Rubric 编辑器 */}
            <div>
                <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-3">{t('extensions.rubricEditor')}</h3>
                <div className="bg-[var(--color-surface-dark)] border border-[var(--color-border-dark)] rounded-xl p-4 space-y-3">
                    {['Code Quality', 'Security', 'Performance', 'Readability'].map(dim => (
                        <div key={dim} className="flex items-center gap-3">
                            <span className="text-white text-xs w-24">{dim}</span>
                            <input type="range" min="0" max="100" defaultValue="50" className="flex-1 accent-[var(--color-primary)]" />
                            <span className="text-slate-400 text-xs w-8 text-right">50%</span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    )
}

// ── Sessions 管理面板 ────────────────────────────────────
function SessionsPanel({ t }) {
    const [sessions] = useState([])
    return (
        <div className="space-y-6">
            <div className="grid grid-cols-3 gap-4">
                <div className="bg-[var(--color-surface-dark)] border border-[var(--color-border-dark)] rounded-xl p-4 text-center">
                    <p className="text-2xl font-bold text-white">{sessions.filter(s => s.active).length || 0}</p>
                    <p className="text-xs text-slate-400 mt-1">{t('extensions.activeSessions')}</p>
                </div>
                <div className="bg-[var(--color-surface-dark)] border border-[var(--color-border-dark)] rounded-xl p-4 text-center">
                    <p className="text-2xl font-bold text-white">{sessions.length || 0}</p>
                    <p className="text-xs text-slate-400 mt-1">{t('extensions.historySessions')}</p>
                </div>
                <div className="bg-[var(--color-surface-dark)] border border-[var(--color-border-dark)] rounded-xl p-4 text-center">
                    <p className="text-2xl font-bold text-white">0 MB</p>
                    <p className="text-xs text-slate-400 mt-1">{t('extensions.diskUsage')}</p>
                </div>
            </div>
            {sessions.length === 0 ? (
                <div className="text-center py-12 empty-state-glow">
                    <span className="material-symbols-outlined text-[40px] text-slate-600 block mb-3 animate-float-icon">history</span>
                    <p className="text-slate-400 text-sm">{t('extensions.sessions')} — {t('extensions.notFound')}</p>
                </div>
            ) : (
                <div className="space-y-2">
                    {sessions.map((s, i) => (
                        <div key={i} className="bg-[var(--color-surface-dark)] border border-[var(--color-border-dark)] rounded-xl p-3 flex items-center gap-3">
                            <span className={`size-2 rounded-full ${s.active ? 'bg-emerald-500' : 'bg-slate-500'}`} />
                            <div className="flex-1 min-w-0">
                                <p className="text-white text-sm truncate">{s.id}</p>
                                <p className="text-slate-500 text-xs">{s.provider} • {s.duration}</p>
                            </div>
                            <button className="px-2 py-1 text-[10px] rounded bg-white/5 text-slate-400 hover:bg-white/10">Restore</button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}

// ── 主组件 ────────────────────────────────────────────────
export default function Extensions() {
    const { t } = useTranslation()
    const [active, setActive] = useState('skills')
    const [overview, setOverview] = useState(null)
    const [isLoading, setIsLoading] = useState(false)
    const [viewContent, setViewContent] = useState(null)
    const [contentLoading, setContentLoading] = useState(false)

    const SECTIONS = [
        { id: 'skills', labelKey: 'extensions.skills', icon: 'extension', descKey: 'extensions.skillsDesc' },
        { id: 'mcp', labelKey: 'extensions.mcpServers', icon: 'hub', descKey: 'extensions.mcpDesc' },
        { id: 'projectConfig', labelKey: 'extensions.projectConfig', icon: 'folder_open', descKey: 'extensions.projectConfigDesc' },
        { id: 'roles', labelKey: 'extensions.roles', icon: 'badge', descKey: 'extensions.rolesDesc' },
        { id: 'workflows', labelKey: 'extensions.workflows', icon: 'account_tree', descKey: 'extensions.workflowsDesc' },
        { id: 'sessions', labelKey: 'extensions.sessions', icon: 'history', descKey: 'extensions.sessionsDesc' }
    ]

    const fetchOverview = async () => {
        if (!api) return
        setIsLoading(true)
        try { setOverview(await api.extensionsGetOverview()) }
        catch (err) { console.error('Failed to fetch extensions:', err) }
        setIsLoading(false)
    }

    useEffect(() => { fetchOverview() }, [])

    const activeSection = SECTIONS.find(s => s.id === active)

    const viewItem = async (type, nameOrFile) => {
        setContentLoading(true)
        try {
            const loaders = {
                skills: () => api.extensionsGetSkillContent(nameOrFile),
                roles: () => api.extensionsGetRoleContent(nameOrFile),
                workflows: () => api.extensionsGetWorkflowContent(nameOrFile)
            }
            const result = await loaders[type]()
            setViewContent({ name: nameOrFile, content: result?.content || 'No content' })
        } catch {
            setViewContent({ name: nameOrFile, content: 'Failed to load content' })
        }
        setContentLoading(false)
    }

    const skills = overview?.skills || []
    const mcpServers = overview?.mcpServers || []
    const roles = overview?.roles || []
    const workflows = overview?.workflows || []

    return (
        <div className="flex h-full overflow-hidden">
            {/* 左侧导航 */}
            <aside className="w-52 shrink-0 border-r border-[var(--color-border-dark)] bg-[var(--color-surface-darker)] flex flex-col">
                <div className="p-4 border-b border-[var(--color-border-dark)] flex items-center justify-between">
                    <h3 className="text-white text-sm font-semibold">{t('extensions.title')}</h3>
                    <button onClick={fetchOverview} disabled={isLoading} className="p-1 text-slate-500 hover:text-white rounded transition-colors">
                        <span className={`material-symbols-outlined text-[16px] ${isLoading ? 'animate-spin' : ''}`}>refresh</span>
                    </button>
                </div>
                <nav className="flex-1 px-2 py-2 space-y-0.5 overflow-y-auto custom-thin-scrollbar">
                    {SECTIONS.map(s => {
                        const countMap = { skills: skills.length, mcp: mcpServers.length, roles: roles.length, workflows: workflows.length }
                        const count = countMap[s.id] || 0
                        return (
                            <button key={s.id} onClick={() => setActive(s.id)}
                                className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors ${active === s.id
                                    ? 'bg-[var(--color-primary)]/10 text-[var(--color-primary)] font-medium'
                                    : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'}`}>
                                <span className="flex items-center gap-2.5">
                                    <span className="material-symbols-outlined text-[18px]">{s.icon}</span>
                                    {t(s.labelKey)}
                                </span>
                                {count > 0 && <span className="text-[10px] text-slate-500">{count}</span>}
                            </button>
                        )
                    })}
                </nav>
            </aside>

            {/* 右侧内容区 */}
            <div className="flex-1 overflow-y-auto p-6 custom-thin-scrollbar">
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h2 className="text-lg font-bold text-white">{t(activeSection?.labelKey)}</h2>
                        <p className="text-slate-400 text-xs mt-0.5">{t(activeSection?.descKey)}</p>
                    </div>
                </div>

                {isLoading ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-fade-in">
                        {[1, 2, 3, 4].map(i => <div key={i} className="skeleton skeleton-hero rounded-xl" />)}
                    </div>
                ) : (
                    <>
                        {/* Skills */}
                        {active === 'skills' && (
                            skills.length === 0 ? (
                                <div className="text-center py-20 empty-state-glow">
                                    <span className="material-symbols-outlined text-[48px] text-slate-600 mb-4 block animate-float-icon">extension</span>
                                    <h3 className="text-white font-semibold text-lg">{t('extensions.skills')} — {t('extensions.notFound')}</h3>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {skills.map(s => (
                                        <div key={s.id} className="bg-[var(--color-surface-dark)] border border-[var(--color-border-dark)] rounded-xl p-4 hover:border-[var(--color-primary)]/30 transition-all group">
                                            <div className="flex items-start justify-between">
                                                <div className="flex items-center gap-3">
                                                    <div className="bg-[var(--color-surface-darker)] p-2 rounded-lg border border-[var(--color-border-dark)]">
                                                        <span className="material-symbols-outlined text-[var(--color-primary)] text-[20px]">extension</span>
                                                    </div>
                                                    <div>
                                                        <h4 className="text-white font-semibold text-sm">{s.name}</h4>
                                                        <p className="text-slate-500 text-xs mt-0.5">{s.description || t('extensions.notFound')}</p>
                                                    </div>
                                                </div>
                                                <button onClick={() => viewItem('skills', s.name)} className="opacity-0 group-hover:opacity-100 px-2 py-1 text-[10px] rounded bg-[var(--color-primary)]/10 text-[var(--color-primary)] border border-[var(--color-primary)]/20 hover:bg-[var(--color-primary)]/20 transition-all">View</button>
                                            </div>
                                            <div className="mt-3 pt-3 border-t border-[var(--color-border-dark)] flex items-center justify-between">
                                                <span className="text-[10px] text-slate-500 font-mono truncate">{s.path}</span>
                                                <span className="text-[10px] text-slate-600">{new Date(s.modified).toLocaleDateString()}</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )
                        )}

                        {/* MCP Servers */}
                        {active === 'mcp' && <McpPanel servers={mcpServers} t={t} />}

                        {/* Project Config */}
                        {active === 'projectConfig' && <ProjectConfigPanel t={t} />}

                        {/* Roles & Rubrics */}
                        {active === 'roles' && <RolesPanel roles={roles} t={t} onView={viewItem} />}

                        {/* Workflows */}
                        {active === 'workflows' && (
                            workflows.length === 0 ? (
                                <div className="text-center py-20 empty-state-glow">
                                    <span className="material-symbols-outlined text-[48px] text-slate-600 mb-4 block animate-float-icon">account_tree</span>
                                    <h3 className="text-white font-semibold text-lg">{t('extensions.workflows')} — {t('extensions.notFound')}</h3>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {workflows.map(s => (
                                        <div key={s.id} className="bg-[var(--color-surface-dark)] border border-[var(--color-border-dark)] rounded-xl p-4 hover:border-orange-500/30 transition-all group">
                                            <div className="flex items-center gap-3">
                                                <div className="bg-orange-500/10 p-2 rounded-lg border border-orange-500/20">
                                                    <span className="material-symbols-outlined text-orange-400 text-[20px]">account_tree</span>
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <h4 className="text-white font-semibold text-sm">{s.name}</h4>
                                                    <p className="text-slate-500 text-xs truncate">{s.description || s.filename}</p>
                                                </div>
                                                <button onClick={() => viewItem('workflows', s.filename)} className="opacity-0 group-hover:opacity-100 px-2 py-1 text-[10px] rounded bg-orange-500/10 text-orange-400 border border-orange-500/20 hover:bg-orange-500/20 transition-all">View</button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )
                        )}

                        {/* Sessions */}
                        {active === 'sessions' && <SessionsPanel t={t} />}
                    </>
                )}
            </div>

            {/* Content Viewer Modal */}
            {viewContent && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-8 animate-fade-in">
                    <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setViewContent(null)} />
                    <div className="relative w-full max-w-3xl max-h-[80vh] bg-[#161d2a] rounded-xl shadow-2xl ring-1 ring-white/5 overflow-hidden flex flex-col">
                        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--color-border-dark)]">
                            <h3 className="text-white font-semibold">{viewContent.name}</h3>
                            <button onClick={() => setViewContent(null)} className="p-1 text-slate-400 hover:text-white rounded">
                                <span className="material-symbols-outlined">close</span>
                            </button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-6 custom-thin-scrollbar">
                            {contentLoading ? (
                                <div className="animate-pulse space-y-2">
                                    {[1, 2, 3].map(i => <div key={i} className="h-4 bg-slate-700/50 rounded w-3/4" />)}
                                </div>
                            ) : (
                                <div className="prose prose-invert prose-sm max-w-none">
                                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{viewContent.content}</ReactMarkdown>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
