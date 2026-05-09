# Service And Boundary Reference

## Recommended Layers

```txt
contract/schema:
  input, output, error, OpenAPI-visible shapes

route/transport:
  framework adapter, middleware, context extraction, response mapping

service/usecase:
  business workflow and orchestration

repo/query:
  PostgreSQL, Redis, external API access

policy:
  authorization and domain decisions

infra:
  concrete clients, logger, queue, telemetry
```

## Hono/oRPC Shape

Hono route code should stay thin:

```ts
const app = new Hono();

app.route("/rpc", createORPCHonoHandler({ router, context: buildContext }));
```

Implementation code should depend on contracts and dependencies, not on `Hono.Context`:

```ts
export async function createUser(deps: Deps, input: CreateUserInput) {
  const user = await deps.userRepo.create(input);
  await deps.auditLog.write({ type: "user.created", userId: user.id });
  return user;
}
```

## Elysia/oRPC Shape

In oRPC-first Elysia projects, connect Elysia to the oRPC adapter and avoid rewriting the same public endpoint schema as `Elysia.t`. Use `Elysia.t` only for local/internal endpoints such as health checks or debug-only routes.

Do not pass Elysia context into usecases. Extract request-local data at the transport boundary and pass a typed dependency/context object.

## Schema Source Rule

Pick exactly one canonical schema source per public API boundary:

- oRPC-first: `packages/contracts` with Zod/Valibot/ArkType schemas.
- Hono-only: Standard Schema adapter or Zod/Valibot/ArkType validator as the route schema source.
- Elysia/Eden-only: `Elysia.t` can be the route/client/OpenAPI source.

Do not mirror the same endpoint shape in multiple schema systems. Divergent schemas are worse than a slightly less perfect library choice.

## Closure Use

Good closure use:

```ts
export function makeUserHandlers(deps: Deps) {
  return {
    getById: async (c: Context) => {
      const id = c.req.param("id");
      return c.json(await deps.userRepo.getById(id));
    },
  };
}
```

This captures a small dependency object and returns a small handler group.

Avoid:

- Returning many nested function layers such as `makeA(a)(b)(c)`.
- Capturing large mutable state in long-lived closures.
- Hiding business state transitions in closure chains.
- Building private mini-frameworks around closures.

## Review Checklist

- Is the route free of complex business logic?
- Does service/usecase code avoid framework context imports?
- Does every public input/output/error have one schema source?
- Are authorization decisions centralized in policy/usecase rather than scattered in route/component code?
- Are API resource caches owned by TanStack Query or equivalent server-state tooling, not by Pinia/Zustand?
- Are high-volume data objects free of per-instance function properties?
