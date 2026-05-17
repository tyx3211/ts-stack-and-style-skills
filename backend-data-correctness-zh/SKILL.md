---
name: backend-data-correctness-zh
description: Use when writing, reviewing, or designing TypeScript backend data access in Chinese workflow contexts involving PostgreSQL, Drizzle, Kysely, Redis, cache adapters, transactions, concurrency control, idempotency, outbox, migrations, queues, or Hono/oRPC repository and usecase boundaries.
---

# 后端数据正确性

## 概览

对于 TypeScript 后端，把数据正确性视为硬契约。Hono、Elysia、Fastify 或 oRPC handler（处理器）应该保持轻薄；业务不变量应落在 usecase（用例）、repository（仓储）、数据库约束、事务和 cache adapter（缓存适配器）里。

默认立场：

- PostgreSQL 是业务事实源。
- Drizzle + `pg` 是默认 PostgreSQL 层；Kysely 可用于 SQL-heavy module（SQL 较重的模块）。
- 默认由 Drizzle 拥有 schema（数据库结构）和 migration（迁移）。不要让 Drizzle 和 Kysely 同时变成互相竞争的 schema / migration 事实源。
- Redis 是辅助层，用于 cache（缓存）、session（会话）、rate limit（限流）、idempotency hint（幂等提示）、短时状态、pub/sub（发布订阅）或 hot counter（热点计数）。
- Redis 不得保护金额、库存、权限、订单状态、法务流程状态等核心业务不变量。
- 在 Hono/oRPC 代码里，route handler（路由处理器）不得包含临时 SQL、Redis 命令、事务逻辑或缓存 key 构造。

## PostgreSQL 正确性

每个 write usecase（写用例）都必须声明并发策略：

- `atomic-sql`：一条条件写入表达业务不变量。
- `transaction-lock`：显式事务加 `SELECT ... FOR UPDATE`。
- `optimistic-version`：在 `WHERE` 中检查 `version` 列。
- `serializable-retry`：Repeatable Read 或 Serializable 事务加重试。
- `advisory-xact-lock`：短事务内使用 transaction-level advisory lock（事务级咨询锁）。
- `idempotency-record`：唯一幂等记录加业务写入。

规则：

- 默认隔离级别是 Read Committed。
- 单条写 SQL 本身已经在 PostgreSQL 的隐式事务里执行，不要为了形式感添加显式事务。
- 多语句不变量、先读后写、锁作用域、隔离级别、advisory lock、outbox（事务外发箱）和幂等记录必须使用显式事务。
- 优先使用原子条件写入，而不是应用层先读再写。
- 唯一性、外键、检查类不变量必须落到数据库约束里。应用层检查不够。
- 关键 `update` 和 `delete` 必须检查 `returning()` 行或 affected rows（受影响行数）。
- 事务回调内必须使用传入的 `tx`；不得偷偷调用全局 `db`。
- 从 transaction callback（事务回调）正常返回会提交已经完成的写入。如果部分写入必须回滚，应抛错、使用项目统一回滚 helper，或调用 ORM 的 rollback API。
- 事务要短。事务内不得调用外部 HTTP、发送邮件、推送不可回滚副作用或执行长循环。

Drizzle 原子更新：

```ts
const [row] = await db
  .update(inventory)
  .set({
    stock: sql`${inventory.stock} - ${qty}`,
  })
  .where(and(eq(inventory.sku, sku), gte(inventory.stock, qty)))
  .returning({
    sku: inventory.sku,
    stock: inventory.stock,
  });

if (!row) {
  return { ok: false, reason: "insufficient_stock_or_missing_sku" };
}
```

get-or-create 必须使用唯一约束加 `ON CONFLICT`：

```ts
const [inserted] = await db
  .insert(users)
  .values({ id, email, name })
  .onConflictDoNothing({ target: users.email })
  .returning({
    id: users.id,
    email: users.email,
    name: users.name,
  });
```

如果 insert 没有返回行，必须用同一个唯一键读取已有行，并显式处理理论上“不应缺失”的异常情况。不要把 get-or-create 写成 `SELECT exists` 后再普通 `INSERT`。

状态转移必须把当前状态写进 `WHERE`：

```ts
const [order] = await db
  .update(orders)
  .set({
    status: "paid",
    version: sql`${orders.version} + 1`,
  })
  .where(
    and(
      eq(orders.id, orderId),
      eq(orders.status, "pending"),
      eq(orders.version, expectedVersion),
    ),
  )
  .returning({
    id: orders.id,
    status: orders.status,
    version: orders.version,
  });
```

先读后写必须加锁或使用 optimistic version（乐观版本）：

```ts
await db.transaction(async (tx) => {
  const [order] = await tx
    .select({
      id: orders.id,
      status: orders.status,
    })
    .from(orders)
    .where(eq(orders.id, orderId))
    .limit(1)
    .for("update");

  if (!order || order.status !== "pending") {
    return { ok: false };
  }

  return tx
    .update(orders)
    .set({ status: "cancelled" })
    .where(eq(orders.id, order.id))
    .returning();
});
```

`FOR UPDATE SKIP LOCKED` 只允许用于 job claiming（任务领取）、worker stealing（工作进程抢任务）和受控 backfill（回填）：

```ts
const rows = await tx
  .select({ id: jobs.id })
  .from(jobs)
  .where(eq(jobs.status, "pending"))
  .orderBy(desc(jobs.priority), jobs.createdAt)
  .limit(limit)
  .for("update", { skipLocked: true });
```

不得把 `SKIP LOCKED` 用于普通业务列表、权限检查、库存、金额或状态判断。

如果依赖 Drizzle 的 `.for("update")`、`.for("update", { skipLocked: true })` 或事务隔离级别配置，应锁定 Drizzle 版本，并补 integration test（集成测试）验证生成 SQL 和并发行为。这是正确性边界，不是格式细节。如果当前 Drizzle 版本不支持需要的锁形状，应把替代写法限制在 repository layer（仓储层）内，并使用参数化 `sql`、Kysely 或严格 review（审查）的 raw SQL。

## 事务重试

Repeatable Read 和 Serializable 事务必须使用统一 retry wrapper（重试包装器）。

规则：

- 重试 SQLSTATE `40001`（`serialization_failure`）。
- 通常也重试 `40P01`（`deadlock_detected`）。
- 重试整个 transaction callback（事务回调），而不是只重试中间某条 SQL。
- 必须有最大次数、指数退避和 jitter（抖动）。
- 不允许 agent 在每个 usecase 里随手写自定义重试循环。

```ts
const retryablePgCodes = new Set(["40001", "40P01"]);

export async function withSerializableRetry<T>(
  run: () => Promise<T>,
): Promise<T> {
  for (let attempt = 1; attempt <= 5; attempt += 1) {
    try {
      return await run();
    } catch (error) {
      if (!hasPgCode(error, retryablePgCodes) || attempt === 5) {
        throw error;
      }

      await sleep(20 * 2 ** (attempt - 1) + Math.floor(Math.random() * 20));
    }
  }

  throw new Error("unreachable retry state");
}
```

## Advisory Lock

当受保护资源属于 PostgreSQL 业务模型时，优先使用 PostgreSQL transaction-level advisory lock，而不是 Redis lock。

规则：

- 优先 `pg_advisory_xact_lock`，不要默认使用 session-level `pg_advisory_lock`。
- advisory lock 只用于短事务内的资源串行化。
- 持有 advisory lock 时不得调用外部 HTTP 或运行长任务。
- 不得用 advisory lock 替代唯一约束、状态机 `WHERE` 条件或幂等记录。

```ts
await db.transaction(async (tx) => {
  await tx.execute(
    sql`select pg_advisory_xact_lock(${namespaceId}, ${resourceLockId})`,
  );

  return runShortDatabaseOnlyCriticalSection(tx);
});
```

## Redis 正确性

Redis 正确性不是 PostgreSQL 正确性。Redis 单命令可以是原子的，`MULTI/EXEC` 会顺序执行命令，`WATCH` 可以提供 CAS（比较并交换）式乐观检查，Lua 或 Redis Functions 可以运行小型原子脚本。但 Redis transaction（事务）不提供 PostgreSQL 式 rollback（回滚）或完整隔离级别。

规则：

- Redis 不是业务事实源。
- 只做缓存的 Redis 默认不需要业务分布式锁。
- 业务代码不得直接调用裸 `redis.get`、`redis.set`、`JSON.parse(raw) as T` 或手写 key。
- Redis 访问必须通过 cache/session/rate-limit/idempotency adapter，并带 typed key builder（类型化 key 构造器）、schema 或 codec 解码、TTL 策略、owner（归属方）和失败行为。
- Redis key 应有 namespace（命名空间）和默认 TTL，除非明确声明为 managed persistent key（受管理持久 key）。
- 高流量 key 的 TTL 应加入 jitter。
- Redis 故障行为必须明确：fail open（失败放行）、fail closed（失败拒绝）或回源 PostgreSQL。
- Redis client（Redis 客户端）必须统一创建并跨请求复用，同时明确 error event（错误事件）、重连、超时和 offline queue（离线队列）策略，并通过应用的 shutdown path（关闭路径）释放。不得每个请求创建一个 Redis client。
- Redis 数据丢失、过期、被驱逐或持久化缺口必须有恢复路径；不要把 Redis durability（持久性）当作 PostgreSQL durability。

Cache adapter 形状：

```ts
type CacheCodec<T> = {
  encode: (value: T) => string;
  decode: (raw: string) => T;
};

type CacheEntry<T> = {
  key: string;
  ttlSec: number;
  codec: CacheCodec<T>;
};
```

Cache-aside 示例：

```ts
const cached = await redis.get(entry.key);

if (cached !== null) {
  return entry.codec.decode(cached);
}

const value = await loadFromPostgres();

if (value !== null) {
  await redis.set(entry.key, entry.codec.encode(value), {
    EX: entry.ttlSec + Math.floor(Math.random() * 30),
  });
}
```

## Redis Lock 与原子性

不要默认引入 Redis lock。如果缓存层出现 cache stampede（缓存击穿 / 大量同时回源），把这个机制称为 cache-fill mutex（缓存填充互斥），不要称为业务分布式锁。

允许用途：

- 防止重复生成昂贵缓存。
- 协调短时非核心外部操作，但前提是重复执行是安全的。
- 避免重复后台工作，且丢锁不影响业务正确性。

禁止用途：

- 保护库存、金额、权限、订单状态或核心工作流不变量。
- 替代 PostgreSQL 唯一约束、行锁、advisory xact lock、幂等记录或状态机更新。
- 长任务或需要严格正确性的外部 HTTP 调用。

如果使用 Redis lock：

- 必须用一条 `SET key token NX PX ttl` 获取锁。
- token 必须每次加锁唯一。
- 释放锁必须用 Lua 比较 token 后再删除。
- 禁止 `SETNX` 后再单独 `EXPIRE`。
- 禁止不比较 token 就 `DEL` 锁。
- 如果过期锁持有者仍可能写外部持久资源，需要 fencing token（栅栏令牌）。

Pipeline（流水线）不是事务。需要原子性时，使用单条 Redis 命令、`MULTI/EXEC`、`WATCH`、Lua 或 Redis Functions。

Redis Cluster 下，任何多 key 原子逻辑都必须声明 cluster 兼容性。必须原子处理的相关 key 应使用 hash tag，例如 `user:{123}:profile` 和 `user:{123}:settings`。

## 副作用、幂等与迁移

- 外部副作用应使用 outbox、after-commit hook（提交后钩子）或已提交 job row。不得在数据库事务内调用外部服务。
- 数据库提交前，不得把 Redis cache（缓存）写成最终状态。数据库成功提交后，应 invalidate / delete（失效 / 删除）受影响的 cache key，或者写入 outbox / job row 去执行失效。
- 会修改数据的 usecase 必须声明受影响的 cache key，或者说明不需要缓存失效的理由。
- 可重试 mutation（变更）必须幂等：支付、退款、提交订单、审批、导入、webhook、job、移动端提交。
- 关键幂等应由 PostgreSQL 唯一约束和记录支撑。Redis 可以辅助，但不应是唯一正确性层。
- 破坏性迁移必须使用 expand、backfill、switch、contract 流程。
- Drizzle 的 `sql` template expression（模板表达式）可用于参数化 SQL 片段。raw SQL 只能出现在 repository module（仓储模块），必须参数化，且不得用 `sql.raw` 拼接用户输入。
- 动态列名、排序键和表名必须使用 whitelist map（白名单映射）。

## 队列与 Worker

- 普通后端 job（任务）优先使用 PostgreSQL-backed job row（PostgreSQL 支撑的任务行）、pg-boss，或其他与 PostgreSQL 事实源匹配的持久队列。
- `FOR UPDATE SKIP LOCKED` 适合受控的 PostgreSQL job claiming（任务领取）和 backfill worker（回填工作进程）；它不是通用列表查询优化手段。
- 当 Redis 已经是系统接受的依赖，并且 BullMQ 的队列能力确实值得引入时，可以接受 BullMQ 自带的 ioredis 生态。
- 长流程、人审、跨服务重试，或者需要明确历史和 replay（重放）的工作流，使用 Temporal 或同等 durable workflow engine（持久工作流引擎）。

## Hono 与 oRPC 边界

- Hono/oRPC handler 只解析上下文、调用 usecase、映射响应。
- handler 不得直接构造 Redis key、运行 Drizzle 事务或拼装 SQL。
- repository 和 cache adapter 不得 import `Hono.Context`、Elysia context、React、Vue 或 request-scoped UI type（请求作用域 UI 类型）。
- Contract schema（契约 schema）拥有 API 输入输出。数据库行和 API 响应必须显式映射。

## Drizzle ESLint 门禁

使用 Drizzle 时，尽量开启 Drizzle ESLint 规则：

```js
{
  rules: {
    "drizzle/enforce-delete-with-where": "error",
    "drizzle/enforce-update-with-where": "error"
  }
}
```

如果当前无法使用插件，应通过 review、测试或本地 lint 规则执行同等政策。

## 类型检查性能偏好

对中大型 TypeScript 仓库，本地类型检查自检默认使用全量 `tsgo --noEmit --pretty false`。它通常已经够快、够稳。如果人类开发者明确表示耗时不可接受，并要求继续加速，优先考虑全缓存 incremental（增量）命令，例如 `tsgo --noEmit --incremental --tsBuildInfoFile .cache/tsgo.tsbuildinfo --pretty false`；一般不要把 watch mode（监听模式）当成性能路径。

## Review 清单

- 每个 write usecase 是否声明并发策略？
- 业务不变量是否由 PostgreSQL 约束、原子 SQL、锁或可重试事务兜住？
- 是否检查了 `returning()` 行或 affected rows？
- 事务内所有操作是否都使用 `tx`，而不是全局 `db`？
- 外部副作用是否在事务之外？
- RR / Serializable 事务是否通过 retry wrapper？
- Redis key、value、TTL、owner 和失败行为是否在 adapter 里声明？
- Redis 是否被排除在核心业务正确性之外？
- cache invalidation（缓存失效）和 cache miss（缓存未命中）行为是否明确？
- 迁移是否能安全生产发布？
- Hono/oRPC handler 是否轻薄，并且没有临时数据访问逻辑？
