import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import useAskStore from '../../store/askStore'

/**
 * 左侧 Thread Outline — 大纲面板 + 会话管理
 * 点击节点 → 画布 Fly-to；点击会话 → 加载完整数据
 */
export default function ThreadOutline() {
    const { t } = useTranslation()
    const nodes = useAskStore(s => s.nodes)
    const edges = useAskStore(s => s.edges)
    const activeNodeId = useAskStore(s => s.activeNodeId)
    const sessions = useAskStore(s => s.sessions)
    const activeSessionId = useAskStore(s => s.activeSessionId)
    const [confirmDelete, setConfirmDelete] = useState(null)

    // 构建树形结构
    const buildTree = () => {
        const rootNodes = nodes.filter(n => !edges.some(e => e.to === n.id))
        const getChildren = (nodeId) => {
            const childEdges = edges.filter(e => e.from === nodeId)
            return childEdges.map(e => nodes.find(n => n.id === e.to)).filter(Boolean)
        }

        const renderNode = (node, depth = 0) => {
            const children = getChildren(node.id)
            const isActive = activeNodeId === node.id
            const providers = useAskStore.getState().getProviders()
            const provider = providers.find(p => p.id === node.provider)

            const getIcon = () => {
                if (node.type === 'user') return 'flag'
                if (node.isComparison) return 'compare_arrows'
                if (node.aborted) return 'stop_circle'
                return provider ? 'smart_toy' : 'hub'
            }

            const getLabel = () => {
                if (node.type === 'user') return node.content?.slice(0, 30) + (node.content?.length > 30 ? '...' : '')
                return node.title || provider?.name || t('ask.response')
            }

            return (
                <div key={node.id}>
                    <div
                        onClick={() => useAskStore.getState().flyToNode(node.id)}
                        className={`flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-all duration-150
              ${isActive
                                ? 'bg-[var(--color-primary)]/10 border border-[var(--color-primary)]/20 text-white'
                                : 'text-slate-400 hover:bg-white/5 hover:text-slate-200 border border-transparent'
                            }`}
                        style={{ marginLeft: depth * 16 }}
                    >
                        <span
                            className={`material-symbols-outlined text-[16px] shrink-0 ${node.aborted ? 'text-red-400' : ''}`}
                            style={{ color: !node.aborted ? (isActive ? 'var(--color-primary)' : (provider?.color || undefined)) : undefined }}
                        >
                            {getIcon()}
                        </span>
                        <span className="text-[13px] font-medium truncate">{getLabel()}</span>
                        {node.streaming && (
                            <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
                        )}
                    </div>

                    {children.length > 0 && (
                        <div className="relative">
                            <div
                                className="absolute w-px bg-[var(--color-border-dark)]"
                                style={{ left: depth * 16 + 20, top: 0, bottom: 0 }}
                            />
                            {children.map(child => renderNode(child, depth + 1))}
                        </div>
                    )}
                </div>
            )
        }

        return rootNodes.map(n => renderNode(n))
    }

    const handleSessionClick = async (sessionId) => {
        if (sessionId === activeSessionId) return
        // 先保存当前会话
        if (nodes.length > 0 && activeSessionId) {
            await useAskStore.getState().saveSession()
        }
        await useAskStore.getState().loadSession(sessionId)
    }

    const handleDelete = async (e, sessionId) => {
        e.stopPropagation()
        if (confirmDelete === sessionId) {
            await useAskStore.getState().deleteSession(sessionId)
            setConfirmDelete(null)
        } else {
            setConfirmDelete(sessionId)
            setTimeout(() => setConfirmDelete(null), 3000)
        }
    }

    const handleNewSession = async () => {
        if (nodes.length > 0 && activeSessionId) {
            await useAskStore.getState().saveSession()
        }
        useAskStore.getState().newSession()
    }

    const formatTime = (ts) => {
        if (!ts) return ''
        const d = new Date(ts)
        const now = new Date()
        if (d.toDateString() === now.toDateString()) {
            return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
        return d.toLocaleDateString([], { month: 'short', day: 'numeric' })
    }

    return (
        <aside className="w-[240px] shrink-0 border-r border-[var(--color-border-dark)] bg-[var(--color-bg-dark)] flex flex-col z-40">
            {/* Header */}
            <div className="p-4 border-b border-[var(--color-border-dark)] flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500">{t('ask.threadOutline')}</span>
                <button onClick={handleNewSession} className="text-[var(--color-primary)] hover:text-blue-400 transition-colors" title="New Session">
                    <span className="material-symbols-outlined text-[16px]">add_circle</span>
                </button>
            </div>

            {/* 会话列表 */}
            <div className="px-2 py-2 border-b border-[var(--color-border-dark)]/50">
                <div className="flex items-center justify-between px-2 mb-1.5">
                    <span className="text-xs text-slate-500 font-bold uppercase tracking-wider">{t('ask.sessions')}</span>
                    <span className="text-[11px] text-slate-600">{sessions.length}</span>
                </div>
                <div className="space-y-0.5 max-h-[160px] overflow-y-auto custom-thin-scrollbar">
                    {sessions.map(s => (
                        <div
                            key={s.id}
                            onClick={() => handleSessionClick(s.id)}
                            className={`group flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg cursor-pointer transition-all
                ${s.id === activeSessionId
                                    ? 'bg-[var(--color-surface-dark)] border border-[var(--color-border-dark)]'
                                    : 'hover:bg-[var(--color-surface-dark)]/50 border border-transparent'
                                }`}
                        >
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between">
                                    <span className={`text-xs font-medium truncate ${s.id === activeSessionId ? 'text-white' : 'text-slate-400'}`}>
                                        {s.title || 'Untitled'}
                                    </span>
                                    <span className="text-[11px] text-slate-600 shrink-0 ml-1">{formatTime(s.timestamp)}</span>
                                </div>
                                {s.nodeCount && (
                                    <span className="text-[11px] text-slate-600">{s.nodeCount} nodes</span>
                                )}
                            </div>
                            <button
                                onClick={(e) => handleDelete(e, s.id)}
                                className={`shrink-0 transition-colors ${confirmDelete === s.id
                                    ? 'text-red-400'
                                    : 'text-transparent group-hover:text-slate-600 hover:!text-red-400'}`}
                            >
                                <span className="material-symbols-outlined text-[14px]">
                                    {confirmDelete === s.id ? 'delete_forever' : 'close'}
                                </span>
                            </button>
                        </div>
                    ))}
                    {sessions.length === 0 && (
                        <p className="text-xs text-slate-600 text-center py-3">{t('ask.noSessions')}</p>
                    )}
                </div>
            </div>

            {/* 大纲树 */}
            <div className="flex-1 overflow-y-auto p-2 space-y-0.5 custom-thin-scrollbar">
                {nodes.length > 0 ? buildTree() : (
                    <div className="text-center py-8">
                        <span className="material-symbols-outlined text-[32px] text-slate-700 block mb-2">forum</span>
                        <p className="text-xs text-slate-600">{t('ask.startConversation')}</p>
                    </div>
                )}
            </div>

            {/* 底部 */}
            <div className="p-3 border-t border-[var(--color-border-dark)] flex items-center justify-between">
                <button
                    onClick={handleNewSession}
                    className="flex items-center gap-2 text-slate-400 hover:text-white text-sm transition-colors"
                >
                    <span className="material-symbols-outlined text-[16px]">add</span>
                    <span>{t('ask.newBranch')}</span>
                </button>
                {nodes.length > 0 && (
                    <button
                        onClick={() => useAskStore.getState().saveSession()}
                        className="flex items-center gap-1 text-slate-500 hover:text-emerald-400 text-xs transition-colors"
                        title="Save (⌘S)"
                    >
                        <span className="material-symbols-outlined text-[14px]">save</span>
                    </button>
                )}
            </div>
        </aside>
    )
}
