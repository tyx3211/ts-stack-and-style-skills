# 构建与声明 Pipeline

## 工具选择

### Vite 8 与 Rolldown

浏览器 app 与 Vite-oriented library build 使用 Vite。Vite 8 已使用 Rolldown 作为统一 bundler，并使用 Oxc 系转换；不要再按旧的“开发 esbuild、生产 Rollup”架构推理。现有 Rollup-style option/plugin 可能经过兼容层工作，但迁移时必须验证复杂 plugin。

Vite 会转换 TypeScript，但不替代完整 project typecheck。运行 `tsc --noEmit` 或框架专用 checker。最终 app 不发布声明。Library mode 必须 externalize 由 host 持有的 dependency/peer，并让 runtime entry 与 declaration entry 对齐。

### SWC

SWC 只用于快速 JavaScript 转换。它逐文件工作，不执行完整 TypeScript typecheck，必须配独立 typecheck。library 还要增加独立声明 pipeline。

### tsdown 与遗留 tsup

新工具链不要选择 tsup：其仓库已声明不再积极维护，并推荐 tsdown。已有稳定 tsup package 可暂时保留，但应隔离配置并规划迁移。

新的中小型 TypeScript library 在 Rolldown-based library bundler 符合格式与 plugin 要求时优先考虑 tsdown。迁移不能只机械改命令：默认值、dependency externalization、plugin API、声明行为、输出名与 clean 行为都有差异。锁定版本，并测试 package metadata 与 consumer。

不要让任何工具的声明便利功能替代独立 typecheck 与 package validation。

## 三条 Pipeline

### Typecheck

用 pinned compiler 或框架 checker 检查手写源码，并与 JavaScript bundle gate 独立。

### Runtime JavaScript

每个 package 只选一个 owner：透明 Node library/service 可用 compiler emit；browser、serverless、executable、多格式或确有 bundle 需求时用 bundler。验证 platform、target、external、module format、sourcemap 与 dynamic loading。

### Declarations

- compiler 同时拥有 JS 与类型输出时使用 `declaration`。
- 其他工具拥有 JavaScript 时使用 `emitDeclarationOnly`。
- 只有需要跳转到已发布/可获得源码时才用 `declarationMap`。
- 只有公开 API 已有足够注解且 pinned toolchain 支持时才考虑 `isolatedDeclarations`。
- 多入口 package 默认保留逐入口声明，除非 rollup 设计明确覆盖每个公开入口。

## API Extractor

只有稳定/公开 library 需要 API report、release-tag 治理、documentation model 或刻意 `.d.ts` rollup 时才加入 API Extractor。它消费预先 emit 的声明；它不是 compiler、alias fixer、runtime bundler 或 typecheck 替代品。

它的 declaration rollup 天然偏单入口。多入口 package 应保留逐入口声明，或设计独立 extractor entry；禁止意外压扁 exports。内部 package 与最终 app 通常不需要 API Extractor。

## 产物断言

- 每个 `exports` runtime target 都存在，并能在声明环境加载。
- 每个 `types` target 都存在，并能在支持的 TypeScript module mode 下解析。
- runtime 与 declaration entry 集合一致。
- 需要 external 的 dependency 没有被内联。
- sourcemap 指向可获得源码，且不泄露非预期路径。
