---
name: strict-typescript-source-gates
description: Use when writing, reviewing, or enforcing strict handwritten TypeScript source, including tsconfig, ESLint, scripts, hooks, CI, arrays and indexed access, mutable aliases and variance, narrowing across callbacks or await, type guards and assertion functions, overloads, branded types, declarations or augmentations, monkey patches, and TypeScript escape-hatch or release audits.
---

# Strict TypeScript Source Gates

## Objective And Scope

Treat the compiler, lint, tests, package scripts, hooks, CI, and human review as one feedback system. Prefer machine-enforced rules. When TypeScript is intentionally unsound or cannot prove a relation, isolate the trust decision, label it, test it, and inventory it.

Apply the strict policy to handwritten production `src/`. Put tests, fixtures, generated code, migrations, vendored code, and legacy adapters on separate explicit policies; never let their relaxations leak into production.

## Load Focused References

- Arrays, holes, checked access, and kernels: [references/array-and-index-safety.md](references/array-and-index-safety.md).
- Mutable widening, variance, aliases, callbacks, and `await`: [references/alias-variance-and-refinement.md](references/alias-variance-and-refinement.md).
- Predicates, assertions, overloads, brands, declarations, augmentation, and monkey patches: [references/trusted-type-boundaries.md](references/trusted-type-boundaries.md).
- Escape classification and release inventory: [references/escape-hatch-registry.md](references/escape-hatch-registry.md).
- Caller-supplied generics, method bivariance, lookup claims, decorators, configuration escapes, and other less-obvious unsoundness: [references/additional-unsoundness-and-trust-claims.md](references/additional-unsoundness-and-trust-claims.md).
- A non-mandatory but executable TS7/TS6 API, typed-ESLint, audit, and build command baseline: [references/recommended-harness-blueprint.md](references/recommended-harness-blueprint.md).

Also load `backend-data-correctness` for database/Redis/transaction correctness.

## Required Workflow

1. Inspect the installed TypeScript, runtime, module model, configs, and source boundaries.
2. Confirm each rule is active; do not infer coverage from a preset name.
3. Implement the smallest changes that close the requested gaps.
4. Run the same public commands used by agents, hooks, and CI.
5. For trust-boundary or release work, run `scripts/audit-type-escapes.mjs --deny-unreviewed <paths>`.
6. Review every escape and every `[SAFETY]:`, `[TRUSTME]:`, or `[INDEX INVARIANT]:` claim.
7. Report intentional exceptions and checks that remain human-audited.

The audit is an inventory heuristic, not alias/effect analysis or a soundness proof.

## Stable Commands

```json
{
  "scripts": {
    "lint": "eslint \"src/**/*.{ts,tsx,mts,cts}\" --cache --cache-location .cache/eslint --max-warnings=0",
    "typecheck": "tsc --noEmit --pretty false",
    "audit:type-escapes": "node path/to/audit-type-escapes.mjs --deny-unreviewed src",
    "build:artifact": "<framework-or-package artifact command>",
    "verify": "npm run lint && npm run typecheck && npm run audit:type-escapes && npm run test && npm run build:artifact",
    "build": "npm run verify"
  }
}
```

In this recommended command graph, `build:artifact` is emit/bundle work, `verify` is the aggregate verdict, and public `build` aliases `verify` without recursion. A framework may keep artifact-only `build`, but then CI and agents must use `verify` as the verdict and never describe raw transpilation as correctness. Changed-file lint may supplement but never replace full lint.

## Compiler Baseline

Use this for new NodeNext server packages unless the target requires a documented difference:

```jsonc
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022"],
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "esModuleInterop": true,
    "types": ["node"],
    "strict": true,
    "noImplicitAny": true,
    "strictFunctionTypes": true,
    "strictNullChecks": true,
    "useUnknownInCatchVariables": true,
    "exactOptionalPropertyTypes": true,
    "noUncheckedIndexedAccess": true,
    "noPropertyAccessFromIndexSignature": true,
    "noImplicitOverride": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "allowUnreachableCode": false,
    "allowUnusedLabels": false,
    "verbatimModuleSyntax": true,
    "isolatedModules": true,
    "moduleDetection": "force",
    "noUncheckedSideEffectImports": true,
    "forceConsistentCasingInFileNames": true,
    "skipLibCheck": false
  }
}
```

Keep policy flags explicit even when the installed version defaults them on. Prefer `skipLibCheck:false` for libraries, shared packages, contracts, infrastructure, and trusted boundaries. An app may use `true` only as a measured, documented declaration-trust compromise.

Use TypeScript 7 `tsc` as the authoritative checker. TS7.0 has no programmatic compiler API, so tools such as typescript-eslint and this skill's AST inventory require a pinned TypeScript 6 compatibility API. The current official side-by-side baseline aliases TS7 as `@typescript/native` and `@typescript/typescript6` as the package named `typescript`; it must be verified rather than inferred. Do not use obsolete `@typescript/native-preview`/`tsgo` layouts or a global fallback. Embedded-language tooling may use the same explicit TS6 compatibility track, but it is not authoritative for ordinary `.ts`. See the recommended harness blueprint for exact wiring and permitted alternatives.

## ESLint Baseline

Enable type-aware lint for production source and confirm each rule exists in the installed version. The following is a policy fragment, not a complete flat-config installation; the final config must include pinned imports, a project-aware parser/project service, file policies, and failing fixtures as described in the recommended harness blueprint:

```js
export default [{
  files: ["src/**/*.{ts,tsx,mts,cts}"],
  rules: {
    eqeqeq: ["error", "always"],
    "no-implicit-coercion": "error",
    "@typescript-eslint/no-explicit-any": "error",
    "@typescript-eslint/no-unsafe-assignment": "error",
    "@typescript-eslint/no-unsafe-argument": "error",
    "@typescript-eslint/no-unsafe-call": "error",
    "@typescript-eslint/no-unsafe-member-access": "error",
    "@typescript-eslint/no-unsafe-return": "error",
    "@typescript-eslint/no-unsafe-type-assertion": "error",
    "@typescript-eslint/no-unnecessary-type-assertion": "error",
    "@typescript-eslint/no-non-null-assertion": "error",
    "@typescript-eslint/strict-boolean-expressions": "error",
    "@typescript-eslint/method-signature-style": ["error", "property"],
    "@typescript-eslint/no-array-delete": "error",
    "@typescript-eslint/no-for-in-array": "error",
    "@typescript-eslint/no-floating-promises": "error",
    "@typescript-eslint/no-misused-promises": ["error", { "checksVoidReturn": true }],
    "@typescript-eslint/switch-exhaustiveness-check": "error",
    "@typescript-eslint/only-throw-error": "error",
    "@typescript-eslint/use-unknown-in-catch-callback-variable": "error",
    "@typescript-eslint/no-unsafe-declaration-merging": "error",
    "@typescript-eslint/unbound-method": "error",
    "@typescript-eslint/unified-signatures": "error"
  }
}];
```

Use `consistent-type-assertions`, `no-restricted-syntax`, or a local AST rule to allow `as const` but reject other assertions by default. `no-unsafe-type-assertion` alone does not ban every `as`. Use `prefer-readonly-parameter-types:error` in core/domain/lib/shared/protocol code; it may be `warn` in measured framework-heavy glue. `readonly` is shallow and does not prove ownership.

## Non-Negotiable Source Rules

- External input starts as `unknown` and crosses a runtime parser/schema.
- Permit `as const`; prefer `satisfies`. Other assertions are exceptions, never validation.
- Ban `JSON.parse(...) as T`, `as unknown as T`, and unvalidated SDK/IPC/database/network values.
- Treat caller-supplied generic runtime results such as `json<T>()`, `query<T>()`, `invoke<T>()`, and `querySelector<T>()` as remote assertions unless tied to runtime validation or generated contract evidence.
- Use discriminated unions and exhaustive switches for finite states.
- Use function properties at assignable callback/handler/visitor/comparer/middleware/listener boundaries. Class implementations may remain prototype methods.
- Do not narrow override parameters; `noImplicitOverride` does not close method bivariance.
- Do not pass bare methods as callbacks.
- Public collections are readonly by default; copy before mutating a widened collection.
- Do not retain a mutable property refinement across unknown callbacks, escaping closures, event turns, or `await`; snapshot stable immutable data or revalidate.
- Prefer factories over generic constructor signatures in plugin/registry/DI boundaries.
- Forbid ordinary production monkey patches and ambient promises about runtime behavior.

## Review Labels

Follow a Rust-`unsafe`-inspired philosophy: necessary escape hatches are welcome when they are the clearest implementation, but their trust boundary must be explicit, narrow, mechanically inventoried, evidence-backed, and easy to review. Do not hide flexibility behind innocent-looking helpers or fake guards. These labels are a project audit convention, not a claim that TypeScript provides Rust's compiler-enforced `unsafe` boundary.

```ts
// [SAFETY]: <runtime evidence and why it establishes the claimed invariant>
// [TRUSTME]: <external declaration/runtime contract, owner, and verification>
// [INDEX INVARIANT]: <bounds, density, length relation, and preservation argument>
```

Keep exceptions narrow and link stable files plus exported symbols, not line numbers alone. A label is review evidence, not proof.

Forbid `@ts-ignore` and `@ts-nocheck`. A rare `@ts-expect-error` is single-line, tracked, and fails when unused. Lint disables name one rule, cover the minimum range, carry a label, and are reported when unused.

## Performance And Review

Default to full cached ESLint plus full `tsc --noEmit`. Oxlint may add a fast path, but retain ESLint for uncovered semantic rules. Prove coverage using deliberately failing fixtures for assertions, `any`, sparse arrays, method-shaped boundaries, Promise misuse, declarations, and unbound methods. Optimize only after measurement and human approval; watch state is not a release verdict.

Before acceptance verify: full shared commands pass with pinned local tool versions; configuration relaxations and source escapes are inventoried; arrays are dense and checked; mutable widening aliases are absent; refinements are revalidated after effects; callback boundaries use function properties; generic runtime claims are validated or labeled; and every fast path catches the policy fixtures.
