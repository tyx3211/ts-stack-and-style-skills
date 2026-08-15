# 数组与索引安全

## 政策

- 普通生产 project 开启 `noUncheckedIndexedAccess`；它只做静态检查，emit 仍是普通 JS 属性访问。
- 维护“应用数组一律 dense”的项目不变量。
- 不需随机访问时优先 `for...of`/iterator；动态索引走 checked helper 或处理 `undefined`。
- 裸索引 `!` 只允许在审计过的 algorithm kernel。

JavaScript 越界读取通常得到 `undefined`，不是 C++ 式 UB；后续可能是 `TypeError`、`NaN` 或状态损坏。该选项也影响开放 index signature：开放 key 优先 `Map<K,V>`，真正封闭 key 才用 `Record<ClosedUnion,V>`。

## Dense 不变量

禁止 `delete array[index]`、扩张 `.length`、far-index write、未完整初始化的 `new Array(length)` 逃逸，以及无明确算法语义的遍历中结构修改。`for...of` 对 hole 可能产生 `undefined` 而 TS 仍写 `T`；`forEach`/`map` 可能跳 hole。两者都不证明 density。

优先 literal、`push`、完整初始化的 `Array.from` 或对已知 dense 输入的转换。

## Checked Access

拒绝负数、小数、非有限数、非安全整数和越界 index；checked write 不得意外扩容。

```ts
export function getOrThrow<T>(values: readonly T[], index: number): T {
  if (!Number.isSafeInteger(index) || index < 0 || index >= values.length) {
    throw new RangeError(`index ${index} outside [0, ${values.length})`);
  }
  // [SAFETY]: 上方已检查 bounds；项目数组按构造纪律保持 dense。
  return values[index]!;
}
```

输入可能 sparse 时，bounds 不够；还要验证 own slot 或在边界 normalize/copy。

## 外部数组、Brand 与 Kernel

assertion function 只证明调用时观察状态；另一条 writable alias 可事后破坏 dense brand。持久保证要求：以 unknown/readonly 接收，验证槽位和元素，copy 到 trusted storage，隐藏 mutable backing array，并只暴露 readonly view/wrapper。不要把 `asserts value is DenseArray<T>` 当 ownership。

只有模块 index-heavy、有直接和 property/fuzz tests、不泄漏 mutable storage、且 benchmark 证明必要时，`*.kernel.ts` 才能窄范围允许 `!`。每个非显然 assertion 都要相邻 `[INDEX INVARIANT]:`，解释 bounds、density、length relation 和保持理由。

不能按文件关闭 `noUncheckedIndexedAccess`；compiler option 作用于 program。真正不同政策需独立 project/package。机器门禁包括该选项、`no-array-delete`、`no-for-in-array`、默认 `no-non-null-assertion`、kernel override 及可选 sparse-construction AST rule。lint 不能证明 density 或 alias lifetime。
