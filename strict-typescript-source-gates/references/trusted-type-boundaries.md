# Trusted Type Boundaries

## Explicit Predicates And Assertions

Explicit `value is T` and `asserts value is T` are trust boundaries: TypeScript does not verify that their bodies establish the declared result. Replacing `as T` with an assertion function improves locality only when it performs meaningful runtime validation.

Prefer schema result parsing, ordinary narrowing/inferred predicates, explicit predicates with complete checks, assertion functions with complete checks, then narrow reviewed assertions for invariants that cannot be independently observed. Document checks, remaining assumptions, and negative tests.

## Generic Conditional Returns

A runtime branch narrows a value; it does not generally rebind generic `T` for all instantiations. TypeScript has limited contextual generic narrowing, while conditional types may be deferred/distributed during instantiation. Avoid parameter-generic conditional returns used to simulate overloads when implementation requires assertions. Prefer separate functions, discriminated input/output unions, keyed maps, or schema-derived mappings. Co-locate and test unavoidable relational generic APIs.

## Overloads

Overloads are not automatically unsafe, but a broad implementation signature may not prove every promised input/output correlation. Keep declarations adjacent to exhaustive dispatch, use neither `any` nor assertions to force implementation, add runtime tests per branch and type tests per signature, and add `[SAFETY]:` for unproved correlations. Prefer keyed event maps to overloaded callbacks. Use `unified-signatures` to collapse unnecessary overloads.

## Brands

Phantom/`unique symbol` brands have no runtime tag; safety comes from controlled construction. Centralize brand constructors, prefer independently verifiable checks, and do not export public “bless anything” assertions. For provenance that cannot be recovered from a value, an honest narrow `as Brand` plus `[SAFETY]:` is better than a fake guard. Copy/hide mutable branded storage. Use runtime wrappers only when their identity/encapsulation value justifies the cost.

## Declarations And Augmentation

`declare`, handwritten `.d.ts`, `declare global`, and module augmentation inject checker promises but install no runtime behavior. Isolate project-owned declarations; identify runtime provider, load point, version, and contract test; link declaration and implementation by stable path/exported symbol; reject unsafe merging/global pollution; keep boundary packages on `skipLibCheck:false`. Third-party declarations do not validate runtime JSON/network/database/IPC/plugin data.

## Monkey Patches

Forbid ordinary production monkey patches. A rare test/polyfill/tracing/compatibility patch lives in a dedicated side-effect module, has explicit load order, carries `[TRUSTME]:` at runtime mutation and augmentation, links both sides by stable symbol, contract-tests runtime shape, restores test state, and documents collision/version assumptions.

Inventory all these boundaries before release. A label records that a human claim exists; it does not prove the implementation.
