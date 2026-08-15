# Agent-Driven 推荐参考实现

这是一份面向跨域 agent-driven 产品的完整起点，是建议而不是强制 topology。按项目特点调整时，应保留下述 ownership 与 artifact invariant。

## 建议 Package 与 Runtime Graph

```text
apps/web                 -> contracts, api-client, ui
apps/api                 -> contracts, application, data
apps/worker              -> contracts, application, data
apps/desktop-main        -> desktop-preload-contract, desktop-sidecar-client
apps/desktop-renderer    -> desktop-preload-contract, ui
apps/desktop-sidecar     -> contracts, application, data

packages/contracts       -> schema + oRPC contract；无 framework/DB import
packages/api-client      -> generated/inferred transport client
packages/application     -> usecase 与 port
packages/data            -> PostgreSQL/Redis adapter 与 migration
packages/desktop-preload-contract -> 窄 renderer/main DTO 与 capability API
packages/desktop-sidecar-client   -> main 持有的 authenticated local RPC client
packages/ui              -> 只有确需时才放 framework-compatible shared UI
packages/config          -> shared lint/tsconfig/test config
```

App 保持 leaf consumer。小产品可以减少 package；只有 ownership、runtime、release 或 artifact boundary 真实存在时才继续拆。

## Contract 与 oRPC 基线

- `packages/contracts` 放 runtime schema、oRPC contract、稳定 error variant 与 public DTO。
- Router implementation 留在 owning app，不进入 contract package。
- 通过 public package export 消费 contract；Node、Vite、test、published consumer 必须看到同一 runtime artifact 时使用 dist-first。
- OpenAPI 是 public/interoperability artifact 时生成并 diff；内部 TS client 可直接 inference。

当前 Hono integration 使用 `@orpc/server/fetch` 的 `RPCHandler`：

```ts
const handler = new RPCHandler(router);

app.use("/rpc/*", async (context, next) => {
  const { matched, response } = await handler.handle(context.req.raw, {
    prefix: "/rpc",
    context: await buildContext(context),
  });
  if (matched) return context.newResponse(response.body, response);
  await next();
});
```

必须按锁定的 oRPC release 验证 adapter，不能无限期复制示例。见[官方 Hono adapter](https://orpc.dev/docs/adapters/hono)。

## Electron 与 Sidecar 基线

对于实质性的本地 Node BFF，优先这条 capability chain：

```text
renderer
  -> 一个窄 preload method
  -> 校验并授权的 main-process IPC handler
  -> main 持有的 authenticated loopback oRPC/HTTP client
  -> sidecar business-state owner
```

Main 持有 sidecar bearer capability；renderer 既不拿 token，也不拿 generic IPC/network primitive。启动 sidecar 或打开共享状态前先取得 Electron single-instance lock。Ready、timeout、parent death、graceful/forced shutdown、orphan cleanup 与 duplicate owner 都要成为可执行 integration test。

Renderer 直连 sidecar 是例外，不是绝对禁止。项目若因 latency/streaming 确需直连，应发放 least-privilege renderer capability，定义 compromised-renderer blast radius，并把 denial test 与 main-proxy baseline 对比。

## 建议 Task Graph

```text
generate/contracts -> typecheck -> lint -> test
                                  \-> audit:type-escapes
typecheck + lint + tests + audits -> build:artifact
build:artifact -> packed/consumer/runtime fixtures
all required evidence -> verify
```

每个 task 声明 input/output，只缓存 deterministic task。Clean CI 检查 generated drift 与 packed consumer。具体 runner 可以是 npm/pnpm scripts、Turbo、Nx 或其他工具；graph 才是 contract。

## Agent 如何偏离

选择其他组织方式前，写明：

1. workspace/package DAG 与 runtime artifact owner；
2. canonical schema 与 public export boundary；
3. renderer/main/sidecar capability path；
4. authoritative typecheck、typed-lint API、artifact build 与 aggregate verdict；
5. consumer、denial、concurrency 与 crash 证据。

只要更简单地满足这些 invariant，就欢迎更好的 project-specific design。必须显式与本 blueprint 对比，让 review 有基准而不是停留在愿景。
