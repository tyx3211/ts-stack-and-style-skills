# 决策与测试矩阵

## 机制决策表

| 场景 | 首要机制 | Queue 的角色 | 必测内容 |
|---|---|---|---|
| 单 JS 线程、同步 SQLite-only 修改 | 短事务、constraint、run-to-completion | 仅可选组织层 | 重复请求、rollback、affected-row invariant |
| 单进程 async SQLite transaction | 事务独占 connection、只用 `tx`、短 scope | 可选 DB actor/背压 | 强制交错、connection bleed、`BUSY` |
| 跨 `await` 的内存 read/modify/write | Mutex/queue 或 versioned CAS | 串行提交或拒绝陈旧任务 | 在读写间 barrier、旧 version 拒绝 |
| 一个 sidecar 服务多个 window | 唯一 state owner，query/command 分离 | 必要时全局或 per-key 排序 | 同 key 顺序、异 key 并行、retry |
| 多进程共享 SQLite | 唯一 owner 或 SQLite lock+有界 retry | per-process queue 不是全局 queue | child process 竞争、kill/restart、最终 invariant |
| 多服务实例共享 PostgreSQL | 原子 SQL、constraint、lock、retry、幂等 | 只做本地背压 | 并发 SQL、死锁/序列化重试、重复投递 |
| DB 加文件/设备/HTTP | Outbox/job 或 desired/observed 状态机 | 只排序尝试 | 每个持久化/apply 边界 crash、reconcile |
| 长时间或可恢复任务 | 持久化 job table/queue、幂等 worker | 内存 queue 仅控制 executor 准入 | worker death、lease、重复领取、resume |
| 并发 CLI 调用 | Daemon、DB/OS 协调或独立输出+原子发布 | 单次 invocation queue 无效 | spawn N 个进程、SIGINT、同目标发布 |
| 单实例 Ink/Electron、一个进程 owner 的一致性域 | 强制唯一 owner；需要持久恢复或约束时增加 SQLite | Owner command queue 可低成本串行化跨 `await` mutation；UI debounce 只改善体验 | 双 submit、强制交错、绕过 owner、崩溃丢失契约 |
| 多进程或要求重启后持久恢复的桌面状态 | SQLite/daemon ownership、constraint、幂等、reconcile | 进程内 queue 只负责本地准入 | 多窗口/进程、`BUSY`、kill/restart、超时后 retry |

## Queue 与其他机制

- **Queue**：有序准入、容量控制或唯一 owner 的 command execution。
- **Mutex**：无需缓冲顺序时保护短临界区。
- **CAS/version**：允许投机并发，但拒绝旧提交。
- **SQLite transaction**：保证本地 DB 原子性，不推导文件/设备原子性。
- **PostgreSQL 并发控制**：保护多实例 DB invariant。
- **Outbox/committed job row**：把 DB commit 桥接到之后的外部 delivery。
- **Desired/observed state machine**：外部 target 必须收敛并报告 applied state。
- **Durable workflow**：跨长等待、人工输入或多个重试服务的执行。

组合使用很正常：sidecar 可用 queue 做本地准入、SQLite 做原子 metadata、versioned file replacement 做发布、startup reconcile 做崩溃恢复。

## 确定性交错 Harness

不要只把 race 重跑很多次。在语义边界插入可控 barrier：

```ts
type Gate = {
  reached: Promise<void>;
  release: () => void;
  wait: () => Promise<void>;
};

// Command A 读到 version 4 后暂停。
// Command B 提交 version 5。
// 放行 A，并要求其 CAS/version 检查拒绝旧提交。
```

在 read 后、validate 后、lock 前、commit 前、commit 后、external apply 前后和 response 前注入 gate；对每种 schedule 断言 invariant 与用户可见结果。

## Queue 契约测试

至少验证：

1. Task A reject 后 task B 仍执行，A 的 caller 仍收到 A 的错误。
2. 排队任务被取消后不会运行。
3. 运行中任务按声明策略接收取消、忽略取消或抵达 commit。
4. Caller timeout 不会被悄悄解释为 execution cancellation。
5. 超容量行为符合 reject/block/coalesce 契约。
6. Priority 与 hot key 不会超过声明界限地饿死普通任务。
7. 同一 queue 的递归 enqueue 会被拒绝或不会死锁。
8. Shutdown 停止准入、在 deadline 前 drain，并报告遗弃任务。
9. Process crash 能证明内存工作会丢失，或能从持久化记录恢复。

## SQLite 与多进程 Harness

- 创建临时数据库和带硬约束的 schema。
- spawn 独立 child process，不能用同进程 worker task 冒充。
- 用 `BEGIN IMMEDIATE`、conditional update 和人为 pause 制造竞争。
- 同时测试有界 retry 成功和 `SQLITE_BUSY` 耗尽。
- Writer 在 commit 前被 kill 应 rollback；commit 后、response 前被 kill 应支持幂等重试。
- 同时写文件时，在 fsync/rename 前后 kill，并运行 startup reconcile。

## PostgreSQL Harness

使用隔离的真实 PostgreSQL，主动制造：

- 由原子 SQL/version check 解决的 lost-update 候选。
- 行锁阻塞与 lock timeout。
- Serializable `40001` 与 deadlock `40P01`，验证整事务 retry。
- Commit 前后的重复 operation key。
- 多 worker 领取 outbox，但不产生重复 durable effect。

## Electron、Sidecar、CLI 与 Ink Harness

- 并发启动两个 Electron 实例；只有 winner 能启动 state owner，loser 通过 `second-instance` 转发意图。
- 延迟或破坏 sidecar ready handshake；验证 timeout、cleanup 且不遗留 orphan owner。
- 分别 crash main 与 sidecar；验证 ownership 和 restart policy。
- 从多个 BrowserWindow 发起写入，验证声称的 queue/DB scope。
- spawn 多个 CLI process 访问同一资源；不能用同进程并发函数代替。
- 发送快速重复 Ink input，在排队/已提交阶段分别 retry timeout 与 SIGINT。
- UI 禁用按钮和 debounce 只能是辅助体验，不能作为测试通过的正确性条件。

## Crash Matrix

对于 DB 加外部 target，在下列位置注入终止：

1. Desired/outbox commit 前。
2. Desired/outbox commit 后、apply 前。
3. 临时写入或外部请求中。
4. 原子 publish/apply 后、observed-state 更新前。
5. Observed-state 更新后、response 前。

重启后断言操作是不存在、pending、可安全重试、已识别为 applied，或明确要求人工介入；不能接受不可追踪的 half-state。
