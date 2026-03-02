/**
 * ClipboardSense — 剪贴板智能感知组件
 *
 * 持续监听剪贴板，当检测到以下内容时弹出建议气泡：
 *  - 代码片段（含语法关键字/缩进块）
 *  - 错误栈（含 Error/at/Traceback）
 *  - URL 链接
 *
 * 支持操作：发送到 Ask / 在终端运行 / 搜索
 */
import { useState, useEffect, useRef, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import useAskStore from '../store/askStore'

const POLL_INTERVAL = 3000 // 3 秒轮询一次

// 内容类型检测
function detectContent(text) {
    if (!text || text.length < 10 || text.length > 5000) return null

    // 错误栈
    if (/\b(Error|Exception|Traceback|FAILED|panic|FATAL)/i.test(text) &&
        /(at\s+|File\s+"|line\s+\d|Stack trace)/i.test(text)) {
        return { type: 'error', icon: 'error', color: 'text-red-400', bg: 'bg-red-500/10 border-red-500/20' }
    }

    // URL
    if (/^https?:\/\/\S+$/i.test(text.trim())) {
        return { type: 'url', icon: 'link', color: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/20' }
    }

    // 代码片段（含常见语法关键字或一致缩进）
    const codeKeywords = /\b(function|const |let |var |import |export |class |def |return |if\s*\(|for\s*\(|while\s*\(|=>\s*{|async |await )/
    const indentPattern = /^\s{2,}/m
    if (codeKeywords.test(text) && indentPattern.test(text)) {
        return { type: 'code', icon: 'code', color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20' }
    }

    return null
}

export default function ClipboardSense() {
    const { t } = useTranslation()
    const navigate = useNavigate()
    const [suggestion, setSuggestion] = useState(null)
    const [dismissed, setDismissed] = useState(false)
    const lastClip = useRef('')
    const timerRef = useRef(null)

    const checkClipboard = useCallback(async () => {
        try {
            const text = await navigator.clipboard?.readText()
            if (!text || text === lastClip.current) return
            lastClip.current = text
            setDismissed(false)

            const detected = detectContent(text)
            if (detected) {
                setSuggestion({ ...detected, text: text.slice(0, 200) + (text.length > 200 ? '…' : '') })
            } else {
                setSuggestion(null)
            }
        } catch {
            // 权限不足 — 静默忽略
        }
    }, [])

    useEffect(() => {
        timerRef.current = setInterval(checkClipboard, POLL_INTERVAL)
        return () => clearInterval(timerRef.current)
    }, [checkClipboard])

    const dismiss = () => { setDismissed(true); setSuggestion(null) }

    const sendToAsk = () => {
        useAskStore.getState().addUserNode(lastClip.current, [])
        navigate('/ask')
        dismiss()
    }

    const runInTerminal = () => {
        navigate('/terminal')
        dismiss()
    }

    if (!suggestion || dismissed) return null

    return (
        <div className="fixed bottom-20 right-6 z-[90] animate-clipboard-slide max-w-sm">
            <div className={`bg-[var(--color-surface-dark)]/95 backdrop-blur-lg border rounded-xl shadow-2xl shadow-black/50 overflow-hidden ${suggestion.bg}`}>
                {/* 头部 */}
                <div className="flex items-center justify-between px-4 py-2.5 border-b border-[var(--color-border-dark)]/50">
                    <div className="flex items-center gap-2">
                        <span className={`material-symbols-outlined text-[16px] ${suggestion.color}`}>{suggestion.icon}</span>
                        <span className="text-white text-xs font-medium">
                            {suggestion.type === 'error' ? t('clipboard.errorDetected') :
                                suggestion.type === 'url' ? t('clipboard.urlDetected') :
                                    t('clipboard.codeDetected')}
                        </span>
                    </div>
                    <button onClick={dismiss} className="p-0.5 text-slate-500 hover:text-white transition-colors">
                        <span className="material-symbols-outlined text-[14px]">close</span>
                    </button>
                </div>

                {/* 预览 */}
                <div className="px-4 py-2">
                    <pre className="text-[10px] text-slate-400 font-mono whitespace-pre-wrap line-clamp-3 leading-relaxed">{suggestion.text}</pre>
                </div>

                {/* 操作 */}
                <div className="flex items-center gap-2 px-4 py-2.5 bg-[var(--color-surface-darker)]/50">
                    <button onClick={sendToAsk}
                        className="flex items-center gap-1 px-2.5 py-1 text-[10px] rounded-lg bg-[var(--color-primary)]/10 text-[var(--color-primary)] hover:bg-[var(--color-primary)]/20 transition-colors">
                        <span className="material-symbols-outlined text-[12px]">chat</span>
                        {t('clipboard.sendToAsk')}
                    </button>
                    {suggestion.type === 'code' && (
                        <button onClick={runInTerminal}
                            className="flex items-center gap-1 px-2.5 py-1 text-[10px] rounded-lg bg-white/5 text-slate-400 hover:bg-white/10 transition-colors">
                            <span className="material-symbols-outlined text-[12px]">terminal</span>
                            {t('clipboard.runInTerminal')}
                        </button>
                    )}
                </div>
            </div>
        </div>
    )
}
