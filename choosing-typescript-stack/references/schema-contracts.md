# Schema And Contract Choices

## Core Rule

Each public endpoint should have exactly one schema fact source. The common failure is writing an oRPC contract schema and a framework route schema for the same shape, then letting them diverge.

## oRPC-First

Use for complex, long-lived, AI-driven, public/stable, or multi-client projects.

```txt
packages/contracts:
  Zod/Valibot/ArkType schema
  oRPC contract

apps/api:
  Hono/Elysia adapter
  handler implementation

apps/web:
  oRPC client
  TanStack Query integration

artifact:
  generated OpenAPI
```

In this mode:

- Hono should not repeat the same route schema through `@hono/zod-validator` or `@hono/standard-validator`.
- Elysia should not repeat the same public route schema through `Elysia.t`.
- Framework schema may still be used for health checks, internal debug endpoints, and non-oRPC local routes.

## Elysia-First

Use for pure Bun/Elysia/Eden projects where TypeScript monorepo internal client experience is more important than framework-neutral contract governance.

```txt
Canonical schema: Elysia.t
Client: Eden
OpenAPI: Elysia OpenAPI plugin
```

Do not add a parallel Zod/Valibot mirror unless form reuse or third-party integration truly needs it.

## Hono-First Without oRPC

Use when API needs are small and oRPC is too much.

```txt
Canonical schema: Zod/Valibot/ArkType
Validation: @hono/standard-validator or @hono/zod-validator
OpenAPI: hono-openapi or separate OpenAPI generation
```

This is clean because Hono itself does not impose a schema language.

## tRPC

Use when:

- The API is primarily internal to a TypeScript monorepo.
- Public REST/OpenAPI is not the main governance artifact.
- Procedure/router inference is the desired main developer experience.

Avoid as the only contract layer when language-neutral clients, public API documentation, or long-lived OpenAPI diffing matter.

## Schema Library Choice

| Library | Prefer for | Watch out for |
| --- | --- | --- |
| Zod | widest ecosystem, AI familiarity, common examples | bundle/perf concerns in large frontends |
| Valibot | modular, lightweight, Standard Schema-friendly | lower team familiarity |
| ArkType | advanced TS-heavy type expression | smaller ecosystem and steeper learning curve |
| Elysia.t | pure Elysia/Eden path | cross-framework reuse and form reuse |
| TypeBox | JSON Schema/OpenAPI/performance orientation | less ergonomic domain modeling than Zod-style APIs |

## OpenAPI-Safe Public Schema

For public contract schemas, keep shapes easy to express in JSON/OpenAPI:

- Prefer serialized `string` datetimes over `Date` objects.
- Prefer strings for `BigInt`-like values unless numeric range is safe.
- Be cautious with transforms, effects, complex refinements, brands, and coercions.
- Normalize/coerce at input boundaries explicitly.
- Shape output before returning it; do not expose database rows directly.
