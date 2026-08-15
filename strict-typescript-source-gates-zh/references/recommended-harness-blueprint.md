# 推荐 Harness 参考实现

这是一份可工作的基准，不是强制仓库形态。必须保留的是 invariant 与证据；项目有更合适且经过验证的方案时，可以替换 package 或 command graph。

## 当前 TypeScript 7 兼容基线

TypeScript 7.0 提供权威 `tsc` CLI，但没有 programmatic compiler API。因此 type-aware ESLint 与本 skill 的 AST inventory 需要并行使用 TypeScript 6 compatibility API。

```json
{
  "devDependencies": {
    "@typescript/native": "npm:typescript@7.0.2",
    "typescript": "npm:@typescript/typescript6@6.0.2"
  },
  "scripts": {
    "typecheck": "tsc --noEmit --pretty false",
    "typecheck:api-compat": "tsc6 --noEmit --pretty false",
    "lint": "eslint \"src/**/*.{ts,tsx,mts,cts}\" --max-warnings=0",
    "audit:type-escapes": "node path/to/audit-type-escapes.mjs --deny-unreviewed src",
    "build:artifact": "<framework-or-package artifact command>",
    "verify": "npm run lint && npm run typecheck && npm run typecheck:api-compat && npm run audit:type-escapes && npm run test && npm run build:artifact",
    "build": "npm run verify"
  }
}
```

锁定精确 resolved version，并在 CI 验证 wiring：

```sh
npx tsc --version
npx tsc6 --version
node -p "require('typescript').version"
```

第一个命令必须是 TS7，API import 必须是受支持的 TS6 compatibility version。绝不 fallback 到 global compiler。TS7 获得受支持 programmatic API，或 typescript-eslint 改变支持范围后，应重新核对布局。

Primary references：

- [TypeScript 7 side-by-side guidance](https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/#running-side-by-side-with-typescript-60)
- [typescript-eslint dependency versions](https://typescript-eslint.io/users/dependency-versions/)
- [typescript-eslint typed linting](https://typescript-eslint.io/getting-started/typed-linting/)

## Typed ESLint 形态

使用当前 flat-config API 和 project-aware parser。精确 import 与 preset 取决于锁定版本，但必须具备：

- files 只覆盖手写生产 TypeScript；
- `projectService` 或显式 project config，并有稳定 root；
- type-checked strict preset 加 `SKILL.md` 的显式规则；
- test、generated file、declaration、migration 和 legacy adapter 使用独立政策；
- 不受支持的 TypeScript API version 必须暴露成 failure，不得隐藏 warning；
- 故意失败 fixture 证明每条关键本地规则真实启用。

不能复制一个残缺 `rules` object 就称作完整 ESLint 安装。应从锁定版本的官方 typed-linting setup 开始，合入项目规则，再让 negative fixture 通过公开 `lint` command 执行。

## Command 语义

- `build:artifact` 只负责 emit/bundle artifact，可假设前序检查已完成。
- `verify` 是聚合 release gate。
- `typecheck:api-compat` 证明被 TS6-based typed lint/AST tooling 消费的源码仍可解析且 type-consistent。若刻意采用的 TS7-only syntax 让它不成立，应改成锁定版本的 parser/fixture compatibility gate，并记录覆盖缩减；不得无声省略。
- 本建议基线让公开 `build` alias 到 `verify`，因此“build passed”表示可信门禁通过，且不会递归。
- 框架若必须让 `build` 表示 artifact-only，可以保留该约定；但 CI 与 agent 指令必须以 `verify` 为最终判决，不得把裸 build 成功描述成正确性。

## 允许的替代方案

Agent 可以选择不同布局，但必须记录：

1. 哪个 compiler 是权威 checker；
2. 哪个锁定 parser/API 为 type-aware lint 与 AST tool 提供能力；
3. 如何禁止 global/floating tool fallback；
4. artifact 与 aggregate command graph 如何保持非递归；
5. negative fixture 与 clean-environment 证据。

替代方案要显式与本基线对比。欢迎架构自由；不允许悄悄丢掉 invariant。
