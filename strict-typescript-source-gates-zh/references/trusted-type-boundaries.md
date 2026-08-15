# 可信类型边界

## Predicate、Assertion 与泛型关系

显式 `value is T` 和 `asserts value is T` 都是 trust boundary：TypeScript 不验证函数体是否建立声明结论。把 `as T` 换成 assertion function，只有真实 runtime validation 才改善审计，不会自动生成证明。

优先 schema result parsing、普通 narrowing/inferred predicate、完整校验显式 predicate、完整校验 assertion function，最后才是 invariant 无法独立观察时的窄范围 assertion。记录检查内容、剩余假设和 negative tests。

runtime branch 收窄 value，不会普遍为所有实例重绑泛型 `T`。TS 有有限 contextual generic narrowing，而 conditional type 可在实例化时 deferred/distributed。禁止以参数泛型 conditional return 模拟 overload，尤其实现需要 assertion 时；优先拆函数、discriminated input/output、keyed map 或 schema-derived mapping。不可避免的 relational generic API 要相邻实现并覆盖实例测试。

## Overload 与 Brand

Overload 并非自动 unsafe，但宽 implementation signature 不一定证明每个 input/output correlation。declaration 与 exhaustive dispatch 相邻；不用 `any`/assertion 硬过；每分支 runtime test、每签名 type test；无法证明的 correlation 加 `[SAFETY]:`。keyed event map 优于 overloaded callback，`unified-signatures` 合并无必要 overload。

phantom/`unique symbol` brand 没 runtime tag，安全来自构造收口。集中 constructor，优先可独立验证 check，不导出“任意 bless” assertion。provenance 无法从值恢复时，诚实的窄 `as Brand` + `[SAFETY]:` 优于伪 guard。mutable brand 必须 copy/隐藏存储；runtime wrapper 只在 identity/封装价值值得成本时使用。

## Declaration、Augmentation 与 Monkey Patch

`declare`、手写 `.d.ts`、`declare global` 和 module augmentation 只向 checker 注入承诺，不安装 runtime 行为。隔离项目 declaration，写明 runtime provider、load point、版本和 contract test；通过稳定 path/exported symbol 互指；拒绝 unsafe merging/global pollution；边界 package 保持 `skipLibCheck:false`。第三方 declaration 不替代 JSON/network/database/IPC/plugin runtime validation。

普通 production 禁止 monkey patch。极少数 test/polyfill/tracing/compatibility patch 必须进专用 side-effect module，有显式 load order，在 runtime mutation 和 augmentation 两端写 `[TRUSTME]:`，稳定互指，contract-test runtime shape，测试后恢复状态，并说明 collision/version 假设。

发版前 inventory 所有边界。标签只表示存在人工声明，不证明实现正确。
