# Project References And TSConfig

## Use References Deliberately

Use project references when packages need independent declaration/build outputs, incremental graph builds, or editor isolation. Skip them for small source-first workspaces when a framework checker already owns the complete program and references add only duplicate configuration.

Project references are not import access control. Pair them with package exports and dependency-boundary lint.

## Solution Pattern

```json
{
  "files": [],
  "references": [
    { "path": "./packages/contracts" },
    { "path": "./packages/db" },
    { "path": "./apps/api" },
    { "path": "./apps/web" }
  ]
}
```

Every referenced project must enable `composite`. Explicitly set `rootDir`, `outDir`, and a non-colliding `tsBuildInfoFile`. Ensure `include` covers every implementation file. A referenced buildable library must provide declarations; a final app can remain a leaf and generally needs no declaration contract.

## Build And Check

- Use `tsc -b` to build the reference graph in dependency order.
- Use a stop-on-error build option in CI when supported by the pinned compiler and desired by policy.
- Do not assume `tsc -p` builds referenced dependencies; build mode is the graph orchestrator.
- Do not advertise `tsc -b --noEmit` as universally portable. Validate it with the pinned compiler. A compatible baseline is `tsc -b` for buildable libraries and `tsc --noEmit -p ...` for final TypeScript apps.
- Vue/SFC and other embedded-language apps require their framework-aware checker until its current toolchain supports the selected compiler.

## TypeScript 7 Migration

- Replace preview `@typescript/native-preview` and `tsgo`. Use pinned standard `typescript`/`tsc` for CLI-only projects, or the verified official TS7-as-`@typescript/native` plus TS6-API-as-`typescript` alias layout when programmatic consumers remain.
- Remove `baseUrl`; make `paths` values relative to the defining config.
- Specify `rootDir` explicitly because the TypeScript 7 default changed.
- Specify ambient `types` explicitly because the TypeScript 7 default no longer discovers all `@types` packages.
- Remove compiler options and legacy module targets no longer supported by TypeScript 7.
- If a tool needs the TypeScript programmatic API, verify TypeScript 7 support; until it exists, pin the TS6 compatibility API, record which commands import it, and fail rather than falling back globally.

## Config Separation

Keep shared strict options in a base config, but use environment-specific leaf configs:

- Node library/app: Node runtime types and Node-compatible module semantics.
- Vite browser app: DOM libs, bundler resolution, and no compiler JavaScript emit.
- Tests: explicit test globals and separate include scope.
- Declaration build: stable public sources only; exclude tests, fixtures, migrations, and generated scratch files.

Remember that `references` is not inherited through `extends`; declare it in each project that owns graph edges.
