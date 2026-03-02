/**
 * ClassicTerminal — 方案 A：经典 xterm.js 终端
 *
 * 纯黑无边框终端，支持分屏（预留），对应 UI 规格 §6.1
 * 设计参考：integrated_terminal_split_view prototype
 */
import { useRef, useEffect, useCallback, useState } from 'react'
import i18n from '../i18n'

const api = typeof window !== 'undefined' ? window.electronAPI : null

export default function ClassicTerminal({ terminalId, isActive, termConfig }) {
    const containerRef = useRef(null)
    const xtermRef = useRef(null)
    const fitAddonRef = useRef(null)
    const [isReady, setIsReady] = useState(false)

    const initTerminal = useCallback(async () => {
        if (!containerRef.current || xtermRef.current) return

        // 动态导入 xterm 和插件（仅在 renderer 中执行）
        const { Terminal } = await import('@xterm/xterm')
        const { FitAddon } = await import('@xterm/addon-fit')
        const { WebLinksAddon } = await import('@xterm/addon-web-links')
        const { SearchAddon } = await import('@xterm/addon-search')

        // 创建 xterm 实例
        const term = new Terminal({
            fontFamily: termConfig?.fontFamily || '"JetBrains Mono", "SF Mono", "Menlo", "Monaco", monospace',
            fontSize: termConfig?.fontSize || 13,
            lineHeight: 1.5,
            cursorBlink: termConfig?.cursorBlink ?? true,
            cursorStyle: termConfig?.cursorStyle || 'bar',
            theme: {
                background: '#0d1117',
                foreground: '#c9d1d9',
                cursor: '#58a6ff',
                cursorAccent: '#0d1117',
                selectionBackground: '#264f78',
                selectionForeground: '#ffffff',
                black: '#0d1117',
                red: '#ff7b72',
                green: '#3fb950',
                yellow: '#d29922',
                blue: '#58a6ff',
                magenta: '#bc8cff',
                cyan: '#39d353',
                white: '#c9d1d9',
                brightBlack: '#484f58',
                brightRed: '#ffa198',
                brightGreen: '#56d364',
                brightYellow: '#e3b341',
                brightBlue: '#79c0ff',
                brightMagenta: '#d2a8ff',
                brightCyan: '#56d364',
                brightWhite: '#f0f6fc'
            },
            scrollback: termConfig?.scrollback || 10000,
            allowProposedApi: true
        })

        // 安装插件
        const fitAddon = new FitAddon()
        term.loadAddon(fitAddon)
        term.loadAddon(new WebLinksAddon())
        term.loadAddon(new SearchAddon())

        // 渲染到 DOM
        term.open(containerRef.current)
        fitAddon.fit()

        xtermRef.current = term
        fitAddonRef.current = fitAddon
        setIsReady(true)

        // 将 xterm 的用户输入写入到 PTY
        term.onData((data) => {
            if (api && terminalId) {
                api.ptyWrite(terminalId, data)
            }
        })

        // 窗口 resize 时自动 fit
        const resizeObserver = new ResizeObserver(() => {
            try {
                fitAddon.fit()
                if (api && terminalId) {
                    api.ptyResize(terminalId, term.cols, term.rows)
                }
            } catch { /* ignore during teardown */ }
        })
        resizeObserver.observe(containerRef.current)

        return () => {
            resizeObserver.disconnect()
            term.dispose()
            xtermRef.current = null
            fitAddonRef.current = null
        }
    }, [terminalId])

    useEffect(() => {
        const cleanup = initTerminal()
        return () => { cleanup?.then(fn => fn?.()) }
    }, [initTerminal])

    // 监听 PTY 数据输出
    useEffect(() => {
        if (!api || !terminalId) return

        const unsub = api.onPtyData(({ id, data }) => {
            if (id === terminalId && xtermRef.current) {
                xtermRef.current.write(data)
            }
        })

        return unsub
    }, [terminalId])

    // 动态更新终端配置
    useEffect(() => {
        if (!xtermRef.current || !termConfig) return
        const term = xtermRef.current
        const opts = {}
        if (termConfig.fontSize) opts.fontSize = termConfig.fontSize
        if (termConfig.fontFamily) opts.fontFamily = termConfig.fontFamily
        if (termConfig.cursorStyle) opts.cursorStyle = termConfig.cursorStyle
        if (termConfig.cursorBlink !== undefined) opts.cursorBlink = termConfig.cursorBlink
        if (termConfig.scrollback) opts.scrollback = termConfig.scrollback
        if (Object.keys(opts).length > 0) {
            term.options = { ...term.options, ...opts }
            fitAddonRef.current?.fit()
        }
    }, [termConfig])

    // 当 tab 切换为活跃时 re-fit
    useEffect(() => {
        if (isActive && fitAddonRef.current) {
            setTimeout(() => {
                try {
                    fitAddonRef.current.fit()
                } catch { /* ignore */ }
            }, 50)
        }
    }, [isActive])

    return (
        <div className="h-full w-full bg-[#0d1117] relative">
            {/* xterm 加载指示器 */}
            {!isReady && (
                <div className="absolute inset-0 flex items-center justify-center z-10">
                    <div className="text-slate-500 text-sm flex items-center gap-2">
                        <span className="material-symbols-outlined text-[18px] animate-spin">sync</span>
                        {i18n.t('terminal.initTerminal')}
                    </div>
                </div>
            )}
            <div
                ref={containerRef}
                className="h-full w-full"
                style={{ padding: '8px 12px' }}
            />
        </div>
    )
}
