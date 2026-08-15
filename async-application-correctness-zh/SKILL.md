---
name: async-application-correctness-zh
description: 用于中文工作流中编写、审查、调试或设计 TypeScript/JavaScript 异步应用，尤其涉及 command queue、互斥锁、actor、取消、超时、背压、本地 SQLite、PostgreSQL、文件或设备副作用、React Ink/CLI 入口、Electron IPC、本地 BFF/sidecar、worker、桌面单实例、多进程、关闭、崩溃恢复或确定性并发测试时。
---

# 异步应用正确性

## 核心契约

把调度、事务性、进程所有权和崩溃恢复视为四种独立契约。

- `async` 会产生逻辑交错，但不等于必须使用 command queue。
- command queue 只为一个 owner 排序；它不是数据库事务、跨进程锁或持久化任务系统。
- mutex 保护临界区；queue 还必须定义准入顺序、背压、取消与关闭语义。
- CAS/version 检查拒绝陈旧提交，但不会串行化无关工作。
- SQLite/PG 只能保护其内部状态，不能回滚文件、设备、HTTP 或已发送消息。
- 内存 queue 会随崩溃消失；需要恢复的任务必须在确认接受前持久化。

选择 queue、mutex、CAS、SQLite、PostgreSQL、outbox 或持久化 job table，或设计并发/崩溃测试时，读取 [references/decision-and-test-matrix.md](references/decision-and-test-matrix.md)。

涉及 PostgreSQL schema、Drizzle/Kysely 事务、Redis、幂等记录、outbox 表或 migration 时，同时加载 `backend-data-correctness-zh`。

## 先建立执行模型

修改代码前明确：

1. 权威状态，以及所有外部投影和副作用。
2. 每一个 writer：handler、timer、retry、UI 事件、worker、CLI 进程、Electron window、sidecar、其他服务实例。
3. 所有权边界：JS turn、线程、进程、主机还是数据库。
4. 业务不变量，以及建立它的最小 commit point。
5. 成功的含义：已接受、已提交、已应用、已观测或已持久化入队。
6. commit 前后取消、超时、关闭和崩溃分别意味着什么。

不能从“只有一个 UI/用户/renderer/JS 线程”推导出串行。双击、重试、timer、后台同步、多窗口和 `await` 后恢复都会产生逻辑并发。

## 判断是否需要 Queue

不要只因函数是 `async` 就增加 queue。

同时满足下列条件时，默认无需应用层 queue：

- 一个进程、一个 JS 线程独占状态。
- 完整修改是短小的同步 run-to-completion 区域。
- 区域内没有 `await`、callback 重入、worker 或第二个进程写入。
- 数据库事务或文件原子替换才是真正 commit 边界。

当一个 owner 必须为多个可重入调用者排序、限制压力、集中准入或串行化一致性域时，使用 command queue/actor。长 I/O 或 CPU 工作能移出队列时，只串行提交阶段。基于旧 snapshot 计算的结果在提交前必须重读状态或执行 version/CAS 检查。

调用者只需互斥、不需要 FIFO、缓冲和命令生命周期时使用 mutex。锁域要短，且不能把进程内 mutex 当作跨进程协调。

仅当资源 key 独立且稳定时使用 per-resource queue。真正只有一个一致性域时先用全局 queue；只有证明操作可交换且确有吞吐需求后再拆分。

对于明确只允许单实例、只有一个状态 owner、且不要求崩溃恢复的小型 GUI / TUI，如果 mutation 会跨 `await` 交错，那么进程内 command queue 是很合适的低复杂度默认方案。必须真正执行单实例承诺，让所有 writer 都经过该 owner，并写清楚进程崩溃会丢失排队工作。这个 owner queue 不等于 UI debounce 或禁用按钮。只要需要重启恢复、多进程、数据库约束或持久历史，就优先直接使用 SQLite。

不要只按 HTTP method 分类。应按操作影响的状态和不变量分类：POST 可能因原子 SQL 而可并发，名义上的 query 也可能触发不安全的 lazy write。

## SQLite 与 PostgreSQL 边界

本地 CLI、桌面应用或单 sidecar 使用 SQLite 时：

- 优先设立一个明确 DB owner 和短事务。
- 同步 SQLite transaction 且内部无 `await` 时，已经形成进程内 run-to-completion 临界区；前置 queue 可选。
- 使用 async driver 时，必须保证事务独占连接、SQL 有序、只用 `tx`，且事务内没有无关外部等待。
- 即使写入已串行，也要用 constraint 和 conditional update 表达不变量。
- 明确会写的事务可有意使用 `BEGIN IMMEDIATE`，并定义 busy timeout/retry。
- 需要 reader/writer 并存时可使用 WAL，但 SQLite 仍同时只有一个 writer。

多个进程共享 SQLite 时，每个进程一个内存 queue 不够。优先选择：

1. 强制应用单实例。
2. 只让一个 daemon/sidecar 拥有数据库，其他 client 通过 RPC 调用。
3. 接受 DB 锁竞争，并实现有界 `BUSY` retry、幂等和外部资源协调。

预期模型包含多服务实例、高写并发或复杂并发事务时改用 PostgreSQL。不要在每个服务实例里重造“全局 command queue”。用原子 SQL、constraint、行锁、optimistic version、事务级 advisory lock、Serializable retry 和幂等保护不变量。进程内 queue 只处理本地背压或进程独占资源。

## 文件、设备、HTTP 与其他副作用

绝不能把 queue 或数据库事务描述成跨外部系统原子性。

- 文件写入使用唯一临时文件，按耐久性需要 flush/fsync，原子 rename/replace，并在启动时清理或 reconcile。
- SQLite/PG 加外部系统时，在短事务中记录 desired state 或 outbox/job，执行幂等 apply，再记录 observed/applied state，并在中断后 reconcile。
- 用 version/hash/fencing 检查阻止旧任务覆盖更新的 desired state。
- 外部 HTTP、设备 I/O、用户输入和长计算必须在数据库事务和持 mutex 区域之外。
- 定义 commit 后、响应前报错是否属于 uncertain outcome，并用 operation/idempotency key 支持安全重试。

对于低价值、可重算产物，删除并重算可能是正确恢复策略。把较重状态机留给用户原始数据、不可逆副作用和多系统真源。

## Electron、Sidecar、Ink 与 CLI

Electron 中：

- renderer 负责 UI，preload 是窄 capability bridge，main 是生命周期/安全控制面；非平凡应用让 sidecar/utility process 拥有本地业务状态。
- 实质性 BFF 的推荐基线：renderer 调一个窄 preload method；preload 调经过校验的 main-process handler；main 持有 authenticated loopback client/token 并调用 sidecar。不得把 generic network primitive 或 sidecar credential 交给 renderer。renderer 直连 sidecar 只有作为已记录的 least-privilege 例外，并覆盖 compromised-renderer test 时才允许。
- Electron IPC 适合少量 native 控制；较大 local BFF 使用 typed RPC/HTTP 边界，避免手写 IPC 框架。
- 启动状态 owner 或打开共享本地状态前，先取得 `app.requestSingleInstanceLock()`；通过 `second-instance` 把第二次启动意图转发给现有 owner。
- single-instance lock 是应用实例策略，挡不住外部编辑器、其他二进制、遗留 helper 或共享网络盘。
- sidecar 必须有 ready handshake、超时、鉴权后的本地 endpoint、父子所有权，以及 graceful/forced shutdown。要检测 orphan 和重复 owner。

React Ink/TUI 中：

- Ink 是 UI renderer，不是串行化边界。
- 预期快速按键、重复 submit、effect 重启、retry 与 cancel 会重叠。
- 禁用重复按钮只改善体验；正确性必须由 command/DB 层保证。

CLI 中：

- 默认每次 CLI 调用都是独立 OS 进程。
- 某次调用内部创建的 queue 无法协调并发调用。
- 使用 single-owner daemon、SQLite/PG 协调、合适的 OS lock，或每任务独立输出后原子发布。
- 明确 SIGINT/SIGTERM 在 commit 前后分别是否可重试。

worker 可以并行纯 CPU 计算：输入 snapshot，输出纯结果。除非架构显式转移所有权，否则不要给 worker DB connection、文件 ownership 或设备 writer；提交前再次校验 snapshot version。

## Queue 契约

实现或批准 queue 前必须明确：

- **Scope：** 全局、per-resource、per-process，还是跨进程持久化。
- **Ordering：** FIFO、priority、coalescing、latest-wins，还是无保证。
- **Poisoning：** 一个失败不能悄悄阻塞后续任务。
- **Cancellation：** 区分排队中取消和开始执行后取消。
- **Timeout：** 明确 caller timeout 是否取消任务，还是留下 uncertain outcome。
- **Backpressure：** 设置容量，并明确 reject、block、shed 或 coalesce。
- **Fairness：** 需要时防止 priority/hot-key 饥饿。
- **Reentrancy：** 禁止或显式处理运行中 command 再向同一串行 queue enqueue。
- **Shutdown：** 定义停止准入、drain deadline、abort 和强制退出。
- **Crash：** 明确 queued/running work 是丢失、重试还是从持久化状态恢复。
- **Observability：** 暴露 command id、resource key、排队时长、执行时长、结果和重试次数。

不要只写 Promise tail 就认为契约完整。失败任务不能 poison tail；为了保持 tail 存活而吞掉的内部 rejection，也不能让调用者收不到自己的错误。

## 验证工作流

1. 写出 invariant 和 owner map。
2. 标出每个 yield、commit、外部副作用、response 和 shutdown 边界。
3. 选择覆盖真实边界的最小机制。
4. 写确定性交错测试，不依赖反复跑 timing race。
5. 正确性跨越进程或持久化边界时，加入多进程和 crash injection。
6. 验证 timeout、cancel、duplicate delivery、shutdown 和 restart 后行为。

## 审查清单

- 是否错误地把 `async` 等同于必须 queue？
- queue/mutex 是否覆盖其声称 scope 内的每一个 writer？
- 是否把内存 queue 误当跨进程或持久化协调？
- 是否正确区分 SQLite 与 PG 的职责？
- DB 不变量是否由 constraint、conditional write、lock 或 version 表达？
- 数据库事务或锁内是否包含外部/长时间 I/O？
- 旧计算结果能否覆盖新版本？
- success、timeout、cancel 和 uncertain outcome 是否明确？
- Electron single-instance 与 sidecar 生命周期顺序是否正确？
- 并发 CLI 进程或多个 window 能否访问同一资源？
- queue 契约是否覆盖 poison、cancel、backpressure、fairness、reentrancy、shutdown 和 crash？
- 测试是否主动制造具体交错和崩溃点？
