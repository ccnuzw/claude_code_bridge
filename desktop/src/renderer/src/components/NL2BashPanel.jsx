/**
 * NL2BashPanel — 自然语言转 Bash 命令面板
 *
 * 在终端中输入 ?? 前缀后弹出此面板，
 * 将自然语言描述发送给 AI 获取命令建议，
 * 用户可编辑后确认执行。
 */
import { useState, useRef, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'

const api = typeof window !== 'undefined' ? window.electronAPI : null

export default function NL2BashPanel({ query = '', onExecute, onClose }) {
    const { t } = useTranslation()
    const [nlInput, setNlInput] = useState(query)
    const [suggestions, setSuggestions] = useState([])
    const [isLoading, setIsLoading] = useState(false)
    const [editingIdx, setEditingIdx] = useState(-1)
    const [editValue, setEditValue] = useState('')
    const inputRef = useRef(null)

    useEffect(() => {
        inputRef.current?.focus()
        if (query) handleGenerate(query)
    }, [])

    const handleGenerate = useCallback(async (text) => {
        const q = (text || nlInput).trim()
        if (!q || isLoading) return
        setIsLoading(true)
        setSuggestions([])

        try {
            const prompt = `Convert the following natural language to a bash command. Return ONLY the command(s), one per line, no explanation:\n\n"${q}"`
            const response = await api?.askSend?.('claude', prompt)
            const reply = response?.reply || ''
            // 提取所有看起来像命令的行
            const cmds = reply.split('\n')
                .map(l => l.trim())
                .filter(l => l && !l.startsWith('#') && !l.startsWith('//') && l.length > 2)
                .map(l => l.replace(/^[`$]\s*/, '').replace(/`$/, ''))
                .slice(0, 5)
            setSuggestions(cmds.length > 0 ? cmds : [reply.trim()])
        } catch (err) {
            setSuggestions([`# Error: ${err.message}`])
        }
        setIsLoading(false)
    }, [nlInput, isLoading])

    const handleKeyDown = (e) => {
        if (e.key === 'Escape') onClose?.()
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            handleGenerate()
        }
    }

    const executeCmd = (cmd) => {
        onExecute?.(cmd)
        onClose?.()
    }

    const startEdit = (idx) => {
        setEditingIdx(idx)
        setEditValue(suggestions[idx])
    }

    const confirmEdit = () => {
        if (editingIdx >= 0) {
            setSuggestions(prev => prev.map((s, i) => i === editingIdx ? editValue : s))
        }
        setEditingIdx(-1)
    }

    return (
        <div className="bg-[var(--color-surface-dark)] border border-[var(--color-border-dark)] rounded-xl shadow-2xl shadow-black/50 overflow-hidden animate-slide-up">
            {/* 输入区 */}
            <div className="flex items-center gap-3 px-4 py-3 border-b border-[var(--color-border-dark)]">
                <div className="size-7 rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shrink-0">
                    <span className="text-white text-[11px] font-bold">??</span>
                </div>
                <input
                    ref={inputRef}
                    value={nlInput}
                    onChange={(e) => setNlInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={t('terminal.nl2bashPlaceholder')}
                    className="flex-1 bg-transparent text-white text-sm outline-none placeholder-slate-500"
                />
                <button
                    onClick={() => handleGenerate()}
                    disabled={isLoading || !nlInput.trim()}
                    className="px-3 py-1.5 text-xs rounded-lg bg-[var(--color-primary)] text-white font-medium hover:opacity-90 disabled:opacity-40 transition-colors flex items-center gap-1"
                >
                    <span className={`material-symbols-outlined text-[14px] ${isLoading ? 'animate-spin' : ''}`}>
                        {isLoading ? 'progress_activity' : 'auto_awesome'}
                    </span>
                    {t('terminal.generate')}
                </button>
                <button onClick={onClose} className="p-1 text-slate-500 hover:text-white transition-colors">
                    <span className="material-symbols-outlined text-[16px]">close</span>
                </button>
            </div>

            {/* 建议列表 */}
            {(suggestions.length > 0 || isLoading) && (
                <div className="p-3 space-y-2 max-h-48 overflow-y-auto custom-thin-scrollbar">
                    {isLoading && (
                        <div className="flex items-center gap-2 px-3 py-2">
                            <div className="size-4 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
                            <span className="text-slate-400 text-xs">{t('terminal.generating')}</span>
                        </div>
                    )}
                    {suggestions.map((cmd, i) => (
                        <div key={i} className="group bg-[var(--color-surface-darker)] border border-[var(--color-border-dark)] rounded-lg px-3 py-2 flex items-center gap-2 hover:border-amber-500/30 transition-colors">
                            <span className="text-amber-400 text-[10px] font-mono shrink-0">$</span>
                            {editingIdx === i ? (
                                <input
                                    value={editValue}
                                    onChange={(e) => setEditValue(e.target.value)}
                                    onBlur={confirmEdit}
                                    onKeyDown={(e) => { if (e.key === 'Enter') confirmEdit(); if (e.key === 'Escape') setEditingIdx(-1) }}
                                    autoFocus
                                    className="flex-1 bg-transparent text-white text-xs font-mono outline-none"
                                />
                            ) : (
                                <code className="flex-1 text-white text-xs font-mono truncate">{cmd}</code>
                            )}
                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                                <button onClick={() => startEdit(i)} className="p-1 text-slate-500 hover:text-white rounded transition-colors" title="Edit">
                                    <span className="material-symbols-outlined text-[14px]">edit</span>
                                </button>
                                <button onClick={() => navigator.clipboard?.writeText(cmd)} className="p-1 text-slate-500 hover:text-white rounded transition-colors" title="Copy">
                                    <span className="material-symbols-outlined text-[14px]">content_copy</span>
                                </button>
                                <button onClick={() => executeCmd(cmd)} className="p-1 text-emerald-500 hover:text-emerald-400 rounded transition-colors" title="Execute">
                                    <span className="material-symbols-outlined text-[14px]">play_arrow</span>
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* 底栏提示 */}
            <div className="px-4 py-2 bg-[var(--color-surface-darker)]/50 border-t border-[var(--color-border-dark)]/50 flex items-center justify-between">
                <span className="text-[9px] text-slate-600">
                    <kbd className="px-1 py-0.5 rounded bg-slate-800 text-slate-400 font-mono mr-1">↵</kbd>
                    {t('terminal.nl2bashGenerate')}
                </span>
                <span className="text-[9px] text-slate-600">
                    <kbd className="px-1 py-0.5 rounded bg-slate-800 text-slate-400 font-mono mr-1">esc</kbd>
                    {t('common.cancel')}
                </span>
            </div>
        </div>
    )
}
