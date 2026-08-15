# Workspace And Package Graph

## Package Threshold

Create a package only when it has a durable reason to exist: independent publication, deployment, runtime, ownership, access policy, expensive isolated tests, or reuse by multiple consumers. Keep a feature inside an app when extraction adds configuration without a stable contract.

## Four Graphs

- Workspace graph: installation, linking, package-manager selection, and lockfile.
- Runtime graph: package dependencies, `exports`/`imports`, module formats, and deployment artifacts.
- TypeScript graph: tsconfig membership, references, declaration boundaries, and build information.
- Task graph: command ordering and cacheability. A task runner such as Turbo or Nx coordinates work but does not replace the other graphs.

Compare the graphs during review. Every runtime dependency should be declared by its consumer. Every project reference should correspond to a real TypeScript dependency. Every task dependency should reflect the artifacts a downstream task consumes.

## Recommended Shape

```text
apps/
  api/
  web/
  worker/
packages/
  contracts/
  db/
  ui/
  config/
```

Use names and directories that reflect actual roles; do not create empty architectural layers.

## Dist-first Decision

Choose dist-first when any of these apply:

- the package is published or installed outside the repository;
- plain Node consumes it without a TypeScript loader;
- different runtimes consume the same package;
- package metadata and artifacts must match production during development;
- declarations are a supported external contract.

Build upstream packages before consumers. Point public metadata at `dist`, and exclude source-only private modules from exports.

## Source-first Decision

Choose source-first only when all consumers are controlled and their dev/test/build/runtime tools accept the same TypeScript syntax. Record that contract explicitly. Avoid a source-first browser package that imports Node-only dependencies even if type-only imports make one path appear safe.

## Dependency Policy

- Put runtime dependencies in the package that imports them.
- Put build-only tools in the nearest package or shared config package that owns the command.
- Use peer dependencies only for host-owned singleton/plugin relationships, not to avoid installation.
- Detect undeclared and unused dependencies in CI.
- Enforce allowed dependency directions such as `web -> contracts`, `api -> contracts/db`, and never `contracts -> app`.
