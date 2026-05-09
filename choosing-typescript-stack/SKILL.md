---
name: choosing-typescript-stack
description: Use when choosing or comparing TypeScript project stacks, front-end frameworks, back-end frameworks, API contracts, schema libraries, databases, auth, queues, testing, observability, monorepo layout, or React/Vue/Hono/Elysia/Fastify/NestJS tradeoffs.
---

# Choosing TypeScript Stack

## Overview

Choose TypeScript stacks by keeping API contracts and runtime schemas explicit, keeping business logic independent from framework context, and selecting frameworks that match project risk, team background, runtime constraints, and AI-assisted maintenance.

## Selection Workflow

1. Identify project shape: frontend-only, full-stack, API service, BFF, SaaS/dashboard, public API, internal monorepo, edge/serverless, or long-running workflow system.
2. Decide hard constraints: React vs Vue, Node vs Bun, runtime portability, SEO/SSR, public OpenAPI needs, team Java/NestJS background, and whether SOTA AI is assumed.
3. Pick the API contract source before picking route details.
4. Pick backend shell by migration risk and desired developer experience.
5. Pick frontend state/form/router choices by React/Vue ecosystem, not by backend taste.
6. Add database, Redis, auth, queue, tests, and observability as explicit independent choices.

Load [references/stack-matrix.md](references/stack-matrix.md) for the full recommendation matrix.

## Defaults

- Runtime: prefer Node.js 24 for conservative Node deployments, or a current stable Bun release for Bun-first projects.
- TypeScript config: prefer `module: "NodeNext"`, `moduleResolution: "NodeNext"`, and `esModuleInterop: true` for new server-side projects unless the repository is intentionally CommonJS-only.
- API contract: oRPC contract-first plus generated OpenAPI for public/stable APIs.
- Schema: Valibot or Zod by default; ArkType for advanced type-heavy projects.
- Database: PostgreSQL + Drizzle by default; Kysely for SQL-heavy work; Prisma only when team CRUD DX and onboarding matter more than explicit SQL control.
- Auth: Better Auth by default, with authorization in policy/usecase rather than scattered routes.
- Redis: node-redis or equivalent as cache/session/rate-limit/idempotency helper, not as primary domain database.
- Queue: pg-boss first when PostgreSQL is already enough; BullMQ when Redis is already part of the system; Temporal for durable long workflows.
- Tests: Vitest for unit/integration, Playwright for E2E, contract tests for public API.
- Observability: OpenTelemetry plus pino, with request/user/tenant/trace identifiers where applicable.

## Backend Choices

- Choose Hono when portability, thin HTTP shell, low framework magic, edge/serverless, and future migration matter.
- Choose Elysia when Bun-first development, high product DX, schema/type/runtime validation integration, and SOTA AI-assisted iteration matter.
- Choose Fastify when the project wants traditional Node server engineering, mature plugin structure, and schema-based validation without NestJS weight.
- Choose NestJS only when the team needs strong enterprise convention, has Java/Spring or C# background, or values uniform controller/provider/module discipline over TypeScript naturalness.
- Choose tRPC mainly for full-stack/internal monorepo APIs that do not need public REST/OpenAPI governance as the primary artifact.

Load [references/schema-contracts.md](references/schema-contracts.md) before deciding between oRPC-first, Elysia-first, Hono-first, Hono RPC, Eden, or tRPC.

## Frontend Choices

- React default: Vite, TanStack Router, TanStack Query, TanStack Form, shadcn/ui, Tailwind CSS, Zustand/Jotai only when needed.
- Vue default: Vue 3, Vite, Vue Router, TanStack Query Vue or Pinia Colada, Pinia for client state, TanStack Form Vue or VeeValidate, shadcn-vue/Reka UI, Tailwind CSS.
- Do not default to Next.js or Nuxt for complex backend domains. Use them for SSR/SEO/content needs, and keep complex domain backend independent.
- Do not store server resource cache in Zustand or Pinia when TanStack Query or equivalent owns it.

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
