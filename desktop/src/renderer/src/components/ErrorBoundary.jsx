import { Component } from 'react'
import i18n from '../i18n'

/**
 * React Error Boundary — 捕获渲染错误的降级组件
 * 必须使用 class component（React API 要求）
 */
export default class ErrorBoundary extends Component {
    constructor(props) {
        super(props)
        this.state = { hasError: false, error: null, errorInfo: null }
    }

    static getDerivedStateFromError(error) {
        return { hasError: true, error }
    }

    componentDidCatch(error, errorInfo) {
        this.setState({ errorInfo })
        console.error('[ErrorBoundary]', error, errorInfo)
    }

    handleReload = () => {
        this.setState({ hasError: false, error: null, errorInfo: null })
    }

    render() {
        if (this.state.hasError) {
            return (
                <div className="flex items-center justify-center h-full bg-[var(--color-bg-dark)]">
                    <div className="bg-[var(--color-surface-dark)] border border-[var(--color-border-dark)] rounded-2xl p-8 max-w-md w-full mx-4 text-center shadow-2xl animate-slide-up">
                        {/* 错误图标 */}
                        <div className="mx-auto size-16 rounded-2xl bg-red-500/10 flex items-center justify-center mb-5 border border-red-500/20">
                            <span className="material-symbols-outlined text-red-400 text-[32px]">error_outline</span>
                        </div>

                        <h2 className="text-white text-lg font-bold mb-2">{i18n.t('error.title')}</h2>
                        <p className="text-slate-400 text-sm mb-4">
                            {i18n.t('error.description')}
                        </p>

                        {/* 错误详情 */}
                        {this.state.error && (
                            <div className="bg-[var(--color-surface-darker)] border border-[var(--color-border-dark)] rounded-lg p-3 mb-3 text-left">
                                <p className="text-red-400 text-xs font-mono break-all leading-relaxed">
                                    {this.state.error.toString()}
                                </p>
                            </div>
                        )}

                        {/* 组件栈（可展开） */}
                        {this.state.errorInfo?.componentStack && (
                            <details className="mb-5 text-left">
                                <summary className="text-[10px] text-slate-500 cursor-pointer hover:text-slate-300 transition-colors mb-1">
                                    {i18n.t('error.showStack')}
                                </summary>
                                <div className="bg-[var(--color-surface-darker)] border border-[var(--color-border-dark)] rounded-lg p-3 max-h-32 overflow-y-auto custom-thin-scrollbar">
                                    <pre className="text-[9px] text-slate-500 font-mono whitespace-pre-wrap break-all leading-relaxed">
                                        {this.state.errorInfo.componentStack}
                                    </pre>
                                </div>
                            </details>
                        )}

                        {/* 操作按钮 */}
                        <div className="flex gap-3 justify-center">
                            <button
                                onClick={this.handleReload}
                                className="px-5 py-2 text-sm font-medium rounded-lg bg-[var(--color-primary)] text-white hover:bg-[var(--color-primary-hover)] transition-colors flex items-center gap-2"
                            >
                                <span className="material-symbols-outlined text-[16px]">refresh</span>
                                {i18n.t('error.reload')}
                            </button>
                            <button
                                onClick={() => {
                                    const text = [this.state.error?.toString(), this.state.errorInfo?.componentStack].filter(Boolean).join('\n\n')
                                    navigator.clipboard?.writeText(text)
                                }}
                                className="px-5 py-2 text-sm font-medium rounded-lg bg-white/5 text-slate-300 border border-[var(--color-border-dark)] hover:bg-white/10 transition-colors flex items-center gap-2"
                            >
                                <span className="material-symbols-outlined text-[16px]">content_copy</span>
                                {i18n.t('error.copyError')}
                            </button>
                        </div>
                    </div>
                </div>
            )
        }

        return this.props.children
    }
}
