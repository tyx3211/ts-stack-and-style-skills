---
name: choosing-typescript-stack
description: Use when choosing or comparing TypeScript project stacks, front-end frameworks, back-end frameworks, API contracts, schema libraries, databases, auth, queues, testing, observability, monorepo layout, or React/Vue/Hono/Elysia/Fastify/NestJS tradeoffs.
---

# Choosing TypeScript Stack

## Overview

Choose TypeScript stacks by enforcing explicit API contracts and runtime schemas, keeping business logic independent from framework context, and selecting frameworks that match project risk, team background, runtime constraints, and AI-assisted maintenance. Treat stack choices as architecture decisions; defaults apply unless a concrete project constraint justifies an exception.

## Selection Workflow

1. Identify project shape first: frontend-only, full-stack, API service, BFF, SaaS/dashboard, public API, internal monorepo, edge/serverless, or long-running workflow system.
2. Decide hard constraints before naming frameworks: React vs Vue, Node vs Bun, runtime portability, SEO/SSR, public OpenAPI needs, team Java/NestJS background, and whether SOTA AI is assumed.
3. Pick the API contract source before route details. Do not start from controller/route style.
4. Pick backend shell by migration risk and desired developer experience. Do not pick a backend framework by habit.
5. Pick frontend state/form/router choices by React/Vue ecosystem, not by backend taste.
6. Add database, Redis, auth, queue, tests, and observability as explicit independent choices. Do not let framework starter templates decide these implicitly.

Load [references/stack-matrix.md](references/stack-matrix.md) for the full recommendation matrix.

## Defaults

Use these defaults unless the project has a documented reason to deviate:

- Runtime: use Node.js 24 for conservative Node deployments, or a current stable Bun release for Bun-first projects.
- TypeScript config: use `module: "NodeNext"`, `moduleResolution: "NodeNext"`, and `esModuleInterop: true` for new server-side projects unless the repository is intentionally CommonJS-only. For strict `src/` gates, load `strict-typescript-source-gates`.
- API contract: use oRPC contract-first plus generated OpenAPI for public/stable APIs.
- Schema: use Valibot or Zod by default; use ArkType only for advanced type-heavy projects.
- Database: use PostgreSQL + Drizzle by default; use Kysely for SQL-heavy work; use Prisma only when team CRUD DX and onboarding matter more than explicit SQL control.
- Auth: use Better Auth by default, with authorization centralized in policy/usecase rather than scattered routes.
- Redis: use node-redis or equivalent as cache/session/rate-limit/idempotency helper, not as primary domain database.
- Queue: use pg-boss first when PostgreSQL is already enough; use BullMQ when Redis is already part of the system; use Temporal for durable long workflows.
- Tests: use Vitest for unit/integration, Playwright for E2E, and contract tests for public API.
- Observability: use OpenTelemetry plus pino, with request/user/tenant/trace identifiers where applicable.

When selecting PostgreSQL, Drizzle, Kysely, Redis, cache, queue, idempotency, or backend data-access patterns, also load `backend-data-correctness`.

## Typecheck Performance Preference

For medium-to-large TypeScript projects, choose a toolchain that can run full-project `tsgo --noEmit --pretty false` by default. This is usually fast and stable enough for local self-checks. If a human developer later says the time is unacceptable and asks for more speed, prefer a fully cached incremental command such as `tsgo --noEmit --incremental --tsBuildInfoFile .cache/tsgo.tsbuildinfo --pretty false`; generally do not make watch mode the default performance strategy.

## Backend Choices

- Choose Hono when portability, thin HTTP shell, low framework magic, edge/serverless, and future migration matter. This is the stable lightweight default for runtime-neutral API services.
- Choose Elysia when Bun-first development, high product DX, schema/type/runtime validation integration, and SOTA AI-assisted iteration matter.
- Choose Fastify when the project wants traditional Node server engineering, mature plugin structure, and schema-based validation without NestJS weight.
- Choose NestJS only when the team demonstrably needs strong enterprise convention, has Java/Spring or C# background, or values uniform controller/provider/module discipline over TypeScript naturalness. Do not select it as the generic TypeScript backend default.
- Choose tRPC mainly for full-stack/internal monorepo APIs that do not need public REST/OpenAPI governance as the primary artifact.

Load [references/schema-contracts.md](references/schema-contracts.md) before deciding between oRPC-first, Elysia-first, Hono-first, Hono RPC, Eden, or tRPC.

## Frontend Choices

- React default: Vite, TanStack Router, TanStack Query, TanStack Form, shadcn/ui, Tailwind CSS, Zustand/Jotai only when needed.
- Vue default: Vue 3, Vite, Vue Router, TanStack Query Vue or Pinia Colada, Pinia for client state, TanStack Form Vue or VeeValidate, shadcn-vue/Reka UI, Tailwind CSS.
- Do not default to Next.js or Nuxt for complex backend domains. Use them for SSR/SEO/content needs, and keep complex domain backend independent.
- Do not store server resource cache in Zustand or Pinia when TanStack Query or equivalent owns it.
- Do not handwrite API response types in frontend code when a contract or schema-derived client already owns them.

## Recommended Recipes

- Most progressive Vue stack: Vue 3 + Elysia + oRPC + Drizzle + Better Auth + Valibot/Zod.
- Most stable Vue stack: Vue 3 + Hono + oRPC + Drizzle + Better Auth + Valibot/Zod.
- Most progressive React stack: React + Elysia + oRPC + TanStack stack + Drizzle.
- Most stable React stack: React + Hono + oRPC + TanStack stack + Drizzle.
- Runtime-neutral API service: Node.js 24 or Bun + Hono + oRPC + Drizzle/Kysely + node-redis + OpenTelemetry.
- Traditional Node service: Node.js 24 + Fastify + oRPC or OpenAPI + Drizzle/Kysely.
- Enterprise CRUD with strong team convention: NestJS + explicit rules to prevent hollow layers and schema duplication.

## Architecture Rules

- Keep public API schema and contract in one canonical place.
- Generate OpenAPI as a CI artifact for public/stable API surfaces.
- Do not put complex backend logic in Next.js or Nuxt server routes.
- Do not import Hono/Elysia/React/Vue framework context into service/usecase/repo code.
- Keep route/controller layers thin.
- Keep permissions in policy/usecase.
- Keep database entities separate from API responses.
- Put CPU-heavy tasks in workers and long/background tasks in queues or workflows.

Load [references/project-structure.md](references/project-structure.md) when creating a new monorepo or adding architectural rules to `AGENTS.md`/repo docs.

## Anti-Defaults

- Do not choose NestJS just because the project is backend TypeScript.
- Do not choose Prisma by inertia when the project values explicit SQL, AI-readable migrations, or low framework magic.
- Do not maintain both oRPC contract schemas and framework route schemas for the same endpoint.
- Do not use Redis as the main source of truth unless the product is explicitly Redis-shaped.
- Do not let AI-generated Java-style service/repository/manager layers grow without real responsibility.
