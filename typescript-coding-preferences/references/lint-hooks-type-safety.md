# Lint, Hooks, And Type Safety Reference

## ESLint Baseline

For handwritten main code outside tests, enforce these as errors where the repository tooling supports them:

```txt
tsconfig:
  strict: true
  noImplicitAny: true

ESLint:
  eqeqeq: error
  @typescript-eslint/no-explicit-any: error
  @typescript-eslint/no-unsafe-assignment: error
  @typescript-eslint/no-unsafe-call: error
  @typescript-eslint/no-unsafe-member-access: error
  @typescript-eslint/no-unsafe-return: error
```

Prefer adding `@typescript-eslint/strict-boolean-expressions` and `no-implicit-coercion` when the project can absorb the migration cost. These rules reduce truthy/falsy and coercion mistakes that `eqeqeq` does not cover.

Tests may use narrower exceptions for mocks, fixtures, or third-party compatibility, but do not let test exceptions leak into `src/` or other main production directories.

## `any`, `unknown`, And Assertions

Use `unknown` for external or unchecked values:

```ts
const raw: unknown = JSON.parse(text);
```

Then validate before use:

```ts
function parseFiniteNumber(value: unknown, name: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`${name} must be a finite number`);
  }

  return value;
}
```

Avoid assertion-as-validation:

```ts
// Avoid: this only tells TypeScript to trust us; it does not convert or validate.
const weight = payload.weight as number;
```

Prefer guard/schema narrowing:

```ts
const WeightSchema = z.number().finite().positive();
const weight = WeightSchema.parse(payload.weight);
```

`satisfies` and `as const` are generally acceptable because they preserve or check type information without pretending that unknown runtime data has been validated. Treat non-null assertions (`value!`) with the same suspicion as `as`: they are allowed only when an invariant is locally obvious or already checked.

## Equality And Numeric Safety

`eqeqeq` prevents loose equality such as `"0" == 0`, but it is not a full correctness proof.

Still guard against:

- `NaN`, because `NaN === NaN` is false and `typeof NaN === "number"` is true.
- `Infinity`, because it is also a `number`.
- `0` or negative values when business logic requires positive values.
- truthy/falsy mistakes around `0`, `""`, `null`, and `undefined`.
- `||` defaulting where `??` is intended.

For core algorithms, validate before entering the algorithm:

```ts
function gcd(a: number, b: number): number {
  if (!Number.isFinite(a) || !Number.isFinite(b)) {
    throw new Error("gcd arguments must be finite");
  }

  if (b === 0) {
    return a;
  }

  return gcd(b, a % b);
}
```

## Hooks And CI/CD

Use automation to turn project rules into hard constraints:

```txt
pre-commit:
  format/lint changed files, block explicit any, loose equality, stale generated files

pre-push:
  run typecheck, lint, core tests, contract/codegen consistency

CI:
  run full clean-environment verify, build, test, contract diff, artifact checks
```

Keep hooks thin. A hook should call stable commands rather than reimplement logic:

```bash
npm run lint
npm run typecheck
npm run verify
```

Expose a small set of reliable commands to agents and humans:

```txt
npm run fmt
npm run lint
npm run typecheck
npm run build
npm run test
npm run verify
```

`build` should mean a trusted build, not just transpilation. In TS projects using fast transpilers such as SWC, keep a separate command like `build:transpile`; make the public `build` run typecheck, lint, transpile, required codegen, and generated-file consistency checks.

Hook and CI failures should be explicit and actionable:

```txt
ESLint failed: explicit any is forbidden in src/.
Type check failed; build aborted before transpilation.
Generated OpenAPI client is stale. Run npm run gen:api and commit the diff.
```

## Generated Code

Do not lint generated code with the same strict rule set as handwritten production code by default.

Prefer:

- handwritten code: strict lint, format, typecheck.
- generated code: format if committed, compile/typecheck, regenerate-and-diff check.
- generator code: strict lint and tests.

If generated code must be linted, put it in a dedicated directory with a separate, intentionally looser lint config. Fix generator output by changing the generator, not by hand-editing generated files.

## Review Checklist

- Does main non-test code contain explicit `any`?
- Did any `unknown` value get used without guard/schema narrowing?
- Did an `as` assertion replace a real runtime check?
- Are loose equality, implicit coercion, or truthy/falsy checks hiding business semantics?
- Are numeric inputs checked with `Number.isFinite` and domain range rules?
- Do hooks call shared commands instead of duplicating hidden logic?
- Does CI run the same core checks in a clean environment?
- Are generated files verified by regenerate-and-diff rather than hand-maintained?
