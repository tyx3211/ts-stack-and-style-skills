# Object Modeling Reference

## Decision Table

| Need | Preferred shape | Avoid |
| --- | --- | --- |
| DTO, API payload, config, row data | plain object + `type`/`interface` | class just for ceremony |
| Domain entity/value object with intrinsic behavior | `class + interface`, no `extends` by default | every method becoming business workflow |
| Many tiny data objects, no intrinsic behavior | plain data + external functions/Ops | per-instance function properties |
| Finite variant family | discriminated union + `switch` | open inheritance hierarchy |
| Cross-resource workflow | helper/usecase/service function | entity method doing I/O |
| Small capability object such as repo/cache/client | factory-returned object or module object | deep DI container by default |

## Class As Struct Shell

Use classes as a data/invariant shell plus shared prototype methods:

```ts
interface PriceLike {
  isZero(): boolean;
  add(delta: number): Price;
}

export class Price implements PriceLike {
  constructor(public readonly value: number) {}

  isZero(): boolean {
    return this.value === 0;
  }

  add(delta: number): Price {
    return new Price(this.value + delta);
  }
}
```

Keep these methods intrinsic: they should mainly depend on `this` and simple arguments. Do not put database persistence, policy checks, or request context into this class.

## Data Interfaces Vs Capability Interfaces

Do this:

```ts
export interface UserData {
  id: string;
  name: string;
}

export interface UserService {
  rename(user: UserData, newName: string): UserData;
}
```

Avoid this for large data instances:

```ts
export interface User {
  id: string;
  name: string;
  rename(newName: string): User;
}
```

The first keeps `user` as data and makes the service/ops object the behavior implementer. The second pushes behavior onto every instance.

## Operations Modules

Use static grouping when flat functions become hard to scan:

```ts
interface UserOperations {
  rename(user: UserData, newName: string): UserData;
  displayName(user: UserData): string;
}

export const UserOps = {
  rename(user: UserData, newName: string): UserData {
    return { ...user, name: newName };
  },

  displayName(user: UserData): string {
    return user.name.trim();
  },
} satisfies UserOperations;
```

This is a namespace-like grouping container, not an instance. It keeps functions shared and keeps data instances thin.

## Tag Dispatch

Use tag dispatch for finite families:

```ts
type Node =
  | { kind: "lit"; value: number }
  | { kind: "binary"; op: "+" | "-"; left: Node; right: Node };

export function evalNode(node: Node): number {
  switch (node.kind) {
    case "lit":
      return node.value;
    case "binary": {
      const left = evalNode(node.left);
      const right = evalNode(node.right);
      return node.op === "+" ? left + right : left - right;
    }
  }
}
```

Prefer this over Visitor-style class hierarchies when the variant set is known and new operations are more common than new variants.

## `this` Discipline

Do not pass prototype methods directly:

```ts
// Avoid: this can be lost.
items.map(price.format);
```

Use one of these:

```ts
items.map((item) => price.format(item));
items.map((item) => formatPrice(price, item));
```

The point is not banning class methods; it is preventing accidental `this` loss and hidden binding costs.
