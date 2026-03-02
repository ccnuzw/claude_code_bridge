/**
 * SVG 连线层 — 绘制节点间的贝塞尔曲线
 */
export default function ConnectorLayer({ nodes, edges }) {
    const getNodeCenter = (nodeId, side = 'right') => {
        const node = nodes.find(n => n.id === nodeId)
        if (!node) return { x: 0, y: 0 }
        const w = node.width || 300
        const h = 200 // 估算高度
        if (side === 'right') return { x: node.x + w, y: node.y + h / 2 }
        if (side === 'left') return { x: node.x, y: node.y + h / 2 }
        return { x: node.x + w / 2, y: node.y + h / 2 }
    }

    return (
        <svg
            className="absolute top-0 left-0 w-full h-full pointer-events-none z-0"
            style={{ overflow: 'visible' }}
        >
            <defs>
                <linearGradient id="edge-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#324467" />
                    <stop offset="100%" stopColor="#135bec" />
                </linearGradient>
                <linearGradient id="edge-comparison" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#135bec" />
                    <stop offset="100%" stopColor="#135bec" stopOpacity="0.4" />
                </linearGradient>
            </defs>

            {edges.map((edge, i) => {
                const from = getNodeCenter(edge.from, 'right')
                const to = getNodeCenter(edge.to, 'left')

                const dx = to.x - from.x
                const cpx1 = from.x + dx * 0.4
                const cpx2 = to.x - dx * 0.4

                const isComparison = edge.type === 'comparison'
                const isActive = edge.type === 'direct'

                return (
                    <g key={i}>
                        {/* 发光效果底层 */}
                        {isActive && (
                            <path
                                d={`M ${from.x} ${from.y} C ${cpx1} ${from.y}, ${cpx2} ${to.y}, ${to.x} ${to.y}`}
                                fill="none"
                                stroke="#135bec"
                                strokeWidth="6"
                                opacity="0.1"
                                strokeLinecap="round"
                            />
                        )}
                        {/* 主线 */}
                        <path
                            d={`M ${from.x} ${from.y} C ${cpx1} ${from.y}, ${cpx2} ${to.y}, ${to.x} ${to.y}`}
                            fill="none"
                            stroke={isComparison ? 'url(#edge-comparison)' : 'url(#edge-gradient)'}
                            strokeWidth={isComparison ? 2 : 2.5}
                            strokeDasharray={isComparison ? '6,4' : 'none'}
                            strokeLinecap="round"
                            opacity={isComparison ? 0.6 : 0.5}
                        />
                        {/* 终点圆点 */}
                        <circle
                            cx={to.x}
                            cy={to.y}
                            r={4}
                            fill={isComparison ? '#135bec' : '#324467'}
                            opacity={0.7}
                        />
                    </g>
                )
            })}
        </svg>
    )
}
