---
name: typescript-monorepo-toolchain
description: Design, modify, review, debug, or validate TypeScript monorepo toolchains involving npm/pnpm/Yarn workspaces, package boundaries, package.json exports/imports, TypeScript project references, tsconfig graphs, path aliases, tsc build mode, Vite/Rolldown, SWC, tsdown/legacy tsup, declaration generation, API Extractor, task caching, oRPC contract packages, or package publishing and consumer fixtures.
---

# TypeScript Monorepo Toolchain

## Overview

Treat a TypeScript monorepo as three coordinated graphs: workspace packages define installation and ownership, `package.json` defines runtime/public module boundaries, and `tsconfig` defines TypeScript project boundaries. Make every resolver and artifact agree; editor success alone is not evidence that production works.

## Workflow

1. Inventory runtimes, deployment units, published packages, private packages, entry points, consumers, module formats, and code-generation owners.
2. Draw the package dependency DAG before changing configs. Reject cycles and undeclared dependencies.
3. Choose exactly one consumption mode for each shared package: dist-first or source-first.
4. Define `exports`/`imports` and public subpaths before adding TypeScript aliases.
5. Decide whether project references add useful build isolation. Do not add `composite` by habit.
6. Separate type checking, runtime JavaScript production, and declaration production.
7. Make root scripts and any task runner express the same DAG with correct cache inputs and outputs.
8. Validate clean installation, runtime resolution, declarations, packed artifacts, and representative consumers.

Load [workspace-and-package-graph.md](references/workspace-and-package-graph.md) when creating packages, choosing dist-first versus source-first, or defining dependency ownership.

Load [project-references-and-tsconfig.md](references/project-references-and-tsconfig.md) when editing solution configs, `references`, `composite`, `tsc -b`, TypeScript 7 migration, or mixed app/library configs.

Load [package-exports-and-resolution.md](references/package-exports-and-resolution.md) when editing `exports`, `imports`, aliases, ESM/CJS entry points, deep-import policy, or `tsc-alias`.

Load [build-and-declaration-pipelines.md](references/build-and-declaration-pipelines.md) when choosing Vite 8/Rolldown, SWC, tsdown, legacy tsup, declaration emit, declaration rollup, or API Extractor.

Load [orpc-contract-packages.md](references/orpc-contract-packages.md) when an oRPC/Zod/Valibot contract package is shared by API and frontend consumers.

Load [validation-cache-and-release.md](references/validation-cache-and-release.md) when defining CI, task caching, package validation, publication, or packed consumer fixtures.

Load [agent-driven-reference-blueprint.md](references/agent-driven-reference-blueprint.md) when a project needs a concrete but non-mandatory starting point combining contracts, monorepo packages, Electron/main/sidecar ownership, and the build/verification graph. Agents may deviate when they compare evidence against the same invariants.

## Consumption Modes

### Dist-first

Use dist-first for published libraries, Node-consumed runtime packages, stable reusable libraries, and packages whose production boundary must be exercised during development.

- Point `exports` and type entry points at built files under `dist/`.
- Emit runtime JavaScript when the package contains runtime values.
- Emit declarations for TypeScript consumers; add declaration maps only when source navigation is useful and sources are available.
- Build or watch upstream packages before running downstream consumers.
- Prefer this as the conservative default for cross-runtime packages.

### Source-first

Use source-first only for private packages whose complete dev, test, build, and runtime toolchain intentionally consumes TypeScript source.

- Point controlled entry points at source and verify every consumer can transform the syntax.
- Do not claim plain-Node or publishable-package compatibility without packed consumer tests.
- Do not add a parallel dist path that differs silently from development resolution.
- Switch to dist-first when a package crosses an uncontrolled runtime, repository, or publication boundary.

## Hard Rules

- Import across packages by package name and exported subpath, never by `../../packages/foo/src/...`.
- Declare a dependency in the consuming package even if root hoisting makes it resolve.
- Treat `exports` as public API metadata, not a complete architecture firewall; block relative filesystem bypasses with lint or dependency-boundary tooling.
- Do not use TypeScript `paths` as a package manager or runtime resolver.
- Do not let frontend packages import backend runtime, database, filesystem, or secret-bearing packages.
- Keep final applications as leaf consumers. Do not publish or import an app as if it were a library.
- Make code generation owned by one package and diff generated artifacts in CI.
- Keep public script names such as `typecheck`, `build`, `test`, and `verify` stable while implementations evolve.

## TypeScript 7 Baseline

- TypeScript 7 is the stable native CLI checker. In CLI-only projects, pin the standard `typescript` package. While programmatic API consumers exist, use and verify the official side-by-side alias layout: TS7 may be installed as `@typescript/native`, the package named `typescript` supplies `@typescript/typescript6`, and `tsc` must still resolve to TS7. Never use a global fallback.
- TypeScript 7 removed `baseUrl`; make `paths` targets relative to their tsconfig when aliases remain.
- Set `rootDir` and required global `types` explicitly where TypeScript 7 defaults would change output or ambient types.
- Keep TypeScript 6 API tooling side-by-side only for programmatic consumers such as typescript-eslint, AST rules, or framework/embedded-language tools. Check each consumer's current support and retire the compatibility track when TS7 exposes a supported API.
- Treat `tsc -b --noEmit` as version-sensitive. Validate it against the pinned compiler and a minimal real reference graph before adoption; the portable default is real build mode for buildable libraries plus separate no-emit checks for leaf apps.

## Pipeline Rule

Always model these independently:

1. Type checking: `tsc --noEmit`, build mode, or framework-aware checker.
2. Runtime JavaScript: `tsc` emit, Vite/Rolldown, SWC, tsdown, or another runtime builder.
3. Declarations: `tsc`/framework declaration emit, optional declaration bundling, and API-surface validation.

A fast transpiler passing does not prove types are correct. A JavaScript bundle passing does not prove declarations resolve. A declaration rollup does not prove runtime exports work.

## Review Checklist

- Does every package have an explicit owner, consumer set, runtime, and consumption mode?
- Do workspace dependencies, project references, and task dependencies describe the same acyclic graph?
- Do `exports`, declarations, runtime files, and source maps all exist at the paths advertised?
- Are all aliases understood by typecheck, dev, test, build, and production runtime?
- Are typecheck, JavaScript production, and declaration production separately visible and gated?
- Are frontend/backend and server/browser package boundaries mechanically enforced?
- Does CI test a clean checkout rather than relying on stale `dist` or editor redirects?
- Are packed artifacts installed in representative consumer fixtures before publication?
