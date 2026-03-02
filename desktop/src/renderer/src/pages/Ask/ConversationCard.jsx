import ReactMarkdown from 'react-markdown'
import rehypeHighlight from 'rehype-highlight'
import remarkGfm from 'remark-gfm'
import 'highlight.js/styles/github-dark.css'
import { useTranslation } from 'react-i18next'
import { useAppStore } from '../../store'
import useAskStore from '../../store/askStore'

/**
 * 对话卡片组件 — 用户 Prompt 和 AI 回答
 * 使用真实 Provider 数据 + react-markdown 渲染
 */
export default function ConversationCard({ node, isActive, onClick }) {
    const { t } = useTranslation()
    // 从真实 store 获取 Provider 信息
    const appProviders = useAppStore(s => s.providers)
    const providers = useAskStore.getState().getProviders()
    const provider = providers.find(p => p.id === node.provider)

    // ── User Prompt 卡片 ──
    if (node.type === 'user') {
        return (
            <div
                className={`card-interactive absolute cursor-pointer transition-shadow duration-200 ${isActive ? 'ring-2 ring-[var(--color-primary)]/30' : ''}`}
                style={{ left: node.x, top: node.y, width: node.width || 260 }}
                onClick={onClick}
            >
                <div className="bg-[var(--color-surface-dark)] border border-[var(--color-border-dark)] rounded-xl p-4 shadow-lg hover:shadow-xl transition-shadow">
                    <div className="flex items-center gap-2 mb-2">
                        <div className="size-6 rounded-full bg-slate-600 flex items-center justify-center text-[10px] font-bold text-white">ME</div>
                        <span className="text-xs font-semibold text-slate-400">{t('ask.prompt')}</span>
                    </div>
                    <p className="text-sm text-slate-200 leading-relaxed">{node.content}</p>
                    {node.attachments?.length > 0 && (
                        <div className="flex gap-1.5 mt-2 flex-wrap">
                            {node.attachments.map((f, i) => (
                                <span key={i} className="text-[10px] bg-[var(--color-primary)]/10 text-[var(--color-primary)] px-2 py-0.5 rounded-full flex items-center gap-1">
                                    <span className="material-symbols-outlined text-[10px]">attach_file</span>
                                    {f.name || f}
                                </span>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        )
    }

    // ── AI Response 卡片 ──
    const borderClass = node.error
        ? 'border-red-500/40'
        : node.aborted
            ? 'border-orange-500/40'
            : isActive
                ? 'border-[var(--color-primary)]/40'
                : 'border-[var(--color-border-dark)]'

    const handleCopy = (e) => {
        e.stopPropagation()
        navigator.clipboard?.writeText(node.content || '')
    }

    return (
        <div
            className={`card-interactive absolute cursor-pointer transition-all duration-200 ${isActive ? 'ring-2 ring-[var(--color-primary)]/30' : ''}`}
            style={{ left: node.x, top: node.y, width: node.width || 400 }}
            onClick={onClick}
        >
            <div className={`bg-[var(--color-surface-dark)] border rounded-xl shadow-xl overflow-hidden ${borderClass} hover:shadow-2xl transition-shadow`}>
                {/* Header */}
                <div className="bg-[#151b26] p-3 flex items-center justify-between border-b border-[var(--color-border-dark)]">
                    <div className="flex items-center gap-2">
                        <div
                            className="size-6 rounded flex items-center justify-center text-[10px] font-bold border"
                            style={{
                                backgroundColor: `${provider?.color || '#666'}20`,
                                color: provider?.color || '#666',
                                borderColor: `${provider?.color || '#666'}30`
                            }}
                        >
                            {provider?.shortName || node.provider?.[0]?.toUpperCase() || '?'}
                        </div>
                        <span className="text-sm font-semibold text-white">{node.title}</span>
                    </div>
                    <div className="flex items-center gap-2">
                        {node.streaming && (
                            <span className="flex items-center gap-1 text-[10px] text-emerald-400 font-medium">
                                <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse" />
                                {t('ask.streaming')}
                            </span>
                        )}
                        {node.aborted && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-orange-500/10 text-orange-400 border border-orange-500/20 font-medium">
                                {t('ask.aborted')}
                            </span>
                        )}
                        {node.error && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-500/10 text-red-400 border border-red-500/20 font-medium">
                                {t('ask.error')}
                            </span>
                        )}
                        {node.responseTime > 0 && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-mono">
                                {node.responseTime}s
                            </span>
                        )}
                        <button onClick={handleCopy} className="card-interactive p-1 hover:bg-slate-700 rounded text-slate-400 hover:text-white transition-colors">
                            <span className="material-symbols-outlined text-[14px]">content_copy</span>
                        </button>
                        <button className="card-interactive p-1 hover:bg-slate-700 rounded text-slate-400 hover:text-white transition-colors">
                            <span className="material-symbols-outlined text-[14px]">more_horiz</span>
                        </button>
                    </div>
                </div>

                {/* Content — react-markdown 渲染 */}
                <div className="p-4 max-h-[400px] overflow-y-auto custom-thin-scrollbar markdown-body">
                    <ReactMarkdown
                        remarkPlugins={[remarkGfm]}
                        rehypePlugins={[rehypeHighlight]}
                        components={{
                            code({ className, children, node: codeNode, ...props }) {
                                const isInline = !className
                                if (isInline) {
                                    return (
                                        <code className="bg-[#0d1117] text-blue-300 px-1 py-0.5 rounded text-xs font-mono" {...props}>
                                            {children}
                                        </code>
                                    )
                                }
                                const lang = className?.replace('language-', '') || ''
                                return (
                                    <div className="relative group my-3">
                                        <div className="bg-[#0d1117] rounded-lg border border-[var(--color-border-dark)] overflow-hidden">
                                            {lang && (
                                                <div className="flex items-center justify-between px-3 py-1.5 bg-[#161b22] border-b border-[var(--color-border-dark)]">
                                                    <span className="text-[10px] text-slate-500 font-mono">{lang}</span>
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation()
                                                            const text = String(children).replace(/\n$/, '')
                                                            navigator.clipboard?.writeText(text)
                                                            const btn = e.currentTarget
                                                            btn.textContent = '✓ Copied!'
                                                            setTimeout(() => { btn.innerHTML = `<span class="material-symbols-outlined text-[12px]">content_copy</span>${t('ask.copy')}` }, 1500)
                                                        }}
                                                        className="card-interactive text-[10px] text-slate-500 hover:text-white flex items-center gap-1 transition-colors opacity-0 group-hover:opacity-100"
                                                    >
                                                        <span className="material-symbols-outlined text-[12px]">content_copy</span>
                                                        {t('ask.copy')}
                                                    </button>
                                                </div>
                                            )}
                                            <pre className="p-3 overflow-x-auto text-xs font-mono leading-relaxed !bg-[#0d1117] !m-0">
                                                <code className={className} {...props}>
                                                    {children}
                                                </code>
                                            </pre>
                                        </div>
                                    </div>
                                )
                            },
                            table({ children }) {
                                return (
                                    <div className="my-3 overflow-x-auto">
                                        <table className="w-full text-xs border-collapse">
                                            {children}
                                        </table>
                                    </div>
                                )
                            },
                            thead({ children }) {
                                return <thead className="border-b border-[var(--color-border-dark)]">{children}</thead>
                            },
                            th({ children }) {
                                return <th className="text-left px-3 py-2 text-slate-400 font-semibold text-xs">{children}</th>
                            },
                            td({ children }) {
                                return <td className="px-3 py-1.5 text-slate-300 text-xs border-b border-[var(--color-border-dark)]/30">{children}</td>
                            },
                            p({ children }) {
                                return <p className="text-sm text-slate-300 mb-2 leading-relaxed">{children}</p>
                            },
                            h1({ children }) {
                                return <h1 className="text-white font-bold text-base mt-4 mb-2">{children}</h1>
                            },
                            h2({ children }) {
                                return <h2 className="text-white font-semibold text-sm mt-3 mb-1.5">{children}</h2>
                            },
                            h3({ children }) {
                                return <h3 className="text-white font-medium text-sm mt-3 mb-1">{children}</h3>
                            },
                            ul({ children }) {
                                return <ul className="ml-4 text-slate-300 text-sm list-disc space-y-0.5 mb-2">{children}</ul>
                            },
                            ol({ children }) {
                                return <ol className="ml-4 text-slate-300 text-sm list-decimal space-y-0.5 mb-2">{children}</ol>
                            },
                            li({ children }) {
                                return <li className="text-sm text-slate-300 leading-relaxed">{children}</li>
                            },
                            strong({ children }) {
                                return <strong className="text-white font-medium">{children}</strong>
                            },
                            blockquote({ children }) {
                                return <blockquote className="border-l-2 border-[var(--color-primary)]/40 pl-3 my-2 text-slate-400 italic">{children}</blockquote>
                            }
                        }}
                    >
                        {node.content || ''}
                    </ReactMarkdown>
                    {node.streaming && (
                        <span className="inline-block w-2 h-4 bg-[var(--color-primary)] rounded-sm animate-typing-cursor ml-0.5" />
                    )}
                </div>

                {/* Footer */}
                <div className="px-3 py-2 border-t border-[var(--color-border-dark)] bg-[#151b26]/50 flex items-center justify-between text-xs text-slate-500">
                    <span className="font-mono">{node.tokens > 0 ? `${t('ask.tokens')}: ${node.tokens}` : ''}</span>
                    <div className="flex gap-1">
                        <button className="card-interactive hover:text-white p-1 hover:bg-white/5 rounded transition-colors">
                            <span className="material-symbols-outlined text-[14px]">thumb_up</span>
                        </button>
                        <button className="card-interactive hover:text-white p-1 hover:bg-white/5 rounded transition-colors">
                            <span className="material-symbols-outlined text-[14px]">thumb_down</span>
                        </button>
                    </div>
                </div>

                {/* Connection point — 右侧蓝色圆点 */}
                {!node.streaming && (
                    <div className="absolute -right-3 top-1/2 -translate-y-1/2 size-6 bg-[var(--color-primary)] rounded-full border-4 border-[var(--color-bg-dark)] flex items-center justify-center cursor-pointer shadow-lg hover:scale-110 transition-transform card-interactive">
                        <span className="material-symbols-outlined text-white text-[10px]">add</span>
                    </div>
                )}
            </div>
        </div>
    )
}
