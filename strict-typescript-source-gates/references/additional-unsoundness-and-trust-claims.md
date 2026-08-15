# Additional Unsoundness And Trust Claims

## Classification Rule

Do not classify only syntax named `as` or `!` as an escape hatch. A project-owned declaration, type argument, wrapper, configuration, or structural assignment is also a trusted claim when the checker cannot establish the runtime relation.

The policy has three outcomes:

1. Prefer a mechanically checked shape that removes the claim.
2. Forbid a pattern that has no narrow, testable invariant.
3. Isolate a necessary claim, add `[SAFETY]:` or `[TRUSTME]:`, inventory it, and attach runtime or type tests.

Trust upstream TypeScript standard-library declarations as maintained dependencies. Still audit project code that supplies a type parameter or wrapper promise the upstream API cannot validate.

## Caller-Supplied Generic Runtime Claims

Treat these as assertions at a distance when the type argument is not derived from a runtime schema or generated protocol:

- `response.json<T>()`, HTTP/SDK `get<T>()` or `request<T>()`;
- raw database `query<T>()`, storage `getItem<T>()`, deserializers and message codecs;
- `ipc.invoke<T>()`, plugin/service-locator `resolve<T>()`, and event-bus payload claims;
- DOM `querySelector<T>()` where the selector does not prove the element class;
- typed `Object.keys`/`entries` helpers that promise `(keyof T)[]` despite possible runtime extra keys.

Prefer schema-coupled APIs whose return type is inferred from the schema, generated clients tied to a versioned contract, or `unknown` followed by parsing. Otherwise isolate the call in a boundary adapter:

```ts
// [SAFETY]: generated protocol v12 and the wire compatibility test establish this DTO.
const raw = await transport.request<UserDto>(request);
```

The inventory script heuristically flags explicit type arguments on common runtime claim names. Add repository-local AST rules for the actual SDK, database, IPC, and DI APIs in use; a generic name list cannot be complete.

## Variance, Structural Assignment, And Ownership Claims

Reviewed escapes include:

- method-shaped assignable interfaces that rely on historical parameter bivariance;
- `bivarianceHack` and equivalent indexed-method tricks;
- parameter-narrowing overrides or class-to-class structural assignments not proved substitutable;
- callback contracts that rely on optional/required parameter interchangeability or an open rest parameter as “infinitely optional”; prefer exact tuple-rest signatures when arity matters;
- generic construct signatures that accept classes as factories;
- incompatible writable widening, readonly-to-writable views, or shared mutable array/container views;
- mutable branded values whose backing storage can be changed through another alias.

Default replacements are function-property boundaries, factories, immutable snapshots, copies before widening, private backing storage, and explicit adapters. A compatibility boundary may keep one of these patterns only in a small module with negative type tests and runtime contract tests.

`readonly`, variance annotations, `as const`, and private TypeScript fields are not ownership, deep immutability, runtime freeze, or a security boundary. They are not escape hatches by themselves; code becomes a trusted claim when it relies on them for a property they do not provide.

Other structural traps need explicit modeling rather than labels everywhere: a generic parameter that never appears in a member does not distinguish instantiations; class instance compatibility ignores constructors and static members; numeric enums remain number-compatible. Do not use empty phantom generics, constructor names, or numeric enums as authorization, wire validation, units, or nominal identity. Add a real branded/private member, factory contract, or runtime schema as appropriate.

## Lookup And Collection Claims

- `noUncheckedIndexedAccess` is mandatory but cannot prove array density or runtime bounds.
- Do not use `Record<string, V>` or a total string index signature to mean an arbitrary partial dictionary while assuming every key exists. Prefer `Map`, `Partial<Record<K,V>>`, a closed key union, or explicit `V | undefined`.
- `Array.isArray` establishes array shape, not element types. Treat elements as `unknown` until validated; do not let its library-level `any[]` predicate contaminate core code.
- Typed key enumeration, dense-array brands, tuple construction helpers, and unchecked kernel indexing are audited constructors, not general proofs.

## Effect And Wrapper Claims

Do not retain mutable refinements across unknown callbacks, `await`, getters, proxies, reflective calls, event turns, or escaping closures. Decorators, proxies, monkey patches, serialization hooks, and DI containers can replace or manufacture behavior that declarations only describe.

When a decorator/wrapper changes call, construction, field initialization, or lifecycle behavior, isolate it as a runtime/type contract boundary. Test the transformed artifact and generated metadata; `emitDecoratorMetadata` is incomplete design-type metadata, not runtime input validation or dependency proof.

Void-return assignability is also not Promise ownership. A Promise-returning callback passed to a `() => void` sink needs an explicit owner; enforce `no-misused-promises` with `checksVoidReturn` and `no-floating-promises`.

## Configuration And Build Escapes

Treat each of these as a configuration-level trust expansion requiring explicit review, an owner, and expiry/removal plan:

- disabling `strict` or any required strictness flag;
- `skipLibCheck:true` in an application exception;
- `allowJs:true` with unchecked JavaScript entering core code;
- `noCheck`, transpile-only release paths, or emit/bundle success presented as type safety;
- files excluded from the authoritative project but imported or executed at runtime;
- framework/test/codegen compilers using a different type universe without compatibility tests;
- generated declarations or clients accepted without drift and consumer checks.

Do not place `[SAFETY]:` inside JSON and pretend a comment makes the option safe. Register configuration escapes in a versioned policy file or exception registry and make CI diff them.

## Harness Coverage

Use the compiler and ESLint for strict flags, unsafe `any`, Promise ownership, method signatures, assertions, and common API misuse. Use `audit-type-escapes.mjs` for AST inventory of explicit claims. Add project-specific AST rules for generic runtime APIs, decorators, typed-key helpers, and compatibility hacks. Use type tests for variance and correlations, runtime negative tests for schemas and wrappers, and artifact/consumer tests for declarations.

With `--compatibility-heuristics`, the inventory additionally reports parameterized method signatures and function-type nodes with optional parameters or non-tuple open rest parameters. These are deliberately high-noise declaration-shape hints: they can be entirely valid and do not prove that any unsafe assignment occurred. Keep the flag opt-in for a targeted boundary review or an intentionally method-free/function-property codebase; do not turn it into a repository-wide mandatory failure gate without measuring and accepting the false-positive policy. A strict callback boundary uses an exact tuple when runtime arity matters, or records and tests why open arity is safe.

No general TS lint proves alias lifetime, array density, effect purity, runtime schema fidelity, decorator behavior, or cross-package artifact agreement. Those stay explicit human-reviewed invariants backed by the narrowest executable evidence available.

Primary language references: [TypeScript type compatibility and deliberate unsoundness](https://www.typescriptlang.org/docs/handbook/type-compatibility), [checked indexed access](https://www.typescriptlang.org/tsconfig/noUncheckedIndexedAccess.html), and [declaration files as runtime promises](https://www.typescriptlang.org/docs/handbook/modules/theory.html#the-role-of-declaration-files).
