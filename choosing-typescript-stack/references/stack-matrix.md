# Stack Matrix

## Common Foundation

| Layer | Default | Alternatives |
| --- | --- | --- |
| Runtime | Node.js 24 or latest stable Bun | Edge/serverless platform runtime when portability is primary |
| TypeScript module config | `module: "NodeNext"`, `moduleResolution: "NodeNext"`, `esModuleInterop: true` | Existing CommonJS projects only with explicit reason |
| API contract | oRPC contract-first + OpenAPI | Hono RPC for lightweight internal calls, tRPC for internal full-stack monorepo |
| Schema | Valibot or Zod | ArkType for advanced type expression, Effect Schema for effect-heavy domains |
| Database | PostgreSQL + Drizzle | Kysely for SQL-heavy, Prisma for team CRUD DX |
| Auth | Better Auth | Auth.js/Lucia/custom JWT only with project reason |
| Redis | node-redis/ioredis adapter | Upstash Redis for serverless/runtime constraints |
| Queue | pg-boss | BullMQ, Temporal |
| Testing | Vitest + Playwright + contract tests | Bun test when Bun-only and team accepts it |
| Observability | OpenTelemetry + pino | Sentry or cloud-native metrics/logs as deployment demands |

## Frontend Defaults

### React

```txt
React
TypeScript strict
Vite
TanStack Router
TanStack Query
TanStack Form
Valibot/Zod
shadcn/ui
Tailwind CSS
Zustand or Jotai only when needed
Vitest
Playwright
```

Use React Router v7 instead of TanStack Router when the team prefers mainstream routing and accepts less unified TanStack mental model.

### Vue

```txt
Vue 3
TypeScript strict
Vite
Vue Router
TanStack Query Vue or Pinia Colada
Pinia for client/local state
TanStack Form Vue or VeeValidate
Valibot/Zod
shadcn-vue
Reka UI
Tailwind CSS
Vitest
Playwright
```

Use Nuxt for SSR/SEO/content needs. Keep complex backend domain logic in an independent API service.

## Backend Selection

| Backend | Choose when | Avoid when |
| --- | --- | --- |
| Hono | Runtime portability, thin HTTP shell, edge/serverless, low magic, AI-readable code | Team wants batteries-included enterprise backend |
| Elysia | Bun-first, very high DX, schema/type/runtime validation integration, rapid product iteration | Runtime neutrality or conservative Node deployment is primary |
| Fastify | Traditional Node backend, mature plugin model, schema validation, less magic than NestJS | Edge portability or Bun-first DX is primary |
| NestJS | Large enterprise team, Java/Spring/C# background, strong convention and onboarding uniformity | Small/medium TS-native codebase, AI-heavy generation, low magic desired |
| tRPC | Internal monorepo, full-stack TS, API as typed procedures | Public API governance, language-neutral clients, OpenAPI-first contract |

## Scenario Recipes

| Scenario | Recommended stack |
| --- | --- |
| Vue, Bun accepted, maximum DX | Vue 3 + Elysia + oRPC + Drizzle + Valibot/Zod |
| Vue, migration-safe and runtime-neutral | Vue 3 + Hono + oRPC + Drizzle + Valibot/Zod |
| React, maximum product DX | React + Elysia + oRPC + TanStack stack + Drizzle |
| React, stable and least controversial | React + Hono + oRPC + TanStack stack + Drizzle |
| API service with future Go/Java split possible | Node.js 24 or Bun + Hono + oRPC + OpenAPI + Drizzle/Kysely |
| Heavy SQL/reporting | Node.js 24 + Hono/Fastify + oRPC/OpenAPI + Kysely |
| CRUD team with many backend newcomers | NestJS or Fastify + Prisma, but keep schema rules explicit |
| Long-running agent/order/approval workflows | Any HTTP shell + Temporal for workflows |

## State Split

React:

```txt
Server state: TanStack Query
URL state: TanStack Router search params
Local state: useState/useReducer
Global client state: Zustand/Jotai only when needed
Form state: TanStack Form
```

Vue:

```txt
Server state: TanStack Query Vue or Pinia Colada
URL state: Vue Router query/params
Local state: ref/reactive
Global client state: Pinia
Form state: TanStack Form Vue or VeeValidate
```

Never mirror the same server resource cache into Pinia/Zustand while TanStack Query owns it.
