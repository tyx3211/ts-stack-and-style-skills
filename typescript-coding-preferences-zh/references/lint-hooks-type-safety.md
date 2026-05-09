# Lint、Hooks 与类型安全参考

## ESLint 基线

对于测试之外、手写的主生产代码，只要仓库工具链支持，就应把以下项作为错误级别执行：

```txt
tsconfig:
  strict: true
  noImplicitAny: true

ESLint:
  eqeqeq: error
  @typescript-eslint/no-explicit-any: error
  @typescript-eslint/no-unsafe-assignment: error
  @typescript-eslint/no-unsafe-call: error
  @typescript-eslint/no-unsafe-member-access: error
  @typescript-eslint/no-unsafe-return: error
```

如果项目能承受迁移成本，优先再补上 `@typescript-eslint/strict-boolean-expressions` 和 `no-implicit-coercion`。这两条规则可以减少 `eqeqeq` 无法覆盖的 truthy/falsy 和隐式转换错误。

测试代码可以为 mock、fixture 或第三方兼容性做更窄的例外，但不要让这些测试例外泄漏到 `src/` 或其他主生产目录中。

## `any`、`unknown` 与断言

对外部或未经检查的值，优先使用 `unknown`：

```ts
const raw: unknown = JSON.parse(text);
```

然后在使用前先做校验：

```ts
function parseFiniteNumber(value: unknown, name: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`${name} must be a finite number`);
  }

  return value;
}
```

避免把断言当成校验：

```ts
// 避免：这只是在告诉 TypeScript 信任我们，它并不会完成转换或校验。
const weight = payload.weight as number;
```

优先使用 guard/schema narrowing（守卫 / schema 收窄）：

```ts
const WeightSchema = z.number().finite().positive();
const weight = WeightSchema.parse(payload.weight);
```

`satisfies` 和 `as const` 一般是可以接受的，因为它们是在保留或检查类型信息，而不是假装未知运行时数据已经被验证。non-null assertion（非空断言）`value!` 也应像 `as` 一样谨慎使用，只有当不变量在局部显然成立，或者此前已经明确检查过时才允许。

## 相等性与数值安全

`eqeqeq` 可以防止 `"0" == 0` 这类宽松相等，但它不是完整正确性的证明。

仍然要主动防御：

- `NaN`，因为 `NaN === NaN` 为 `false`，但 `typeof NaN === "number"` 为 `true`
- `Infinity`，因为它同样属于 `number`
- 当业务要求正数时，`0` 或负值也不能放过
- 围绕 `0`、`""`、`null`、`undefined` 的 truthy/falsy 误判
- 本应使用 `??` 却写成 `||` 的默认值逻辑

对于核心算法，最好在进入算法前完成输入校验：

```ts
function gcd(a: number, b: number): number {
  if (!Number.isFinite(a) || !Number.isFinite(b)) {
    throw new Error("gcd arguments must be finite");
  }

  if (b === 0) {
    return a;
  }

  return gcd(b, a % b);
}
```

## Hooks 与 CI/CD

应把自动化工具当成把项目规则变成硬约束的手段：

```txt
pre-commit:
  format/lint changed files, block explicit any, loose equality, stale generated files

pre-push:
  run typecheck, lint, core tests, contract/codegen consistency

CI:
  run full clean-environment verify, build, test, contract diff, artifact checks
```

hooks 应保持轻薄。一个 hook 应只调用稳定命令，而不是自行重写逻辑：

```bash
npm run lint
npm run typecheck
npm run verify
```

最好向代理和人工维护者暴露一组小而可靠的命令：

```txt
npm run fmt
npm run lint
npm run typecheck
npm run build
npm run test
npm run verify
```

`build` 应表示“可信构建”，而不只是一次转译。对于使用 SWC 这类快速转译器的 TS 项目，应保留例如 `build:transpile` 这样的命令给单纯转译，而公开的 `build` 应完成 typecheck、lint、transpile、必要 codegen，以及生成文件一致性检查。

hook 和 CI 的失败信息必须明确且可操作：

```txt
ESLint failed: explicit any is forbidden in src/.
Type check failed; build aborted before transpilation.
Generated OpenAPI client is stale. Run npm run gen:api and commit the diff.
```

## 生成代码

默认不要用与手写生产代码完全相同的严格 lint 规则去检查生成代码。

更合适的做法是：

- 手写代码：严格 lint、format、typecheck
- 生成代码：如果已提交则做 format，再做 compile/typecheck，以及 regenerate-and-diff（重新生成并比较差异）检查
- 生成器代码：严格 lint 和测试

如果生成代码必须参与 lint，最好把它放进单独目录，并使用有意放宽的独立 lint 配置。生成结果的问题应通过修生成器来解决，而不是手改生成文件。

## Review 清单

- 主生产代码里是否存在显式 `any`？
- 是否有 `unknown` 值未经过 guard/schema 收窄就直接使用？
- 是否用 `as` 断言替代了真实运行时校验？
- 是否有宽松相等、隐式转换或 truthy/falsy 判断掩盖了业务语义？
- 数值输入是否同时经过 `Number.isFinite` 与业务范围规则检查？
- hooks 是否只是在调用共享命令，而不是复制隐藏逻辑？
- CI 是否在干净环境中执行了同一套核心检查？
- 生成文件是否通过 regenerate-and-diff 验证，而不是靠手工维护？
