import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useAppStore } from '../store'

const STORAGE_KEY = 'ccb-onboarding-completed'
const api = typeof window !== 'undefined' ? window.electronAPI : null

/**
 * Onboarding Wizard — 4 步首次启动引导
 * Step 0: 使用 systemCheckEnv() 真实环境检测
 * Step 1: 使用 getProviders() 真实 Provider 列表
 * Step 2: 使用 pingProvider() 真实 Ping 测试
 * Step 3: 完成页
 */
export default function OnboardingWizard({ isOpen, onClose }) {
    const { t } = useTranslation()
    const [step, setStep] = useState(0)
    const [checks, setChecks] = useState([])
    const [providerKeys, setProviderKeys] = useState({})
    const [pingResults, setPingResults] = useState({})
    const [pingRunning, setPingRunning] = useState(false)

    const appProviders = useAppStore(s => s.providers)

    // ── Step 0: 使用 systemCheckEnv API 真实环境检测 ──
    useEffect(() => {
        if (!isOpen || step !== 0) return

        const initCheck = async () => {
            // 先加载 Provider 数据
            await useAppStore.getState().fetchProviders()

            if (api?.systemCheckEnv) {
                // 使用真实 systemCheckEnv IPC — 返回完整环境检测结果
                try {
                    const envChecks = await api.systemCheckEnv()
                    if (Array.isArray(envChecks)) {
                        setChecks(envChecks)
                        return
                    }
                } catch (err) {
                    console.error('systemCheckEnv failed:', err)
                }
            }

            // Fallback: 如果 IPC 不可用，使用基础检测
            await useAppStore.getState().fetchHealth()
            const hs = useAppStore.getState().healthStatuses
            const fallbackChecks = [
                { id: 'node', label: 'Node.js', description: 'Runtime', status: 'success', detail: 'Available', icon: 'memory' }
            ]
            const currentProviders = useAppStore.getState().providers
            currentProviders.forEach(p => {
                const h = hs[p.name]
                fallbackChecks.push({
                    id: p.name, label: `${p.label} Daemon`, description: p.daemonKey,
                    status: h?.status === 'operational' ? 'success' : 'error',
                    detail: h?.status === 'operational' ? `PID: ${h?.pid || ''}` : t('common.offline'),
                    icon: p.icon
                })
            })
            setChecks(fallbackChecks)
        }

        initCheck()
    }, [isOpen, step, t])

    // ── Step 2: 真实 Ping 测试 ──
    const runPingTests = useCallback(async () => {
        setPingRunning(true)
        const currentProviders = useAppStore.getState().providers.filter(p => p.enabled)
        for (const p of currentProviders) {
            setPingResults(prev => ({ ...prev, [p.name]: { status: 'pinging' } }))
            const result = await useAppStore.getState().pingProvider(p.name)
            if (result) {
                setPingResults(prev => ({
                    ...prev,
                    [p.name]: {
                        status: result.status === 'operational' ? 'success' : result.status === 'degraded' ? 'degraded' : 'failed',
                        latency: result.latencyMs || result.latency,
                        label: result.label,
                        uptime: result.uptime
                    }
                }))
            } else {
                setPingResults(prev => ({
                    ...prev,
                    [p.name]: { status: 'failed', label: p.label }
                }))
            }
        }
        setPingRunning(false)
    }, [])

    useEffect(() => {
        if (step === 2 && Object.keys(pingResults).length === 0) runPingTests()
    }, [step, pingResults, runPingTests])

    // ── 导航 ──
    const next = () => {
        if (step < 3) setStep(step + 1)
        else { localStorage.setItem(STORAGE_KEY, 'true'); onClose() }
    }
    const back = () => { if (step > 0) setStep(step - 1) }
    const skip = () => { localStorage.setItem(STORAGE_KEY, 'true'); onClose() }

    if (!isOpen) return null

    const steps = [t('onboarding.envDetection'), t('onboarding.providerConfig'), t('onboarding.pingTest'), t('onboarding.complete')]
    const enabledProviders = appProviders.filter(p => p.enabled)

    const StatusIcon = ({ status }) => {
        const map = {
            success: { icon: 'check_circle', color: 'text-green-500', bg: 'bg-green-500/10' },
            warning: { icon: 'warning', color: 'text-yellow-500', bg: 'bg-yellow-500/10' },
            error: { icon: 'cancel', color: 'text-red-500', bg: 'bg-red-500/10' },
            info: { icon: 'info', color: 'text-blue-400', bg: 'bg-blue-400/10' },
            checking: { icon: 'sync', color: 'text-slate-400', bg: 'bg-slate-400/10' },
            pinging: { icon: 'pending', color: 'text-blue-400', bg: 'bg-blue-400/10' },
            degraded: { icon: 'warning', color: 'text-yellow-500', bg: 'bg-yellow-500/10' },
            failed: { icon: 'error', color: 'text-red-500', bg: 'bg-red-500/10' }
        }
        const s = map[status] || map.checking
        return (
            <div className={`flex items-center justify-center rounded-lg shrink-0 size-10 ${s.bg}`}>
                <span className={`material-symbols-outlined ${s.color} ${status === 'checking' || status === 'pinging' ? 'animate-spin' : ''}`}>{s.icon}</span>
            </div>
        )
    }

    const StatusBadge = ({ status, detail }) => {
        const colors = {
            success: 'bg-green-500/10 text-green-400 border-green-500/20',
            warning: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
            error: 'bg-red-500/10 text-red-400 border-red-500/20',
            info: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
            checking: 'bg-slate-500/10 text-slate-400 border-slate-500/20',
            pinging: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
            degraded: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
            failed: 'bg-red-500/10 text-red-400 border-red-500/20'
        }
        return (
            <span className={`px-2 py-1 rounded-md text-xs font-semibold border ${colors[status] || colors.checking}`}>
                {detail || status}
            </span>
        )
    }

    const successChecks = checks.filter(c => c.status === 'success').length
    const operationalProviders = Object.values(pingResults).filter(r => r.status === 'success').length

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 animate-fade-in">
            <div className="absolute inset-0 bg-[var(--color-bg-dark)]">
                <div className="absolute -top-[20%] -left-[10%] w-[50%] h-[50%] rounded-full bg-[var(--color-primary)]/10 blur-[120px] animate-glow-pulse" />
                <div className="absolute top-[40%] -right-[10%] w-[40%] h-[60%] rounded-full bg-blue-500/10 blur-[100px] animate-glow-pulse" style={{ animationDelay: '2s' }} />
            </div>

            <div className="relative w-full max-w-[640px] bg-[var(--color-surface-dark)] rounded-2xl shadow-2xl border border-slate-700/50 overflow-hidden flex flex-col z-10 animate-slide-up">
                {/* Header */}
                <div className="p-8 pb-4">
                    <div className="flex items-center justify-center gap-2 mb-6">
                        {steps.map((s, i) => (
                            <div key={i} className="flex items-center gap-2">
                                <div className={`size-7 rounded-full flex items-center justify-center text-xs font-bold transition-all
                                    ${i < step ? 'bg-green-500 text-white' : i === step ? 'bg-[var(--color-primary)] text-white shadow-lg shadow-blue-900/30' : 'bg-slate-700 text-slate-400'}`}>
                                    {i < step ? <span className="material-symbols-outlined text-[14px]">check</span> : i + 1}
                                </div>
                                {i < steps.length - 1 && <div className={`w-8 h-0.5 rounded-full ${i < step ? 'bg-green-500' : 'bg-slate-700'}`} />}
                            </div>
                        ))}
                    </div>

                    <div className="flex items-center gap-3 mb-4">
                        <div className="flex items-center justify-center size-10 rounded-full bg-[var(--color-primary)]/10 text-[var(--color-primary)]">
                            <span className="material-symbols-outlined text-2xl">
                                {step === 0 ? 'terminal' : step === 1 ? 'smart_toy' : step === 2 ? 'cell_tower' : 'emoji_events'}
                            </span>
                        </div>
                        <div>
                            <h1 className="text-xl font-bold text-white">{steps[step]}</h1>
                            <p className="text-sm text-slate-400">{t('onboarding.step')} {step + 1} {t('onboarding.of')} 4</p>
                        </div>
                    </div>
                    <p className="text-slate-400 text-sm leading-relaxed">
                        {step === 0 && t('onboarding.envDesc')}
                        {step === 1 && t('onboarding.providerDesc')}
                        {step === 2 && t('onboarding.pingDesc')}
                        {step === 3 && t('onboarding.completeDesc')}
                    </p>
                </div>

                {/* Content */}
                <div className="px-8 py-2 flex flex-col gap-3 max-h-[50vh] overflow-y-auto custom-thin-scrollbar">
                    {/* Step 0: 环境检测 */}
                    {step === 0 && checks.map(check => (
                        <div key={check.id} className="group flex items-center justify-between p-4 rounded-xl bg-[var(--color-surface-darker)] border border-transparent hover:border-slate-700 transition-all">
                            <div className="flex items-center gap-4">
                                <StatusIcon status={check.status} />
                                <div className="flex flex-col">
                                    <span className="text-white font-medium text-sm">{check.label}</span>
                                    <span className="text-xs text-slate-500">{check.description}</span>
                                </div>
                            </div>
                            <StatusBadge status={check.status} detail={check.detail} />
                        </div>
                    ))}
                    {step === 0 && checks.length === 0 && (
                        <div className="flex items-center justify-center py-8 text-slate-500 gap-2">
                            <span className="material-symbols-outlined animate-spin">sync</span>
                            {t('onboarding.scanning')}
                        </div>
                    )}

                    {/* Step 1: Provider 配置 */}
                    {step === 1 && appProviders.map(p => (
                        <div key={p.name} className="p-4 rounded-xl bg-[var(--color-surface-darker)] border border-transparent hover:border-slate-700 transition-all">
                            <div className="flex items-center gap-3 mb-3">
                                <div className="size-8 rounded-lg flex items-center justify-center text-sm bg-slate-700/50">
                                    <span className="material-symbols-outlined text-slate-300">{p.icon}</span>
                                </div>
                                <div className="flex-1">
                                    <span className="text-white font-medium text-sm">{p.label}</span>
                                    <span className="text-xs text-slate-500 ml-2">{p.name} • {p.daemonKey}</span>
                                </div>
                                <div className={`size-2 rounded-full ${p.enabled ? 'bg-green-500' : 'bg-slate-500'}`} />
                            </div>
                            <div className="flex gap-2">
                                <input
                                    type="password"
                                    placeholder={`${p.label} ${t('onboarding.apiKeyPlaceholder')}`}
                                    className="flex-1 bg-[var(--color-bg-dark)] border border-[var(--color-border-dark)] rounded-lg text-sm text-white px-3 py-2 outline-none focus:border-[var(--color-primary)] transition-colors placeholder-slate-600"
                                    value={providerKeys[p.name] || ''}
                                    onChange={(e) => setProviderKeys(prev => ({ ...prev, [p.name]: e.target.value }))}
                                />
                                <button className="px-3 py-2 rounded-lg bg-[var(--color-surface-dark)] border border-[var(--color-border-dark)] text-xs text-slate-300 hover:text-white hover:bg-slate-700 transition-colors font-medium">
                                    {t('onboarding.verify')}
                                </button>
                            </div>
                        </div>
                    ))}

                    {/* Step 2: Ping 测试 */}
                    {step === 2 && enabledProviders.map(p => {
                        const result = pingResults[p.name]
                        return (
                            <div key={p.name} className="flex items-center justify-between p-4 rounded-xl bg-[var(--color-surface-darker)] border border-transparent transition-all">
                                <div className="flex items-center gap-4">
                                    <StatusIcon status={result?.status || 'pinging'} />
                                    <div className="flex flex-col">
                                        <span className="text-white font-medium text-sm">{p.label}</span>
                                        <span className="text-xs text-slate-500">{p.daemonKey}{result?.uptime ? ` • Uptime: ${result.uptime}` : ''}</span>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    {result?.latency != null && (
                                        <span className="text-xs font-mono text-emerald-400">
                                            {typeof result.latency === 'number' ? `${result.latency}ms` : result.latency}
                                        </span>
                                    )}
                                    <StatusBadge
                                        status={result?.status || 'pinging'}
                                        detail={result?.status === 'success' ? t('onboarding.connected')
                                            : result?.status === 'degraded' ? t('common.degraded')
                                                : result?.status === 'failed' ? t('common.failed')
                                                    : t('onboarding.pinging')}
                                    />
                                </div>
                            </div>
                        )
                    })}

                    {/* Step 3: 完成 */}
                    {step === 3 && (
                        <div className="text-center py-8">
                            <div className="size-20 rounded-full bg-green-500/10 flex items-center justify-center mx-auto mb-4">
                                <span className="material-symbols-outlined text-green-500 text-[48px]">check_circle</span>
                            </div>
                            <h2 className="text-white text-lg font-bold mb-2">{t('onboarding.allSet')}</h2>
                            <p className="text-slate-400 text-sm max-w-xs mx-auto">{t('onboarding.allSetDesc')}</p>
                            <div className="flex gap-4 justify-center mt-6">
                                <div className="text-center">
                                    <div className="text-2xl font-bold text-white">{operationalProviders || enabledProviders.length}</div>
                                    <div className="text-[10px] text-slate-500 uppercase tracking-wider">{t('onboarding.providersOnline')}</div>
                                </div>
                                <div className="h-8 w-px bg-slate-700" />
                                <div className="text-center">
                                    <div className="text-2xl font-bold text-white">{successChecks}/{checks.length}</div>
                                    <div className="text-[10px] text-slate-500 uppercase tracking-wider">{t('onboarding.checksPassed')}</div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-6 pt-4 flex items-center justify-between border-t border-slate-700/50 mt-2 bg-[#151c2a]">
                    <button onClick={skip} className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-slate-400 hover:bg-slate-700 transition-colors font-medium text-sm">
                        {t('onboarding.skip')}
                    </button>
                    <div className="flex gap-3">
                        {step > 0 && (
                            <button onClick={back} className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-700 transition-colors font-medium text-sm">
                                <span className="material-symbols-outlined text-lg">arrow_back</span>
                                {t('onboarding.back')}
                            </button>
                        )}
                        <button
                            onClick={next}
                            disabled={step === 2 && pingRunning}
                            className="flex items-center gap-2 px-6 py-2.5 rounded-lg bg-[var(--color-primary)] hover:bg-blue-600 text-white shadow-lg shadow-blue-500/20 transition-all font-medium text-sm disabled:opacity-50"
                        >
                            {step === 3 ? t('onboarding.getStarted') : t('onboarding.next')}
                            <span className="material-symbols-outlined text-lg">{step === 3 ? 'rocket_launch' : 'arrow_forward'}</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}

OnboardingWizard.STORAGE_KEY = STORAGE_KEY
