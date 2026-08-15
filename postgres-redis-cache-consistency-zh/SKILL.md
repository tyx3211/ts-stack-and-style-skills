---
name: postgres-redis-cache-consistency-zh
description: 用于中文工作流中设计、实现、审查或测试以 PostgreSQL 为真源的 Redis 缓存、cache-aside 失效、read-your-write、版本化投影、旧值与负缓存、outbox/CDC 投影、会话撤销缓存、Redis lease、CAS、fencing token 或确定性缓存竞态测试。
---

# PostgreSQL–Redis 缓存一致性

## 目标

保持 PostgreSQL 权威，并准确声明每个 Redis 投影能够保证什么。不得暗示 DB 事务加一条 Redis 命令构成跨系统原子事务。

实现 Lua/Redis Function、outbox consumer、tombstone、fencing 或确定性并发测试时，读取 [references/protocol-and-testing.md](references/protocol-and-testing.md)。

## 工作流

1. 找出权威状态、聚合根以及影响缓存 DTO 的全部表。
2. 把读取契约分类为 `none`、`weak`、`read-your-write` 或 `versioned`。
3. 注册旧值预算、决策政策、miss 来源、失败行为、版本来源与写后协议。
4. 对 DB commit、Redis timeout、进程崩溃、淘汰、副本延迟、重复与乱序投递建模。
5. 命令与业务不变量留在 PostgreSQL；除非明确设计为权威子系统，否则 Redis 只是可重建投影。
6. 为所选契约添加确定性集成测试；不得只凭 happy-path 单测批准协议。

## 一致性注册表

要求每个缓存 adapter 暴露可审查的注册项：

```ts
type CacheConsistency = "none" | "weak" | "read-your-write" | "versioned";

type CachePolicy = {
  owner: string;
  aggregate: string;
  consistency: CacheConsistency;
  staleBudgetMs: number | null;
  maxTtlJitterMs: number;
  maxInFlightFillMs: number;
  maxReplicaLagMs: number;
  mayDriveBusinessDecisions: false;
  missSource: "primary" | "replica-allowed";
  redisFailure: "bypass-to-primary" | "serve-bounded-stale" | "fail-closed";
  writeProtocol: "none" | "delete-after-commit" | "version-floor" | "outbox";
  ttlSec: number;
  sourceVersion?: "aggregate-version" | "none";
};
```

不得让缓存裁决金额、库存、权益扣减、权限即时撤销、支付、订单流转或法律/医疗工作流。应在 PostgreSQL 中用约束、条件 SQL、锁或事务复核。

## 选择一致性契约

### `none`

强一致读、轻查询以及 correctness-critical 决策直接读取 PostgreSQL。

### `weak`

只有完整的历史 DTO 在已声明时间内允许旧值时，才使用普通 cache-aside：

```text
读：Redis hit -> 返回；miss/error -> 权威读取 -> best-effort 回填
写：PostgreSQL commit -> best-effort DEL
```

它只有在边界确实成立时才承诺有界旧值，而不承诺最新。必须验证并测试 `ttlSec * 1000 + maxTtlJitterMs + maxInFlightFillMs + maxReplicaLagMs <= staleBudgetMs`；其中 `ttlSec` 是基础 TTL，`maxTtlJitterMs` 是 writer 可能增加的最大正 jitter。不存在的组成项填零。也可以让 `ttlSec` 直接表示包含 jitter 的最大有效 TTL，并把 `maxTtlJitterMs` 设为零，但必须明确登记这一约定。任何组成项没有可信上界时，设置 `staleBudgetMs: null`，诚实描述为 best-effort stale，不能叫 bounded stale。不得用多个独立缓存碎片拼接 correctness-sensitive 视图。

### `read-your-write`

mutation 返回已提交的 DTO 与 version，并采用一种或多种方式：

- 用 mutation 结果更新调用方本地状态；
- 后续读取携带 `minVersion`；
- 调用方短时间绕过缓存；
- 直接读 PostgreSQL。

Redis version 小于 `minVersion` 即为 miss。副本延迟可能违反下限时，必须读取主库。

### `versioned`

仅在读取很热、重建昂贵、DTO 必须内部自洽、允许短暂旧值但不允许投影倒退时使用。

不检查 PostgreSQL 当前 version 时，只能保证：

- 值来自某个已提交聚合版本；
- 旧回填不能覆盖新回填；
- 读方能观察 source version；
- 投影内部自洽。

它不保证 PostgreSQL 最新版本。要求最新时，先从主库读取聚合当前 version；Redis 不满足该 version 就重建或直接读 PostgreSQL。

## 聚合版本与投影快照

使用单调递增的 `bigint` 聚合版本。所有可能改变投影的写入都必须在同一事务中 bump version。不得用时间戳冒充隐式 version。

用单条 SQL 或能保证所有参与行一致的数据库快照构建投影。给碎裂的多查询结果贴 version 标签不能使其自洽。

明确区分：

- 乐观锁 `expectedVersion`：防 lost update；
- 投影 `sourceVersion`：标识缓存快照来源；
- `minVersion`：读方要求的新鲜度下限；
- `floorVersion`：Redis 侧拒绝过期回填的下限。

它们可以共用聚合计数器，但协议职责不同。

## Version Floor 与同版本规则

优先使用显式 floor 状态：

```ts
type VersionedState<T> = {
  floorVersion: bigint;
  data?: { version: bigint; digest: string; value: T };
};
```

通过一个原子 Lua/Redis Function 执行：

```text
markFloor(v): floorVersion = max(floorVersion, v)
               data.version < floorVersion 时丢弃 data

put(v, digest, value):
  v < floorVersion 或 v < data.version 时拒绝
  v == data.version 时，只接受同 digest 的幂等重放
  否则保存完整值，并保留 max(floorVersion, v)
```

允许经过明确验证的同版本 floor→clean 转换。同版本不同 digest 是协议错误：拒绝并报警。简单的 `incoming.version >= current.version` 过于宽松。

versioned 协议不得用 `DEL` 代替 version floor。删除会清空栅栏，让旧的在途 miss 重新填入过期值：

```text
R1: miss -> 读 PostgreSQL v42 -> 暂停
W1: commit v43 -> DEL
R1: key 为空 -> 回填 v42
```

floor 至少保留到最大在途 read/fill 时长与协议失效恢复窗口结束。淘汰或过期会摧毁 Redis 侧栅栏；此后把该项视为不可信 miss：strict 或 `minVersion` 读取必须查询主库后才能接受或重建数据。缺少该 fallback 时，必须声明协议已降级为 weak consistency。

负缓存与删除要写入带版本的 `missing`/tombstone。删除和撤销是状态转移，不是没有历史。

## Commit 与失败语义

不得在 PostgreSQL 事务中调用 Redis；Redis 不会随 PostgreSQL rollback。

commit 后：

- weak cache：best-effort DEL；错误/超时不回滚业务状态；
- versioned cache：best-effort `markFloor` 或 `put`；不得退化为普通 DEL；
- 必须最终完成的失效：在业务事务中写 outbox；
- 强一致/最新读取：无论失效状态如何都查询 PostgreSQL。

把 Redis 网络错误视为 `unknown`，而不是命令确定未执行。重试必须幂等。记录 bypass、stale hit、floor rejection、digest conflict、outbox lag、retry 与 dead letter 指标。

内存中的 after-commit callback 可能在 DB commit 后丢失；只有允许 TTL 有界旧值时才可使用。必须跨进程故障可靠投递时使用 PostgreSQL outbox。

## Outbox 与投影 Consumer

在聚合变更的同一事务中写 `{eventId, aggregateId, version, type}`。强制 `eventId` 唯一，消费幂等。

选择一种事件模型：

- **状态通知：** 按聚合 high-water mark 合并，从权威库加载当前完整状态，再按 version-floor 协议发布。重复或乱序的 `42,44,43` 最终收敛到至少 44。
- **增量事件：** 保持每个聚合的顺序，检测 version gap，并重放缺失 delta。事件不是完整状态时，禁止直接跳到最大 version。

Redis 仍是最终一致投影。根据 PostgreSQL desired/current version 做 reconcile 并监控 lag。`NOTIFY` 只能唤醒 worker，不是可靠队列或真源。

## 会话撤销：诚实声明

PG 真源的 cache-aside session 即使带 version，也不能宣称即时撤销。DB commit 与 Redis floor/tombstone 发布之间，缓存的 valid 值仍可能被接受；淘汰也可能清掉 Redis 栅栏。

必须明确选择一种契约：

- 有界撤销延迟；
- 权威校验读取主库；
- 或把 Redis 明确定义为 fail-closed 的权威 session store，并设计持久化、HA、内存和禁止淘汰政策。

把 logout 建模成推进 version 到 `revoked`。tombstone 至少保留到凭据剩余生命周期加最大在途 fill 时间结束。不得复用 `sid`/`jti`；随机凭据 ID 至少使用 128-bit CSPRNG 熵。64-bit 整数适合单调 version，不适合安全 token。

## Lock 与 Fencing

区分 ownership 与 fencing：

- 随机 lock token 只支持 compare-token-then-delete；
- fencing token 必须单调递增，并由实际接收写入的持久资源校验。

lease 过期不会阻止暂停的 holder 恢复。sink 不拒绝旧 fence，锁就不能保护正确性。未经 failover 与持久化审计，不得假设 Redis `INCR` 是安全的跨资源 fence。PostgreSQL 所有的状态优先使用条件更新、行锁或事务级 advisory lock。

只为减少重复回填的 Redis lease 应称为 `cache-fill mutex`。获得后再次检查缓存，限制等待时间，并保留 fallback。它负责降载，不是业务正确性锁。

## 必须设置的门禁

- 禁止 route/usecase 与 PostgreSQL transaction callback 导入 raw Redis client。
- 每个新缓存必须在评审中提交注册项与 stale budget。
- `minVersion`、权威撤销和严格投影重建必须读主库。
- 必测：DEL 后旧 miss 回填、writer 乱序、Redis timeout/unknown、commit 后进程死亡、副本延迟、outbox 重复/乱序、同版本 digest 冲突、lease 过期旧 holder。
- weak cache 只按声明的旧值上限验证；不得用测试意外把它升级为强一致契约。
