/**
 * ErrorCard — 错误诊断卡片
 *
 * 显示错误信息 + 可能原因 + 建议操作按钮
 */
import { useTranslation } from 'react-i18next'

export default function ErrorCard({ title, message, suggestions = [], onRetry, onDismiss, className = '' }) {
    const { t } = useTranslation()

    return (
        <div className={`bg-red-500/5 border border-red-500/20 rounded-xl p-5 animate-slide-up ${className}`}>
            {/* 头部 */}
            <div className="flex items-start gap-3 mb-3">
                <div className="size-10 rounded-lg bg-red-500/10 flex items-center justify-center shrink-0">
                    <span className="material-symbols-outlined text-red-500 text-[22px]">error</span>
                </div>
                <div className="flex-1 min-w-0">
                    <h4 className="text-white font-semibold text-sm">{title || t('error.title')}</h4>
                    {message && <p className="text-red-400/80 text-xs mt-1">{message}</p>}
                </div>
                {onDismiss && (
                    <button onClick={onDismiss} className="p-1 text-slate-500 hover:text-white rounded transition-colors">
                        <span className="material-symbols-outlined text-[16px]">close</span>
                    </button>
                )}
            </div>

            {/* 建议列表 */}
            {suggestions.length > 0 && (
                <div className="space-y-1.5 mb-4 ml-[52px]">
                    {suggestions.map((s, i) => (
                        <div key={i} className="flex items-start gap-2 text-xs text-slate-400">
                            <span className="material-symbols-outlined text-[14px] text-slate-500 mt-0.5 shrink-0">arrow_right</span>
                            <span>{s}</span>
                        </div>
                    ))}
                </div>
            )}

            {/* 操作按钮 */}
            {onRetry && (
                <div className="flex gap-2 ml-[52px]">
                    <button
                        onClick={onRetry}
                        className="px-4 py-2 text-xs font-medium rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors flex items-center gap-1.5"
                    >
                        <span className="material-symbols-outlined text-[14px]">refresh</span>
                        {t('settings.retry')}
                    </button>
                </div>
            )}
        </div>
    )
}
