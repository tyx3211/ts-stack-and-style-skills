---
name: typescript-coding-preferences
description: Use when writing, refactoring, or reviewing TypeScript code where style, encapsulation, class/interface usage, schema boundaries, ESLint rules, local hooks, any/unknown/assertion policy, Hono/oRPC handlers, performance-sensitive object modeling, or avoiding Java/NestJS-style over-OOP matters.
---

# TypeScript Coding Preferences

## Overview

Follow a TypeScript style that is schema-first at boundaries, function/module-first in flow, data-first in modeling, and deliberately light on object-oriented programming. Treat this as the default project discipline, not a soft aesthetic preference. Use classes as a scoped tool for entities/value objects, not as the architecture default.

This is intentionally Go-like TypeScript: plain data, functions, small interfaces, explicit composition, and classes only when they pay for themselves.

## Default Stance

- Default to explicit data flow, plain functions, and small modules.
- Use composition and delegation over inheritance for code reuse; use inheritance only when the domain has a real, stable `is-a` relationship and the repository already benefits from that shape.
- Treat classic OOP patterns as problem-shape vocabulary, not as implementation templates.
- Avoid Java/Spring-style TypeScript: controller classes, thick service/repository/manager layers, decorator-heavy dependency injection, and empty forwarding abstractions.
- Follow framework conventions already present in the repository when they conflict with this skill, but do not introduce heavier patterns without a local reason.

## Runtime And TSConfig Defaults

- For new server-side TypeScript projects, use Node.js 24 or a current stable Bun release, depending on the deployment/runtime target.
- Use ESM-oriented TypeScript settings with `module: "NodeNext"` and `moduleResolution: "NodeNext"` when the project is not intentionally CommonJS-only.
- Set `esModuleInterop: true` by default for smoother CommonJS/ESM package interop.
- Respect an existing repository's runtime and module system unless the task is explicitly to modernize or rebaseline it.

Load [references/runtime-tsconfig.md](references/runtime-tsconfig.md) when creating or changing `tsconfig`, package module type, runtime baseline, or Node/Bun setup.

## Modeling Decisions

Use this order before adding a new type or abstraction. Do not add a class, service layer, factory, manager, or interface until this check has been applied:

1. For API input/output, DTOs, configs, database rows, and temporary data, use plain object data plus `type` or `interface`.
2. For domain entities and value objects with stable local behavior, use `class + interface` when `obj.method()` readability or prototype method sharing matters.
3. For cross-object, cross-resource, I/O-heavy, or workflow logic, use external functions, `Service`/`Ops` modules, or small capability objects instead of instance methods.
4. For finite variants such as AST nodes, protocol messages, command kinds, and state machines, use discriminated unions with `kind`/`tag` plus exhaustive `switch` where practical.
5. For service/repo/client objects that exist in small quantities, factory-returned method objects are acceptable; do not copy that pattern onto large data arrays.

Load [references/object-modeling.md](references/object-modeling.md) when choosing between `class`, plain object, operations modules, and tag-based dispatch.

## Interface Rules

- Use `interface` for open capability constraints and object contracts that may have future implementers.
- Use `type` for closed unions, mapped/conditional types, and data shapes that should not be reopened.
- Keep data interfaces separate from capability interfaces. A `UserData` instance should not have to satisfy `UserService`.
- Use `satisfies` when a literal should be checked against an interface while preserving its precise inferred type.
- For callback-like capability shapes, use function properties instead of method signatures unless a framework requires method syntax.
- Do not use `class extends` for reuse unless the domain really has a stable `is-a` relationship or a framework/library requires it.

## Class Rules

Use class only when it pays for itself:

- Entity/value object with stable invariants.
- Many instances where prototype methods avoid per-instance function allocation.
- A small set of local, intrinsic methods such as `price.isZero()` or `range.contains(x)`.
- Controlled construction or private mutable state that is genuinely local to the object.

Keep class methods thin and intrinsic. Put persistence, orchestration, authorization, formatting, cache policy, and multi-object workflows outside the entity.

Do not pass prototype methods as callbacks unbound. Call through the object (`obj.method()`), wrap explicitly (`(...args) => obj.method(...args)`), or use an external function.

Do not introduce class-based controllers, decorators, DI containers, or framework-like base classes into a lightweight Hono/oRPC/Elysia codebase unless the repository already owns that convention.

## Functions And Closures

- Use plain helper functions for reusable logic.
- Local callbacks and local helper closures are fine when they do not escape far from their scope.
- Use factory closures sparingly for dependency assembly, for example `makeUserHandlers(deps)`.
- Avoid deeply curried APIs, long-lived escaped closures, and framework-like closure DSLs that hide state and control flow.
- In UI code, React hooks and Vue Composition API closures are framework semantics; follow the framework, but do not build extra private closure frameworks around it.

## Boundary Rules

- Treat runtime schema as the boundary truth for external input/output.
- In oRPC-first projects, keep contract schemas in the contract package and do not duplicate the same endpoint schema in Hono validators or Elysia route options.
- Keep HTTP/RPC handlers thin: parse context, call usecase/service, map response/error.
- Do not let `Hono.Context`, `Elysia.Context`, React component props, or Vue component state leak into service/usecase/repo code.
- Do not handwrite public API response types separately from schema/contract output.

Load [references/service-boundaries.md](references/service-boundaries.md) when editing Hono/oRPC/Elysia route, service, repo, policy, schema, or closure-based assembly code.

## ESLint, Hooks, And Type Safety

- Treat ESLint and TypeScript config as executable project law, not stylistic suggestions.
- When defining or tightening `src/` tsconfig, ESLint, npm scripts, hooks, CI gates, assertion policy, or variance-safety rules, load `strict-typescript-source-gates`.
- In non-test handwritten production code, explicit `any` should be forbidden; `noImplicitAny` should be enabled so implicit `any` is also blocked.
- Prefer `unknown` for untrusted external values, then narrow with `typeof`, custom guards, or schema parsing before use.
- Do not use `as` assertions to replace runtime validation. In particular, avoid `JSON.parse(...) as T`, `payload.value as number`, and `as unknown as T` unless there is a narrow, documented interoperability reason.
- Use `eqeqeq: "error"` to remove loose equality, while remembering that `eqeqeq` does not protect against `NaN`, `Infinity`, truthy/falsy mistakes, or unchecked external inputs.
- For numeric boundaries, validate both type and value, for example `typeof x === "number" && Number.isFinite(x)`, then apply business range checks.
- Keep local hooks thin: they should call stable commands such as `npm run lint`, `npm run typecheck`, `npm run build`, or `npm run verify`, not duplicate hidden logic.
- CI remains the final clean-environment verdict; hooks give fast local feedback and teach agents through clear failures.

Load [references/lint-hooks-type-safety.md](references/lint-hooks-type-safety.md) when changing ESLint, hooks, CI gates, generated-code linting, `any`/`unknown`, assertions, type guards, schema parsing, equality checks, or numeric validation. For hard `src/` gates, also load `strict-typescript-source-gates`.

## Performance And Shape Discipline

- Do not attach function properties to every object in a large collection.
- Keep object shapes stable after construction; avoid patching ad hoc fields onto live objects.
- In hot paths, avoid repeated allocations, repeated parsing/validation, dynamic dispatch confusion, and shape-changing objects.
- Prefer `tag + switch`, flat arrays, stable class layouts, and precomputed results where data volume or hot loops make this relevant.
- In normal application code, do not over-optimize dispatch style before network, database, rendering, serialization, and allocation costs are understood.

## Smells To Push Back On

- Abstract interfaces created only so one class can implement them.
- `Manager`, `Factory`, `Adapter`, `Facade`, or `Service` layers that mostly forward calls.
- Entity methods that reach into database, Redis, HTTP, logging, request context, or framework context.
- Hono code rewritten into NestJS-style controller classes and decorators.
- Same API data cached in TanStack Query and Pinia/Zustand at the same time.
- Public API response types handwritten separately from contract/schema output.
