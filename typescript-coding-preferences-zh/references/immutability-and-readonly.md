# 不可变性与 Readonly Capability

## 只建模真正需要的能力

使用足以表达契约的最弱构造：

| 构造 | 静态契约 | 不能证明 |
| --- | --- | --- |
| `const value` | binding 不可重新赋值 | 引用值不可变 |
| `readonly field` | 不能经该视图重新赋值此 property | 被引用对象不能变化 |
| `readonly T[]` | 不能经该视图增删、重排或替换数组槽位 | 元素不可变、ownership 或不存在其他 writable alias |
| readonly tuple | 不能经该视图赋值固定的 typed slot | 槽位中值的深层不可变性 |
| `ReadonlyMap<K, V>` | 不能经该视图 `set`、`delete` 或 `clear` | value 或 backing storage 不可变 |
| `ReadonlySet<T>` | 不能经该视图 `add`、`delete` 或 `clear` | element 或 backing storage 不可变 |
| `Readonly<T>` | 第一层 property readonly | 递归 readonly 或 runtime freeze |
| 成熟的 `ReadonlyDeep<T>` | 库定义的递归 readonly interpretation | ownership、alias isolation、runtime freeze 或通用 class/framework 兼容性 |

这些应称为 readonly capability view，而不是 immutable object。JavaScript 运行的仍是同一批 object、array、map 和 set；另一个 alias 仍可能修改 backing storage。

## Array 与 Tuple

callee 不需要修改数组时，接收 readonly array：

```ts
function total(values: readonly number[]): number {
  // values.push(1); // rejected
  // values[0] = 1;  // rejected
  return values.reduce((sum, value) => sum + value, 0);
}

const working: number[] = [1, 2, 3];
total(working); // mutable input 可被视作 readonly
working.push(4); // owner 仍拥有 writable alias
```

`readonly T[]` 与 `ReadonlyArray<T>` 描述同一种普通 array view。简单数组优先短写法；泛型语法更清楚时使用 `ReadonlyArray<T>`。二者都不会让 object element readonly：

```ts
type Item = { count: number };

function inspect(items: readonly Item[]): void {
  items[0]?.count++; // allowed：array readonly，Item 并非 readonly
}
```

Tuple 保留长度及每个位置的类型/名称：

```ts
type Point = readonly [x: number, y: number];

function distance(point: Point): number {
  // point[0] = 0; // rejected
  return Math.hypot(point[0], point[1]);
}
```

固定 record 或关联参数适合 readonly tuple；当字段含义和演进更适合 object syntax 时，不要用 tuple 替代命名对象。

## Map 与 Set

consumer 只查询或迭代时，使用 readonly collection interface：

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

它们是 interface，不是 wrapper 或 copy。Mutable `Map`/`Set` 可以赋给 readonly view，而 owner 之后仍能修改原集合；value 与 element 也保留自身可变性。若稳定 snapshot 必须跨 callback、事件轮次或 `await` 存活，应 own/copy 数据或在 effect 后重新验证。

## 已发布的不可变数据

对完成构造并按 immutable contract 发布的 DTO、配置快照、protocol payload、event payload data 和持久 AST snapshot，字段默认 `readonly`，除非 mutation 是模型的一部分：

```ts
interface BuildSnapshot {
  readonly revision: string;
  readonly inputs: readonly InputSnapshot[];
  readonly aliases: ReadonlyMap<string, string>;
}
```

这项政策针对发布后的 value，而不是机械套在所有类别名称上。Builder、accumulator、cache、stateful class、framework event object、generated type 和正在变换的 AST 可以有意 mutable。

优先让生命周期可见：

```text
mutable construction -> validate/copy -> publish readonly data -> replace whole value
```

若能明显澄清 ownership，应把 mutable construction state 与 published type 分开。浅 spread 只复制外层 object；应按实际 runtime guarantee 选择 copy、freeze 或 persistent structure。`Object.freeze` 只是浅层，除非另一个经过审计的 deep-freeze 实现遍历完整的受支持 object graph。

## 构造与语法噪音

Readonly property 可以在 object literal 中正常初始化。Class 可以在字段声明处或 constructor 中初始化 readonly property；constructor parameter property 能保持紧凑：

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

不存在通用的 `readonly User` 或 `const User` object-type 语法。`const` 保护 value binding，不保护被引用对象。若统一的顶层策略更易读，可使用内置的浅层 mapped type：

```ts
type User = Readonly<{
  id: string;
  name: string;
  roles: readonly string[];
}>;
```

应按可审计性选择语法，而不是机械统一：

- 小型或重要 public type 优先显式 `readonly` field，因为每个 property 的 capability 都清楚可见。
- 所有顶层 property 策略一致且 wrapper 能减少重复时，优先 `Readonly<{ ... }>`。Nested mutable collection 仍需显式 readonly collection type。
- 默认不要维护完整的 mutable/readonly 双胞胎。可在 factory 内使用局部 mutable variable，再返回 published readonly type。只有 incomplete mutable construction 确实跨 function、module 或 lifecycle stage 时才引入 `Draft` 或 builder。
- 若另一个 mutable collection alias 能活过构造阶段，发布前应 copy。Readonly return annotation 本身不会切断 alias。
- `as const` 主要用于 literal constant、lookup table、discriminant 和 readonly tuple。它还会保留狭窄 literal type，因此不要机械套给所有 domain object。`satisfies` 只检查关系，本身不会让 value readonly。
- `Readonly<SomeClass>` 不会禁止调用 method，也不会禁止 method 修改 private/internal state。有意 stateful 的 entity 应封装 mutation，而不是宣传成 immutable snapshot。

## Deep Readonly 政策

不要定义一个 naive 全仓递归 mapped type，再套到 arbitrary object 上。Function、overload、constructor、map、set、tuple、array、built-in、class instance 和第三方 framework type 都需要不同语义。

只有同时满足以下条件时，才使用锁定并测试过的 `ReadonlyDeep` 实现或领域专用 JSON data 类型：

1. value 是 owned 或明确作为 immutable data tree 发布；
2. 构造和 mutation 在发布前完成，或放在独立 builder 中；
3. consumer 与 negative type test 覆盖支持的 shape；
4. 已实测与 schema、generated type 和外部库的互操作；
5. 代码不把这种 type view 描述成 runtime freeze、alias isolation 或 Rust borrow guarantee。

当显式字段和 collection capability 比展开一个大型 `ReadonlyDeep<SomeType>` 更容易审计时，优先使用显式写法。

## Agent 审查清单

- Mutation 是有意的领域操作，还是只为局部实现方便？
- `readonly field` 是否只保护 property binding，而 referent 仍可变？
- Array slot readonly 时，element 是否仍可变？
- 是否有另一个 alias 能修改同一 array、map、set 或 nested object？
- Snapshot 是否跨 unknown callback、事件轮次、getter、proxy 或 `await`？
- 是否真的需要 runtime immutability；ownership/copy/freeze 在哪里建立？
- `ReadonlyDeep` 是否足够改善领域契约，值得承担传播与互操作成本？

Primary references：[TypeScript readonly property](https://www.typescriptlang.org/docs/handbook/2/objects.html#readonly-properties)、[readonly array 与 tuple](https://www.typescriptlang.org/docs/handbook/release-notes/typescript-3-4.html#improvements-for-readonlyarray-and-readonly-tuples) 和 [Type-Fest `ReadonlyDeep`](https://github.com/sindresorhus/type-fest/blob/main/source/readonly-deep.d.ts)。
