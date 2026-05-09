# 技术栈矩阵

## 通用基础层

| 层级 | 默认选择 | 可选替代 |
| --- | --- | --- |
| Runtime（运行时） | Node.js 24 或当前稳定版 Bun | 当可移植性最重要时，采用目标 edge/serverless 平台运行时 |
| TypeScript 模块配置 | `module: "NodeNext"`、`moduleResolution: "NodeNext"`、`esModuleInterop: true` | 只有已有 CommonJS 项目且理由明确时才保留旧配置 |
| API contract（API 契约） | oRPC contract-first + OpenAPI | 轻量内部调用可用 Hono RPC，内部全栈 monorepo 可用 tRPC |
| Schema | Valibot 或 Zod | 高级类型表达可用 ArkType，effect（副作用）较重领域可用 Effect Schema |
| Database（数据库） | PostgreSQL + Drizzle | SQL 很重时可用 Kysely，团队偏 CRUD 开发体验时可用 Prisma |
| Auth（认证） | Better Auth | 只有在项目确有需要时才考虑 Auth.js / Lucia / 自定义 JWT |
| Redis | node-redis / ioredis 适配层 | serverless 或特殊运行时约束下可用 Upstash Redis |
| Queue（队列） | pg-boss | BullMQ、Temporal |
| Testing（测试） | Vitest + Playwright + contract tests | 纯 Bun 且团队接受时可用 Bun test |
| Observability（可观测性） | OpenTelemetry + pino | 也可按部署需求用 Sentry 或云厂商日志/指标体系 |

## 前端默认栈

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

如果团队更偏主流路由习惯，并且接受较弱一些的一体化 TanStack 心智模型，也可以用 React Router v7 替代 TanStack Router。

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

如果需求以 SSR / SEO / 内容站点为主，可以选 Nuxt。但复杂后端领域逻辑仍应放在独立 API 服务中。

## 后端选择

| 后端 | 适合场景 | 不适合场景 |
| --- | --- | --- |
| Hono | 运行时可移植、HTTP 外壳轻、edge/serverless、低魔法、AI 易读 | 团队更想要电池齐全的企业后端框架 |
| Elysia | Bun-first、开发体验极强、schema / 类型 / 运行时校验整合紧、产品快速迭代 | 运行时中立或保守 Node 部署是首要目标 |
| Fastify | 传统 Node 后端、成熟插件体系、schema 校验、比 NestJS 更轻 | 重点是 edge 可移植性或 Bun-first 体验 |
| NestJS | 大型企业团队、Java / Spring / C# 背景、强约定和统一上手路径 | 中小型 TS 原生代码库、AI 生成参与度高、追求低框架魔法 |
| tRPC | 内部 monorepo、全栈 TS、把 API 视为类型化过程调用 | 公开 API 治理、语言无关客户端、OpenAPI-first 契约 |

## 场景配方

| 场景 | 推荐技术栈 |
| --- | --- |
| Vue，允许 Bun，追求极致 DX（开发体验） | Vue 3 + Elysia + oRPC + Drizzle + Valibot / Zod |
| Vue，偏迁移安全且运行时中立 | Vue 3 + Hono + oRPC + Drizzle + Valibot / Zod |
| React，追求极致产品开发体验 | React + Elysia + oRPC + TanStack 全家桶 + Drizzle |
| React，稳妥且争议最小 | React + Hono + oRPC + TanStack 全家桶 + Drizzle |
| API 服务，未来可能拆向 Go / Java | Node.js 24 或 Bun + Hono + oRPC + OpenAPI + Drizzle / Kysely |
| 重 SQL / 报表场景 | Node.js 24 + Hono / Fastify + oRPC / OpenAPI + Kysely |
| CRUD 团队，后端新手较多 | NestJS 或 Fastify + Prisma，但 schema 规则必须明确 |
| 长生命周期 agent / order / approval workflow（代理 / 订单 / 审批工作流） | 任意 HTTP 外壳 + Temporal |

## 状态划分

React：

```txt
Server state: TanStack Query
URL state: TanStack Router search params
Local state: useState/useReducer
Global client state: Zustand/Jotai only when needed
Form state: TanStack Form
```

Vue：

```txt
Server state: TanStack Query Vue or Pinia Colada
URL state: Vue Router query/params
Local state: ref/reactive
Global client state: Pinia
Form state: TanStack Form Vue or VeeValidate
```

当 TanStack Query 已经拥有同一份服务端资源缓存时，不要再把它镜像进 Pinia 或 Zustand。
