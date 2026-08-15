# Agent-Driven Reference Blueprint

This is a coherent starting point for a cross-cutting agent-driven product. It is a recommendation, not a mandatory topology. Preserve the stated ownership and artifact invariants when adapting it.

## Suggested Package And Runtime Graph

```text
apps/web                 -> contracts, api-client, ui
apps/api                 -> contracts, application, data
apps/worker              -> contracts, application, data
apps/desktop-main        -> desktop-preload-contract, desktop-sidecar-client
apps/desktop-renderer    -> desktop-preload-contract, ui
apps/desktop-sidecar     -> contracts, application, data

packages/contracts       -> schemas + oRPC contracts; no framework or DB imports
packages/api-client      -> generated/inferred transport client
packages/application     -> usecases and ports
packages/data            -> PostgreSQL/Redis adapters and migrations
packages/desktop-preload-contract -> narrow renderer/main DTO and capability API
packages/desktop-sidecar-client   -> main-owned authenticated local RPC client
packages/ui              -> framework-compatible shared UI only when needed
packages/config          -> shared lint/tsconfig/test config
```

Applications remain leaf consumers. Split fewer packages for a small product; split more only where ownership, runtime, release, or artifact boundaries are real.

## Contract And oRPC Baseline

- Put runtime schemas, oRPC contracts, stable error variants, and public DTOs in `packages/contracts`.
- Keep router implementations in the owning application, not in the contract package.
- Consume contracts through public package exports; choose dist-first consumption when Node, Vite, tests, and published consumers need one identical runtime artifact.
- Generate and diff OpenAPI when it is a public/interoperability artifact; internal TS clients may infer directly.

Current Hono integration uses `RPCHandler` from `@orpc/server/fetch`:

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

Verify this adapter against the pinned oRPC release instead of copying it indefinitely. See [the official Hono adapter](https://orpc.dev/docs/adapters/hono).

## Electron And Sidecar Baseline

For a substantial local Node BFF, prefer this capability chain:

```text
renderer
  -> one narrow preload method
  -> validated and authorized main-process IPC handler
  -> main-owned authenticated loopback oRPC/HTTP client
  -> sidecar business-state owner
```

The main process holds the sidecar bearer capability. The renderer receives neither the token nor generic IPC/network primitives. Acquire the Electron single-instance lock before starting the sidecar or opening shared state. Make readiness, timeout, parent death, graceful/forced shutdown, orphan cleanup, and duplicate owner behavior executable integration tests.

Direct renderer-to-sidecar access is an exception, not a forbidden impossibility. If a project's latency or streaming shape requires it, issue a least-privilege renderer capability, define the compromised-renderer blast radius, and compare denial tests against the main-proxy baseline.

## Suggested Task Graph

```text
generate/contracts -> typecheck -> lint -> test
                                  \-> audit:type-escapes
typecheck + lint + tests + audits -> build:artifact
build:artifact -> packed/consumer/runtime fixtures
all required evidence -> verify
```

Give every task declared inputs and outputs. Cache only deterministic tasks. Validate generated drift and packed consumers in clean CI. The exact runner may be npm/pnpm scripts, Turbo, Nx, or another tool; the graph is the contract.

## How An Agent May Deviate

Before choosing another organization, state:

1. the workspace/package DAG and runtime artifact owner;
2. the canonical schema and public export boundary;
3. the renderer/main/sidecar capability path;
4. the authoritative typecheck, typed-lint API, artifact build, and aggregate verdict;
5. consumer, denial, concurrency, and crash evidence.

A better project-specific design is welcome when it satisfies those invariants more simply. Compare it against this blueprint explicitly so the review is grounded rather than aspirational.
