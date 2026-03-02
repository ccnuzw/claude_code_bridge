/**
 * QuickAsk — Spotlight 风格全局浮窗 + PiP 画中画模式
 *
 * 通过 Cmd+Shift+A 唤出，提供快速 AI 提问能力。
 * 可钉在桌面（PiP 模式）、复制结果、跳转到主控台继续对话。
 */
import { useState, useRef, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useAppStore } from '../store'
import { useNavigate } from 'react-router-dom'

const PROVIDER_OPTIONS = [
    { id: 'claude', label: 'Claude', icon: 'psychology', color: 'text-orange-400' },
    { id: 'codex', label: 'Codex', icon: 'code', color: 'text-blue-400' },
    { id: 'gemini', label: 'Gemini', icon: 'auto_awesome', color: 'text-purple-400' }
]

export default function QuickAsk({ isOpen, onClose }) {
    const { t } = useTranslation()
    const navigate = useNavigate()
    const inputRef = useRef(null)
    const [query, setQuery] = useState('')
    const [selectedProvider, setSelectedProvider] = useState('claude')
    const [isLoading, setIsLoading] = useState(false)
    const [result, setResult] = useState(null)
    const [error, setError] = useState(null)

    // PiP 画中画模式
    const [isPiP, setIsPiP] = useState(false)
    const [pipPos, setPipPos] = useState({ x: 0, y: 0 }) // 0,0 = 未初始化
    const dragRef = useRef(null)
    const dragState = useRef({ dragging: false, startX: 0, startY: 0, startPosX: 0, startPosY: 0 })

    const api = typeof window !== 'undefined' ? window.electronAPI : null

    // 自动聚焦
    useEffect(() => {
        if (isOpen && !isPiP) {
            setTimeout(() => inputRef.current?.focus(), 100)
            setQuery('')
            setResult(null)
            setError(null)
        }
    }, [isOpen, isPiP])

    // PiP 初始化位置
    useEffect(() => {
        if (isPiP && pipPos.x === 0 && pipPos.y === 0) {
            setPipPos({
                x: window.innerWidth - 340,
                y: window.innerHeight - 280
            })
        }
    }, [isPiP])

    // PiP 拖拽逻辑
    const handleDragStart = useCallback((e) => {
        if (!isPiP) return
        dragState.current = {
            dragging: true,
            startX: e.clientX,
            startY: e.clientY,
            startPosX: pipPos.x,
            startPosY: pipPos.y
        }
        const handleMove = (ev) => {
            if (!dragState.current.dragging) return
            setPipPos({
                x: Math.max(0, Math.min(window.innerWidth - 320, dragState.current.startPosX + ev.clientX - dragState.current.startX)),
                y: Math.max(0, Math.min(window.innerHeight - 200, dragState.current.startPosY + ev.clientY - dragState.current.startY))
            })
        }
        const handleUp = () => {
            dragState.current.dragging = false
            window.removeEventListener('mousemove', handleMove)
            window.removeEventListener('mouseup', handleUp)
        }
        window.addEventListener('mousemove', handleMove)
        window.addEventListener('mouseup', handleUp)
    }, [isPiP, pipPos])

    // 发送请求
    const handleSend = useCallback(async () => {
        if (!query.trim() || isLoading) return
        setIsLoading(true)
        setError(null)
        setResult(null)
        try {
            const response = await api?.askSend(selectedProvider, query.trim())
            setResult(response?.reply || 'No response')
        } catch (err) {
            setError(err.message || 'Request failed')
        }
        setIsLoading(false)
    }, [query, selectedProvider, isLoading, api])

    // 键盘快捷键
    const handleKeyDown = useCallback((e) => {
        if (e.key === 'Escape') {
            if (isPiP) setIsPiP(false)
            else onClose()
        }
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            handleSend()
        }
    }, [onClose, handleSend, isPiP])

    const handleCopy = () => result && navigator.clipboard?.writeText(result)
    const handleContinue = () => { onClose(); navigate('/ask') }
    const togglePiP = () => setIsPiP(prev => !prev)

    if (!isOpen) return null

    // ── PiP 迷你浮窗模式 ────────────────────────────
    if (isPiP) {
        return (
            <div
                className="fixed z-[200] animate-clipboard-slide"
                style={{ left: pipPos.x, top: pipPos.y, width: 320 }}
            >
                <div className="bg-[var(--color-surface-dark)]/95 backdrop-blur-lg border border-[var(--color-border-dark)] rounded-xl shadow-2xl shadow-black/60 overflow-hidden ring-1 ring-white/5">
                    {/* 拖拽手柄 */}
                    <div
                        ref={dragRef}
                        onMouseDown={handleDragStart}
                        className="flex items-center justify-between px-3 py-2 cursor-grab active:cursor-grabbing bg-[var(--color-surface-darker)]/50 border-b border-[var(--color-border-dark)]/50 select-none"
                    >
                        <div className="flex items-center gap-2">
                            <span className="material-symbols-outlined text-[14px] text-[var(--color-primary)]">bolt</span>
                            <span className="text-[10px] text-slate-400 font-medium">Quick Ask — PiP</span>
                        </div>
                        <div className="flex items-center gap-1">
                            <button onClick={togglePiP} className="p-0.5 text-slate-500 hover:text-white transition-colors" title="Expand">
                                <span className="material-symbols-outlined text-[14px]">open_in_full</span>
                            </button>
                            <button onClick={onClose} className="p-0.5 text-slate-500 hover:text-red-400 transition-colors" title="Close">
                                <span className="material-symbols-outlined text-[14px]">close</span>
                            </button>
                        </div>
                    </div>

                    {/* 迷你输入 */}
                    <div className="flex items-center gap-2 px-3 py-2">
                        <input
                            ref={inputRef}
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            onKeyDown={handleKeyDown}
                            className="flex-1 bg-transparent text-white text-xs outline-none placeholder-slate-500"
                            placeholder={t('ask.askAnything')}
                            autoFocus
                        />
                        <button
                            onClick={handleSend}
                            disabled={!query.trim() || isLoading}
                            className="p-1 text-[var(--color-primary)] hover:opacity-80 disabled:opacity-30 transition-opacity"
                        >
                            <span className={`material-symbols-outlined text-[16px] ${isLoading ? 'animate-spin' : ''}`}>
                                {isLoading ? 'sync' : 'send'}
                            </span>
                        </button>
                    </div>

                    {/* 迷你结果 */}
                    {result && !isLoading && (
                        <div className="px-3 py-2 border-t border-[var(--color-border-dark)]/50 max-h-32 overflow-y-auto custom-thin-scrollbar">
                            <p className="text-slate-300 text-[11px] leading-relaxed whitespace-pre-wrap">{result.slice(0, 500)}</p>
                        </div>
                    )}
                    {error && !isLoading && (
                        <div className="px-3 py-2 border-t border-[var(--color-border-dark)]/50">
                            <p className="text-red-400 text-[10px]">{error}</p>
                        </div>
                    )}
                </div>
            </div>
        )
    }

    // ── 正常 Spotlight 全屏浮窗模式 ────────────────────
    return (
        <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[20vh]">
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

            <div className="relative w-full max-w-xl mx-4 animate-slide-up">
                <div className="bg-[var(--color-surface-dark)]/95 backdrop-blur-strong border border-[var(--color-border-dark)] rounded-2xl shadow-2xl shadow-black/50 overflow-hidden">
                    {/* 输入区 */}
                    <div className="flex items-center gap-3 px-5 py-4 border-b border-[var(--color-border-dark)]">
                        <div className="size-8 rounded-lg bg-gradient-to-br from-blue-600 to-cyan-500 flex items-center justify-center shadow-md shrink-0">
                            <span className="material-symbols-outlined text-white text-[18px]">
                                {isLoading ? 'sync' : 'bolt'}
                            </span>
                        </div>
                        <input
                            ref={inputRef}
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            onKeyDown={handleKeyDown}
                            className="flex-1 bg-transparent text-white text-sm outline-none placeholder-slate-500"
                            placeholder={t('ask.askAnything')}
                        />
                        <div className="flex items-center gap-1">
                            {PROVIDER_OPTIONS.map(p => (
                                <button
                                    key={p.id}
                                    onClick={() => setSelectedProvider(p.id)}
                                    className={`size-7 rounded-lg flex items-center justify-center transition-all ${selectedProvider === p.id
                                        ? 'bg-[var(--color-primary)]/15 ring-1 ring-[var(--color-primary)]/40'
                                        : 'hover:bg-white/5'
                                        }`}
                                    title={p.label}
                                >
                                    <span className={`material-symbols-outlined text-[16px] ${selectedProvider === p.id ? p.color : 'text-slate-500'}`}>
                                        {p.icon}
                                    </span>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* 加载 */}
                    {isLoading && (
                        <div className="px-5 py-4">
                            <div className="flex items-center gap-3">
                                <div className="size-5 border-2 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin" />
                                <span className="text-slate-400 text-sm">{t('ask.streamingHint')}</span>
                            </div>
                            <div className="mt-3 space-y-2">
                                {[1, 2, 3].map(i => (
                                    <div key={i} className="h-3 bg-slate-800 rounded animate-pulse" style={{ width: `${80 - i * 15}%` }} />
                                ))}
                            </div>
                        </div>
                    )}

                    {/* 结果 */}
                    {result && !isLoading && (
                        <div className="px-5 py-4 max-h-64 overflow-y-auto custom-thin-scrollbar">
                            <div className="text-slate-200 text-sm leading-relaxed whitespace-pre-wrap">{result}</div>
                        </div>
                    )}

                    {/* 错误 */}
                    {error && !isLoading && (
                        <div className="px-5 py-4">
                            <div className="flex items-center gap-2 text-red-400 text-sm">
                                <span className="material-symbols-outlined text-[16px]">error</span>
                                {error}
                            </div>
                        </div>
                    )}

                    {/* 底部工具栏 */}
                    <div className="flex items-center justify-between px-5 py-3 bg-[var(--color-surface-darker)]/50 border-t border-[var(--color-border-dark)]">
                        <div className="flex items-center gap-3 text-[10px] text-slate-600">
                            <span className="flex items-center gap-1">
                                <kbd className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 font-mono">↵</kbd>
                                {t('ask.send')}
                            </span>
                            <span className="flex items-center gap-1">
                                <kbd className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 font-mono">esc</kbd>
                                {t('common.cancel')}
                            </span>
                        </div>
                        <div className="flex items-center gap-2">
                            {/* PiP 钉住按钮 */}
                            <button
                                onClick={togglePiP}
                                className="px-2.5 py-1 text-[10px] rounded-lg bg-white/5 text-slate-400 hover:text-white hover:bg-white/10 transition-colors flex items-center gap-1"
                                title={t('quickAsk.pinToDesktop')}
                            >
                                <span className="material-symbols-outlined text-[12px]">picture_in_picture_alt</span>
                                PiP
                            </button>
                            {result && (
                                <>
                                    <button onClick={handleCopy}
                                        className="px-2.5 py-1 text-[10px] rounded-lg bg-white/5 text-slate-400 hover:text-white hover:bg-white/10 transition-colors flex items-center gap-1">
                                        <span className="material-symbols-outlined text-[12px]">content_copy</span>
                                        {t('ask.copy')}
                                    </button>
                                    <button onClick={handleContinue}
                                        className="px-2.5 py-1 text-[10px] rounded-lg bg-[var(--color-primary)]/10 text-[var(--color-primary)] hover:bg-[var(--color-primary)]/20 transition-colors flex items-center gap-1">
                                        <span className="material-symbols-outlined text-[12px]">open_in_new</span>
                                        {t('quickAsk.continueInMain')}
                                    </button>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
