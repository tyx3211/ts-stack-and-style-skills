# 对象建模参考

## 决策表

| 需求 | 优先形态 | 避免 |
| --- | --- | --- |
| DTO、API payload（载荷）、配置、行数据 | 普通对象 + `type` / `interface` | 只是为了仪式感而使用 class |
| 有内禀行为的领域实体 / 值对象 | `class + interface`，默认不要 `extends` | 把每个方法都写成业务流程 |
| 大量小数据对象、没有内禀行为 | 普通数据 + 外部函数 / Ops | 给每个实例挂函数属性 |
| 有限变体族 | discriminated union（可判别联合）+ `switch` | 开放式继承层级 |
| 跨资源工作流 | helper / usecase / service 函数 | 在 entity 方法里做 I/O |
| 少量 capability object（能力对象），如 repo / cache / client | factory 返回对象或模块对象 | 默认上深层 DI 容器 |

## 把 Class 当成结构外壳

可以把 class 用作“数据与不变量外壳 + 共享原型方法”：

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

这些方法应保持内禀，也就是主要只依赖 `this` 和少量简单参数。不要把数据库持久化、策略判断或请求上下文塞进这个 class 里。

## 数据 Interface 与能力 Interface 分离

推荐这样写：

```ts
export interface UserData {
  id: string;
  name: string;
}

export interface UserService {
  rename(user: UserData, newName: string): UserData;
}
```

应避免在大量数据实例上这样写：

```ts
export interface User {
  id: string;
  name: string;
  rename(newName: string): User;
}
```

前一种写法让 `user` 保持数据对象，把行为交给 service / ops 对象实现；后一种写法会把行为推到每个实例上。

## Operations Module

当纯平函数开始变得不易扫描时，可以用静态分组：

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

这里的 `UserOps` 更像命名空间式分组容器，而不是实例。它的价值是共享函数实现，同时保持数据实例本身轻薄。

## 标签分发

对于有限变体族，优先使用 tag dispatch（标签分发）：

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

当变体集合已知，而且新增操作比新增变体更常见时，这种写法通常比 Visitor 风格 class 层级更直接。

## `this` 纪律

不要直接把原型方法裸传出去：

```ts
// 避免：this 可能丢失。
items.map(price.format);
```

更安全的写法是：

```ts
items.map((item) => price.format(item));
items.map((item) => formatPrice(price, item));
```

这里的重点不是禁止 class 方法，而是避免意外丢失 `this`，以及避免隐藏的绑定成本。
