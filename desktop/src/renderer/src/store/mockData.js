/**
 * Mock Data — Ask 画布 Demo 数据
 *
 * 仅保留预置的对话节点和连线，用于首次加载时展示画布功能。
 * Provider 列表、流式回复、会话历史已全部迁移至真实 IPC。
 */

// ── 预置对话节点（画布 Demo 卡片）──
export const MOCK_NODES = [
  {
    id: 'node-1',
    type: 'user',
    content: 'Create a high-performance database schema for a multi-tenant SaaS application with row-level security.',
    timestamp: Date.now() - 300000,
    x: 80,
    y: 260,
    width: 260
  },
  {
    id: 'node-2',
    type: 'ai',
    provider: 'claude',
    title: 'Database Strategy',
    content: `I recommend using a relational database with **row-level security**. Here is the breakdown:

\`\`\`prisma
model Tenant {
  id    String @id @default(uuid())
  name  String
  users User[]
}

model User {
  id       String @id @default(uuid())
  email    String @unique
  tenantId String
  tenant   Tenant @relation(fields: [tenantId])
}
\`\`\`

Key considerations:
- **RLS Policies** enforce tenant isolation at the DB level
- Use **connection pooling** with PgBouncer for scale
- Add **composite indexes** on (tenantId, createdAt) for common queries`,
    timestamp: Date.now() - 240000,
    responseTime: 2.1,
    tokens: 420,
    x: 440,
    y: 220,
    width: 400
  },
  {
    id: 'node-3',
    type: 'ai',
    provider: 'gemini',
    title: 'Alternative: Discriminator Column',
    content: `For high-scale multi-tenancy with **thousands of tenants**, a **Discriminator Column** approach offers better performance:

- Single shared schema, \`tenant_id\` column on every table
- 20% lower latency on queries (benchmarks)
- Simpler migration path
- Trade-off: weaker data isolation

**Performance comparison:**
| Approach | Query Latency | Isolation | Migration |
|----------|--------------|-----------|-----------|
| Schema-per-tenant | ~45ms | Strong | Complex |
| Discriminator | ~36ms | Moderate | Simple |`,
    timestamp: Date.now() - 200000,
    responseTime: 1.8,
    tokens: 310,
    x: 940,
    y: 140,
    width: 420
  },
  {
    id: 'node-4',
    type: 'ai',
    provider: 'codex',
    title: 'Hybrid Approach',
    content: `Consider a **hybrid approach** combining both strategies:

1. **Critical data** (billing, PII) → Schema-per-tenant
2. **Shared data** (logs, analytics) → Discriminator column
3. **Caching layer** with Redis for hot tenant data

\`\`\`sql
-- RLS Policy Example
CREATE POLICY tenant_isolation ON orders
  USING (tenant_id = current_setting('app.tenant_id')::uuid);
\`\`\`

This gives you **strong isolation where it matters** and **performance where it counts**.`,
    timestamp: Date.now() - 180000,
    responseTime: 2.4,
    tokens: 385,
    x: 940,
    y: 480,
    width: 420
  }
]

// ── 预置连线 ──
export const MOCK_EDGES = [
  { from: 'node-1', to: 'node-2', type: 'direct' },
  { from: 'node-2', to: 'node-3', type: 'comparison' },
  { from: 'node-2', to: 'node-4', type: 'comparison' }
]
