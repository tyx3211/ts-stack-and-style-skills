# Array And Index Safety

## Policy

- Enable `noUncheckedIndexedAccess` for ordinary production projects.
- It is static only; emitted JavaScript performs normal property access.
- Maintain a project invariant that application arrays are dense.
- Prefer `for...of`/iterators when random access is unnecessary.
- Use checked helpers or handle `undefined` for dynamic indexes.
- Permit raw indexed `!` only in audited algorithm kernels.

Out-of-range JavaScript reads usually produce `undefined`, not C++-style UB. Later failures include `TypeError`, `NaN`, or corrupted application state. The compiler option also affects open index signatures; use `Map<K,V>` for open keys and `Record<ClosedUnion,V>` only for genuinely closed keys.

## Dense Invariant

Forbid `delete array[index]`, `.length` expansion, far-index writes, escaping incompletely initialized `new Array(length)`, and unplanned structural mutation while iterating. `for...of` can yield `undefined` for a hole while TypeScript still says `T`; `forEach`/`map` may skip holes. Neither proves density.

Prefer literals, `push`, `Array.from` with complete initialization, or transformations over known-dense inputs.

## Checked Access

Reject negative, fractional, non-finite, unsafe-integer, and out-of-range indexes. Checked writes must not extend the array.

```ts
export function getOrThrow<T>(values: readonly T[], index: number): T {
  if (!Number.isSafeInteger(index) || index < 0 || index >= values.length) {
    throw new RangeError(`index ${index} outside [0, ${values.length})`);
  }
  // [SAFETY]: bounds checked above; project arrays are dense by construction.
  return values[index]!;
}
```

If sparse input is possible, bounds alone are insufficient; validate own slots or normalize/copy at the boundary.

## External And Branded Arrays

An assertion function proves only the observed moment. Another writable alias can invalidate a dense brand later. For a persistent guarantee: receive unknown/readonly data, validate slots and elements, copy into trusted storage, hide the mutable backing array, and expose a readonly view or wrapper. Do not treat `asserts value is DenseArray<T>` as ownership.

## Kernel Protocol

A narrow `*.kernel.ts` lint override may allow `!` only when the module is index-heavy, directly and property/fuzz tested, does not leak mutable storage, and benchmark evidence justifies avoiding helpers. Every non-obvious assertion needs an adjacent `[INDEX INVARIANT]:` covering bounds, density, length relations, and preservation.

Do not disable `noUncheckedIndexedAccess` per file; compiler options apply to a program. A genuinely independent policy requires a separate project/package. Prefer keeping the option enabled.

Machine gates: `noUncheckedIndexedAccess`, `no-array-delete`, `no-for-in-array`, default `no-non-null-assertion`, a kernel-only override, and optional local AST rules for sparse construction. No lint rule proves density or alias lifetime.
