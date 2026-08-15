# Corpus integration audit — 2026-08-15

This document records the decisions made while integrating the local GPT chat-export corpus into this repository. It is an audit trail, not an installable skill and not a claim that conversation text is authoritative.

## Corpus handling

- 103 top-level Markdown chat exports were moved, not copied, from `D:\chromeDownload` and `C:\Users\William\Downloads` into `C:\Data\gpt-chat-export-corpus`.
- 50 conversations selected by full-text topic search are under `ts-skill-relevant/`; 53 other technical conversations are under `other-technical/`.
- Nested project documentation and this Git repository were not treated as chat exports and were not moved.
- Retrieval inspected conversation question blocks and full-text topic matches, not filenames alone.

## Review process

The corpus was reviewed by theme, then independently challenged by medium-reasoning agents for:

- TypeScript escape hatches, arrays, variance, aliasing, guards, overloads, brands, and monkey patching;
- workspace/package graphs, module resolution, build tools, declarations, and release validation;
- PostgreSQL/Redis projection and cache consistency;
- async desktop, CLI, Electron, sidecar, SQLite, and multi-process correctness;
- Result/exception/Promise failure ownership;
- skill boundaries, progressive disclosure, bilingual structure, and validation harnesses.

Rules were adopted only after reconciling conflicting conversation conclusions and checking time-sensitive tool claims against primary documentation.

## Material corrections

1. **Async does not imply a command queue.** A queue orders work within one owner; it is not a transaction, a cross-process lock, or durable recovery. For a deliberately single-instance small GUI/TUI with one state owner, a process-local owner queue can still be the cheapest correct way to serialize mutations across `await`; UI debounce is not that queue. Use SQLite/database constraints, CAS, outbox, or reconciliation when the actual boundary includes persistence, multiple processes, or external effects.
2. **A cache version prevents regression, not latest-state staleness.** Plain delete loses the version fence and permits an old in-flight miss fill to resurrect obsolete data. Version floors, equal-version digests, outbox delivery, and primary-read freshness checks have distinct roles.
3. **Type guards and assertion functions are trusted claims.** Explicit `x is T` and `asserts x is T` are not proved from the implementation. A guard may centralize runtime proof and audit, but it does not turn a false predicate into safety.
4. **Overloads are not intrinsically unsound.** The risky case is a claimed input/output correlation that the implementation body and compiler do not prove. Project policy still defaults away from overloads and audits necessary correlated overloads as trusted boundaries.
5. **Do not ban every cross-scope mutable alias.** Ban incompatible writable views and mutable widening; re-read or snapshot truly immutable values across opaque callbacks and `await`. A second mutable reference is not an immutable snapshot.
6. **`noUncheckedIndexedAccess` is not a runtime bounds check.** Dense-array ownership, sparse-array construction rules, checked random access, and reviewed algorithm-kernel exceptions remain necessary.
7. **TypeScript 7 uses `typescript` and `tsc`.** Old `@typescript/native-preview`/`tsgo` defaults were removed. Embedded-language toolchains may still require a documented TypeScript 6 compatibility path while TypeScript 7 lacks the needed programmatic API.
8. **`paths` does not rewrite emitted imports.** Cross-package imports default to workspace package names plus public `exports`; `tsc-alias` is a legacy exception with published-artifact tests, not the default architecture.
9. **Build, typecheck, and declaration generation are separate pipelines.** Vite/SWC/Rolldown transpilation does not replace typechecking. `tsup` is no longer actively maintained; deprecated `rollup-plugin-ts` guidance was not retained. Declaration rollup and API Extractor are conditional governance tools, not mandatory for every package.
10. **Result, absence, and exceptions have different owners.** Expected caller-handled failures use narrow feature unions; ordinary absence uses `null`/`undefined`; invariants and startup defects throw; terminating HTTP/job/process boundaries own exhaustive mapping and final logging.
11. **Lucia v3 is not a current auth-library choice.** Its own migration documentation marks the library deprecated and now presents Lucia as a learning resource. New stack guidance keeps maintained auth products, managed OIDC, or a deliberately designed session layer as the alternatives.
12. **Type escape hatches are not limited to `as` and `!`.** Caller-supplied generic results, method bivariance tricks, generic constructors, typed key helpers, decorator/DI runtime claims, total-map assumptions, unchecked JS, `noCheck`, excluded runtime files, and transpile-only verdicts all expand trust. The registry now classifies them and the AST inventory covers the mechanically recognizable subset.
13. **TypeScript 7 CLI and compiler-API tooling need an explicit compatibility graph.** TS7.0 is the authoritative CLI but has no programmatic API. The executable recommendation uses the official TS7 plus TS6-API alias layout, pins the AST parser locally, reports its version, and rejects global fallback.
14. **Reference implementations are recommendations, not universal architecture.** The skills enforce ownership, artifact, security, and verification invariants. Agents may choose a better project-specific organization after comparing it against a runnable baseline and providing equivalent evidence.

## Machine enforcement boundary

The repository validator checks UTF-8, frontmatter, metadata, line limits, direct reference links, bilingual structure, and routing-fixture coverage. Source-gate scripts inventory explicit TypeScript trust boundaries. These tools reduce omissions and make exceptional code reviewable; they do not prove semantic, concurrency, cache, or security correctness.

## Primary time-sensitive sources

- [TypeScript 7.0 announcement](https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/)
- [typescript-eslint dependency versions](https://typescript-eslint.io/users/dependency-versions/)
- [oRPC Hono adapter](https://orpc.dev/docs/adapters/hono)
- [TypeScript module-resolution reference](https://www.typescriptlang.org/docs/handbook/modules/reference)
- [Vite production and library builds](https://vite.dev/guide/build)
- [Vite 8 migration to Rolldown/Oxc](https://vite.dev/guide/migration.html)
- [tsup maintenance notice](https://github.com/egoist/tsup)
- [Electron application lifecycle and single-instance API](https://www.electronjs.org/docs/latest/api/app)
- [SQLite isolation](https://www.sqlite.org/isolation.html)
- [PostgreSQL advisory-lock functions](https://www.postgresql.org/docs/current/functions-admin.html#FUNCTIONS-ADVISORY-LOCKS)
- [Lucia v3 migration notice](https://lucia-auth.com/lucia-v3/migrate)
