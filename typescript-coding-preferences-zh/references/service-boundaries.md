# Service 与边界参考

## 推荐分层

```txt
contract/schema:
  input, output, error, OpenAPI-visible shapes

route/transport:
  framework adapter, middleware, context extraction, response mapping

service/usecase:
  business workflow and orchestration

repo/query:
  PostgreSQL, Redis, external API access

policy:
  authorization and domain decisions

infra:
  concrete clients, logger, queue, telemetry
```

## Hono / oRPC 形态

Hono route 代码应保持轻薄：

```ts
const app = new Hono();

app.route("/rpc", createORPCHonoHandler({ router, context: buildContext }));
```

实现代码应依赖 contracts 与依赖对象，而不是依赖 `Hono.Context`：

```ts
export async function createUser(deps: Deps, input: CreateUserInput) {
  const user = await deps.userRepo.create(input);
  await deps.auditLog.write({ type: "user.created", userId: user.id });
  return user;
}
```

## Elysia / oRPC 形态

在 oRPC-first 的 Elysia 项目中，应把 Elysia 接到 oRPC 适配层上，而不是把同一份公开接口 schema 再用 `Elysia.t` 重写一遍。`Elysia.t` 只应用于本地 / 内部接口，比如健康检查或仅调试使用的路由。

不要把 Elysia context 直接传进 usecase。应在传输层边界提取请求局部数据，再把它们封装进类型明确的 dependency / context 对象传入。

## Schema 来源规则

每个公开 API 边界只能有一个 canonical schema source（规范 schema 来源）：

- oRPC-first：`packages/contracts` 内的 Zod / Valibot / ArkType schema
- Hono-only：Standard Schema 适配器，或 Zod / Valibot / ArkType validator 作为路由 schema 来源
- Elysia / Eden-only：`Elysia.t` 可同时作为路由 / 客户端 / OpenAPI 来源

不要在多个 schema 系统里镜像同一份接口形状。相比“库选择不完美”，schema 漂移要糟得多。

## 闭包使用

好的闭包使用方式：

```ts
export function makeUserHandlers(deps: Deps) {
  return {
    getById: async (c: Context) => {
      const id = c.req.param("id");
      return c.json(await deps.userRepo.getById(id));
    },
  };
}
```

这里捕获的是一个小型依赖对象，返回的也是一组小型 handler。

应避免：

- 返回多层嵌套函数，例如 `makeA(a)(b)(c)`
- 在长期存活闭包里捕获大型可变状态
- 把业务状态推进隐藏在闭包链条里
- 围绕闭包搭建私有小框架

## Review 清单

- route 是否保持轻薄，没有复杂业务逻辑？
- service / usecase 代码是否避免导入框架 context？
- 每个公开 input / output / error 是否都只有一个 schema 来源？
- 授权决策是否集中在 policy / usecase，而不是散落在 route / component 中？
- API 资源缓存是否由 TanStack Query 或同类 server-state 工具拥有，而不是由 Pinia / Zustand 维护？
- 高频数据对象是否避免了每实例函数属性？
