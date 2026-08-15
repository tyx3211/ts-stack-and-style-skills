# Workspace 与 Package Graph

## 拆包阈值

只有 package 具备长期独立理由时才拆包：独立发布、部署、运行时、所有权、访问政策、昂贵隔离测试，或被多个 consumer 复用。如果抽取只增加配置而没有稳定 contract，就把 feature 留在 app 内。

## 四张图

- Workspace graph：安装、链接、package manager 选择与 lockfile。
- Runtime graph：package dependency、`exports`/`imports`、模块格式与部署产物。
- TypeScript graph：tsconfig 归属、references、声明边界与 build info。
- Task graph：命令顺序与缓存。Turbo/Nx 等 task runner 负责协调，但不替代前三张图。

审查时对齐这些图。每个 runtime dependency 都应由 consumer 声明；每个 project reference 都应对应真实 TypeScript 依赖；每个 task dependency 都应对应下游实际消费的产物。

## 推荐形态

```text
apps/
  api/
  web/
  worker/
packages/
  contracts/
  db/
  ui/
  config/
```

名称与目录必须反映真实职责；不要创建空洞架构层。

## Dist-first 决策

以下任一条件成立时选择 dist-first：

- package 会被发布或安装到仓库外；
- 纯 Node 在没有 TypeScript loader 时消费它；
- 多种运行时消费同一 package；
- 开发期必须让 metadata/产物与生产一致；
- 声明是受支持的外部 contract。

先 build 上游 package 再运行 consumer。公开 metadata 指向 `dist`，且不要 export 只供源码内部使用的模块。

## Source-first 决策

只有所有 consumer 都受控，且 dev/test/build/runtime 工具接受同一套 TypeScript 语法时才选择 source-first，并显式记录此 contract。即使 type-only import 让某条路径看似安全，浏览器 source-first package 也不得引入 Node-only dependency。

## 依赖政策

- runtime dependency 放在实际 import 它的 package。
- build-only 工具放在拥有命令的最近 package 或共享 config package。
- peer dependency 只用于由 host 持有的 singleton/plugin 关系，不要用它逃避安装。
- CI 检测未声明与未使用依赖。
- 强制依赖方向，例如 `web -> contracts`、`api -> contracts/db`，禁止 `contracts -> app`。
