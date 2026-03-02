import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import ThreadOutline from './Ask/ThreadOutline'
import CanvasEngine from './Ask/CanvasEngine'
import OmniBar from './Ask/OmniBar'
import SessionDrawer from './Ask/SessionDrawer'

/**
 * Ask 页面 — Canvas Threading
 * 无限画布 · 多模型分歧对质 · 思维导图式对话流
 */
export default function Ask() {
    const { t } = useTranslation()
    const [historyOpen, setHistoryOpen] = useState(false)

    return (
        <div className="flex h-full overflow-hidden">
            {/* 历史会话侧栏 */}
            <SessionDrawer isOpen={historyOpen} onClose={() => setHistoryOpen(false)} />

            {/* 左侧大纲 */}
            <ThreadOutline />

            {/* 中心画布区 */}
            <div className="flex-1 relative overflow-hidden">
                {/* 历史按钮 */}
                {!historyOpen && (
                    <button
                        onClick={() => setHistoryOpen(true)}
                        className="absolute top-3 left-3 z-20 size-8 rounded-lg bg-[var(--color-surface-dark)]/80 backdrop-blur border border-[var(--color-border-dark)] flex items-center justify-center text-slate-400 hover:text-white transition-colors shadow-lg"
                        title={t('ask.history')}
                    >
                        <span className="material-symbols-outlined text-[16px]">history</span>
                    </button>
                )}
                <CanvasEngine />
                <OmniBar />
            </div>
        </div>
    )
}
