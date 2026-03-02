/**
 * Toast 通知系统 — 全局轻量级消息提示
 *
 * 支持 4 种类型：success / error / warning / info
 * 自动消失 + 手动关闭 + 从右下角滑入动画
 */
import { create } from 'zustand'

// ── Toast Store ──────────────────────────────────────────────
let toastId = 0

export const useToastStore = create((set, get) => ({
    toasts: [],

    addToast: (message, type = 'info', duration = 4000) => {
        const id = ++toastId
        set(state => ({
            toasts: [...state.toasts, { id, message, type, createdAt: Date.now() }]
        }))
        if (duration > 0) {
            setTimeout(() => get().removeToast(id), duration)
        }
        return id
    },

    removeToast: (id) => {
        set(state => ({
            toasts: state.toasts.filter(t => t.id !== id)
        }))
    },

    // 便捷方法
    success: (msg) => get().addToast(msg, 'success'),
    error: (msg) => get().addToast(msg, 'error', 6000),
    warning: (msg) => get().addToast(msg, 'warning', 5000),
    info: (msg) => get().addToast(msg, 'info')
}))

// ── Toast 图标和样式映射 ──────────────────────────────────────

const TOAST_STYLES = {
    success: {
        icon: 'check_circle',
        bg: 'bg-emerald-500/10 border-emerald-500/20',
        iconColor: 'text-emerald-400',
        textColor: 'text-emerald-300'
    },
    error: {
        icon: 'error',
        bg: 'bg-red-500/10 border-red-500/20',
        iconColor: 'text-red-400',
        textColor: 'text-red-300'
    },
    warning: {
        icon: 'warning',
        bg: 'bg-orange-500/10 border-orange-500/20',
        iconColor: 'text-orange-400',
        textColor: 'text-orange-300'
    },
    info: {
        icon: 'info',
        bg: 'bg-blue-500/10 border-blue-500/20',
        iconColor: 'text-blue-400',
        textColor: 'text-blue-300'
    }
}

// ── Toast UI 组件 ────────────────────────────────────────────

function ToastItem({ toast, onDismiss }) {
    const style = TOAST_STYLES[toast.type] || TOAST_STYLES.info

    return (
        <div
            className={`flex items-center gap-3 px-4 py-3 rounded-xl border backdrop-blur-sm shadow-lg animate-slide-in-right ${style.bg}`}
            role="alert"
        >
            <span className={`material-symbols-outlined text-[18px] ${style.iconColor}`}>
                {style.icon}
            </span>
            <p className={`text-sm font-medium flex-1 ${style.textColor}`}>
                {toast.message}
            </p>
            <button
                onClick={() => onDismiss(toast.id)}
                className="text-slate-500 hover:text-white transition-colors shrink-0"
            >
                <span className="material-symbols-outlined text-[16px]">close</span>
            </button>
        </div>
    )
}

export default function ToastContainer() {
    const { toasts, removeToast } = useToastStore()

    if (toasts.length === 0) return null

    return (
        <div className="fixed bottom-4 right-4 z-[9999] flex flex-col gap-2 max-w-sm pointer-events-auto">
            {toasts.map(toast => (
                <ToastItem key={toast.id} toast={toast} onDismiss={removeToast} />
            ))}
        </div>
    )
}
