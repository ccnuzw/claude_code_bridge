import { useState, useRef, useCallback, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import useAskStore from '../../store/askStore'
import { useAppStore } from '../../store'

/**
 * Omni-Bar — 居中悬浮输入台（Spotlight 风格）
 * 使用真实 Provider 列表 + 健康状态 + i18n
 */
export default function OmniBar() {
    const { t } = useTranslation()
    const [input, setInput] = useState('')
    const [attachments, setAttachments] = useState([])
    const [isDragOver, setIsDragOver] = useState(false)
    const [showOptions, setShowOptions] = useState(false)
    const [temperature, setTemperature] = useState(0.7)
    const [maxTokens, setMaxTokens] = useState(4096)
    const inputRef = useRef(null)

    const selectedProviders = useAskStore(s => s.selectedProviders)
    const streamingNodeId = useAskStore(s => s.streamingNodeId)
    const appProviders = useAppStore(s => s.providers)

    const providers = useAskStore.getState().getProviders()
    const enabledProviders = providers.filter(p => p.enabled !== false && p.status !== 'offline')
    const isStreaming = streamingNodeId !== null

    useEffect(() => {
        if (appProviders.length === 0) {
            useAppStore.getState().fetchProviders()
            useAppStore.getState().fetchHealth()
        }
    }, [appProviders.length])

    // Cmd+S 保存会话
    useEffect(() => {
        const handler = (e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 's') {
                e.preventDefault()
                saveSession()
            }
        }
        window.addEventListener('keydown', handler)
        return () => window.removeEventListener('keydown', handler)
    }, [])

    const saveSession = () => useAskStore.getState().saveSession()

    const handleSend = useCallback(() => {
        const text = input.trim()
        if (!text || isStreaming) return
        useAskStore.getState().addUserNode(text, attachments.map(f => f.name))
        setInput('')
        setAttachments([])
    }, [input, attachments, isStreaming])

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() }
    }

    const handleDragOver = (e) => { e.preventDefault(); setIsDragOver(true) }
    const handleDragLeave = () => setIsDragOver(false)
    const handleDrop = (e) => {
        e.preventDefault(); setIsDragOver(false)
        setAttachments(prev => [...prev, ...Array.from(e.dataTransfer.files)])
    }
    const removeAttachment = (idx) => setAttachments(prev => prev.filter((_, i) => i !== idx))

    return (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 w-[620px] max-w-[90%] z-40">
            <div
                className={`bg-[var(--color-surface-dark)] border rounded-xl shadow-2xl shadow-black/50 overflow-hidden transition-colors ${isDragOver ? 'border-[var(--color-primary)] ring-2 ring-[var(--color-primary)]/20' : 'border-[var(--color-border-dark)]'}`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
            >
                {/* 附件胶囊 */}
                {attachments.length > 0 && (
                    <div className="px-4 pt-3 flex flex-wrap gap-1.5">
                        {attachments.map((f, i) => (
                            <span key={i} className="card-interactive text-[11px] bg-[var(--color-primary)]/10 text-[var(--color-primary)] px-2.5 py-1 rounded-full flex items-center gap-1.5 border border-[var(--color-primary)]/20">
                                <span className="material-symbols-outlined text-[12px]">attach_file</span>
                                {f.name}
                                <button onClick={() => removeAttachment(i)} className="hover:text-red-400 transition-colors">
                                    <span className="material-symbols-outlined text-[12px]">close</span>
                                </button>
                            </span>
                        ))}
                    </div>
                )}

                {/* 输入区域 */}
                <div className="flex items-center px-4 h-14">
                    <span className="material-symbols-outlined text-[var(--color-primary)] text-xl mr-3 shrink-0">
                        {isStreaming ? 'pending' : 'auto_awesome'}
                    </span>
                    <input
                        ref={inputRef}
                        className="card-interactive flex-1 bg-transparent text-sm text-inherit outline-none placeholder-slate-500 h-full"
                        style={{ caretColor: 'var(--color-primary)' }}
                        placeholder={isStreaming ? t('ask.streaming') : t('ask.askAnything')}
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        disabled={isStreaming}
                    />
                    <div className="flex items-center gap-2 shrink-0">
                        <label className="card-interactive cursor-pointer p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-white/5 transition-colors" title={t('ask.attachFile')}>
                            <span className="material-symbols-outlined text-[18px]">attach_file</span>
                            <input type="file" className="hidden" multiple onChange={(e) => setAttachments(prev => [...prev, ...Array.from(e.target.files)])} />
                        </label>
                        {isStreaming ? (
                            <button
                                onClick={() => useAskStore.getState().abortStream()}
                                className="card-interactive flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 transition-all"
                                title="Stop"
                            >
                                <span className="material-symbols-outlined text-[16px]">stop_circle</span>
                            </button>
                        ) : (
                            <button
                                onClick={handleSend}
                                disabled={!input.trim()}
                                className={`card-interactive flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all
                                    ${input.trim()
                                        ? 'bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white shadow-lg shadow-blue-900/30'
                                        : 'bg-[var(--color-surface-dark)] text-slate-500 cursor-not-allowed'
                                    }`}
                                title={t('ask.send')}
                            >
                                <span className="material-symbols-outlined text-[16px]">send</span>
                            </button>
                        )}
                    </div>
                </div>

                {/* Provider 选择栏 */}
                <div className="bg-[var(--color-surface-darker,#151b26)] px-4 py-2 flex items-center justify-between text-xs text-slate-500 border-t border-[var(--color-border-dark)]">
                    <div className="flex gap-3">
                        {enabledProviders.map(p => {
                            const isSelected = selectedProviders.includes(p.id)
                            return (
                                <button
                                    key={p.id}
                                    onClick={() => useAskStore.getState().toggleProvider(p.id)}
                                    className={`card-interactive flex items-center gap-1 px-1.5 py-0.5 rounded transition-colors
                                        ${isSelected ? 'text-white bg-white/5' : 'text-slate-500 hover:text-white'}`}
                                >
                                    {selectedProviders.length > 1 && (
                                        <span className={`inline-block size-3 rounded-sm border transition-colors mr-0.5 flex items-center justify-center
                                            ${isSelected ? 'bg-[var(--color-primary)] border-[var(--color-primary)]' : 'border-slate-600'}`}>
                                            {isSelected && <span className="material-symbols-outlined text-[10px] text-white">check</span>}
                                        </span>
                                    )}
                                    <span className="material-symbols-outlined text-[14px]" style={{ color: isSelected ? p.color : undefined }}>{p.icon}</span>
                                    {p.name}
                                </button>
                            )
                        })}
                    </div>
                    <div className="flex items-center gap-2">
                        {selectedProviders.length > 1 && (
                            <span className="text-[var(--color-primary)] text-[10px] font-medium flex items-center gap-1">
                                <span className="material-symbols-outlined text-[12px]">compare_arrows</span>
                                {t('ask.compareMode')}
                            </span>
                        )}
                        <button
                            onClick={() => setShowOptions(!showOptions)}
                            className={`flex items-center gap-1 text-xs transition-colors cursor-pointer ${showOptions ? 'text-[var(--color-primary)]' : 'text-slate-500 hover:text-slate-300'}`}
                        >
                            <span className="material-symbols-outlined text-[14px]">tune</span>
                            {t('ask.options')}
                        </button>
                    </div>
                </div>

                {/* Options Panel */}
                {showOptions && (
                    <div className="px-4 py-3 border-t border-[var(--color-border-dark)] bg-[var(--color-surface-darker,#151b26)] flex items-center gap-6 text-xs animate-slide-up">
                        <div className="flex items-center gap-2">
                            <span className="text-slate-500">{t('ask.temperature') || 'Temperature'}</span>
                            <input
                                type="range" min="0" max="2" step="0.1" value={temperature}
                                onChange={(e) => setTemperature(parseFloat(e.target.value))}
                                className="w-20 h-1 accent-[var(--color-primary)] cursor-pointer"
                            />
                            <span className="text-slate-400 font-mono w-6 text-right">{temperature}</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-slate-500">{t('ask.maxTokens') || 'Max Tokens'}</span>
                            <input
                                type="number" min="256" max="32768" step="256" value={maxTokens}
                                onChange={(e) => setMaxTokens(parseInt(e.target.value) || 4096)}
                                className="w-20 bg-[var(--color-surface-dark)] border border-[var(--color-border-dark)] text-inherit text-xs rounded px-2 py-1 outline-none focus:ring-1 focus:ring-[var(--color-primary)] text-right"
                            />
                        </div>
                    </div>
                )}
            </div>

            {isDragOver && (
                <div className="absolute inset-0 rounded-xl border-2 border-dashed border-[var(--color-primary)] bg-[var(--color-primary)]/5 flex items-center justify-center pointer-events-none">
                    <span className="text-[var(--color-primary)] text-sm font-medium flex items-center gap-2">
                        <span className="material-symbols-outlined">upload_file</span>
                        {t('ask.dropFiles')}
                    </span>
                </div>
            )}
        </div>
    )
}
