# 错误处理

使用本政策明确区分预期失败、非预期缺陷、传输映射和异步终止。

## 选择失败通道

| 条件 | 默认通道 |
|---|---|
| 调用方必须分支、重试、补偿，或拒绝一个合法业务请求 | `Result<T, E>`，其中 `E` 是封闭的功能专属联合 |
| 值只是不存在 | `T | null | undefined` |
| 缺失有多种业务含义 | tagged union（带标签联合） |
| 程序员错误、不可能状态、可信状态损坏、非法启动配置 | `throw Error` |
| 框架必须依靠异常完成 rollback 或终止 | 内部 throw，在所属边界转换 |

不要把每个 helper 都 Rust 化。纯转换函数应直接返回值。只有当调用方能处理错误时，才在 domain rule、usecase 和 adapter 中高频使用 Result。

## 局部建模类型化错误

- 为每个 feature 或 usecase 定义封闭错误联合，不要定义一个覆盖全仓的 `AppError`。
- 每个 variant 使用稳定 tag，只携带决策或诊断所需上下文。
- 多种 transport 共用时，把 `code`、`kind`、`retryable`、`safeMessage`、`source`、`traceId` 等平台分类与功能 variant 分开。
- 穷尽映射联合。优先使用带类型的 `switch` 加 `assertNever`，并开启仓库的 exhaustive-switch lint 门禁。
- 公共响应不得暴露原始数据库消息、SDK 对象、stack trace 或 `cause`。

## 在信任边界校验

- 把请求和公共 contract 输入按 `unknown` 解析。schema 失败是预期 validation result，通常映射为稳定的 4xx contract error。
- 校验外部 HTTP、SDK、queue、cache payload。解码失败属于 protocol / infrastructure error，不是非法用户输入。
- 可信持久状态或 domain 状态不符合 schema 时，按数据损坏或不变量破坏处理。隔离或停止受影响操作、记录诊断，不得静默填入默认值。
- 启动配置非法时终止启动，不得以部分配置状态运行。
- 只有当外围异常边界明确拥有该失败时才使用 throwing schema API；否则优先使用 safe / result parse。

## 只转换一次外部失败

在 DB、HTTP、SDK、filesystem、queue 和 cache adapter 中：

1. 只有 adapter 能增加语义、重试、清理或转换时，才 `catch unknown`。
2. 收窄或规范化捕获值；JavaScript 可以抛出非 `Error` 值。
3. 上层必须重试、降级、补偿或选择响应时，返回类型化 infrastructure variant。
4. 否则抛出带 `cause` 的规范化 `Error`，交给操作终止边界处理。

不要 catch 后原样 rethrow。不要每一层重复 log。同一失败跨越语义边界时补充上下文，在 request、job、task 或 process 终止处只记录一次。

## 接管 Promise rejection

- 每个 Promise 都必须被 await、return、显式 catch，或注册给 task supervisor。
- `void task()` 只丢弃返回值，不处理 rejection。仅当确实需要 detached execution，并且 handler 会建立最终失败状态时，才使用 `void task().catch(reportFailure)`。
- 不要把无保护的 async callback 传给忽略 Promise 返回值的 API，包括 DOM / EventEmitter 风格 callback 和 `forEach`。应包装 callback 并在内部处理 rejection。
- catch handler 必须明确 recovery、translate 或 rethrow。返回普通值会把链恢复为 fulfilled；空 catch 会静默删除失败。
- 成组工作需要 fail-fast 时使用 `Promise.all`；只有明确建模并检查部分失败时才使用 `Promise.allSettled`。
- 全局 `unhandledRejection`、`uncaughtException`、浏览器 `error` 和 `unhandledrejection` hook 只负责 observability / fatal policy，不是业务恢复机制。

## 终止边界

- HTTP / RPC 边界：穷尽映射预期 variant；未知缺陷返回通用 500；附加 request / trace id；不得把全局 handler 当正常业务控制流。
- Worker / job 边界：记录最终 attempt、retryability、job identity 和 trace；按显式策略 ack、retry、dead-letter 或 fail。
- 浏览器边界：上报缺陷，并把已损坏的交互或共享状态切换到 error boundary / fatal state，不得假装恢复成功。
- Process 边界：未捕获缺陷发生后，只做有时限的必要清理；process 状态可能不可靠时退出，由 supervisor 重启。

预期业务拒绝应使用适当的较低日志级别或 metric；非预期缺陷只记录一次结构化上下文和内部 cause。

## 库升级阈值

- 从原生 discriminated union 和最小 Result 类型开始。
- 只有重复的 async Result 组合与 early-return 样板已经明显损害可读性时，才引入 neverthrow；同一 feature 不得混用多种 Result 表示。
- 只有模块需要类型化 retry / timeout / cancellation、structured concurrency、resource lifetime 或复杂外部编排时，才把 Effect 作为明确的 module island 引入。预期失败放入 typed error channel，缺陷仍作为 defect，并在单一 Promise / transport 边界 fold 两者。
- 不要只为消灭 `throw` 引入 Effect；没有明确架构决策，不得让 Effect island 扩散。

## 事务与清理

- ORM 必须依靠异常触发 rollback 时，可以在 transaction 内 throw。在 transaction 外捕获，再按操作的公共错误 contract 转换。
- 原始失败保持 primary。rollback、close、release 或 compensation 的失败只能作为 secondary context 附加 / 记录，不得静默覆盖原始 cause。
- cleanup 失败且状态不再可信时，销毁或隔离相关资源。
- 除非 transaction 或 compensation contract 能证明结果状态有效，否则不得在 partial write 后继续运行。

## 审查与测试门禁

- 审查每个操作的 expected、infrastructure、invariant 和 fatal 四类失败。
- 拒绝业务 `throw` 与 Result 混用、隐藏新 variant 的 catch-all default、空 catch、floating Promise、重复日志、内部消息泄漏和静默 fallback。
- 测试每个错误 variant 到 transport / job 结果的映射、非法 schema 输入、adapter rejection 规范化、retry / cancellation、cleanup 失败和 fatal-boundary 行为。
- 可执行 lint 政策放入 `strict-typescript-source-gates`；本文件只拥有错误语义和责任边界。
