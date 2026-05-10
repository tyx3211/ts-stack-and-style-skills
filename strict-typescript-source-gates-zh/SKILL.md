---
name: strict-typescript-source-gates-zh
description: Use when defining, tightening, reviewing, or enforcing TypeScript source-code tsconfig, ESLint, npm scripts, git hooks, CI gates, assertion policy, or variance-safety rules for handwritten src code in Chinese workflow contexts.
---

# 严格 TypeScript 源码门禁

## 概览

对于手写的 `src/` TypeScript 源码，应把编译器、ESLint、package scripts、git hooks 和 CI 视为同一套硬门禁。目标是堵住 AI 生成代码最常见的逃生口：`any`、不安全断言、未校验外部输入、宽松相等、callback（回调）双变形状、陈旧生成文件，以及跳过校验的 build。

## 适用范围

- 这些规则默认用于 `src/` 或等价生产源码目录里的手写代码。
- tests（测试）、fixtures（测试夹具）、mocks（模拟对象）、generated code（生成代码）、migrations（迁移脚本）和 vendored code（外部拷贝代码）应使用单独配置，并明确写出放宽项。
- 测试或生成代码的放宽规则不得泄漏到 `src/`。
- 迁移旧系统时，把弱类型遗留适配隔离到边界模块里，不要因此放宽整个项目。

## 默认门禁

- 默认使用 full ESLint + cache：对完整源码 lint 目标运行 `--cache` 和 `--max-warnings=0`。
- `npm run lint` 应完整 lint `src/`，而不是只检查改动文件。改动文件 lint 可以作为额外的快速 pre-commit 步骤。
- `npm run typecheck` 应运行无 emit 的项目类型检查。
- `npm run build` 不能只是 transpile-only（只转译）。它必须包含 lint、typecheck、必要的 codegen 一致性检查，以及构建产物步骤。
- `npm run verify` 应作为 agents、人工维护者、pre-push hooks 和 CI 共用的稳定命令。
- 如果大型项目里 full ESLint 太重，先保持语义门禁不变，再尝试用 `oxlint` 负责快速 lint 类规则，并用 `tsgo` 或 `tsc --noEmit` 负责类型检查。在证明等价前，不要替换 type-aware ESLint（类型感知 ESLint）规则。

推荐 scripts：

```json
{
  "scripts": {
    "lint": "eslint \"src/**/*.{ts,tsx}\" --cache --cache-location .cache/eslint --max-warnings=0",
    "typecheck": "tsc --noEmit",
    "build": "npm run lint && npm run typecheck && npm run build:artifact",
    "verify": "npm run lint && npm run typecheck && npm run test"
  }
}
```

如果仓库使用 `tsgo`，保持公开命令名不变，并明确实现：

```json
{
  "scripts": {
    "typecheck": "tsgo --noEmit",
    "verify": "npm run lint && npm run typecheck && npm run test"
  }
}
```

## TSConfig 基线

除非框架接管配置，或者 package 有明确不同定位，新的 NodeNext 服务端 package 默认使用这份严格基线：

```jsonc
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022"],
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "types": ["node"],

    "strict": true,
    "noImplicitAny": true,
    "strictFunctionTypes": true,
    "strictNullChecks": true,
    "useUnknownInCatchVariables": true,

    "exactOptionalPropertyTypes": true,
    "noUncheckedIndexedAccess": true,
    "noPropertyAccessFromIndexSignature": true,

    "noImplicitOverride": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "allowUnreachableCode": false,
    "allowUnusedLabels": false,

    "verbatimModuleSyntax": true,
    "isolatedModules": true,
    "moduleDetection": "force",
    "noUncheckedSideEffectImports": true,
    "forceConsistentCasingInFileNames": true,

    "skipLibCheck": false,
    "rootDir": "src",
    "outDir": "dist",
    "sourceMap": true
  },
  "include": ["src/**/*.ts"]
}
```

说明：

- 即使 TypeScript 版本默认开启 `strict`，也显式写出 `strict` 和 `noImplicitAny`，因为这属于项目政策。
- `strictFunctionTypes` 已包含在 `strict` 中，但仍显式写出，因为双变安全是本规范的一部分。
- library（库）、shared package（共享包）、基础设施 package 和边界敏感代码，优先 `skipLibCheck: false`。大型 app 可以把 `skipLibCheck: true` 作为有记录的性能折中；它会信任声明文件边界类型，并跳过许多 `.d.ts` 内部错误。
- 如果当前 TypeScript 支持 `erasableSyntaxOnly`，且项目想贴近 Node 原生 TypeScript 兼容路线，可以考虑开启；但这会影响 enum、namespace、parameter property（参数属性）等写法，必须作为明确迁移任务处理。

## ESLint 基线

对于 `src/`，至少强制：

```js
export default [
  {
    files: ["src/**/*.{ts,tsx}"],
    rules: {
      eqeqeq: ["error", "always"],
      "no-implicit-coercion": "error",
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-unsafe-assignment": "error",
      "@typescript-eslint/no-unsafe-argument": "error",
      "@typescript-eslint/no-unsafe-call": "error",
      "@typescript-eslint/no-unsafe-member-access": "error",
      "@typescript-eslint/no-unsafe-return": "error",
      "@typescript-eslint/strict-boolean-expressions": "error",
      "@typescript-eslint/no-unnecessary-type-assertion": "error",
      "@typescript-eslint/method-signature-style": ["error", "property"]
    }
  }
];
```

断言策略：

- 允许 `as const`。
- 字面量需要接受检查但保留精确推导时，优先 `satisfies`。
- 手写 `src/` 里默认禁止其他 `as` 断言。应改用 guard（类型守卫）、discriminated union（可判别联合）、schema parse（schema 校验解析）或类型明确的 adapter function（适配函数）。
- 断言策略必须通过 `@typescript-eslint/consistent-type-assertions`、`no-restricted-syntax` 或本地规则机械执行：允许 `as const`，拒绝其他 `as` 断言。
- non-null assertion（非空断言）`value!` 只能用于局部显然成立的不变量，或有窄范围注释说明的互操作理由。
- `JSON.parse(...) as T`、`payload.value as number` 和 `as unknown as T` 属于政策失败，除非被隔离在有运行时校验的边界适配器中。

如果仓库当前插件版本的现成 ESLint 规则不能干净表达“允许 `as const`，拒绝其他断言”，就补一条本地小规则或 `no-restricted-syntax` 策略，而不是放宽要求。

## 边界校验

- 外部输入一律先视为 `unknown`。
- 使用 schema parse、`typeof`、discriminated union 或自定义 type guard 收窄后再使用。
- 数值要同时校验类型和值：`typeof value === "number" && Number.isFinite(value)`。
- 当数据库行、API 响应和 UI view model（视图模型）的形状不同，应保持分离。
- 生成的 OpenAPI client、oRPC contract 和 schema 派生 client 必须在 CI 中重新生成并做 diff 检查。

## 双变与 Unsound 写法规避

TypeScript 为了 JavaScript 兼容保留了一些 unsound（类型系统不完全可靠）行为。`strictFunctionTypes` 能收紧一部分问题，但 method declaration（方法声明）和 constructor declaration（构造器声明）仍保留历史双变口子。项目代码必须通过写法和 lint 规则主动收口。

callback 类能力使用 function property（函数属性）：

```ts
type Handler<T> = {
  handle: (value: T) => void;
};
```

避免把泛型 callback 边界写成 method signature（方法签名）：

```ts
interface Handler<T> {
  handle(value: T): void;
}
```

规则：

- callback、handler、visitor、comparer、middleware、listener 等形状应使用 function property，而不是 method signature。
- 公开输入集合默认使用 `readonly T[]` 或 `ReadonlyArray<T>`。
- 只有当函数明确拥有该数组，或者契约明确要求函数修改该数组时，才使用可变 `T[]`。
- 不要通过别名把窄的 mutable array（可变数组）扩宽成宽的 mutable array，例如把 `Dog[]` 直接赋给 `Animal[]`。如果需要可变的宽类型数组，先拷贝：`const animals: Animal[] = [...dogs]`。
- 不要在公共 API 中暴露可变数组，除非所有权语义明确。
- 优先小型 capability interface（能力接口）和组合，而不是继承树。
- 对 plugin registry（插件注册表）、dependency container（依赖容器）、ORM factory（ORM 工厂）等泛型创建边界，优先 factory function（工厂函数），例如 `create: (config: Config) => Plugin`，而不是 `new (config: Config) => Plugin`。
- class method 可以用于内禀实现细节，但不要把 method signature 当成泛型 callback 边界形状。

## Hooks 与 CI

- `pre-commit`：运行格式化和快速检查；可以在这里跑 changed-file lint，但它不能替代 full lint。
- `pre-push`：运行 `npm run verify`。
- CI：干净安装、codegen 一致性检查、完整 lint、完整 typecheck、测试、build 和产物检查。
- hooks 应调用共享 package scripts，不要把另一套逻辑藏在 hook 文件里。
- 每个失败信息都应指向 agent 可以在本地运行的命令。

## 大项目性能路径

默认仍然是 full ESLint + cache。如果项目变得很大：

1. 保持 `npm run verify` 的语义稳定。
2. 增加 `oxlint` 来覆盖快速、非 type-aware 的 lint 类规则。
3. 保留 `tsgo --noEmit` 或 `tsc --noEmit` 负责类型检查。
4. 保留 `oxlint` 或编译器无法覆盖的 type-aware ESLint 规则。
5. 用已知违规样例证明等价：显式 `any`、unsafe assignment、unsafe argument、禁止的断言、method-signature callback、宽松相等、陈旧生成文件。

不要悄悄用速度换严格度。任何更快路径都必须继续拦住 `src/` 中真正重要的政策违规。

## Review 清单

- `src/` 是否禁止显式和隐式 `any`？
- 类型断言是否只限于 `as const`、`satisfies`，或者带运行时校验的边界适配器？
- lint 是否覆盖完整源码范围、开启 cache，并使用 `--max-warnings=0`？
- `build` 是否包含 lint 和 typecheck？
- hooks 和 CI 是否调用同一套共享 scripts？
- tests 和 generated code 是否与 `src/` 政策隔离？
- callback 类 interface 是否使用 function property？
- 公开数组入参是否默认 readonly？
- 可变数组扩宽时是否先拷贝，而不是共享别名？
- 泛型插件或注册表边界是否避免 constructor type？
