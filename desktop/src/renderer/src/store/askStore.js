import { create } from 'zustand'
import { useAppStore } from '../store'

const api = typeof window !== 'undefined' ? window.electronAPI : null

// 真实 Provider 尚未加载时的静态 fallback
const FALLBACK_PROVIDERS = [
    { id: 'claude', name: 'Claude', vendor: 'claude', icon: 'psychology', color: '#f97316', shortName: 'C', status: 'unknown', enabled: true },
    { id: 'codex', name: 'Codex', vendor: 'codex', icon: 'code', color: '#10b981', shortName: 'X', status: 'unknown', enabled: true },
    { id: 'gemini', name: 'Gemini', vendor: 'gemini', icon: 'auto_awesome', color: '#3b82f6', shortName: 'G', status: 'unknown', enabled: true },
    { id: 'opencode', name: 'OpenCode', vendor: 'opencode', icon: 'code_blocks', color: '#a855f7', shortName: 'O', status: 'unknown', enabled: true },
    { id: 'droid', name: 'Droid', vendor: 'droid', icon: 'smart_toy', color: '#ef4444', shortName: 'D', status: 'unknown', enabled: true }
]

/**
 * Ask 画布状态管理
 * 管理：画布视口、对话节点、连线关系、当前会话、活跃节点
 *
 * Provider 数据来自全局 useAppStore（真实 IPC）。
 * 流式回复通过 askStream / askCompare IPC 实现（事件监听在 App.jsx 中注册）。
 * 会话历史通过 askGetSessions IPC 加载。
 */
const useAskStore = create((set, get) => ({
    // ── 画布视口 ──
    viewport: { x: 0, y: 0, scale: 1 },
    setViewport: (viewport) => set({ viewport }),
    panBy: (dx, dy) => set((s) => ({
        viewport: { ...s.viewport, x: s.viewport.x + dx, y: s.viewport.y + dy }
    })),
    zoomTo: (scale) => set((s) => ({
        viewport: { ...s.viewport, scale: Math.max(0.3, Math.min(2, scale)) }
    })),
    fitToCenter: () => {
        const nodes = get().nodes
        if (nodes.length === 0) return
        const xs = nodes.map(n => n.x + (n.width || 300) / 2)
        const ys = nodes.map(n => n.y + 100)
        const cx = xs.reduce((a, b) => a + b, 0) / xs.length
        const cy = ys.reduce((a, b) => a + b, 0) / ys.length
        set({ viewport: { x: -cx + 500, y: -cy + 300, scale: 0.85 } })
    },

    // ── 节点 & 连线（默认空白画布） ──
    nodes: [],
    edges: [],
    activeNodeId: null,
    setActiveNode: (id) => set({ activeNodeId: id }),

    // ── 会话（初始为空，通过 loadSessions 从 IPC 加载） ──
    sessions: [],
    activeSessionId: null,
    setActiveSession: (id) => set({ activeSessionId: id }),

    // ── 加载真实会话历史 ──
    loadSessions: async () => {
        if (!api?.askGetSessions) return
        try {
            const sessions = await api.askGetSessions()
            if (Array.isArray(sessions) && sessions.length > 0) {
                set({
                    sessions,
                    activeSessionId: get().activeSessionId || sessions[0]?.id || null
                })
            }
        } catch (err) {
            console.error('loadSessions failed:', err)
        }
    },

    // ── askd 连接状态 ──
    askdConnected: false,
    checkAskdStatus: async () => {
        if (!api?.askStatus) return
        try {
            const { running } = await api.askStatus()
            set({ askdConnected: !!running })
        } catch {
            set({ askdConnected: false })
        }
    },

    // ── Provider 选择 ──
    selectedProviders: ['claude'],
    toggleProvider: (id) => set((s) => {
        const sel = s.selectedProviders
        return { selectedProviders: sel.includes(id) ? sel.filter(x => x !== id) : [...sel, id] }
    }),

    // ── 流式回复状态 ──
    streamingNodeId: null,
    streamingNodeIds: [], // 多 provider 对比时可能有多个同时 streaming

    // ── 获取真实 Provider 列表（从全局 store 读取） ──
    getProviders: () => {
        const appState = useAppStore.getState()
        const providers = appState.providers
        if (providers && providers.length > 0) {
            return providers.map(p => ({
                id: p.name,
                name: p.label,
                vendor: p.name,
                icon: p.icon,
                color: getProviderColor(p.name),
                shortName: p.label[0],
                status: getProviderStatus(p.name, appState.healthStatuses),
                enabled: p.enabled
            }))
        }
        return FALLBACK_PROVIDERS
    },

    // ── 添加用户 Prompt 节点 ──
    addUserNode: (content, attachments = []) => {
        const state = get()
        const lastNode = state.nodes[state.nodes.length - 1]
        const newX = lastNode ? lastNode.x + (lastNode.width || 300) + 120 : 80
        const newY = lastNode ? lastNode.y : 260

        const userNode = {
            id: `node-${Date.now()}`,
            type: 'user',
            content,
            attachments,
            timestamp: Date.now(),
            x: newX,
            y: newY,
            width: 260
        }

        set((s) => ({
            nodes: [...s.nodes, userNode],
            activeNodeId: userNode.id
        }))

        // 使用真实 askd IPC 发送请求
        const providers = state.selectedProviders
        if (providers.length > 1) {
            get().triggerComparisonReply(userNode.id, providers, content)
        } else {
            get().triggerSingleReply(userNode.id, providers[0] || 'claude', content)
        }

        return userNode.id
    },

    // ── 单 Provider 流式回复（真实 askStream IPC） ──
    triggerSingleReply: async (parentNodeId, providerId, message) => {
        const state = get()
        const parentNode = state.nodes.find(n => n.id === parentNodeId)
        const providers = get().getProviders()
        const provider = providers.find(p => p.id === providerId)

        // 从用户节点读取 prompt（如果没有直接传入）
        const prompt = message || parentNode?.content || ''

        const aiNode = {
            id: `node-${Date.now()}-${providerId}`,
            type: 'ai',
            provider: providerId,
            title: `${provider?.name || providerId} Response`,
            content: '',
            timestamp: Date.now(),
            responseTime: 0,
            tokens: 0,
            x: (parentNode?.x || 0) + (parentNode?.width || 300) + 120,
            y: parentNode?.y || 260,
            width: 400,
            streaming: true
        }

        const newEdge = { from: parentNodeId, to: aiNode.id, type: 'direct' }

        set((s) => ({
            nodes: [...s.nodes, aiNode],
            edges: [...s.edges, newEdge],
            streamingNodeId: aiNode.id,
            activeNodeId: aiNode.id
        }))

        // 调用真实 askStream IPC
        // 事件监听器（onAskStreamChunk 等）在 App.jsx 中注册，会调用 handleStreamChunk 等
        if (api?.askStream) {
            try {
                await api.askStream(providerId, prompt, aiNode.id)
            } catch (err) {
                console.error('askStream failed:', err)
                // 标记为错误状态
                set((s) => ({
                    nodes: s.nodes.map(n =>
                        n.id === aiNode.id
                            ? { ...n, streaming: false, content: `⚠️ Error: ${err.message || 'askStream failed'}`, error: true }
                            : n
                    ),
                    streamingNodeId: null
                }))
            }
        } else {
            // Fallback: 没有 askStream API 时显示提示
            set((s) => ({
                nodes: s.nodes.map(n =>
                    n.id === aiNode.id
                        ? { ...n, streaming: false, content: '⚠️ askd daemon not available. Please start askd first.' }
                        : n
                ),
                streamingNodeId: null
            }))
        }
    },

    // ── 多 Provider 对比回复（真实 askCompare IPC） ──
    triggerComparisonReply: async (parentNodeId, providerIds, message) => {
        const state = get()
        const parentNode = state.nodes.find(n => n.id === parentNodeId)
        const baseX = (parentNode?.x || 0) + (parentNode?.width || 300) + 120
        const baseY = parentNode?.y || 260
        const providers = get().getProviders()

        const prompt = message || parentNode?.content || ''

        const newNodes = []
        const newEdges = []
        const nodeIds = {}

        providerIds.forEach((providerId, i) => {
            const provider = providers.find(p => p.id === providerId)
            const aiNode = {
                id: `node-${Date.now()}-${providerId}`,
                type: 'ai',
                provider: providerId,
                title: `${provider?.name || providerId}`,
                content: '',
                timestamp: Date.now(),
                responseTime: 0,
                tokens: 0,
                x: baseX,
                y: baseY + i * 280 - ((providerIds.length - 1) * 140),
                width: 420,
                streaming: true,
                isComparison: true
            }
            newNodes.push(aiNode)
            newEdges.push({ from: parentNodeId, to: aiNode.id, type: 'comparison' })
            nodeIds[providerId] = aiNode.id
        })

        set((s) => ({
            nodes: [...s.nodes, ...newNodes],
            edges: [...s.edges, ...newEdges],
            streamingNodeId: newNodes[0]?.id,
            streamingNodeIds: newNodes.map(n => n.id)
        }))

        // 调用真实 askCompare IPC — 每个 provider 独立推送 stream 事件
        if (api?.askCompare) {
            try {
                await api.askCompare(providerIds, prompt, nodeIds)
            } catch (err) {
                console.error('askCompare failed:', err)
                set((s) => ({
                    nodes: s.nodes.map(n =>
                        nodeIds[n.provider] === n.id
                            ? { ...n, streaming: false, content: `⚠️ Error: ${err.message || 'askCompare failed'}`, error: true }
                            : n
                    ),
                    streamingNodeId: null,
                    streamingNodeIds: []
                }))
            }
        } else {
            set((s) => ({
                nodes: s.nodes.map(n => {
                    const isOurs = newNodes.some(nn => nn.id === n.id)
                    return isOurs ? { ...n, streaming: false, content: '⚠️ askd daemon not available.' } : n
                }),
                streamingNodeId: null,
                streamingNodeIds: []
            }))
        }
    },

    // ── 流式事件处理器（从 App.jsx 调用） ──
    handleStreamStart: ({ nodeId, provider }) => {
        set((s) => ({
            nodes: s.nodes.map(n =>
                n.id === nodeId ? { ...n, streaming: true } : n
            )
        }))
    },

    handleStreamChunk: ({ nodeId, provider, delta, content, tokens, responseTime }) => {
        set((s) => ({
            nodes: s.nodes.map(n =>
                n.id === nodeId
                    ? {
                        ...n,
                        content: content || (n.content + (delta || '')),
                        tokens: tokens ?? n.tokens,
                        responseTime: responseTime ?? n.responseTime
                    }
                    : n
            )
        }))
    },

    handleStreamEnd: ({ nodeId, provider, reply, exitCode, meta, tokens }) => {
        set((s) => {
            const updatedStreamingIds = s.streamingNodeIds.filter(id => id !== nodeId)
            return {
                nodes: s.nodes.map(n =>
                    n.id === nodeId
                        ? {
                            ...n,
                            streaming: false,
                            content: reply || n.content,
                            tokens: tokens ?? n.tokens,
                            exitCode,
                            meta
                        }
                        : n
                ),
                streamingNodeId: updatedStreamingIds.length > 0 ? updatedStreamingIds[0] : null,
                streamingNodeIds: updatedStreamingIds
            }
        })
        // 流完成后自动保存会话
        setTimeout(() => get().saveSession(), 500)
    },

    handleStreamError: ({ nodeId, provider, error }) => {
        set((s) => {
            const updatedStreamingIds = s.streamingNodeIds.filter(id => id !== nodeId)
            return {
                nodes: s.nodes.map(n =>
                    n.id === nodeId
                        ? {
                            ...n,
                            streaming: false,
                            content: n.content + `\n\n⚠️ Error: ${error || 'Stream failed'}`,
                            error: true
                        }
                        : n
                ),
                streamingNodeId: updatedStreamingIds.length > 0 ? updatedStreamingIds[0] : null,
                streamingNodeIds: updatedStreamingIds
            }
        })
    },

    // ── 会话持久化 ──────────────────────────────────────────

    saveSession: async (title) => {
        if (!api?.askSaveSession) return null
        const { activeSessionId, nodes, edges, viewport, selectedProviders } = get()
        // 过滤掉正在 streaming 的节点不保存
        const stableNodes = nodes.filter(n => !n.streaming)
        if (stableNodes.length === 0) return null
        try {
            const result = await api.askSaveSession({
                id: activeSessionId,
                title: title || stableNodes.find(n => n.type === 'user')?.content?.slice(0, 50) || 'Untitled',
                nodes: stableNodes,
                edges,
                viewport,
                selectedProviders
            })
            // 更新会话 ID（新建时后端生成）
            if (result?.id && result.id !== activeSessionId) {
                set({ activeSessionId: result.id })
                await get().loadSessions() // 刷新侧边栏列表
            }
            return result
        } catch (err) {
            console.error('saveSession failed:', err)
            return null
        }
    },

    loadSession: async (sessionId) => {
        if (!api?.askLoadSession) return
        try {
            const data = await api.askLoadSession(sessionId)
            if (data?.error) {
                console.error('loadSession:', data.error)
                return
            }
            set({
                activeSessionId: data.id,
                nodes: data.nodes || [],
                edges: data.edges || [],
                viewport: data.viewport || { x: 0, y: 0, scale: 1 },
                selectedProviders: data.selectedProviders || ['claude'],
                streamingNodeId: null,
                streamingNodeIds: [],
                activeNodeId: data.nodes?.[data.nodes.length - 1]?.id || null
            })
        } catch (err) {
            console.error('loadSession failed:', err)
        }
    },

    deleteSession: async (sessionId) => {
        if (!api?.askDeleteSession) return
        try {
            await api.askDeleteSession(sessionId)
            const sessions = get().sessions.filter(s => s.id !== sessionId)
            set({ sessions })
            // 如果删的是当前活跃会话，切换到下一个或新建空白
            if (get().activeSessionId === sessionId) {
                if (sessions.length > 0) {
                    await get().loadSession(sessions[0].id)
                } else {
                    get().newSession()
                }
            }
        } catch (err) {
            console.error('deleteSession failed:', err)
        }
    },

    newSession: () => {
        set({
            activeSessionId: null,
            nodes: [],
            edges: [],
            viewport: { x: 0, y: 0, scale: 1 },
            activeNodeId: null,
            streamingNodeId: null,
            streamingNodeIds: []
        })
    },

    // ── 中断流式回复 ──
    abortStream: async (nodeId) => {
        const targetNodeId = nodeId || get().streamingNodeId
        if (!targetNodeId) return
        if (api?.askAbort) {
            try {
                await api.askAbort(targetNodeId)
            } catch (err) {
                console.error('askAbort failed:', err)
            }
        }
        // 本地立即标记为中断（不等后端事件）
        set((s) => {
            const updatedStreamingIds = s.streamingNodeIds.filter(id => id !== targetNodeId)
            return {
                nodes: s.nodes.map(n =>
                    n.id === targetNodeId
                        ? { ...n, streaming: false, content: n.content + '\n\n⏹ *Aborted by user*', aborted: true }
                        : n
                ),
                streamingNodeId: updatedStreamingIds.length > 0 ? updatedStreamingIds[0] : null,
                streamingNodeIds: updatedStreamingIds
            }
        })
    },

    // ── 处理后端 abort 事件（由 App.jsx 调用） ──
    handleStreamAbort: ({ nodeId, provider }) => {
        set((s) => {
            const updatedStreamingIds = s.streamingNodeIds.filter(id => id !== nodeId)
            return {
                nodes: s.nodes.map(n =>
                    n.id === nodeId
                        ? { ...n, streaming: false, aborted: true }
                        : n
                ),
                streamingNodeId: updatedStreamingIds.length > 0 ? updatedStreamingIds[0] : null,
                streamingNodeIds: updatedStreamingIds
            }
        })
    },

    // ── 飞到指定节点 ──
    flyToNode: (nodeId) => {
        const node = get().nodes.find(n => n.id === nodeId)
        if (!node) return
        set({
            viewport: {
                x: -node.x + 400,
                y: -node.y + 200,
                scale: 1
            },
            activeNodeId: nodeId
        })
    }
}))

// ── Provider 颜色映射 ──
function getProviderColor(name) {
    const colors = {
        claude: '#f97316',
        codex: '#10b981',
        gemini: '#3b82f6',
        opencode: '#a855f7',
        droid: '#ef4444'
    }
    return colors[name] || '#6b7280'
}

// ── 根据 healthStatuses 获取 provider 状态 ──
function getProviderStatus(name, healthStatuses) {
    if (!healthStatuses || !healthStatuses[name]) return 'unknown'
    const s = healthStatuses[name].status
    if (s === 'operational') return 'online'
    if (s === 'degraded') return 'degraded'
    return 'offline'
}

export default useAskStore
