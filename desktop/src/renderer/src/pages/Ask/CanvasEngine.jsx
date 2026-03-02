import { useRef, useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import useAskStore from '../../store/askStore'
import ConversationCard from './ConversationCard'
import ConnectorLayer from './ConnectorLayer'

/**
 * 无限画布引擎 — 支持拖拽平移、滚轮缩放、网格背景
 */
export default function CanvasEngine() {
    const { t } = useTranslation()
    const containerRef = useRef(null)
    const isDragging = useRef(false)
    const lastPos = useRef({ x: 0, y: 0 })

    const { viewport, setViewport, nodes, edges, activeNodeId, setActiveNode } = useAskStore()
    const [canvasSize] = useState({ width: 3000, height: 2000 })

    // ── 鼠标拖拽平移 ──
    const handleMouseDown = useCallback((e) => {
        if (e.target.closest('.card-interactive')) return
        isDragging.current = true
        lastPos.current = { x: e.clientX, y: e.clientY }
        if (containerRef.current) containerRef.current.style.cursor = 'grabbing'
    }, [])

    const handleMouseMove = useCallback((e) => {
        if (!isDragging.current) return
        const dx = e.clientX - lastPos.current.x
        const dy = e.clientY - lastPos.current.y
        lastPos.current = { x: e.clientX, y: e.clientY }
        setViewport({
            ...useAskStore.getState().viewport,
            x: useAskStore.getState().viewport.x + dx,
            y: useAskStore.getState().viewport.y + dy
        })
    }, [setViewport])

    const handleMouseUp = useCallback(() => {
        isDragging.current = false
        if (containerRef.current) containerRef.current.style.cursor = 'grab'
    }, [])

    // ── 滚轮缩放 ──
    const handleWheel = useCallback((e) => {
        e.preventDefault()
        const vp = useAskStore.getState().viewport
        const delta = e.deltaY > 0 ? -0.05 : 0.05
        const newScale = Math.max(0.3, Math.min(2, vp.scale + delta))
        setViewport({ ...vp, scale: newScale })
    }, [setViewport])

    useEffect(() => {
        const el = containerRef.current
        if (!el) return
        el.addEventListener('wheel', handleWheel, { passive: false })
        return () => el.removeEventListener('wheel', handleWheel)
    }, [handleWheel])

    // ── 缩放控件 ──
    const zoomIn = () => setViewport({ ...viewport, scale: Math.min(2, viewport.scale + 0.15) })
    const zoomOut = () => setViewport({ ...viewport, scale: Math.max(0.3, viewport.scale - 0.15) })
    const fitCenter = () => useAskStore.getState().fitToCenter()

    return (
        <div
            ref={containerRef}
            className="flex-1 relative overflow-hidden bg-[var(--color-bg-dark)] cursor-grab select-none"
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
        >
            {/* 网格背景 */}
            <div
                className="absolute inset-0 bg-grid-pattern opacity-30 pointer-events-none"
                style={{
                    backgroundPosition: `${viewport.x}px ${viewport.y}px`,
                    backgroundSize: `${40 * viewport.scale}px ${40 * viewport.scale}px`
                }}
            />

            {/* 变换容器 */}
            <div
                className="absolute top-0 left-0 origin-top-left transition-none"
                style={{
                    transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.scale})`,
                    width: canvasSize.width,
                    height: canvasSize.height
                }}
            >
                {/* SVG 连线层 */}
                <ConnectorLayer nodes={nodes} edges={edges} />

                {/* 对话卡片 */}
                {nodes.map((node) => (
                    <ConversationCard
                        key={node.id}
                        node={node}
                        isActive={activeNodeId === node.id}
                        onClick={() => setActiveNode(node.id)}
                    />
                ))}
            </div>

            {/* 空白画布引导 */}
            {nodes.length === 0 && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
                    <div className="text-center max-w-sm">
                        <div className="size-20 mx-auto mb-4 rounded-2xl bg-[var(--color-primary)]/10 border border-[var(--color-primary)]/20 flex items-center justify-center">
                            <span className="material-symbols-outlined text-[40px] text-[var(--color-primary)] animate-float-icon">question_answer</span>
                        </div>
                        <h3 className="text-white font-bold text-lg mb-2">{t('ask.startConversation')}</h3>
                        <p className="text-slate-400 text-sm leading-relaxed mb-4">
                            {t('ask.startConversationDesc')}
                        </p>
                        <div className="flex items-center justify-center gap-4 text-[11px] text-slate-500">
                            <span className="flex items-center gap-1"><kbd className="px-1.5 py-0.5 rounded bg-slate-700 text-slate-300 font-mono">⌘S</kbd> {t('time.save')}</span>
                            <span className="flex items-center gap-1"><kbd className="px-1.5 py-0.5 rounded bg-slate-700 text-slate-300 font-mono">⌘⇧P</kbd> {t('time.commands')}</span>
                        </div>
                    </div>
                </div>
            )}

            {/* 右下角缩放控件 */}
            <div className="absolute bottom-20 right-4 flex flex-col gap-1.5 z-30">
                <button
                    onClick={zoomIn}
                    className="size-9 bg-[var(--color-surface-dark)] border border-[var(--color-border-dark)] rounded-lg flex items-center justify-center text-slate-400 hover:text-white hover:bg-[var(--color-surface-dark)]/80 shadow-lg transition-colors"
                >
                    <span className="material-symbols-outlined text-[18px]">add</span>
                </button>
                <button
                    onClick={zoomOut}
                    className="size-9 bg-[var(--color-surface-dark)] border border-[var(--color-border-dark)] rounded-lg flex items-center justify-center text-slate-400 hover:text-white hover:bg-[var(--color-surface-dark)]/80 shadow-lg transition-colors"
                >
                    <span className="material-symbols-outlined text-[18px]">remove</span>
                </button>
                <button
                    onClick={fitCenter}
                    className="size-9 bg-[var(--color-surface-dark)] border border-[var(--color-border-dark)] rounded-lg flex items-center justify-center text-slate-400 hover:text-white hover:bg-[var(--color-surface-dark)]/80 shadow-lg transition-colors mt-1"
                >
                    <span className="material-symbols-outlined text-[18px]">center_focus_strong</span>
                </button>
                <div className="text-center text-[10px] text-slate-500 mt-1 font-mono">
                    {Math.round(viewport.scale * 100)}%
                </div>
            </div>
        </div>
    )
}
