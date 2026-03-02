/**
 * EmptyState — 统一空状态组件
 *
 * 支持多种预设场景，提供柔和渐变 SVG 插图 + 标题 + 描述 + 行动按钮。
 */
import { useTranslation } from 'react-i18next'

const PRESETS = {
    dashboard: { icon: 'space_dashboard', gradient: ['#135bec', '#6366f1'] },
    ask: { icon: 'question_answer', gradient: ['#3b82f6', '#06b6d4'] },
    providers: { icon: 'dns', gradient: ['#10b981', '#14b8a6'] },
    tasks: { icon: 'task', gradient: ['#f59e0b', '#f97316'] },
    terminal: { icon: 'terminal', gradient: ['#8b5cf6', '#a855f7'] },
    mail: { icon: 'mail', gradient: ['#ec4899', '#f43f5e'] },
    extensions: { icon: 'extension', gradient: ['#06b6d4', '#0ea5e9'] },
    sessions: { icon: 'history', gradient: ['#6366f1', '#8b5cf6'] },
    search: { icon: 'search_off', gradient: ['#64748b', '#94a3b8'] },
    tokens: { icon: 'vpn_key', gradient: ['#f97316', '#ef4444'] },
    threads: { icon: 'forum', gradient: ['#ec4899', '#f43f5e'] },
    generic: { icon: 'inbox', gradient: ['#64748b', '#475569'] }
}

export default function EmptyState({ preset = 'generic', icon, title, description, actionLabel, onAction, className = '' }) {
    const { t } = useTranslation()
    const p = PRESETS[preset] || PRESETS.generic
    const displayIcon = icon || p.icon

    return (
        <div className={`flex flex-col items-center justify-center py-16 px-6 text-center ${className}`}>
            {/* SVG 渐变背景圆 + 图标 */}
            <div className="relative mb-5">
                <div className="absolute inset-0 -m-4 rounded-full opacity-20 animate-glow-pulse"
                    style={{ background: `radial-gradient(circle, ${p.gradient[0]}40 0%, transparent 70%)` }}
                />
                <div
                    className="size-20 rounded-2xl flex items-center justify-center shadow-lg"
                    style={{ background: `linear-gradient(135deg, ${p.gradient[0]}, ${p.gradient[1]})` }}
                >
                    <span className="material-symbols-outlined text-white text-[36px] animate-float-icon">{displayIcon}</span>
                </div>
            </div>

            {/* 文字 */}
            {title && <h3 className="text-white font-bold text-lg mb-2">{title}</h3>}
            {description && <p className="text-slate-400 text-sm leading-relaxed max-w-sm">{description}</p>}

            {/* 行动按钮 */}
            {actionLabel && onAction && (
                <button
                    onClick={onAction}
                    className="mt-5 px-5 py-2.5 text-sm font-medium rounded-xl text-white shadow-lg transition-all hover:scale-105 active:scale-95"
                    style={{ background: `linear-gradient(135deg, ${p.gradient[0]}, ${p.gradient[1]})` }}
                >
                    {actionLabel}
                </button>
            )}
        </div>
    )
}
