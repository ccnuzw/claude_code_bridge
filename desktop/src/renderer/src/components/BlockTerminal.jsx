/**
 * BlockTerminal — 方案 B：区块卡片终端
 *
 * 每条命令渲染为一张可折叠的卡片:
 *   - 左侧状态条（绿色=成功，红色=失败，蓝色=运行中）
 *   - 标题行：命令 + 状态 Badge + 耗时
 *   - 展开区显示输出 + AI Explain & Fix 按钮
 *
 * 设计参考：super_terminal_ai_augmented_workstation prototype
 */
import { useState, useEffect, useRef } from 'react'
import i18n from '../i18n'

const api = typeof window !== 'undefined' ? window.electronAPI : null

// 模拟区块数据（后续接入真实 PTY 解析）
const MOCK_BLOCKS = [
    {
        id: 1, cmd: 'git push origin main', status: 'success', duration: '2.1s', time: '10:42:15 AM',
        output: `Enumerating objects: 5, done.\nCounting objects: 100% (5/5), done.\nDelta compression using up to 8 threads\nCompressing objects: 100% (3/3), done.\nWriting objects: 100% (3/3), 324 bytes | 324.00 KiB/s, done.\nTo github.com:user/repo.git\n  a1b2c3d..e4f5g6h main -> main`,
        expanded: false
    },
    {
        id: 2, cmd: 'cat config.json', status: 'success', duration: '0.04s', time: '10:43:02 AM',
        output: `{\n  "environment": "production",\n  "database": {\n    "host": "db-primary.cluster-ax9.aws.com",\n    "port": 5432,\n    "ssl": true\n  },\n  "features": ["new-ui", "beta-access"]\n}`,
        isJson: true, expanded: true
    },
    {
        id: 3, cmd: 'npm run build', status: 'failed', duration: '4.8s', time: '10:45:12 AM',
        output: `> project-alpha@1.0.0 build\n> next build\n\n...\nType error: Property 'userSettings' does not exist on type 'UserContext'.\n  74 |   const { theme } = context.userSettings;\n     |                           ^`,
        expanded: true, hasAiFix: true
    }
]

function BlockCard({ block, onToggle }) {
    const statusColors = {
        success: { border: 'bg-emerald-500', icon: 'check_circle', iconColor: 'text-emerald-500', bgIcon: 'bg-[var(--color-border-dark)]', badge: 'bg-emerald-500/20 text-emerald-500' },
        failed: { border: 'bg-red-500 shadow-[0_0_10px_#ef4444]', icon: 'error', iconColor: 'text-red-500', bgIcon: 'bg-red-500/20', badge: 'bg-red-500/20 text-red-500' },
        running: { border: 'bg-blue-500 animate-pulse', icon: 'sync', iconColor: 'text-blue-500 animate-spin', bgIcon: 'bg-blue-500/20', badge: 'bg-blue-500/20 text-blue-500' }
    }
    const s = statusColors[block.status] || statusColors.success

    return (
        <div className={`group relative rounded-xl border overflow-hidden transition-colors ${block.status === 'failed'
            ? 'border-red-500/50 bg-red-500/5 hover:bg-red-500/10 shadow-[0_0_15px_rgba(239,68,68,0.1)]'
            : 'border-[var(--color-border-dark)] bg-[var(--color-surface-dark)]/50 hover:bg-[var(--color-surface-dark)]'
            }`}>
            {/* 左侧状态条 */}
            <div className={`absolute left-0 top-0 bottom-0 w-1 ${s.border}`} />

            {/* 头部：命令行 + 状态 */}
            <div
                className="flex items-center gap-4 px-4 py-3 cursor-pointer"
                onClick={() => onToggle(block.id)}
            >
                <div className={`flex items-center justify-center rounded-lg shrink-0 size-10 ${s.bgIcon}`}>
                    <span className={`material-symbols-outlined ${s.iconColor}`}>{s.icon}</span>
                </div>
                <div className="flex flex-col justify-center flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                        <p className="text-white text-sm font-mono font-medium truncate">{block.cmd}</p>
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${s.badge}`}>
                            {block.status}
                        </span>
                    </div>
                    <p className="text-slate-500 text-xs font-mono mt-0.5">{block.duration} • {block.time}</p>
                </div>
                <span className="material-symbols-outlined text-slate-500 hover:text-white transition-colors">
                    {block.expanded ? 'expand_less' : 'expand_more'}
                </span>
            </div>

            {/* 展开区 */}
            {block.expanded && (
                <div className="px-4 pb-4 pl-[4.5rem]">
                    {block.isJson ? (
                        <div className="bg-[var(--color-bg-dark)]/50 rounded-lg p-3 font-mono text-xs border border-[var(--color-border-dark)] overflow-x-auto">
                            <pre className="text-slate-300 whitespace-pre-wrap">{block.output}</pre>
                            <div className="mt-2 flex gap-2">
                                <button className="text-[10px] bg-[var(--color-border-dark)] hover:bg-white/10 text-slate-400 hover:text-white px-2 py-1 rounded transition-colors">{i18n.t('terminal.copyJson')}</button>
                                <button className="text-[10px] bg-[var(--color-border-dark)] hover:bg-white/10 text-slate-400 hover:text-white px-2 py-1 rounded transition-colors">{i18n.t('terminal.viewRaw')}</button>
                            </div>
                        </div>
                    ) : (
                        <div className={`text-xs font-mono leading-relaxed border-l-2 pl-3 ${block.status === 'failed' ? 'text-red-300/90 border-red-500/30' : 'text-slate-400 border-[var(--color-border-dark)]'
                            }`}>
                            <pre className="whitespace-pre-wrap">{block.output}</pre>
                        </div>
                    )}

                    {/* AI Explain & Fix 按钮 */}
                    {block.hasAiFix && (
                        <div className="flex items-center gap-3 mt-3">
                            <button className="flex items-center gap-2 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white px-4 py-2 rounded-lg text-xs font-bold shadow-lg shadow-purple-900/40 border border-white/10 transition-all hover:scale-[1.02]">
                                <span className="material-symbols-outlined text-[16px] animate-pulse">smart_toy</span>
                                {i18n.t('terminal.explainFix')}
                            </button>
                            <span className="text-slate-500 text-[10px]">{i18n.t('terminal.aiSuggested')}</span>
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}

export default function BlockTerminal({ terminalId, isActive }) {
    const [blocks, setBlocks] = useState(MOCK_BLOCKS)
    const [input, setInput] = useState('')
    const scrollRef = useRef(null)

    const toggleBlock = (id) => {
        setBlocks(prev => prev.map(b =>
            b.id === id ? { ...b, expanded: !b.expanded } : b
        ))
    }

    const handleSubmit = (e) => {
        e.preventDefault()
        if (!input.trim()) return

        // 添加新的运行中区块
        const newBlock = {
            id: Date.now(),
            cmd: input,
            status: 'running',
            duration: '...',
            time: new Date().toLocaleTimeString(),
            output: '',
            expanded: true
        }
        setBlocks(prev => [...prev, newBlock])
        setInput('')

        // 写入真实 PTY
        if (api && terminalId) {
            api.ptyWrite(terminalId, input + '\n')
        }

        // 滚动到底部
        setTimeout(() => {
            scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
        }, 100)
    }

    return (
        <div className="flex flex-col h-full bg-[var(--color-bg-dark)]">
            {/* Header */}
            <div className="sticky top-0 z-10 bg-[var(--color-bg-dark)]/95 backdrop-blur border-b border-[var(--color-border-dark)] flex flex-wrap justify-between items-center gap-3 p-4 px-6">
                <div className="flex flex-col">
                    <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-slate-500 text-sm">folder_open</span>
                        <p className="text-white tracking-tight text-lg font-bold leading-tight">{i18n.t('terminal.blockTerminal')}</p>
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                        <div className="size-2 rounded-full bg-emerald-500" />
                        <p className="text-slate-500 text-xs font-mono">{i18n.t('terminal.blockDesc')}</p>
                    </div>
                </div>
                <div className="flex gap-2">
                    <button className="flex items-center justify-center rounded-lg h-8 px-3 bg-[var(--color-surface-dark)] border border-[var(--color-border-dark)] hover:border-slate-500/50 text-white text-xs font-medium transition-all">
                        <span className="material-symbols-outlined text-[16px] mr-1.5">tune</span>
                        {i18n.t('terminal.filters')}
                    </button>
                </div>
            </div>

            {/* Blocks Container */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-4 pb-20">
                {blocks.map((block) => (
                    <BlockCard key={block.id} block={block} onToggle={toggleBlock} />
                ))}
            </div>

            {/* Input Area */}
            <div className="border-t border-[var(--color-border-dark)] bg-[var(--color-bg-dark)]/95 backdrop-blur p-4">
                <form onSubmit={handleSubmit} className="relative flex items-center w-full">
                    <span className="absolute left-3 material-symbols-outlined text-emerald-500 text-[18px]">chevron_right</span>
                    <input
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        className="w-full bg-[var(--color-surface-dark)] border border-[var(--color-border-dark)] rounded-lg py-3 pl-10 pr-12 text-sm text-white font-mono placeholder:text-slate-600 focus:ring-1 focus:ring-[var(--color-primary)] focus:border-[var(--color-primary)] outline-none"
                        placeholder="Enter command or prompt AI..."
                        autoFocus
                    />
                    <div className="absolute right-3 flex items-center gap-2">
                        <span className="text-[10px] text-slate-500 bg-[var(--color-border-dark)] px-1.5 py-0.5 rounded font-mono">⏎</span>
                    </div>
                </form>
            </div>
        </div>
    )
}
