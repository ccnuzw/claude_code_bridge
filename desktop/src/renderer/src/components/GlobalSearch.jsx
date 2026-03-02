/**
 * GlobalSearch — 全局全文搜索面板
 *
 * 通过 Cmd+F 唤出（在 App 页面外），搜索范围：
 *  - 对话历史 (sessions)
 *  - 任务 (tasks)
 *  - 扩展 (extensions)
 *
 * 支持分组展示和一键跳转。
 */
import { useState, useRef, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'

const api = typeof window !== 'undefined' ? window.electronAPI : null

const CATEGORIES = [
    { id: 'all', icon: 'search', labelKey: 'tasks.all' },
    { id: 'sessions', icon: 'chat', labelKey: 'nav.ask' },
    { id: 'tasks', icon: 'task_alt', labelKey: 'nav.tasks' },
    { id: 'extensions', icon: 'extension', labelKey: 'nav.extensions' }
]

export default function GlobalSearch({ isOpen, onClose }) {
    const { t } = useTranslation()
    const navigate = useNavigate()
    const inputRef = useRef(null)
    const [query, setQuery] = useState('')
    const [category, setCategory] = useState('all')
    const [results, setResults] = useState([])
    const [isLoading, setIsLoading] = useState(false)

    useEffect(() => {
        if (isOpen) {
            setTimeout(() => inputRef.current?.focus(), 100)
            setQuery('')
            setResults([])
        }
    }, [isOpen])

    const doSearch = useCallback(async (q) => {
        if (!q.trim()) { setResults([]); return }
        setIsLoading(true)
        try {
            // 尝试调用后端搜索 API
            if (api?.searchGlobal) {
                const hits = await api.searchGlobal(q.trim(), category)
                setResults(Array.isArray(hits) ? hits : [])
            } else {
                // 降级：本地模拟搜索
                const mockResults = []
                if (category === 'all' || category === 'sessions') {
                    mockResults.push(
                        { type: 'session', title: `Search: "${q}"`, subtitle: 'Ask sessions matching your query', route: '/ask' }
                    )
                }
                if (category === 'all' || category === 'tasks') {
                    mockResults.push(
                        { type: 'task', title: `Tasks: "${q}"`, subtitle: 'Tasks matching your query', route: '/tasks' }
                    )
                }
                setResults(mockResults)
            }
        } catch { setResults([]) }
        setIsLoading(false)
    }, [category])

    // 防抖搜索
    useEffect(() => {
        const timer = setTimeout(() => doSearch(query), 300)
        return () => clearTimeout(timer)
    }, [query, doSearch])

    const handleKeyDown = (e) => {
        if (e.key === 'Escape') onClose?.()
        if (e.key === 'Enter' && results.length > 0) {
            navigate(results[0].route)
            onClose?.()
        }
    }

    const goTo = (result) => {
        navigate(result.route)
        onClose?.()
    }

    if (!isOpen) return null

    return (
        <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[18vh]">
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

            <div className="relative w-full max-w-lg mx-4 animate-slide-up">
                <div className="bg-[var(--color-surface-dark)]/95 backdrop-blur-lg border border-[var(--color-border-dark)] rounded-2xl shadow-2xl shadow-black/50 overflow-hidden">
                    {/* 搜索输入 */}
                    <div className="flex items-center gap-3 px-5 py-4 border-b border-[var(--color-border-dark)]">
                        <span className="material-symbols-outlined text-[20px] text-slate-500">search</span>
                        <input
                            ref={inputRef}
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            onKeyDown={handleKeyDown}
                            className="flex-1 bg-transparent text-white text-sm outline-none placeholder-slate-500"
                            placeholder={t('search.placeholder')}
                        />
                        {isLoading && <div className="size-4 border-2 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin" />}
                    </div>

                    {/* 分类 Tab */}
                    <div className="flex items-center gap-1 px-4 py-2 border-b border-[var(--color-border-dark)]/50">
                        {CATEGORIES.map(c => (
                            <button
                                key={c.id}
                                onClick={() => setCategory(c.id)}
                                className={`flex items-center gap-1 px-2.5 py-1 text-[10px] rounded-lg transition-colors ${category === c.id
                                    ? 'bg-[var(--color-primary)]/10 text-[var(--color-primary)]'
                                    : 'text-slate-500 hover:text-slate-300 hover:bg-white/5'}`}
                            >
                                <span className="material-symbols-outlined text-[14px]">{c.icon}</span>
                                {t(c.labelKey)}
                            </button>
                        ))}
                    </div>

                    {/* 结果列表 */}
                    <div className="max-h-64 overflow-y-auto custom-thin-scrollbar">
                        {results.length === 0 && query.trim() && !isLoading ? (
                            <div className="px-5 py-8 text-center">
                                <span className="material-symbols-outlined text-[32px] text-slate-600 mb-2 block">search_off</span>
                                <p className="text-slate-500 text-xs">{t('search.noResults')}</p>
                            </div>
                        ) : (
                            results.map((r, i) => (
                                <button
                                    key={i}
                                    onClick={() => goTo(r)}
                                    className="w-full flex items-center gap-3 px-5 py-3 text-left hover:bg-white/5 transition-colors border-b border-[var(--color-border-dark)]/30 last:border-0"
                                >
                                    <span className={`material-symbols-outlined text-[16px] ${r.type === 'session' ? 'text-blue-400' :
                                            r.type === 'task' ? 'text-emerald-400' :
                                                'text-purple-400'}`}
                                    >
                                        {r.type === 'session' ? 'chat' : r.type === 'task' ? 'task_alt' : 'extension'}
                                    </span>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-white text-sm font-medium truncate">{r.title}</p>
                                        {r.subtitle && <p className="text-slate-500 text-[10px] truncate">{r.subtitle}</p>}
                                    </div>
                                    <span className="material-symbols-outlined text-[14px] text-slate-600">arrow_forward</span>
                                </button>
                            ))
                        )}
                    </div>

                    {/* 底栏 */}
                    <div className="px-5 py-2.5 bg-[var(--color-surface-darker)]/50 border-t border-[var(--color-border-dark)] flex items-center justify-between text-[10px] text-slate-600">
                        <span className="flex items-center gap-1">
                            <kbd className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 font-mono">↵</kbd>
                            {t('search.openFirst')}
                        </span>
                        <span className="flex items-center gap-1">
                            <kbd className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 font-mono">esc</kbd>
                            {t('common.cancel')}
                        </span>
                    </div>
                </div>
            </div>
        </div>
    )
}
