---
name: strict-typescript-source-gates-zh
description: 用于编写、审查或强制执行严格的手写 TypeScript 源码，包括 tsconfig、ESLint、scripts、hooks、CI、数组和索引访问、可变别名与变型、跨 callback 或 await 收窄、类型守卫和断言函数、重载、品牌类型、声明与增强、monkey patch，以及 TypeScript 逃生舱或发版审计；适用于中文工作流。
---

# 严格 TypeScript 源码门禁

## 目标与范围

把编译器、lint、测试、package scripts、hooks、CI 和人工审查视为同一反馈系统。优先机器规则；TypeScript 有意不健全或无法证明关系时，隔离信任决策、加标签、测试并生成清单。

严格政策默认用于手写生产 `src/`。测试、fixtures、生成代码、迁移、vendored code 和遗留适配器使用独立显式政策，其放宽不得泄漏到生产源码。

## 按主题加载参考文件

- 数组、hole、checked access 和 kernel：[references/array-and-index-safety.md](references/array-and-index-safety.md)。
- mutable widening、变型、alias、callback 和 `await`：[references/alias-variance-and-refinement.md](references/alias-variance-and-refinement.md)。
- predicate、assertion、overload、brand、declaration、augmentation 和 monkey patch：[references/trusted-type-boundaries.md](references/trusted-type-boundaries.md)。
- 逃生舱分类和发版 inventory：[references/escape-hatch-registry.md](references/escape-hatch-registry.md)。
- 调用者泛型、method bivariance、lookup 声明、decorator、配置逃生舱及其他不明显的不健全入口：[references/additional-unsoundness-and-trust-claims.md](references/additional-unsoundness-and-trust-claims.md)。
- 非强制但可执行的 TS7/TS6 API、typed ESLint、audit 与 build command 基线：[references/recommended-harness-blueprint.md](references/recommended-harness-blueprint.md)。

数据库/Redis/事务正确性还要加载 `backend-data-correctness-zh`。

## 必须工作流

1. 检查安装的 TypeScript、runtime、module model、配置和源码边界。
2. 确认规则真实生效，不根据 preset 名猜覆盖。
3. 用最小改动关闭目标缺口。
4. 运行 agents、hooks、CI 共享公开命令。
5. trust-boundary 或发版工作运行 `scripts/audit-type-escapes.mjs --deny-unreviewed <paths>`。
6. 人工复核每个逃生舱与 `[SAFETY]:`、`[TRUSTME]:`、`[INDEX INVARIANT]:`。
7. 报告有意例外和仍依赖人工的检查。

审计脚本只是 inventory heuristic，不是 alias/effect analysis 或 soundness proof。

## 稳定命令

```json
{
  "scripts": {
    "lint": "eslint \"src/**/*.{ts,tsx,mts,cts}\" --cache --cache-location .cache/eslint --max-warnings=0",
    "typecheck": "tsc --noEmit --pretty false",
    "audit:type-escapes": "node path/to/audit-type-escapes.mjs --deny-unreviewed src",
    "build:artifact": "<framework-or-package artifact command>",
    "verify": "npm run lint && npm run typecheck && npm run audit:type-escapes && npm run test && npm run build:artifact",
    "build": "npm run verify"
  }
}
```

在这份推荐 command graph 中，`build:artifact` 负责 emit/bundle，`verify` 是聚合判决，公开 `build` 非递归地 alias 到 `verify`。框架若必须保留 artifact-only `build`，CI 与 agent 就必须以 `verify` 为判决，且不得把裸 transpile 成功描述成正确性。changed-file lint 只能补充 full lint。

## 编译器基线

新 NodeNext server package 默认使用：

```jsonc
{
  "compilerOptions": {
    "target": "ES2022", "lib": ["ES2022"],
    "module": "NodeNext", "moduleResolution": "NodeNext",
    "esModuleInterop": true, "types": ["node"],
    "strict": true, "noImplicitAny": true,
    "strictFunctionTypes": true, "strictNullChecks": true,
    "useUnknownInCatchVariables": true,
    "exactOptionalPropertyTypes": true,
    "noUncheckedIndexedAccess": true,
    "noPropertyAccessFromIndexSignature": true,
    "noImplicitOverride": true, "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "allowUnreachableCode": false, "allowUnusedLabels": false,
    "verbatimModuleSyntax": true, "isolatedModules": true,
    "moduleDetection": "force", "noUncheckedSideEffectImports": true,
    "forceConsistentCasingInFileNames": true, "skipLibCheck": false
  }
}
```

政策选项即使默认开启也显式写出。library、shared package、contract、基础设施和可信边界优先 `skipLibCheck:false`；app 的 `true` 必须是实测、记录过的 declaration-trust 折中。

权威 checker 使用 TypeScript 7 `tsc`。TS7.0 没有 programmatic compiler API，因此 typescript-eslint 与本 skill 的 AST inventory 需要锁定的 TypeScript 6 compatibility API。当前官方 side-by-side 基线把 TS7 alias 为 `@typescript/native`，并把 `@typescript/typescript6` alias 成名为 `typescript` 的 package；必须实际验证 wiring。不得使用过时 `@typescript/native-preview`/`tsgo` 或 global fallback。embedded-language tooling 可使用同一显式 TS6 compatibility track，但它不得成为普通 `.ts` 的权威。精确 wiring 与允许替代方案见推荐 harness blueprint。

## ESLint 基线

生产源码使用 type-aware lint，并确认规则存在于安装版本。下列只是 policy fragment，不是完整 flat-config 安装；最终 config 必须像推荐 harness blueprint 所述，包含锁定 import、project-aware parser/project service、文件政策与失败 fixtures：

```js
export default [{ files: ["src/**/*.{ts,tsx,mts,cts}"], rules: {
  eqeqeq: ["error", "always"], "no-implicit-coercion": "error",
  "@typescript-eslint/no-explicit-any": "error",
  "@typescript-eslint/no-unsafe-assignment": "error",
  "@typescript-eslint/no-unsafe-argument": "error",
  "@typescript-eslint/no-unsafe-call": "error",
  "@typescript-eslint/no-unsafe-member-access": "error",
  "@typescript-eslint/no-unsafe-return": "error",
  "@typescript-eslint/no-unsafe-type-assertion": "error",
  "@typescript-eslint/no-unnecessary-type-assertion": "error",
  "@typescript-eslint/no-non-null-assertion": "error",
  "@typescript-eslint/strict-boolean-expressions": "error",
  "@typescript-eslint/method-signature-style": ["error", "property"],
  "@typescript-eslint/no-array-delete": "error",
  "@typescript-eslint/no-for-in-array": "error",
  "@typescript-eslint/no-floating-promises": "error",
  "@typescript-eslint/no-misused-promises": ["error", { "checksVoidReturn": true }],
  "@typescript-eslint/switch-exhaustiveness-check": "error",
  "@typescript-eslint/only-throw-error": "error",
  "@typescript-eslint/use-unknown-in-catch-callback-variable": "error",
  "@typescript-eslint/no-unsafe-declaration-merging": "error",
  "@typescript-eslint/unbound-method": "error",
  "@typescript-eslint/unified-signatures": "error"
} }];
```

另用 `consistent-type-assertions`、`no-restricted-syntax` 或本地 AST rule 允许 `as const`、默认拒绝其他 assertion；`no-unsafe-type-assertion` 不能单独禁完。core/domain/lib/shared/protocol 使用 `prefer-readonly-parameter-types:error`；framework-heavy glue 可经实测改 `warn`。`readonly` 是浅层约束，不证明 ownership。

## 不可协商源码规则

- 外部输入从 `unknown` 开始并经过 runtime parser/schema。
- 允许 `as const`，优先 `satisfies`；其他 assertion 是例外，不是 validation。
- 禁止 `JSON.parse(...) as T`、`as unknown as T` 和未校验 SDK/IPC/database/network 值。
- `json<T>()`、`query<T>()`、`invoke<T>()`、`querySelector<T>()` 等 caller-supplied generic runtime result，如果没有 runtime validation 或 generated contract 证据，应视为远距离 assertion。
- 有限状态使用 discriminated union 和 exhaustive switch。
- 可赋值 callback/handler/visitor/comparer/middleware/listener 边界使用 function property；class 实现可保留 prototype method。
- override 不缩窄参数；`noImplicitOverride` 不能关闭 method bivariance。
- 不把 bare method 当 callback。
- 公共 collection 默认 readonly；扩宽后需要修改时先 copy。
- 不跨 unknown callback、escaping closure、事件轮次或 `await` 保留 mutable property refinement；应快照稳定 immutable data 或重验。
- plugin/registry/DI 边界优先 factory，不用 generic constructor signature。
- 普通 production 禁止 monkey patch 和对 runtime 行为的 ambient 承诺。

## 审查标签

采用对标 Rust `unsafe` 的哲学：必要逃生舱如果是最清晰的实现，完全欢迎使用；但其信任边界必须显式、窄小、可被机器盘点、有证据支撑且便于集中审查。不得把灵活性藏进看似无害的 helper 或伪 guard。这里的标签是项目审计约定，并不声称 TypeScript 拥有 Rust 编译器强制的 `unsafe` 边界。

```ts
// [SAFETY]: <runtime evidence，以及为何建立声明 invariant>
// [TRUSTME]: <external declaration/runtime contract、负责人和验证>
// [INDEX INVARIANT]: <bounds、density、length relation 和保持理由>
```

例外保持最小，并通过稳定文件和 exported symbol 互指，不只写行号。标签是审查证据，不是证明。

禁止 `@ts-ignore`、`@ts-nocheck`。极少数 `@ts-expect-error` 必须单行、可追踪且 unused 时失败。lint disable 点名一条规则、覆盖最小范围、带标签，并报告 unused directive。

## 性能与 Review

默认 full cached ESLint 加完整 `tsc --noEmit`。Oxlint 可加快速路径，但未覆盖语义规则保留 ESLint。用故意失败 fixture 证明 assertion、`any`、sparse array、method boundary、Promise misuse、declaration 和 unbound method 的覆盖。只有实测和人工批准后才优化；watch 状态不是发版判决。

接受前确认：共享命令用锁定本地工具完整运行；配置放宽与源码逃生舱已 inventory；数组 dense 且索引已处理；不存在 mutable widening alias；effect 后已重验 refinement；callback boundary 使用 function property；generic runtime claim 已校验或加标签；所有快速路径都捕获政策 fixtures。
