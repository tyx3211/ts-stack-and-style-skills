# 其他不健全入口与可信声明

## 分类规则

不能只把名为 `as` 或 `!` 的语法算作逃生舱。只要 checker 无法建立 runtime 关系，而项目自己的 declaration、type argument、wrapper、配置或 structural assignment 却声明该关系成立，它就是可信声明。

政策只有三种处理：

1. 优先换成机器可检查、能删除该声明的形态。
2. 无法形成窄小且可测试 invariant 的模式直接禁止。
3. 必要声明隔离后加 `[SAFETY]:` 或 `[TRUSTME]:`，进入 inventory，并绑定 runtime/type test。

上游 TypeScript 标准库声明作为受维护依赖予以信任；但项目代码主动提供 type parameter 或包装承诺，而上游 API 无法在 runtime 验证时，仍要审计项目自己的这次声明。

## 调用者提供的泛型 Runtime 声明

当 type argument 不是由 runtime schema 或生成协议推导时，下列写法等价于“远距离 assertion”：

- `response.json<T>()`、HTTP/SDK 的 `get<T>()` / `request<T>()`；
- raw database `query<T>()`、storage `getItem<T>()`、反序列化器和消息 codec；
- `ipc.invoke<T>()`、plugin/service locator 的 `resolve<T>()`、event bus payload 声明；
- selector 不能证明元素 class 的 DOM `querySelector<T>()`；
- 明知 runtime 可能有额外 key，却承诺 `(keyof T)[]` 的 typed `Object.keys` / `entries` helper。

优先使用“返回类型由 schema 推导”的 API、绑定版本化契约的 generated client，或从 `unknown` 开始 parse。否则把调用隔离到 boundary adapter：

```ts
// [SAFETY]: generated protocol v12 与 wire compatibility test 建立此 DTO。
const raw = await transport.request<UserDto>(request);
```

inventory script 会启发式扫描常见 runtime claim 名称上的显式 type argument。仓库还应为实际使用的 SDK、database、IPC 和 DI API 增加本地 AST rule；通用名称清单不可能完备。

## 变型、Structural Assignment 与 Ownership 声明

受审逃生舱还包括：

- 依赖历史 parameter bivariance 的 method-shaped 可赋值 interface；
- `bivarianceHack` 及等价的 indexed-method 技巧；
- 未证明 substitutable 的 override 参数缩窄或 class-to-class structural assignment；
- 依赖 optional/required parameter 互换，或把 open rest parameter 当作“无限 optional”的 callback contract；arity 有意义时优先精确 tuple-rest signature；
- 把 class 当 factory 的 generic construct signature；
- 不兼容 writable widening、readonly-to-writable view，或共享 mutable array/container view；
- backing storage 可被其他 alias 修改的 mutable brand。

默认替代方案是 function-property boundary、factory、immutable snapshot、扩宽前 copy、private backing storage 和显式 adapter。兼容边界只有放在小模块、同时有 negative type test 与 runtime contract test 时，才允许保留上述模式。

`readonly`、variance annotation、`as const` 和 TypeScript private field 都不是 ownership、deep immutability、runtime freeze 或安全边界。它们本身不是逃生舱；只有代码依赖它们去提供其并不具备的保证时，才形成可信声明。

另一些 structural trap 不需要遍地加标签，但必须正确建模：没有出现在任何 member 中的 generic parameter 不能区分不同实例化；class instance compatibility 忽略 constructor/static member；numeric enum 仍与 number compatible。不得把 empty phantom generic、constructor name 或 numeric enum 当 authorization、wire validation、unit 或 nominal identity。按场景增加真正 brand/private member、factory contract 或 runtime schema。

## Lookup 与 Collection 声明

- `noUncheckedIndexedAccess` 必须开启，但不能证明数组 dense 或 runtime bounds。
- 不要用 `Record<string, V>` 或 total string index signature 表示任意 partial dictionary 后又假定每个 key 存在。优先 `Map`、`Partial<Record<K,V>>`、封闭 key union 或显式 `V | undefined`。
- `Array.isArray` 只证明 array 形态，不证明元素类型。元素在校验前按 `unknown` 处理，不允许其标准库 `any[]` predicate 污染 core。
- typed key enumeration、dense-array brand、tuple constructor helper 和 kernel unchecked index 都是受审构造器，不是通用证明。

## Effect 与 Wrapper 声明

不得跨 unknown callback、`await`、getter、Proxy、反射调用、event turn 或 escaping closure 保留 mutable refinement。Decorator、Proxy、monkey patch、serialization hook 和 DI container 都可能替换或制造 declaration 只负责描述的行为。

Decorator/wrapper 改变 call、construction、field initialization 或 lifecycle 时，把它隔离成 runtime/type contract boundary。测试转换后的 artifact 与生成 metadata；`emitDecoratorMetadata` 只是残缺的 design-type metadata，不是 runtime 输入验证或依赖证明。

Void-return assignability 也不代表 Promise 已有人负责。Promise callback 进入 `() => void` sink 时必须有显式 owner；启用 `no-misused-promises` 的 `checksVoidReturn` 与 `no-floating-promises`。

## 配置与 Build 逃生舱

下列每一项都是 configuration-level trust expansion，必须显式审查、登记 owner，并写明到期/移除计划：

- 关闭 `strict` 或任一必需严格选项；
- app 例外中的 `skipLibCheck:true`；
- `allowJs:true` 且 unchecked JavaScript 进入 core；
- `noCheck`、transpile-only 发版路径，或把 emit/bundle 成功冒充类型安全；
- 被权威 project 排除、却在 runtime import/执行的文件；
- framework/test/codegen compiler 使用不同 type universe，且没有 compatibility test；
- 没有 drift 与 consumer check 就接受 generated declaration/client。

不能在 JSON 里塞一条 `[SAFETY]:` 就假装配置安全。配置逃生舱应登记进版本化 policy/exception registry，并由 CI 对其 diff。

## Harness 覆盖

compiler 和 ESLint 负责 strict flag、unsafe `any`、Promise ownership、method signature、assertion 与常见 API misuse。`audit-type-escapes.mjs` 负责显式声明的 AST inventory。实际项目还要为 generic runtime API、decorator、typed-key helper 和 compatibility hack 增加本地 AST rule。variance/correlation 用 type test，schema/wrapper 用 runtime negative test，declaration 用 artifact/consumer test。

启用 `--compatibility-heuristics` 后，inventory 还会报告带参数的 method signature，以及含 optional parameter 或非 tuple open rest parameter 的 function-type node。这些是刻意高噪声的 declaration-shape 提示：它们完全可能合理，也不能证明实际发生了不安全 assignment。只应在定向 boundary review，或明确采用无 method/function-property 风格的代码库中选择启用；没有测量并接受误报政策前，不得把它变成全仓强制失败 gate。runtime arity 重要时，严格 callback boundary 使用精确 tuple；否则记录并测试为何 open arity 安全。

不存在通用 TS lint 能证明 alias lifetime、array density、effect purity、runtime schema fidelity、decorator 行为或跨包 artifact 一致。它们仍是显式人工 invariant，并绑定当前能得到的最窄可执行证据。

Primary language references：[TypeScript type compatibility 与 deliberate unsoundness](https://www.typescriptlang.org/docs/handbook/type-compatibility)、[checked indexed access](https://www.typescriptlang.org/tsconfig/noUncheckedIndexedAccess.html)、[declaration file 作为 runtime promise](https://www.typescriptlang.org/docs/handbook/modules/theory.html#the-role-of-declaration-files)。
