# Build And Declaration Pipelines

## Tool Selection

### Vite 8 And Rolldown

Use Vite for browser applications and Vite-oriented library builds. Vite 8 uses Rolldown as its unified bundler and Oxc-based transforms; do not reason from the old “esbuild in dev, Rollup in production” architecture. Existing Rollup-style options/plugins may pass through compatibility layers, but verify nontrivial plugins during migration.

Vite transforms TypeScript but does not replace a complete project typecheck. Run `tsc --noEmit` or the framework-aware checker. Final apps do not publish declarations. Library mode must externalize host-owned dependencies/peers and pair runtime entries with declaration entries.

### SWC

Use SWC for fast JavaScript transformation only. It works file by file and does not perform a complete TypeScript typecheck. Pair it with an explicit typecheck. For a library, add a separate declaration pipeline.

### tsdown And Legacy tsup

Do not select tsup for a new toolchain: its repository says it is not actively maintained and recommends tsdown. Existing tsup packages may remain temporarily when stable; isolate their config and plan migration.

Prefer tsdown for a new small-to-medium TypeScript library when a Rolldown-based library bundler fits the required formats and plugins. Review migration differences rather than mechanically renaming commands: defaults, dependency externalization, plugin APIs, declaration behavior, output names, and cleaning differ. Pin the version and test emitted package metadata and consumers.

Do not let either tool's declaration convenience replace independent typecheck and package validation.

## Three Pipelines

### Typecheck

Run the pinned compiler or framework checker over handwritten source. Keep this gate independent from JavaScript bundling.

### Runtime JavaScript

Choose one owner per package: compiler emit for transparent Node libraries/services, or a bundler for browser, serverless, executable, multi-format, or intentional bundle requirements. Validate platform, target, externals, module format, sourcemaps, and dynamic loading.

### Declarations

- Use `declaration` when the compiler owns JS and type output together.
- Use `emitDeclarationOnly` when another tool owns JavaScript.
- Use `declarationMap` only when navigation to shipped/available source is desired.
- Consider `isolatedDeclarations` only when the public API is annotated enough for syntactic declaration emit and the pinned toolchain supports the workflow.
- Preserve per-entry declarations for multi-entry packages unless a rollup design explicitly covers every public entry.

## API Extractor

Add API Extractor only for a stable/public library that benefits from API reports, release-tag governance, documentation models, or a deliberate `.d.ts` rollup. It consumes previously emitted declarations; it is not a compiler, alias fixer, runtime bundler, or typecheck replacement.

Its declaration rollup is naturally single-entry oriented. For a multi-entry package, keep per-entry declarations or design separate extractor entry points; do not collapse exports accidentally. Internal packages and final apps normally do not need API Extractor.

## Artifact Assertions

- Every `exports` runtime target exists and loads in its declared environment.
- Every `types` target exists and resolves under the supported TypeScript module modes.
- Runtime and declaration entry sets match.
- External dependencies remain external when required.
- Source maps reference available sources without leaking unintended paths.
