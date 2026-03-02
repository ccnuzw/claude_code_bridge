/**
 * Mail 页面 — 三区布局邮件管理
 *
 * 顶部状态栏 + 左侧邮件列表(Inbox/Sent/Config) + 右侧邮件对话链 / 配置向导
 */
import { useState, useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

const api = typeof window !== 'undefined' ? window.electronAPI : null

// ── 配置向导步骤 ─────────────────────────────────────────
function SetupWizard({ overview, onUpdate, onClose, t }) {
    const [step, setStep] = useState(0)
    const [form, setForm] = useState({
        email: overview?.serviceEmail || '',
        imapHost: '', imapPort: '993',
        smtpHost: '', smtpPort: '587',
        password: '',
        provider: overview?.defaultProvider || 'claude'
    })
    const [testing, setTesting] = useState(false)
    const [testResult, setTestResult] = useState(null)

    const steps = [
        { title: t('mail.wizardStep1'), icon: 'mail', desc: t('mail.wizardStep1Desc') },
        { title: t('mail.wizardStep2'), icon: 'dns', desc: t('mail.wizardStep2Desc') },
        { title: t('mail.wizardStep3'), icon: 'lock', desc: t('mail.wizardStep3Desc') },
        { title: t('mail.wizardStep4'), icon: 'check_circle', desc: t('mail.wizardStep4Desc') }
    ]

    const testConnection = async () => {
        setTesting(true)
        setTestResult(null)
        try {
            if (api) await api.mailUpdateConfig('connection', form)
            setTestResult({ ok: true, msg: t('mail.testSuccess') })
        } catch {
            setTestResult({ ok: false, msg: t('mail.testFailed') })
        }
        setTesting(false)
    }

    return (
        <div className="bg-[var(--color-surface-dark)] border border-[var(--color-border-dark)] rounded-2xl overflow-hidden animate-fade-in">
            {/* 进度条 */}
            <div className="flex border-b border-[var(--color-border-dark)]">
                {steps.map((s, i) => (
                    <div key={i} className={`flex-1 flex items-center gap-2 p-3 text-xs font-medium transition-colors ${i === step ? 'text-[var(--color-primary)] bg-[var(--color-primary)]/5' : i < step ? 'text-emerald-500' : 'text-slate-500'}`}>
                        <span className="material-symbols-outlined text-[16px]">{i < step ? 'check_circle' : s.icon}</span>
                        <span className="hidden lg:inline">{s.title}</span>
                    </div>
                ))}
            </div>

            <div className="p-6 min-h-[280px]">
                <h3 className="text-white font-semibold text-lg mb-1">{steps[step].title}</h3>
                <p className="text-slate-400 text-sm mb-6">{steps[step].desc}</p>

                {/* Step 0: 邮箱地址 */}
                {step === 0 && (
                    <div className="space-y-4 max-w-md">
                        <div>
                            <label className="text-slate-400 text-xs block mb-1.5">{t('mail.emailAddress')}</label>
                            <input value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                                className="w-full bg-[var(--color-surface-darker)] border border-[var(--color-border-dark)] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[var(--color-primary)]"
                                placeholder="your@email.com" />
                        </div>
                        <div>
                            <label className="text-slate-400 text-xs block mb-1.5">{t('mail.defaultProvider')}</label>
                            <select value={form.provider} onChange={e => setForm(f => ({ ...f, provider: e.target.value }))}
                                className="w-full bg-[var(--color-surface-darker)] border border-[var(--color-border-dark)] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[var(--color-primary)]">
                                {['claude', 'codex', 'gemini', 'opencode'].map(p => <option key={p} value={p}>{p}</option>)}
                            </select>
                        </div>
                    </div>
                )}

                {/* Step 1: 服务器 */}
                {step === 1 && (
                    <div className="grid grid-cols-2 gap-4 max-w-lg">
                        <div>
                            <label className="text-slate-400 text-xs block mb-1.5">IMAP Host</label>
                            <input value={form.imapHost} onChange={e => setForm(f => ({ ...f, imapHost: e.target.value }))}
                                className="w-full bg-[var(--color-surface-darker)] border border-[var(--color-border-dark)] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[var(--color-primary)]"
                                placeholder="imap.gmail.com" />
                        </div>
                        <div>
                            <label className="text-slate-400 text-xs block mb-1.5">IMAP Port</label>
                            <input value={form.imapPort} onChange={e => setForm(f => ({ ...f, imapPort: e.target.value }))}
                                className="w-full bg-[var(--color-surface-darker)] border border-[var(--color-border-dark)] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[var(--color-primary)]" />
                        </div>
                        <div>
                            <label className="text-slate-400 text-xs block mb-1.5">SMTP Host</label>
                            <input value={form.smtpHost} onChange={e => setForm(f => ({ ...f, smtpHost: e.target.value }))}
                                className="w-full bg-[var(--color-surface-darker)] border border-[var(--color-border-dark)] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[var(--color-primary)]"
                                placeholder="smtp.gmail.com" />
                        </div>
                        <div>
                            <label className="text-slate-400 text-xs block mb-1.5">SMTP Port</label>
                            <input value={form.smtpPort} onChange={e => setForm(f => ({ ...f, smtpPort: e.target.value }))}
                                className="w-full bg-[var(--color-surface-darker)] border border-[var(--color-border-dark)] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[var(--color-primary)]" />
                        </div>
                    </div>
                )}

                {/* Step 2: 认证 */}
                {step === 2 && (
                    <div className="space-y-4 max-w-md">
                        <div>
                            <label className="text-slate-400 text-xs block mb-1.5">{t('mail.password')}</label>
                            <input type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                                className="w-full bg-[var(--color-surface-darker)] border border-[var(--color-border-dark)] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[var(--color-primary)]"
                                placeholder="App-specific password" />
                            <p className="text-slate-600 text-[10px] mt-1.5">{t('mail.passwordHint')}</p>
                        </div>
                        <button onClick={testConnection} disabled={testing}
                            className="px-4 py-2 rounded-lg bg-[var(--color-primary)] text-white text-sm font-medium hover:opacity-90 disabled:opacity-50 flex items-center gap-2">
                            <span className={`material-symbols-outlined text-[16px] ${testing ? 'animate-spin' : ''}`}>{testing ? 'progress_activity' : 'cable'}</span>
                            {t('mail.testConnection')}
                        </button>
                        {testResult && (
                            <div className={`p-3 rounded-lg text-xs ${testResult.ok ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' : 'bg-red-500/10 text-red-500 border border-red-500/20'}`}>
                                {testResult.msg}
                            </div>
                        )}
                    </div>
                )}

                {/* Step 3: 完成 */}
                {step === 3 && (
                    <div className="text-center py-6">
                        <span className="material-symbols-outlined text-[48px] text-emerald-500 block mb-3">check_circle</span>
                        <h4 className="text-white text-lg font-semibold">{t('mail.setupComplete')}</h4>
                        <p className="text-slate-400 text-sm mt-1">{form.email}</p>
                    </div>
                )}
            </div>

            {/* 底部导航 */}
            <div className="flex justify-between p-4 border-t border-[var(--color-border-dark)]">
                <button onClick={() => step > 0 ? setStep(step - 1) : onClose?.()} className="px-4 py-2 text-sm text-slate-400 hover:text-white transition-colors">
                    {step > 0 ? t('common.back') : t('common.cancel')}
                </button>
                <button onClick={() => step < 3 ? setStep(step + 1) : onClose?.()} className="px-4 py-2 rounded-lg bg-[var(--color-primary)] text-white text-sm font-medium hover:opacity-90">
                    {step < 3 ? t('common.next') : t('common.done')}
                </button>
            </div>
        </div>
    )
}

// ── 邮件对话链 ───────────────────────────────────────────
function ThreadDetail({ thread, t }) {
    if (!thread) return (
        <div className="flex items-center justify-center h-full text-slate-500 text-sm">
            <div className="text-center">
                <span className="material-symbols-outlined text-[40px] text-slate-600 block mb-3">mail</span>
                <p>{t('mail.selectThread')}</p>
            </div>
        </div>
    )

    return (
        <div className="h-full flex flex-col">
            {/* 邮件头 */}
            <div className="p-4 border-b border-[var(--color-border-dark)]">
                <h3 className="text-white font-semibold text-sm">{thread.subject || 'No Subject'}</h3>
                <div className="flex items-center gap-3 mt-2 text-xs text-slate-400">
                    <span className="flex items-center gap-1">
                        <span className="material-symbols-outlined text-[14px]">person</span>
                        {thread.from || 'Unknown'}
                    </span>
                    <span className="flex items-center gap-1">
                        <span className="material-symbols-outlined text-[14px]">smart_toy</span>
                        {thread.provider || 'auto'}
                    </span>
                    <span className="flex items-center gap-1">
                        <span className="material-symbols-outlined text-[14px]">schedule</span>
                        {thread.timestamp ? new Date(thread.timestamp).toLocaleString() : ''}
                    </span>
                </div>
            </div>

            {/* 对话链 */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-thin-scrollbar">
                {/* 用户请求 */}
                <div className="bg-[var(--color-surface-darker)] border border-[var(--color-border-dark)] rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-2 text-xs text-slate-500">
                        <span className="material-symbols-outlined text-[14px]">person</span>
                        <span>{t('mail.request')}</span>
                    </div>
                    <div className="text-slate-300 text-sm leading-relaxed">
                        {thread.request || thread.preview || ''}
                    </div>
                </div>

                {/* AI 回复 */}
                {thread.response && (
                    <div className="bg-[var(--color-surface-dark)] border border-[var(--color-primary)]/20 rounded-xl p-4">
                        <div className="flex items-center gap-2 mb-2 text-xs text-[var(--color-primary)]">
                            <span className="material-symbols-outlined text-[14px]">smart_toy</span>
                            <span>{thread.provider} {t('mail.response')}</span>
                            {thread.duration && <span className="text-slate-500">({thread.duration})</span>}
                        </div>
                        <div className="prose prose-invert prose-sm max-w-none">
                            <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                {thread.response}
                            </ReactMarkdown>
                        </div>
                    </div>
                )}
            </div>

            {/* 操作栏 */}
            <div className="p-3 border-t border-[var(--color-border-dark)] flex gap-2">
                <button className="flex-1 py-2 rounded-lg bg-[var(--color-primary)]/10 text-[var(--color-primary)] text-xs font-medium hover:bg-[var(--color-primary)]/20 transition-colors flex items-center justify-center gap-1.5">
                    <span className="material-symbols-outlined text-[14px]">reply</span>
                    {t('mail.reply')}
                </button>
                <button className="flex-1 py-2 rounded-lg bg-white/5 text-slate-400 text-xs font-medium hover:bg-white/10 transition-colors flex items-center justify-center gap-1.5">
                    <span className="material-symbols-outlined text-[14px]">forward</span>
                    {t('mail.forward')}
                </button>
                <button className="py-2 px-3 rounded-lg bg-white/5 text-slate-400 text-xs hover:bg-red-500/10 hover:text-red-400 transition-colors">
                    <span className="material-symbols-outlined text-[14px]">delete</span>
                </button>
            </div>
        </div>
    )
}

// ── 主组件 ────────────────────────────────────────────────
export default function Mail() {
    const { t } = useTranslation()
    const [overview, setOverview] = useState(null)
    const [isLoading, setIsLoading] = useState(false)
    const [folder, setFolder] = useState('inbox')
    const [selectedThread, setSelectedThread] = useState(null)
    const [showWizard, setShowWizard] = useState(false)

    const fetchOverview = async () => {
        if (!api) return
        setIsLoading(true)
        try {
            const data = await api.mailGetOverview()
            setOverview(data)
        } catch (err) {
            console.error('Failed to fetch mail overview:', err)
        }
        setIsLoading(false)
    }

    useEffect(() => { fetchOverview() }, [])

    const toggleEnabled = async () => {
        if (!api || !overview) return
        await api.mailUpdateConfig('enabled', !overview.enabled)
        fetchOverview()
    }

    const threads = useMemo(() => overview?.threads || [], [overview])
    const tokens = useMemo(() => overview?.tokens || [], [overview])

    const inboxThreads = threads.filter(t => !t.sent)
    const sentThreads = threads.filter(t => t.sent)

    const folders = [
        { id: 'inbox', icon: 'inbox', label: t('mail.inbox'), count: inboxThreads.length },
        { id: 'sent', icon: 'send', label: t('mail.sent'), count: sentThreads.length },
        { id: 'tokens', icon: 'key', label: t('mail.tokens'), count: tokens.length },
        { id: 'config', icon: 'settings', label: t('mail.config'), count: null }
    ]

    const activeThreads = folder === 'inbox' ? inboxThreads : folder === 'sent' ? sentThreads : []

    return (
        <div className="flex flex-col h-full overflow-hidden">
            {/* 顶部状态栏 */}
            <header className="h-12 border-b border-[var(--color-border-dark)] flex items-center justify-between px-6 shrink-0 bg-[var(--color-surface-dark)]/50">
                <div className="flex items-center gap-3">
                    <h2 className="text-base font-bold text-white flex items-center gap-2">
                        {t('mail.title')}
                        <span className={`size-2 rounded-full ${overview?.enabled ? 'bg-emerald-500 animate-pulse' : 'bg-slate-500'}`} />
                    </h2>
                    <span className="text-xs text-slate-500">
                        {t('mail.inbox')}: {inboxThreads.length} • {t('mail.sent')}: {sentThreads.length}
                    </span>
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={toggleEnabled}
                        className={`relative w-10 h-5 rounded-full transition-colors ${overview?.enabled ? 'bg-[var(--color-primary)]' : 'bg-slate-600'}`}>
                        <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${overview?.enabled ? 'left-5' : 'left-0.5'}`} />
                    </button>
                    <button onClick={() => setShowWizard(true)}
                        className="px-3 py-1.5 text-xs rounded-lg bg-white/5 text-slate-400 hover:text-white border border-[var(--color-border-dark)] transition-colors flex items-center gap-1">
                        <span className="material-symbols-outlined text-[14px]">tune</span>
                        {t('mail.wizardBtn')}
                    </button>
                    <button onClick={fetchOverview} disabled={isLoading}
                        className="px-3 py-1.5 text-xs rounded-lg bg-white/5 text-slate-300 border border-[var(--color-border-dark)] hover:bg-white/10 transition-colors disabled:opacity-50 flex items-center gap-1">
                        <span className={`material-symbols-outlined text-[14px] ${isLoading ? 'animate-spin' : ''}`}>refresh</span>
                    </button>
                </div>
            </header>

            {/* 三列布局 */}
            <div className="flex-1 flex overflow-hidden">
                {/* 左侧文件夹导航 */}
                <div className="w-48 border-r border-[var(--color-border-dark)] bg-[var(--color-surface-darker)]/50 p-2 shrink-0">
                    {folders.map(f => (
                        <button key={f.id} onClick={() => { setFolder(f.id); setSelectedThread(null) }}
                            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${folder === f.id ? 'bg-[var(--color-primary)]/10 text-[var(--color-primary)]' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}>
                            <span className="material-symbols-outlined text-[16px]">{f.icon}</span>
                            <span className="flex-1 text-left">{f.label}</span>
                            {f.count != null && f.count > 0 && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-white/10 text-slate-400">{f.count}</span>
                            )}
                        </button>
                    ))}
                </div>

                {/* 中间邮件列表 / Tokens / Config */}
                {(folder === 'inbox' || folder === 'sent') && (
                    <>
                        <div className="w-72 border-r border-[var(--color-border-dark)] overflow-y-auto custom-thin-scrollbar shrink-0">
                            {activeThreads.length === 0 ? (
                                <div className="text-center py-16">
                                    <span className="material-symbols-outlined text-[36px] text-slate-600 block mb-3 animate-float-icon">mail</span>
                                    <p className="text-slate-500 text-sm">{folder === 'inbox' ? t('mail.noInbox') : t('mail.noSent')}</p>
                                </div>
                            ) : activeThreads.map((thread, i) => (
                                <div key={i} onClick={() => setSelectedThread(thread)}
                                    className={`p-3 border-b border-[var(--color-border-dark)] cursor-pointer transition-colors ${selectedThread === thread ? 'bg-[var(--color-primary)]/5 border-l-2 border-l-[var(--color-primary)]' : 'hover:bg-white/[0.02]'}`}>
                                    <div className="flex items-center justify-between mb-1">
                                        <span className="text-white text-xs font-medium truncate flex-1">{thread.from || thread.to || 'Unknown'}</span>
                                        <span className="text-slate-600 text-[10px] shrink-0 ml-2">{thread.timestamp ? new Date(thread.timestamp).toLocaleDateString() : ''}</span>
                                    </div>
                                    <p className="text-slate-400 text-xs truncate">{thread.subject || 'No Subject'}</p>
                                    <p className="text-slate-600 text-[10px] truncate mt-0.5">{thread.preview || ''}</p>
                                </div>
                            ))}
                        </div>
                        {/* 右侧对话详情 */}
                        <div className="flex-1">
                            <ThreadDetail thread={selectedThread} t={t} />
                        </div>
                    </>
                )}

                {/* Tokens */}
                {folder === 'tokens' && (
                    <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-thin-scrollbar">
                        {tokens.length === 0 ? (
                            <div className="text-center py-16">
                                <span className="material-symbols-outlined text-[48px] text-slate-600 block mb-4 animate-float-icon">key_off</span>
                                <h3 className="text-white font-semibold text-lg">{t('mail.noTokens')}</h3>
                                <p className="text-slate-500 text-sm mt-2">~/.ccb/tokens/</p>
                            </div>
                        ) : tokens.map((token) => (
                            <div key={token.filename} className="bg-[var(--color-surface-dark)] border border-[var(--color-border-dark)] rounded-xl p-4 flex items-center gap-4 hover:border-[var(--color-primary)]/30 transition-colors">
                                <div className="bg-[var(--color-surface-darker)] p-2.5 rounded-lg border border-[var(--color-border-dark)]">
                                    <span className="material-symbols-outlined text-yellow-400 text-[22px]">key</span>
                                </div>
                                <div className="flex-1 min-w-0">
                                    <h4 className="text-white text-sm font-mono font-medium truncate">{token.filename}</h4>
                                    <p className="text-slate-500 text-xs">{(token.size / 1024).toFixed(1)} KB • {new Date(token.modified).toLocaleString()}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* Config / Wizard */}
                {folder === 'config' && (
                    <div className="flex-1 overflow-y-auto p-6 custom-thin-scrollbar">
                        {showWizard ? (
                            <SetupWizard overview={overview} onUpdate={fetchOverview} onClose={() => setShowWizard(false)} t={t} />
                        ) : (
                            <div className="max-w-2xl space-y-6">
                                {/* Hero Stats */}
                                <div className="grid grid-cols-3 gap-4">
                                    {[
                                        { labelKey: 'mail.serviceEmail', value: overview?.serviceEmail || t('common.unknown'), icon: 'mail' },
                                        { labelKey: 'mail.defaultProvider', value: overview?.defaultProvider, icon: 'smart_toy' },
                                        { labelKey: 'mail.pollInterval', value: `${overview?.pollInterval || 30}s`, icon: 'schedule' }
                                    ].map(s => (
                                        <div key={s.labelKey} className="bg-[var(--color-surface-dark)] border border-[var(--color-border-dark)] rounded-xl p-4">
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className="material-symbols-outlined text-[16px] text-slate-500">{s.icon}</span>
                                                <p className="text-[10px] text-slate-500 uppercase tracking-wider">{t(s.labelKey)}</p>
                                            </div>
                                            <p className="text-white text-sm font-medium truncate">{s.value}</p>
                                        </div>
                                    ))}
                                </div>

                                <button onClick={() => setShowWizard(true)}
                                    className="w-full p-4 rounded-xl border-2 border-dashed border-[var(--color-border-dark)] hover:border-[var(--color-primary)]/50 text-slate-400 hover:text-[var(--color-primary)] transition-colors flex items-center justify-center gap-2">
                                    <span className="material-symbols-outlined text-[20px]">settings</span>
                                    {t('mail.openWizard')}
                                </button>

                                {/* Notify mode */}
                                <div>
                                    <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-3">{t('mail.notifyMode')}</h3>
                                    <div className="grid grid-cols-2 gap-3">
                                        {['on_completion', 'realtime', 'periodic', 'on_request'].map(m => (
                                            <button key={m}
                                                onClick={() => api?.mailUpdateConfig('notification', { mode: m }).then(fetchOverview)}
                                                className={`p-3 rounded-xl border text-left transition-all ${overview?.notifyMode === m
                                                    ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/5'
                                                    : 'border-[var(--color-border-dark)] hover:border-slate-600'}`}>
                                                <p className="text-white text-sm font-medium">{t(`mail.${m === 'on_completion' ? 'onCompletion' : m === 'on_request' ? 'onRequest' : m}`)}</p>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    )
}
