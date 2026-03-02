/**
 * SessionDrawer — Ask 会话历史 Drawer 侧栏
 *
 * 展示过去的会话列表，支持搜索和切换。
 * 可通过按钮展开/收起。
 */
import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import useAskStore from '../../store/askStore'

const api = typeof window !== 'undefined' ? window.electronAPI : null

export default function SessionDrawer({ isOpen, onClose }) {
    const { t } = useTranslation()
    const [sessions, setSessions] = useState([])
    const [searchQuery, setSearchQuery] = useState('')
    const [isLoading, setIsLoading] = useState(false)

    useEffect(() => {
        if (isOpen) loadSessions()
    }, [isOpen])

    const loadSessions = useCallback(async () => {
        setIsLoading(true)
        try {
            const list = await api?.askGetSessions?.()
            setSessions(Array.isArray(list) ? list : [])
        } catch { setSessions([]) }
        setIsLoading(false)
    }, [])

    const filtered = sessions.filter(s => {
        if (!searchQuery.trim()) return true
        const q = searchQuery.toLowerCase()
        return s.title?.toLowerCase().includes(q) || s.preview?.toLowerCase().includes(q)
    })

    const loadSession = (sessionId) => {
        useAskStore.getState().loadSession?.(sessionId)
        onClose?.()
    }

    if (!isOpen) return null

    return (
        <div className="w-72 shrink-0 border-r border-[var(--color-border-dark)] bg-[var(--color-surface-darker)] flex flex-col h-full animate-slide-right overflow-hidden">
            {/* 标题栏 */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--color-border-dark)]">
                <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[16px] text-[var(--color-primary)]">history</span>
                    <h3 className="text-white text-sm font-semibold">{t('ask.history')}</h3>
                </div>
                <button onClick={onClose} className="p-1 text-slate-500 hover:text-white transition-colors">
                    <span className="material-symbols-outlined text-[16px]">close</span>
                </button>
            </div>

            {/* 搜索 */}
            <div className="px-3 py-2">
                <div className="relative">
                    <input
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full bg-[var(--color-surface-dark)] border border-[var(--color-border-dark)] text-slate-300 text-xs rounded-lg pl-8 pr-3 py-2 outline-none focus:ring-1 focus:ring-[var(--color-primary)] placeholder-slate-500"
                        placeholder={t('nav.search')}
                    />
                    <span className="material-symbols-outlined absolute left-2.5 top-2 text-slate-500 text-[14px]">search</span>
                </div>
            </div>

            {/* 会话列表 */}
            <div className="flex-1 overflow-y-auto custom-thin-scrollbar px-2 py-1 space-y-1">
                {isLoading ? (
                    <div className="space-y-2 px-2">
                        {[1, 2, 3, 4, 5].map(i => (
                            <div key={i} className="h-14 bg-slate-800/50 rounded-lg animate-pulse" />
                        ))}
                    </div>
                ) : filtered.length === 0 ? (
                    <div className="text-center py-10">
                        <span className="material-symbols-outlined text-[32px] text-slate-600 mb-2 block">chat_bubble_outline</span>
                        <p className="text-slate-500 text-xs">{t('ask.noHistory')}</p>
                    </div>
                ) : (
                    filtered.map((sess) => (
                        <button
                            key={sess.id}
                            onClick={() => loadSession(sess.id)}
                            className="w-full text-left px-3 py-2.5 rounded-lg hover:bg-white/5 transition-colors group"
                        >
                            <div className="flex items-center gap-2 mb-1">
                                <span className="material-symbols-outlined text-[14px] text-slate-500">chat</span>
                                <span className="text-white text-xs font-medium truncate flex-1">{sess.title || 'Untitled'}</span>
                            </div>
                            <p className="text-slate-500 text-[10px] truncate pl-6">{sess.preview || ''}</p>
                            <p className="text-slate-600 text-[9px] pl-6 mt-0.5">
                                {sess.timestamp ? new Date(sess.timestamp).toLocaleString() : ''}
                            </p>
                        </button>
                    ))
                )}
            </div>

            {/* 底部新建按钮 */}
            <div className="px-3 py-2 border-t border-[var(--color-border-dark)]">
                <button
                    onClick={() => { useAskStore.getState().newSession?.(); onClose?.() }}
                    className="w-full flex items-center justify-center gap-1.5 px-3 py-2 text-xs rounded-lg bg-[var(--color-primary)]/10 text-[var(--color-primary)] hover:bg-[var(--color-primary)]/20 transition-colors font-medium"
                >
                    <span className="material-symbols-outlined text-[14px]">add</span>
                    {t('ask.newConversation')}
                </button>
            </div>
        </div>
    )
}
