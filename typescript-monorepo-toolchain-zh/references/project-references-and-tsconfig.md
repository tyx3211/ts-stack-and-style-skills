# Project References 与 TSConfig

## 有条件地使用 References

package 需要独立声明/构建产物、增量图构建或编辑器隔离时使用 project references。小型 source-first workspace 若已经由框架 checker 拥有完整 program，且 references 只会复制配置，则不要使用。

Project references 不是 import 访问控制；必须同时使用 package exports 与 dependency-boundary lint。

## Solution Pattern

```json
{
  "files": [],
  "references": [
    { "path": "./packages/contracts" },
    { "path": "./packages/db" },
    { "path": "./apps/api" },
    { "path": "./apps/web" }
  ]
}
```

每个被引用 project 必须开启 `composite`。显式设置 `rootDir`、`outDir` 与不冲突的 `tsBuildInfoFile`，并确保 `include` 覆盖所有实现文件。被引用的 buildable library 必须提供声明；最终 app 保持 leaf，通常不需要声明 contract。

## Build 与 Check

- 用 `tsc -b` 按依赖顺序构建 reference graph。
- pinned compiler 支持且政策需要时，在 CI 使用遇错停止的 build 选项。
- 不要假定 `tsc -p` 会构建被引用依赖；build mode 才是图编排器。
- 不要把 `tsc -b --noEmit` 宣称为跨版本通用。必须用 pinned compiler 验证。兼容基线是 buildable library 执行 `tsc -b`，最终 TypeScript app 执行 `tsc --noEmit -p ...`。
- Vue/SFC 等 embedded-language app 在所选 compiler 得到当前工具链支持前，继续使用框架专用 checker。

## TypeScript 7 迁移

- 删除 preview `@typescript/native-preview` 与 `tsgo`。CLI-only 项目使用锁定标准 `typescript`/`tsc`；仍有 programmatic consumer 时，使用并验证官方“TS7 alias 为 `@typescript/native`、TS6 API alias 为 `typescript`”布局。
- 删除 `baseUrl`，让 `paths` value 相对定义它的 config。
- TypeScript 7 的默认值已改变，因此显式设置 `rootDir`。
- 显式列出 ambient `types`，因为 TypeScript 7 不再默认发现全部 `@types` package。
- 删除 TypeScript 7 不再支持的 compiler option 与旧 module target。
- 工具需要 TypeScript programmatic API 时先验证 TS7 支持；API 尚不存在期间锁定 TS6 compatibility API，记录哪些 command import 它，并在缺失时失败而非 global fallback。

## 配置分离

共享严格项放在 base config，但 leaf config 必须按环境区分：

- Node library/app：Node runtime types 与 Node-compatible module semantics。
- Vite browser app：DOM libs、bundler resolution，且 compiler 不 emit JavaScript。
- Tests：显式 test globals 与独立 include scope。
- Declaration build：只包含稳定公开源码；排除 test、fixture、migration 与临时生成文件。

`references` 不会通过 `extends` 继承；每个拥有图边的 project 必须自己声明。
