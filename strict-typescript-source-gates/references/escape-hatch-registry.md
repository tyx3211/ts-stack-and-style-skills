# TypeScript Escape-Hatch Registry

## Classification

Treat this registry as the TypeScript analogue of Rust's `unsafe` review discipline, not as a ban list. A necessary escape may improve clarity and interoperability; the requirement is to expose and minimize the trusted surface, state the invariant, attach executable evidence where possible, and make release review cheap. Unlike Rust `unsafe`, this boundary is enforced by repository policy, lint, inventory, tests, and review rather than by the TypeScript language.

Forbidden in handwritten production source:

- explicit/implicit `any`, `@ts-ignore`, `@ts-nocheck`, double assertions;
- unvalidated JSON/SDK/IPC/database/network data treated as application types;
- production monkey patches outside reviewed modules;
- blanket/file-wide lint disables;
- JavaScript entering core source without `checkJs` or a validated adapter.

Reviewed escapes only:

- assertions other than `as const`, non-null and definite-assignment assertions;
- explicit predicates/assertion signatures;
- overload/conditional-generic correlations;
- caller-supplied generic runtime claims from HTTP/SDK/database/IPC/DOM/storage APIs;
- method-shaped assignable boundaries, bivariance hacks, open optional/rest callback arity, parameter-narrowing compatibility adapters, and generic construct signatures;
- brand construction;
- ambient declarations, `.d.ts`, augmentation, declaration merging;
- generic construct boundaries;
- rare tracked single-line `@ts-expect-error`;
- exact-rule minimum-range lint disables;
- kernel index assertions;
- measured application `skipLibCheck:true`.
- registered configuration relaxations such as unchecked JS, `noCheck`, excluded runtime source, or a compatibility compiler/type universe.

Not escapes: `unknown` before validation, `satisfies`, allowed `as const`, schema success/error parsing, and ordinary checker-understood narrowing. `readonly` is not an escape but is shallow.

## Labels And Inventory

Use an adjacent leading comment or same-line trailing `[SAFETY]:`, `[TRUSTME]:`, or `[INDEX INVARIANT]:` comment containing evidence, owner/contract, or bounds/density reasoning. The brackets and following colon are required; unbracketed legacy labels do not count. An unrelated statement breaks the association. The script requires `[TRUSTME]:` for declarations, augmentation, merging, and monkey patches; non-null indexing accepts `[INDEX INVARIANT]:` or `[SAFETY]:`; other reviewed escapes accept `[SAFETY]:` or `[TRUSTME]:`. Block/file-wide or multi-rule lint disables remain policy failures and cannot be blessed by a label. The script records the claim but does not judge its truth.

```sh
node <skill>/scripts/audit-type-escapes.mjs src
node <skill>/scripts/audit-type-escapes.mjs --json src packages/core/src
node <skill>/scripts/audit-type-escapes.mjs --deny-unreviewed src
node <skill>/scripts/audit-type-escapes.mjs --compatibility-heuristics src
```

By default it inventories assertions except `as const`, non-null/definite assignment, explicit predicates/asserts, overloads, generic construct signatures, common caller-supplied runtime generics, TS directives, lint disables, ambient declarations/augmentations, and prototype/global mutation clues. The opt-in compatibility heuristic also reports parameterized method signatures and open optional/rest function types; it is a high-noise review aid, not a default deny gate or evidence that an unsafe assignment occurred. Project-specific generic APIs and configuration escapes need additional gates. The script is not runtime-validation, alias, effect, density, variance, or overload proof; false positives/negatives are possible.

Release flow: run full lint and authoritative `tsc`; deny unreviewed escapes; diff a stored JSON baseline if used; inspect every changed claim; verify declarations against runtime providers; run negative parser/predicate/brand/overload tests and kernel property/fuzz tests. A directory named `unsafe` narrows the audit surface but does not globally bless its contents.
