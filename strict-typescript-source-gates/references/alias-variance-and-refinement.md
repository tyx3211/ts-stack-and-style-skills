# Alias, Variance, And Refinement Safety

## Ban Incompatible Writable Views

Do not ban every alias. Ban different writable type views of the same storage:

```ts
type Box<T> = { value: T };
const narrow: Box<string> = { value: "safe" };
const wide: Box<string | number> = narrow; // forbidden
wide.value = 42;
narrow.value.toUpperCase();
```

Width subtyping that forgets unrelated fields is distinct. Depth widening of writable fields, mutable arrays, discriminants, and read/write generic containers is dangerous. Readonly producers may be covariant; consumers contravariant; read/write storage must be invariant by project policy. Copy before mutating a widened collection.

`readonly` is shallow and compile-time-only. Another alias may mutate the backing object; it is not ownership, deep immutability, or runtime freeze.

## Readonly Capability Ladder

Use `const` for a stable binding, `readonly field` for property reassignment control, `readonly T[]` or a readonly tuple for array-slot control, and `ReadonlyMap`/`ReadonlySet` for query-only collection views. These are the same runtime values with reduced static mutation capability. Array elements, map values, set elements, and nested referents retain their own mutability; another alias may mutate the same storage.

For immutable-by-contract DTOs, config snapshots, protocol/event payload data, and published AST snapshots, prefer explicit readonly fields after construction. Do not apply the rule mechanically to builders, accumulators, caches, stateful classes, framework objects, generated types, or transforms whose contract includes mutation.

Construction may initialize readonly fields normally. Use explicit fields when property-level visibility helps review, or a shallow `Readonly<{ ... }>` when every top-level field shares the policy and the wrapper reduces noise. Prefer local mutable construction followed by a readonly return over duplicate mutable/readonly shapes; introduce a draft or builder only for a real multi-stage lifecycle. `Readonly<T>` does not make nested collections readonly, sever aliases, or prevent a class method from mutating internal state.

Do not default arbitrary parameters to a recursive `ReadonlyDeep`. Use a pinned and tested deep-readonly implementation only for owned or deliberately published immutable data trees, with consumer tests for maps, sets, tuples, arrays, functions, classes, schemas, and third-party types. Runtime immutability requires a separately established ownership/copy/freeze or persistent-data contract.

`prefer-readonly-parameter-types` recursively evaluates nested values and can recreate deep-readonly contagion. Make it an opt-in error for deliberately immutable modules with measured allowlists, not a blanket production gate. `no-param-reassign` with `props:true` catches direct assignment/delete/update but not `array.push()`, other mutating methods, escaping aliases, or indirect effects. Combine narrow lint with explicit types and human alias review.

## Functions And Methods

`strictFunctionTypes` tightens ordinary function types, while method/constructor declaration origins retain historical bivariance. Assignable boundaries use function properties:

```ts
interface Handler<T> { handle: (value: T) => void }
```

Avoid method-shaped boundary signatures. Class implementations may remain prototype methods because the target member shape controls assignment. Enforce boundaries with `method-signature-style: property` without rewriting unrelated implementation methods.

Review concrete class-to-class structural assignments, narrowed override parameters, generic construct signatures, bare method callbacks, and method-shaped listener/comparer/middleware/visitor contracts. Prefer factory properties over construct signatures.

## Refinement Across Effects

Do not rely on a mutable property/discriminant narrowing after an unknown callback, escaping closure, event turn, `await`, getter, Proxy, reflective/dynamic JavaScript, or a declaration that omits mutation effects.

Snapshot a primitive or genuinely immutable value, clone to owned immutable data, or revalidate afterward. Copying an object reference merely creates another mutable alias. Prefer replacing immutable discriminated-union states over mutating discriminants in place.

Compiler/lint can enforce strict function types, function-property boundaries, readonly public collections, parameter-mutation bans, unbound methods, and selected syntactic patterns. Complete enforcement needs interprocedural alias/effect analysis; never claim ESLint proves closure escape or indirect mutation safety.

Review whether two writable views disagree, whether a callback retains a reference, whether narrowing crosses mutation, whether “ownership” means an actual copy/hidden store, and whether readonly APIs are backed by caller-owned mutable storage.
