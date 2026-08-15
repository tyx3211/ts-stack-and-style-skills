# oRPC Contract Package

## 所有权

把 canonical runtime schema 与 oRPC contract 放在同一个 contract package。Zod、Valibot、ArkType 与 oRPC contract object 是运行时值，不是 type-only declaration，因此 dist-first contract package 必须 emit JavaScript 与声明。

```text
packages/contracts
  schema + oRPC contract
apps/api
  implementation + transport adapter
apps/web
  contract-derived client + query integration
artifact
  generated OpenAPI when required
```

## 边界规则

- contract package 不得 import Hono/Elysia app context、数据库 adapter、secret、Node-only infrastructure、React/Vue 或 app code。
- API 实现 contract，并把 domain/application result 映射为 contract output。
- 前端消费 contract-derived client，不得 import API app 或数据库 package。
- 不要在 Hono validator 或框架 route schema 中重复 oRPC endpoint 的 body/query/param schema。
- oRPC adapter 前的 middleware 不得消费 adapter 仍需读取的 request body。
- database row 与 contract output 必须分离。

## OpenAPI 角色

内部 TypeScript client 可直接从共享 contract package 派生类型，不需要把 OpenAPI client generation 作为同步中间步骤。但 OpenAPI 是公开/外部 contract、文档输入、互操作产物或 CI diff surface 时仍应生成。

OpenAPI artifact 必须从 canonical contract 生成并检查 drift。禁止维护手写平行 OpenAPI schema。

## Package 模式

- Dist-first：package exports 指向已构建 JavaScript 与声明；app dev 前 build/watch，或在 task graph 声明依赖。
- Source-first：只有所有 consumer 都刻意转换同一 schema source，且没有不受支持的 runtime dependency 穿透边界时才允许。
- health check 等框架本地 endpoint 可按需留在共享业务 contract 外。

## 验证

- API implementation 对 contract 做 typecheck。
- 前端 client/query usage 对同一 contract 做 typecheck。
- 执行 runtime schema parsing test，而不只测试 inference。
- 需要 OpenAPI 时生成并 diff。
- 把 pack 后 contract package 安装进最小 consumer，并执行一次 runtime schema import。
