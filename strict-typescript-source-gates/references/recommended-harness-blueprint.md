# Recommended Harness Blueprint

This is a working baseline, not a mandatory repository shape. Keep the invariants and evidence; replace the packages or command graph when the project has a better verified fit.

## Current TypeScript 7 Compatibility Baseline

TypeScript 7.0 provides the authoritative `tsc` CLI but no programmatic compiler API. Type-aware ESLint and this skill's AST inventory therefore need the TypeScript 6 compatibility API side-by-side.

```json
{
  "devDependencies": {
    "@typescript/native": "npm:typescript@7.0.2",
    "typescript": "npm:@typescript/typescript6@6.0.2"
  },
  "scripts": {
    "typecheck": "tsc --noEmit --pretty false",
    "typecheck:api-compat": "tsc6 --noEmit --pretty false",
    "lint": "eslint \"src/**/*.{ts,tsx,mts,cts}\" --max-warnings=0",
    "audit:type-escapes": "node path/to/audit-type-escapes.mjs --deny-unreviewed src",
    "build:artifact": "<framework-or-package artifact command>",
    "verify": "npm run lint && npm run typecheck && npm run typecheck:api-compat && npm run audit:type-escapes && npm run test && npm run build:artifact",
    "build": "npm run verify"
  }
}
```

Lock exact resolved versions. Verify the wiring in CI:

```sh
npx tsc --version
npx tsc6 --version
node -p "require('typescript').version"
```

The first command must be TS7; the API import must be the supported TS6 compatibility version. Never fall back to a global compiler. Recheck this layout when TS7 gains a supported programmatic API or typescript-eslint changes its support range.

Primary references:

- [TypeScript 7 side-by-side guidance](https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/#running-side-by-side-with-typescript-60)
- [typescript-eslint dependency versions](https://typescript-eslint.io/users/dependency-versions/)
- [typescript-eslint typed linting](https://typescript-eslint.io/getting-started/typed-linting/)

## Typed ESLint Shape

Use the current flat-config API and a project-aware parser. The exact imports and presets depend on pinned versions; the required properties are:

- files restricted to handwritten production TypeScript;
- `projectService` or explicit project configs with a stable root;
- a type-checked strict preset plus the explicit rules in `SKILL.md`;
- separate policies for tests, generated files, declarations, migrations, and legacy adapters;
- unsupported TypeScript API versions visible as failures, not hidden warnings;
- deliberately failing fixtures proving every critical local rule is active.

Do not copy a partial `rules` object and call it a complete ESLint installation. Start from the official typed-linting setup for the pinned release, merge the project rules, then execute negative fixtures through the public `lint` command.

## Command Semantics

- `build:artifact` emits or bundles artifacts and may assume earlier checks.
- `verify` is the aggregate release gate.
- `typecheck:api-compat` proves that sources consumed by TS6-based typed lint/AST tooling remain parseable and type-consistent. If intentional TS7-only syntax makes that impossible, replace this command with a pinned parser/fixture compatibility gate and document the reduced coverage; do not silently omit it.
- In this suggested baseline, public `build` aliases `verify`, so “build passed” means the trusted gate passed and cannot recurse.
- A framework that requires `build` to mean artifact-only may keep that convention, but CI and agent instructions must call `verify` as the verdict and must not describe raw build success as correctness.

## Permitted Alternatives

An agent may choose a different layout when it records:

1. which compiler is the authoritative checker;
2. which pinned parser/API powers type-aware lint and AST tools;
3. how global/floating tool fallback is prevented;
4. the non-recursive artifact and aggregate command graph;
5. negative fixtures and clean-environment evidence.

Compare the alternative against this baseline explicitly. Architectural freedom is welcome; losing an invariant silently is not.
