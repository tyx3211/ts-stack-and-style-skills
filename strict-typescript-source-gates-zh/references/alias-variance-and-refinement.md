# 别名、变型与收窄安全

## 禁止不兼容 Writable View

不要禁止全部 alias；禁止同一存储的不同可写类型视图：

```ts
type Box<T> = { value: T };
const narrow: Box<string> = { value: "safe" };
const wide: Box<string | number> = narrow; // 禁止
wide.value = 42;
narrow.value.toUpperCase();
```

忘记无关字段的 width subtyping 与此不同。可写字段、mutable array、discriminant 和读写泛型容器的 depth widening 才危险。readonly producer 可协变、consumer 可逆变，读写存储按项目政策要求不变。扩宽后要修改时先 copy。

`readonly` 只是浅层编译期视图；其他 alias 仍可修改底层对象。它不是 ownership、deep immutability 或 runtime freeze。

## Readonly Capability 层级

稳定 binding 使用 `const`；控制 property 重新赋值使用 `readonly field`；控制 array slot 使用 `readonly T[]` 或 readonly tuple；只查询 collection 使用 `ReadonlyMap`/`ReadonlySet`。它们仍是同一个 runtime value，只是减少了静态 mutation capability。Array element、map value、set element 与 nested referent 保留自身可变性；另一个 alias 仍可修改同一 storage。

对按 immutable contract 发布的 DTO、config snapshot、protocol/event payload data 和 published AST snapshot，在构造完成后优先显式 readonly field。不得机械套给 builder、accumulator、cache、stateful class、framework object、generated type 或契约本来包含 mutation 的 transform。

构造阶段可以正常初始化 readonly field。Property-level 可见性有助审查时使用显式字段；所有顶层字段策略一致且 wrapper 能减少噪音时，使用浅层 `Readonly<{ ... }>`。优先局部 mutable construction 后返回 readonly type，不要重复完整 mutable/readonly shape；只有真实多阶段 lifecycle 才引入 draft 或 builder。`Readonly<T>` 不会让 nested collection readonly、切断 alias，或阻止 class method 修改 internal state。

不要默认把 arbitrary parameter 变成递归 `ReadonlyDeep`。只有 owned 或明确发布的 immutable data tree 才使用锁定并测试过的 deep-readonly 实现，并用 consumer test 覆盖 map、set、tuple、array、function、class、schema 和第三方类型。Runtime immutability 必须另外建立 ownership/copy/freeze 或 persistent-data contract。

`prefer-readonly-parameter-types` 会递归检查 nested value，可能重新制造 deep-readonly contagion。它只应在刻意 immutable 的 module 中配合实测 allowlist 选择性设为 error，不能作为全 production blanket gate。`no-param-reassign` 配 `props:true` 只抓 direct assignment/delete/update，抓不到 `array.push()`、其他 mutating method、escaping alias 或间接 effect。必须把窄 lint、显式类型和人工 alias review 组合起来。

## 函数、方法与 Effect

`strictFunctionTypes` 收紧普通函数类型，但 method/constructor declaration 来源仍有历史 bivariance。可赋值边界写 function property：

```ts
interface Handler<T> { handle: (value: T) => void }
```

避免 method-shaped boundary。class 实现仍可用 prototype method，因为目标成员形状控制赋值检查。用 `method-signature-style: property` 强制边界，不要把无关实现方法改成每实例字段。

专项审查 concrete class-to-class structural assignment、override 参数缩窄、generic construct signature、bare method callback 和 method-shaped listener/comparer/middleware/visitor contract。construct signature 默认改 factory property。

未知 callback、escaping closure、事件轮次、`await`、getter、Proxy、反射/动态 JS，或声明未表达 mutation effect 的调用之后，不得依赖 mutable property/discriminant 的旧 narrowing。应快照 primitive/真正 immutable value、clone 成自有 immutable data，或事后重验；复制对象引用只会创建另一条 mutable alias。状态机优先替换 immutable discriminated-union state，不原地改 discriminant。

compiler/lint 可管 strict function type、function-property boundary、readonly 公共 collection、parameter mutation、unbound method 和部分语法 pattern；完整执行需要跨过程 alias/effect analysis。不得声称 ESLint 证明 closure escape 或间接 mutation 安全。
