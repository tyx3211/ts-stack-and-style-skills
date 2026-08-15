---
name: typescript-monorepo-toolchain-zh
description: 在中文工作流中设计、修改、审查、调试或验证 TypeScript monorepo 工具链，覆盖 npm/pnpm/Yarn workspace、包边界、package.json exports/imports、TypeScript project references、tsconfig 图、路径别名、tsc build mode、Vite/Rolldown、SWC、tsdown/遗留 tsup、声明生成、API Extractor、任务缓存、oRPC contract 包以及包发布与 consumer fixture。
---

# TypeScript Monorepo 工具链

## 概览

把 TypeScript monorepo 看成三张必须协调一致的图：workspace package 负责安装与所有权，`package.json` 负责运行时与公开模块边界，`tsconfig` 负责 TypeScript project 边界。所有 resolver 与产物必须一致；编辑器能跳转不能证明生产环境能运行。

## 工作流

1. 盘点运行时、部署单元、公开包、私有包、入口、消费者、模块格式与 codegen 所有者。
2. 修改配置前先画 package dependency DAG，拒绝环与未声明依赖。
3. 每个共享包只选择一种消费模式：dist-first 或 source-first。
4. 先定义 `exports` / `imports` 与公开 subpath，再考虑 TypeScript alias。
5. 判断 project references 是否确实带来构建隔离；不要习惯性增加 `composite`。
6. 分开类型检查、运行时 JavaScript 生成与声明生成。
7. 让 root scripts 与 task runner 表达同一张 DAG，并声明正确的缓存输入输出。
8. 验证 clean install、运行时解析、声明、打包产物与代表性消费者。

创建 package、选择 dist-first/source-first 或定义依赖所有权时，读取 [workspace-and-package-graph.md](references/workspace-and-package-graph.md)。

修改 solution config、`references`、`composite`、`tsc -b`、TypeScript 7 迁移或混合 app/library 配置时，读取 [project-references-and-tsconfig.md](references/project-references-and-tsconfig.md)。

修改 `exports`、`imports`、alias、ESM/CJS 入口、deep import 政策或 `tsc-alias` 时，读取 [package-exports-and-resolution.md](references/package-exports-and-resolution.md)。

选择 Vite 8/Rolldown、SWC、tsdown、遗留 tsup、声明 emit、声明 rollup 或 API Extractor 时，读取 [build-and-declaration-pipelines.md](references/build-and-declaration-pipelines.md)。

API 与前端共享 oRPC/Zod/Valibot contract 包时，读取 [orpc-contract-packages.md](references/orpc-contract-packages.md)。

定义 CI、任务缓存、包验证、发布或 pack consumer fixtures 时，读取 [validation-cache-and-release.md](references/validation-cache-and-release.md)。

项目需要一份把 contract、monorepo package、Electron/main/sidecar ownership 和 build/verification graph 串起来的具体但非强制起点时，读取 [agent-driven-reference-blueprint.md](references/agent-driven-reference-blueprint.md)。Agent 可以偏离，但要用同一组 invariant 对比证据。

## 消费模式

### Dist-first

公开发布库、被 Node 消费的运行时包、稳定复用库，以及必须在开发期真实演练生产边界的 package 使用 dist-first。

- 让 `exports` 与类型入口指向 `dist/` 下的构建产物。
- package 含运行时值时必须产出 JavaScript。
- 为 TypeScript consumer 产出声明；只有源码可获得且确实需要源码导航时才增加 declaration map。
- 运行下游 consumer 前先 build/watch 上游 package。
- 跨运行时共享 package 默认优先使用此模式。

### Source-first

只有当完整的开发、测试、构建与运行工具链都明确消费 TypeScript 源码时，私有 package 才使用 source-first。

- 让受控入口指向源码，并验证每个 consumer 都能转换相关语法。
- 没有 pack consumer test 时，不要宣称兼容纯 Node 或可发布 npm package。
- 不要再保留一条与开发解析静默不同的 dist 路径。
- package 跨越不可控运行时、仓库或发布边界时，切换为 dist-first。

## 硬规则

- 跨 package 只通过 package name 与公开 subpath 导入，禁止 `../../packages/foo/src/...`。
- 即使 root hoisting 能解析，消费方 package 也必须声明自己的依赖。
- `exports` 是公开 API metadata，不是完整架构防火墙；用 lint 或 dependency-boundary 工具阻止相对路径绕过。
- 不要把 TypeScript `paths` 当作 package manager 或 runtime resolver。
- 前端 package 不得导入后端 runtime、数据库、文件系统或含 secret 的 package。
- 最终 app 是叶子消费者；不要把 app 当 library 发布或导入。
- codegen 只能有一个 owner，并在 CI 中 diff 生成产物。
- 工具链变化时保持 `typecheck`、`build`、`test`、`verify` 等公开脚本名稳定。

## TypeScript 7 基线

- TypeScript 7 是稳定 native CLI checker。CLI-only 项目锁定标准 `typescript` package；存在 programmatic API consumer 时，使用并验证官方 side-by-side alias：TS7 可安装为 `@typescript/native`，名为 `typescript` 的 package 提供 `@typescript/typescript6`，同时 `tsc` 必须仍解析到 TS7。绝不 global fallback。
- TypeScript 7 已移除 `baseUrl`；保留 alias 时让 `paths` target 相对其 tsconfig。
- 在 TypeScript 7 默认值可能改变输出或 ambient types 时，显式设置 `rootDir` 与所需全局 `types`。
- 只有 typescript-eslint、AST rule 或 framework/embedded-language tool 等 programmatic consumer 仍需旧 compiler API 时才并行保留 TS6。逐项核对当前支持，并在 TS7 提供受支持 API 后移除 compatibility track。
- `tsc -b --noEmit` 具有版本边界。采用前必须用锁定 compiler 与最小真实 reference graph 验证；可移植默认是 buildable library 执行真实 build mode，leaf app 单独执行 no-emit 检查。

## 三条 Pipeline

始终独立建模：

1. 类型检查：`tsc --noEmit`、build mode 或框架专用 checker。
2. 运行时 JavaScript：`tsc` emit、Vite/Rolldown、SWC、tsdown 或其他 runtime builder。
3. 声明：`tsc`/框架声明 emit、可选声明 bundling 与 API surface 验证。

快速 transpiler 通过不证明类型正确；JavaScript bundle 通过不证明声明可解析；声明 rollup 通过也不证明 runtime exports 正确。

## 审查清单

- 每个 package 是否明确 owner、consumer、runtime 与消费模式？
- workspace dependency、project reference 与 task dependency 是否描述同一张无环图？
- `exports`、声明、runtime 文件与 sourcemap 是否都存在于 advertised path？
- 每个 alias 是否同时被 typecheck、dev、test、build 与生产 runtime 理解？
- typecheck、JavaScript 生成与声明生成是否分别可见并被门禁？
- frontend/backend 与 server/browser package 边界是否机械强制？
- CI 是否从 clean checkout 验证，而不是依赖陈旧 `dist` 或 editor redirect？
- 发布前是否把 pack 产物安装到代表性 consumer fixture？
