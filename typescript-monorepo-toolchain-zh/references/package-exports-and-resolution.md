# Package Exports 与解析

## 公开入口

显式定义每个受支持的 package entry。ESM dist-first package 示例：

```json
{
  "type": "module",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js",
      "default": "./dist/index.js"
    },
    "./feature": {
      "types": "./dist/feature.d.ts",
      "import": "./dist/feature.js",
      "default": "./dist/feature.js"
    }
  }
}
```

把 `types` 放在 runtime condition 前。只 export 有意支持的 subpath。只有真实 CJS 产物存在时才增加 `require`，并测试 dual-package 边界；不要让两个 condition 指向不兼容文件。

## 包内 Imports

运行时支持时，用 package `imports` 定义 package-private alias：

```json
{
  "imports": {
    "#core/*": "./dist/core/*.js"
  }
}
```

entry 使用 `#` specifier，且只在本 package 内生效。source/dist mapping 必须与所选消费模式一致，并验证 Node、TypeScript、test 与 bundler 都能解析。

## TypeScript Paths

`paths` 只改变 TypeScript 解析，不会重写 emit import specifier。TypeScript 7 中不要使用已删除的 `baseUrl`；target 必须相对 config。`paths` 应描述 bundler/runtime 已经拥有的 alias，而不是凭空创造 runtime 行为。

Vite 8 可通过 `resolve.tsconfigPaths` 选择启用 tsconfig path，但默认不开启，也不会让 Node 或其他工具理解 alias。

## Deep Import 与边界

Package `exports` 会封装通过 package name 访问的 subpath，但 monorepo sibling 仍可能用相对文件路径绕过。必须同时强制：

- package-name import 只能匹配已声明 exports；
- lint/boundary 规则禁止跨 package 相对导入。

在 pack consumer 中验证未 export subpath 确实失败。

## `tsc-alias`

`tsc-alias` 只作为遗留 post-emit 兼容层：仓库暂时无法把已 emit alias 迁到 package exports/imports 或相对 runtime path 时才使用。

- 新 package 禁止引入。
- 同时验证 JavaScript 与声明 rewrite。
- 验证 ESM 扩展名、sourcemap、dynamic import、conditional exports 与所有入口。
- rewrite 后运行 pack consumer fixture。
- 保留删除它的迁移任务；postprocessor 只是隐藏 resolver 分歧，并没有消除分歧。
