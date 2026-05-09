# Schema 与 Contract 选择

## 核心规则

每个公开接口都应该只有一个 schema 事实来源。最常见的失败模式是：同一份接口形状同时写了一份 oRPC contract schema 和一份框架 route schema，之后两边逐渐漂移。

## oRPC-First

适用于复杂、长生命周期、AI 深度参与、公开 / 稳定，或者需要服务多个客户端的项目。

```txt
packages/contracts:
  Zod/Valibot/ArkType schema
  oRPC contract

apps/api:
  Hono/Elysia adapter
  handler implementation

apps/web:
  oRPC client
  TanStack Query integration

artifact:
  generated OpenAPI
```

在这种模式下：

- Hono 不应再通过 `@hono/zod-validator` 或 `@hono/standard-validator` 重复声明同一份路由 schema。
- Elysia 不应再通过 `Elysia.t` 重复声明同一份公开路由 schema。
- 框架 schema 依然可以用于健康检查、内部调试接口，以及不属于 oRPC 的本地路由。

## Elysia-First

适用于纯 Bun / Elysia / Eden 项目，且团队更看重 TypeScript monorepo 内部客户端体验，而不是框架中立的契约治理。

```txt
Canonical schema: Elysia.t
Client: Eden
OpenAPI: Elysia OpenAPI plugin
```

除非表单复用或第三方集成真的需要，否则不要再额外维护一份平行的 Zod / Valibot 镜像。

## Hono-First Without oRPC

适用于 API 需求较小，oRPC 反而显得过重的场景。

```txt
Canonical schema: Zod/Valibot/ArkType
Validation: @hono/standard-validator or @hono/zod-validator
OpenAPI: hono-openapi or separate OpenAPI generation
```

这种方案本身是干净的，因为 Hono 并不强制一种 schema 语言。

## tRPC

适用于以下情况：

- API 主要服务于 TypeScript monorepo 内部。
- 公开 REST / OpenAPI 不是主要治理产物。
- 团队更希望以 procedure / router 推导作为主要开发体验。

如果语言无关客户端、公开 API 文档或长期 OpenAPI diff（差异比对）非常重要，就不要把 tRPC 当成唯一契约层。

## Schema 库选择

| 库 | 优先场景 | 注意点 |
| --- | --- | --- |
| Zod | 生态最广、AI 熟悉度高、示例最多 | 在大型前端里要关注体积与性能 |
| Valibot | 模块化、轻量、对 Standard Schema 友好 | 团队熟悉度可能较低 |
| ArkType | 类型表达能力很强的重类型项目 | 生态较小，学习曲线更陡 |
| Elysia.t | 纯 Elysia / Eden 路线 | 跨框架复用和表单复用较弱 |
| TypeBox | 偏 JSON Schema / OpenAPI / 性能导向 | 领域建模手感不如 Zod 风格 API 自然 |

## 面向公开 OpenAPI 的安全 Schema

对于公开契约 schema，尽量把形状保持在容易表达为 JSON / OpenAPI 的范围内：

- 日期时间优先序列化为 `string`，而不是直接暴露 `Date` 对象。
- 类似 `BigInt` 的值，优先使用字符串，除非确认数值范围安全。
- 谨慎使用 transform、effect、复杂 refinement、brand 和 coercion。
- 输入边界的 normalize / coerce（规范化 / 强制转换）要显式完成。
- 返回结果在输出前先整形，不要直接暴露数据库行对象。
