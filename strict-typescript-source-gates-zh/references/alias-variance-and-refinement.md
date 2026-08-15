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

## 函数、方法与 Effect

`strictFunctionTypes` 收紧普通函数类型，但 method/constructor declaration 来源仍有历史 bivariance。可赋值边界写 function property：

```ts
interface Handler<T> { handle: (value: T) => void }
```

避免 method-shaped boundary。class 实现仍可用 prototype method，因为目标成员形状控制赋值检查。用 `method-signature-style: property` 强制边界，不要把无关实现方法改成每实例字段。

专项审查 concrete class-to-class structural assignment、override 参数缩窄、generic construct signature、bare method callback 和 method-shaped listener/comparer/middleware/visitor contract。construct signature 默认改 factory property。

未知 callback、escaping closure、事件轮次、`await`、getter、Proxy、反射/动态 JS，或声明未表达 mutation effect 的调用之后，不得依赖 mutable property/discriminant 的旧 narrowing。应快照 primitive/真正 immutable value、clone 成自有 immutable data，或事后重验；复制对象引用只会创建另一条 mutable alias。状态机优先替换 immutable discriminated-union state，不原地改 discriminant。

compiler/lint 可管 strict function type、function-property boundary、readonly 公共 collection、parameter mutation、unbound method 和部分语法 pattern；完整执行需要跨过程 alias/effect analysis。不得声称 ESLint 证明 closure escape 或间接 mutation 安全。
