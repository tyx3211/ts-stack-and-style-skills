---
name: choosing-typescript-stack-zh
description: Use when choosing or comparing TypeScript project stacks, front-end frameworks, back-end frameworks, API contracts, schema libraries, databases, auth, queues, testing, observability, monorepo layout, or React/Vue/Hono/Elysia/Fastify/NestJS tradeoffs in Chinese workflow contexts.
---

# TypeScript 技术选型

## 概览

在选择 TypeScript 技术栈时，核心原则是：让 API 契约（contract）与运行时 schema（运行时校验结构）保持显式、让业务逻辑独立于框架上下文、并让框架选择匹配项目风险、团队背景、运行时约束以及 AI 辅助维护方式。

## 选型流程

1. 先识别项目形态：纯前端、全栈、API 服务、BFF（后端为前端服务）、SaaS / dashboard（管理后台）、公共 API、内部 monorepo（单仓多包）、edge / serverless（边缘 / 无服务器），或者长生命周期工作流系统。
2. 再确定硬约束：React 还是 Vue，Node 还是 Bun，是否要求运行时可移植性，是否需要 SEO / SSR，是否必须输出公开 OpenAPI，团队是否有 Java / NestJS 背景，以及是否默认依赖当前较强的 AI 辅助开发能力。
3. 在决定具体路由写法之前，先决定 API 契约的来源。
4. 再根据迁移风险和期望的开发体验，选择后端外壳框架。
5. 前端的状态管理、表单和路由选择，应按 React / Vue 各自生态来决定，而不是按后端框架口味来决定。
6. 数据库、Redis、认证、队列、测试和可观测性都应该作为显式的独立选择，而不是隐含附带项。

完整推荐矩阵请读取 [references/stack-matrix.md](references/stack-matrix.md)。

## 默认建议

- 运行时：保守的 Node 部署优先 Node.js 24；Bun-first（以 Bun 为先）的项目优先当前稳定版 Bun。
- TypeScript 配置：对于新的服务端项目，除非仓库明确只打算使用 CommonJS，否则优先使用 `module: "NodeNext"`、`moduleResolution: "NodeNext"` 和 `esModuleInterop: true`。
- API 契约：默认优先 oRPC 的 contract-first（契约优先）模式，并为公开 / 稳定 API 生成 OpenAPI。
- Schema：默认优先 Valibot 或 Zod；类型表达特别复杂的项目再考虑 ArkType。
- 数据库：默认优先 PostgreSQL + Drizzle；SQL 很重的场景考虑 Kysely；只有当团队更看重 CRUD（增删改查）开发体验和新人上手成本时，再考虑 Prisma。
- 认证：默认优先 Better Auth，并把授权逻辑集中在 policy / usecase（策略 / 用例）层，而不是散落在路由里。
- Redis：默认只把 node-redis 或同类方案用作缓存、会话、限流、幂等辅助，而不是主要领域数据库。
- 队列：已有 PostgreSQL 时优先 pg-boss；系统已经依赖 Redis 时考虑 BullMQ；需要可持久的长工作流时考虑 Temporal。
- 测试：默认使用 Vitest 做单元 / 集成测试，Playwright 做 E2E（端到端）测试，公开 API 再补 contract test（契约测试）。
- 可观测性：默认使用 OpenTelemetry 加 pino，并在适用场景下保留 request / user / tenant / trace 标识。

## 后端选择

- 当我们需要运行时可移植性、轻量 HTTP 外壳、低框架魔法、edge / serverless 适配性，以及未来迁移空间时，优先 Hono。
- 当我们是 Bun-first 开发、非常重视产品开发体验、希望 schema / 类型 / 运行时校验整合更紧密，并且默认使用较强 AI 辅助快速迭代时，优先 Elysia。
- 当项目更偏传统 Node 服务工程、需要成熟的插件结构，并希望有 schema 驱动的校验但又不想引入 NestJS 那样的重量级约束时，优先 Fastify。
- 只有当团队明确需要企业级强约定、成员有 Java / Spring 或 C# 背景，或者更看重统一的 controller / provider / module 纪律而不是 TypeScript 的自然写法时，才选择 NestJS。
- tRPC 主要适合全栈 / 内部 monorepo API，尤其是公开 REST / OpenAPI 治理并不是主产物的场景。

在决定 oRPC-first、Elysia-first、Hono-first、Hono RPC、Eden 或 tRPC 之前，先读取 [references/schema-contracts.md](references/schema-contracts.md)。

## 前端选择

- React 默认栈：Vite、TanStack Router、TanStack Query、TanStack Form、shadcn/ui、Tailwind CSS，只有在确实需要时再引入 Zustand / Jotai。
- Vue 默认栈：Vue 3、Vite、Vue Router、TanStack Query Vue 或 Pinia Colada、Pinia 负责客户端状态、TanStack Form Vue 或 VeeValidate、shadcn-vue / Reka UI、Tailwind CSS。
- 对于复杂后端领域，不要默认把 Next.js 或 Nuxt 当成主要后端方案。它们更适合 SSR / SEO / 内容需求，而复杂领域后端应该保持独立。
- 如果 TanStack Query 或同类工具已经负责 server resource cache（服务端资源缓存），就不要再把同一份缓存重复塞进 Zustand 或 Pinia。

## 推荐配方

- 最激进的 Vue 方案：Vue 3 + Elysia + oRPC + Drizzle + Better Auth + Valibot / Zod。
- 最稳妥的 Vue 方案：Vue 3 + Hono + oRPC + Drizzle + Better Auth + Valibot / Zod。
- 最激进的 React 方案：React + Elysia + oRPC + TanStack 全家桶 + Drizzle。
- 最稳妥的 React 方案：React + Hono + oRPC + TanStack 全家桶 + Drizzle。
- 运行时中立的 API 服务：Node.js 24 或 Bun + Hono + oRPC + Drizzle / Kysely + node-redis + OpenTelemetry。
- 传统 Node 服务：Node.js 24 + Fastify + oRPC 或 OpenAPI + Drizzle / Kysely。
- 企业 CRUD 且强调团队约定：NestJS + 明确规则，避免空心分层和 schema 重复。

## 架构规则

- 公开 API 的 schema 和 contract 必须只有一个规范来源。
- 对公开 / 稳定 API 面，OpenAPI 应该作为 CI 产物生成。
- 不要把复杂后端业务逻辑塞进 Next.js 或 Nuxt 的服务端路由。
- 不要把 Hono / Elysia / React / Vue 的框架上下文导入 service / usecase / repo 代码中。
- route / controller 层应保持轻薄。
- 权限逻辑放在 policy / usecase 层。
- 数据库实体与 API 返回对象保持分离。
- CPU 密集型任务交给 worker，长时 / 后台任务交给队列或工作流系统。

当我们要创建新的 monorepo，或者想把架构规则写进 `AGENTS.md` / 仓库文档时，请读取 [references/project-structure.md](references/project-structure.md)。

## 反默认项

- 不要仅仅因为项目是后端 TypeScript，就机械选择 NestJS。
- 如果项目更重视显式 SQL、AI 可读的迁移脚本和低框架魔法，就不要因为惯性去选 Prisma。
- 不要同时维护同一接口的 oRPC 契约 schema 和框架路由 schema。
- 除非产品本身就是典型 Redis 形态，否则不要把 Redis 当成主事实来源。
- 不要放任 AI 生成的 Java 风格 service / repository / manager 空心分层无限增长。
