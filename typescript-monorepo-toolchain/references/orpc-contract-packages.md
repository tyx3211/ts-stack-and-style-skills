# oRPC Contract Packages

## Ownership

Keep the canonical runtime schema and oRPC contract in one contract package. Zod, Valibot, ArkType, and oRPC contract objects are runtime values, not type-only declarations. A dist-first contract package therefore emits JavaScript and declarations.

```text
packages/contracts
  schema + oRPC contract
apps/api
  implementation + transport adapter
apps/web
  contract-derived client + query integration
artifact
  generated OpenAPI when required
```

## Boundary Rules

- The contract package must not import Hono/Elysia application context, database adapters, secrets, Node-only infrastructure, React/Vue, or app code.
- The API implements the contract and maps domain/application results to contract outputs.
- The frontend consumes the contract-derived client; it does not import the API app or database package.
- Do not repeat an oRPC endpoint's body/query/param schema in Hono validators or framework route schemas.
- Middleware before the oRPC adapter must not consume a request body that the adapter needs.
- Keep database rows distinct from contract outputs.

## OpenAPI Role

Internal TypeScript clients can derive types directly from the shared contract package; they do not need OpenAPI client generation as an intermediate synchronization step. Still generate OpenAPI when it is a public/external contract, documentation input, interoperability artifact, or CI diff surface.

The OpenAPI artifact must be generated from the canonical contract and checked for drift. Do not maintain a handwritten parallel OpenAPI schema.

## Package Mode

- Dist-first: point package exports to built JavaScript and declarations; build/watch before app dev or orchestrate the dependency in the task graph.
- Source-first: allow only when all consumers intentionally transform the same schema source and no unsupported runtime dependency leaks across boundaries.
- Keep framework-specific local endpoints such as health checks outside the shared business contract when appropriate.

## Verification

- Typecheck API implementation against the contract.
- Typecheck frontend client/query usage against the same contract.
- Execute runtime schema parsing tests, not only inference tests.
- Generate and diff OpenAPI where required.
- Install the packed contract package in a minimal consumer and execute one runtime schema import.
