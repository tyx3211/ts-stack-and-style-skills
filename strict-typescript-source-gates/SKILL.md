---
name: strict-typescript-source-gates
description: Use when defining, tightening, reviewing, or enforcing TypeScript source-code tsconfig, ESLint, npm scripts, git hooks, CI gates, assertion policy, or variance-safety rules for handwritten src code.
---

# Strict TypeScript Source Gates

## Overview

For handwritten `src/` TypeScript, treat the compiler, ESLint, package scripts, git hooks, and CI as one hard gate. The goal is to close the usual AI-generated escape hatches: `any`, unsafe assertions, unchecked external input, loose equality, bivariant callback shapes, stale generated files, and builds that skip verification.

## Scope

- Apply these rules to handwritten source code under `src/` or equivalent production source directories.
- Keep tests, fixtures, mocks, generated code, migrations, and vendored code on separate configs with explicit relaxations.
- Do not let relaxed test or generated-code rules leak into `src/`.
- For migration work, isolate weakly typed legacy adapters behind boundary modules instead of weakening the whole project.

## Default Gate

- Default to full ESLint with cache: run the full source lint target with `--cache` and `--max-warnings=0`.
- `npm run lint` should lint `src/` fully, not only changed files. Changed-file lint can be an additional fast pre-commit step.
- `npm run typecheck` should run the project type checker with no emit.
- `npm run build` must not mean transpile-only. It must include lint, typecheck, required code generation checks, and the build artifact step.
- `npm run verify` should be the shared command used by agents, humans, pre-push hooks, and CI.
- If full ESLint becomes too heavy in a large project, first keep the same semantic gate and then experiment with `oxlint` for fast lint classes plus `tsgo` or `tsc --noEmit` for type-aware checks. Do not replace type-aware ESLint rules until parity is proven.

Recommended scripts:

```json
{
  "scripts": {
    "lint": "eslint \"src/**/*.{ts,tsx}\" --cache --cache-location .cache/eslint --max-warnings=0",
    "typecheck": "tsc --noEmit",
    "build": "npm run lint && npm run typecheck && npm run build:artifact",
    "verify": "npm run lint && npm run typecheck && npm run test"
  }
}
```

When a repository uses `tsgo`, keep the same public command names and make the implementation explicit:

```json
{
  "scripts": {
    "typecheck": "tsgo --noEmit",
    "verify": "npm run lint && npm run typecheck && npm run test"
  }
}
```

## TSConfig Baseline

Use this as the strict baseline for new NodeNext server-side packages unless the framework owns the config or the package is intentionally different:

```jsonc
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022"],
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
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

    "skipLibCheck": false,
    "rootDir": "src",
    "outDir": "dist",
    "sourceMap": true
  },
  "include": ["src/**/*.ts"]
}
```

Notes:

- Keep `strict` and `noImplicitAny` explicit even when a TypeScript version defaults them on.
- `strictFunctionTypes` is included by `strict`, but keep it explicit because variance safety is part of the policy.
- Prefer `skipLibCheck: false` for libraries, shared packages, infrastructure packages, and boundary-sensitive code. Large apps may use `skipLibCheck: true` only as a documented performance compromise; it trusts declaration-file boundary types and skips many internal `.d.ts` errors.
- If `erasableSyntaxOnly` is available and the project wants Node-native TypeScript compatibility, consider enabling it, but treat the migration as explicit because enums, namespaces, and parameter properties are affected.

## ESLint Baseline

For `src/`, enforce at least:

```js
export default [
  {
    files: ["src/**/*.{ts,tsx}"],
    rules: {
      eqeqeq: ["error", "always"],
      "no-implicit-coercion": "error",
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-unsafe-assignment": "error",
      "@typescript-eslint/no-unsafe-argument": "error",
      "@typescript-eslint/no-unsafe-call": "error",
      "@typescript-eslint/no-unsafe-member-access": "error",
      "@typescript-eslint/no-unsafe-return": "error",
      "@typescript-eslint/strict-boolean-expressions": "error",
      "@typescript-eslint/no-unnecessary-type-assertion": "error",
      "@typescript-eslint/method-signature-style": ["error", "property"]
    }
  }
];
```

Assertion policy:

- `as const` is allowed.
- `satisfies` is preferred for checking literals while preserving precise inference.
- Other `as` assertions are forbidden in handwritten `src/` by default. Use guards, discriminated unions, schema parsing, or typed adapter functions.
- The assertion policy must be enforced mechanically through `@typescript-eslint/consistent-type-assertions`, `no-restricted-syntax`, or a local rule that allows `as const` but rejects other `as` assertions.
- Non-null assertions (`value!`) require a local, obvious invariant or a narrow documented interoperability reason.
- `JSON.parse(...) as T`, `payload.value as number`, and `as unknown as T` are policy failures unless isolated inside a boundary adapter with runtime validation.

If the stock ESLint rule set cannot express "allow `as const`, reject other assertions" cleanly for the repository's plugin version, add a small local rule or `no-restricted-syntax` policy instead of weakening the rule.

## Boundary Validation

- External input starts as `unknown`.
- Narrow with schema parsing, `typeof`, discriminated unions, or custom type guards before use.
- Validate numbers with both type and value checks: `typeof value === "number" && Number.isFinite(value)`.
- Keep database rows, API responses, and UI view models separate when their shapes differ.
- Generated OpenAPI clients, oRPC contracts, and schema-derived clients must be regenerated and diff-checked in CI.

## Variance And Unsoundness Rules

TypeScript keeps some unsound behavior for JavaScript compatibility. `strictFunctionTypes` helps, but method and constructor declarations still preserve historical bivariance holes. Project code should close those holes by style and lint rules.

Use function properties for callback-like capabilities:

```ts
type Handler<T> = {
  handle: (value: T) => void;
};
```

Avoid method signatures for generic callback boundaries:

```ts
interface Handler<T> {
  handle(value: T): void;
}
```

Rules:

- Callback, handler, visitor, comparer, middleware, and listener shapes should use function properties, not method signatures.
- Public input collections default to `readonly T[]` or `ReadonlyArray<T>`.
- Only use mutable `T[]` when the function owns the array or explicitly mutates it as part of its contract.
- Do not widen a narrow mutable array by aliasing it, such as assigning `Dog[]` to `Animal[]`. If a mutable widened array is needed, copy first: `const animals: Animal[] = [...dogs]`.
- Do not expose mutable arrays in public APIs unless ownership is explicit.
- Prefer small capability interfaces and composition over inheritance trees.
- For plugin registries, dependency containers, ORM factories, and other generic creation boundaries, prefer factory functions over constructor signatures: `create: (config: Config) => Plugin` instead of `new (config: Config) => Plugin`.
- Class methods are acceptable for intrinsic implementation details, but should not be used as generic callback boundary shapes.

## Hooks And CI

- `pre-commit`: run formatting and fast checks; changed-file lint may run here, but it does not replace full lint.
- `pre-push`: run `npm run verify`.
- CI: run a clean install, code generation consistency checks, full lint, full typecheck, tests, build, and artifact checks.
- Hooks should call shared package scripts. Do not hide different logic inside hook files.
- Every failure message should point to the command the agent should run locally.

## Large-Project Performance Path

Default remains full ESLint plus cache. If the project becomes too large:

1. Keep `npm run verify` semantics stable.
2. Add `oxlint` for fast non-type-aware lint classes.
3. Keep `tsgo --noEmit` or `tsc --noEmit` for type checking.
4. Keep type-aware ESLint rules that are not covered by `oxlint` or the compiler.
5. Prove parity by intentionally testing known violations: explicit `any`, unsafe assignment, unsafe argument, forbidden assertion, method-signature callback, loose equality, and stale generated files.

Do not trade strictness for speed silently. Any faster path must fail on the same policy violations that matter for `src/`.

## Review Checklist

- Does `src/` forbid explicit and implicit `any`?
- Are type assertions limited to `as const`, `satisfies`, or documented boundary adapters with runtime validation?
- Does lint run with full source scope, cache, and `--max-warnings=0`?
- Does `build` include lint and typecheck?
- Do hooks and CI call the same shared scripts?
- Are tests and generated code separated from `src/` policy?
- Are callback-like interfaces using function properties?
- Are public array inputs readonly by default?
- Are mutable widened arrays copied instead of aliased?
- Are constructor types avoided for generic plugin or registry boundaries?
