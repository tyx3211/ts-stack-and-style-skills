# Project Structure Reference

## Monorepo Layout

```txt
repo/
  apps/
    web/
      src/
        routes/
        pages/
        features/
        components/
        queries/
        stores/
        forms/
        lib/
        main.tsx or main.ts

    api/
      src/
        app.ts
        server.ts
        context.ts
        middleware/ or plugins/
        modules/
          user/
            user.route.ts
            user.service.ts
            user.repo.ts
            user.policy.ts
          order/
            order.route.ts
            order.service.ts
            order.repo.ts
        infra/
          db.ts
          redis.ts
          logger.ts
          queue.ts
          telemetry.ts

    worker/
      src/
        index.ts
        jobs/
          send-email.job.ts
          import-csv.job.ts

  packages/
    contracts/
      src/
        user/
          user.schema.ts
          user.contract.ts
        order/
          order.schema.ts
          order.contract.ts
        index.ts

    db/
      src/
        schema.ts
        migrations/

    ui/
      src/
        components/

    config/
      eslint/
      tsconfig/
```

## API Type Flow

```txt
schema
  -> oRPC contract
  -> backend implementation
  -> generated OpenAPI
  -> typed client
  -> TanStack Query
  -> React/Vue component
  -> form validation
```

## Repo Rules To Add

Use these as AGENTS.md or project rule candidates:

```txt
1. service/usecase must not import Hono/Elysia/Vue/React.
2. route/controller code must not contain complex business logic.
3. frontend code must not handwrite API response DTOs that already come from contracts.
4. the same server resource cache must not live in both TanStack Query and Pinia/Zustand.
5. API boundary code must not use any as an escape hatch.
6. public routes must have schema/contract coverage.
7. mutations must declare query invalidation or optimistic update behavior.
8. public APIs must be represented in generated OpenAPI.
9. database entities must not be returned directly as API responses.
10. usecases return domain/application results, not HTTP responses.
11. permission checks live in policy/usecase, not scattered across components/routes.
12. background tasks go to queue/workflow instead of blocking requests.
13. CPU-heavy work goes to workers instead of blocking the event loop.
14. complex features need handler/usecase/contract tests.
15. complex forms should reuse or derive from boundary schemas where practical.
16. new server-side TS packages should prefer Node.js 24 or latest stable Bun.
17. new server-side tsconfig baselines should prefer NodeNext module/moduleResolution and esModuleInterop: true.
```

## TSConfig Baseline

Use this as the default for new server-side packages unless a framework owns tsconfig or the project is intentionally CommonJS:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true
  }
}
```

Treat migration from CommonJS to `NodeNext` as an explicit task, not as incidental cleanup.

## Hono Module Shape

```txt
modules/user/
  user.route.ts     thin transport glue
  user.service.ts   business workflow
  user.repo.ts      database/cache access
  user.policy.ts    authorization/domain policy
```

`user.route.ts` can import Hono and framework adapters. `user.service.ts`, `user.repo.ts`, and `user.policy.ts` should remain framework-independent.

## Elysia Module Shape

```txt
modules/user/
  user.route.ts     Elysia route/plugin or oRPC adapter glue
  user.model.ts     Elysia-only local model if needed
  user.service.ts   business workflow
  user.repo.ts      database/cache access
  user.policy.ts    authorization/domain policy
```

When the project is oRPC-first, prefer contract schemas in `packages/contracts` and keep `user.model.ts` for local/internal Elysia endpoints only.
