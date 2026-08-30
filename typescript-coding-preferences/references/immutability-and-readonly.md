# Immutability And Readonly Capabilities

## Model The Capability Actually Needed

Use the least powerful construct that states the contract:

| Construct | Static contract | It does not prove |
| --- | --- | --- |
| `const value` | the binding cannot be reassigned | the referenced value is immutable |
| `readonly field` | that property cannot be reassigned through this view | the referenced object cannot mutate |
| `readonly T[]` | this view cannot add, remove, reorder, or replace array slots | element immutability, ownership, or absence of another writable alias |
| readonly tuple | fixed typed slots cannot be assigned through this view | deep immutability of values stored in the slots |
| `ReadonlyMap<K, V>` | no `set`, `delete`, or `clear` through this view | immutable values or immutable backing storage |
| `ReadonlySet<T>` | no `add`, `delete`, or `clear` through this view | immutable elements or immutable backing storage |
| `Readonly<T>` | the first property layer is readonly | recursive readonly or runtime freeze |
| a mature `ReadonlyDeep<T>` | a library-defined recursive readonly interpretation | ownership, alias isolation, runtime freeze, or universal class/framework compatibility |

Call these readonly capability views, not immutable objects. JavaScript runs the same objects, arrays, maps, and sets. Another alias may still mutate the backing storage.

## Arrays And Tuples

Accept a readonly array whenever the callee does not need array mutation:

```ts
function total(values: readonly number[]): number {
  // values.push(1); // rejected
  // values[0] = 1;  // rejected
  return values.reduce((sum, value) => sum + value, 0);
}

const working: number[] = [1, 2, 3];
total(working); // mutable input can be viewed as readonly
working.push(4); // the owner still has a writable alias
```

`readonly T[]` and `ReadonlyArray<T>` describe the same ordinary array view. Prefer the shorter form for simple arrays; use `ReadonlyArray<T>` where generic syntax reads better. Neither makes object elements readonly:

```ts
type Item = { count: number };

function inspect(items: readonly Item[]): void {
  items[0]?.count++; // allowed: the array is readonly, Item is not
}
```

A tuple preserves length and the type/name of each position:

```ts
type Point = readonly [x: number, y: number];

function distance(point: Point): number {
  // point[0] = 0; // rejected
  return Math.hypot(point[0], point[1]);
}
```

Use a readonly tuple for fixed records and correlated arguments, not as a substitute for a named object when field meaning or evolution needs object syntax.

## Maps And Sets

Use readonly collection interfaces when consumers only query or iterate:

```ts
function findUser(
  users: ReadonlyMap<string, User>,
  activeIds: ReadonlySet<string>,
  id: string,
): User | undefined {
  if (!activeIds.has(id)) return undefined;
  return users.get(id);
}
```

These are interfaces, not wrappers or copies. A mutable `Map`/`Set` is assignable to the readonly view, and its owner can still mutate it later. Values and elements also keep their own mutability. If a stable snapshot must survive callbacks, event turns, or `await`, own/copy the data or revalidate after the effect.

## Published Immutable Data

For immutable-by-contract values such as completed DTOs, configuration snapshots, protocol payloads, event payload data, and persistent AST snapshots, default fields to `readonly` unless mutation is part of the model:

```ts
interface BuildSnapshot {
  readonly revision: string;
  readonly inputs: readonly InputSnapshot[];
  readonly aliases: ReadonlyMap<string, string>;
}
```

This policy applies to values after publication, not blindly to every category name. Builders, accumulators, caches, stateful classes, framework event objects, generated types, and in-progress AST transforms may intentionally be mutable.

Prefer a visible lifecycle:

```text
mutable construction -> validate/copy -> publish readonly data -> replace whole value
```

Separate mutable construction state from the published type when that materially clarifies ownership. A shallow spread only copies the outer object; choose copying/freezing/persistent structures according to the actual runtime guarantee. `Object.freeze` is shallow unless a separately reviewed deep-freeze implementation traverses the complete supported object graph.

## Construction And Syntax Noise

Readonly properties are initialized normally in an object literal. A class may initialize a readonly property at its declaration or in its constructor; constructor parameter properties keep this compact:

```ts
interface User {
  readonly id: string;
  readonly name: string;
  readonly roles: readonly string[];
}

const user: User = {
  id: "u-1",
  name: "William",
  roles: ["admin"],
};

class UserValue {
  constructor(
    readonly id: string,
    readonly name: string,
  ) {}
}
```

There is no general `readonly User` or `const User` object-type syntax. `const` protects a value binding, not the referenced object. Use the built-in shallow mapped type when one top-level policy improves readability:

```ts
type User = Readonly<{
  id: string;
  name: string;
  roles: readonly string[];
}>;
```

Choose syntax by auditability, not uniformity:

- Prefer explicit `readonly` fields for small or important public types because the capability is visible at each property.
- Prefer `Readonly<{ ... }>` when every top-level property has the same policy and the wrapper reduces repeated noise. Nested mutable collections still need explicit readonly collection types.
- Do not maintain complete mutable and readonly twins by default. Use local mutable variables inside a factory and return the published readonly type. Introduce a `Draft` or builder only when incomplete mutable construction genuinely crosses functions, modules, or lifecycle stages.
- Copy a mutable collection before publication when another alias can outlive construction. A readonly return annotation alone does not sever aliases.
- Use `as const` mainly for literal constants, lookup tables, discriminants, and readonly tuples. It also preserves narrow literal types, so do not apply it mechanically to all domain objects. `satisfies` checks a relation but does not itself make the value readonly.
- `Readonly<SomeClass>` does not prevent method calls or methods from changing private/internal state. Model intentionally stateful entities with encapsulated mutation rather than advertising them as immutable snapshots.

## Deep Readonly Policy

Do not define a naive repository-wide recursive mapped type and apply it to arbitrary objects. Functions, overloads, constructors, maps, sets, tuples, arrays, built-ins, class instances, and third-party framework types need distinct semantics.

Use a pinned, tested `ReadonlyDeep` implementation or a domain-specific JSON-data type only when all of these hold:

1. the value is an owned or deliberately published immutable data tree;
2. construction and mutation happen before publication or in a separate builder;
3. consumer and negative type tests cover the supported shapes;
4. interoperability with schemas, generated types, and external libraries is measured;
5. code never describes the type view as runtime freeze, alias isolation, or a Rust borrow guarantee.

Prefer explicit fields and collection capabilities when they make the contract easier to audit than mentally expanding one large `ReadonlyDeep<SomeType>`.

## Agent Review Checklist

- Is mutation an intentional domain operation or merely convenient local implementation?
- Does `readonly field` protect only the property binding while its referent stays mutable?
- Are array slots readonly but elements still mutable?
- Can another alias mutate the same array, map, set, or nested object?
- Does a snapshot cross an unknown callback, event turn, getter, proxy, or `await`?
- Is runtime immutability actually required, and if so where is ownership/copy/freeze established?
- Would `ReadonlyDeep` improve the domain contract enough to justify its propagation and interoperability cost?

Primary references: [TypeScript readonly properties](https://www.typescriptlang.org/docs/handbook/2/objects.html#readonly-properties), [readonly arrays and tuples](https://www.typescriptlang.org/docs/handbook/release-notes/typescript-3-4.html#improvements-for-readonlyarray-and-readonly-tuples), and [Type-Fest `ReadonlyDeep`](https://github.com/sindresorhus/type-fest/blob/main/source/readonly-deep.d.ts).
