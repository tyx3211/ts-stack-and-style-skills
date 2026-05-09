# 项目结构参考

## Monorepo 布局

```txt
repo/
  apps/
    web/
      src/
        routes/
        pages/
        features/
        components/
        queries/
        stores/
        forms/
        lib/
        main.tsx or main.ts

    api/
      src/
        app.ts
        server.ts
        context.ts
        middleware/ or plugins/
        modules/
          user/
            user.route.ts
            user.service.ts
            user.repo.ts
            user.policy.ts
          order/
            order.route.ts
            order.service.ts
            order.repo.ts
        infra/
          db.ts
          redis.ts
          logger.ts
          queue.ts
          telemetry.ts

    worker/
      src/
        index.ts
        jobs/
          send-email.job.ts
          import-csv.job.ts

  packages/
    contracts/
      src/
        user/
          user.schema.ts
          user.contract.ts
        order/
          order.schema.ts
          order.contract.ts
        index.ts

    db/
      src/
        schema.ts
        migrations/

    ui/
      src/
        components/

    config/
      eslint/
      tsconfig/
```

## API 类型流转

```txt
schema
  -> oRPC contract
  -> backend implementation
  -> generated OpenAPI
  -> typed client
  -> TanStack Query
  -> React/Vue component
  -> form validation
```

## 可写入仓库规则的建议

这些规则可以直接作为 `AGENTS.md` 或项目规范候选项：

```txt
1. service/usecase 不得导入 Hono/Elysia/Vue/React。
2. route/controller 代码不得承载复杂业务逻辑。
3. 前端代码不得手写已经由 contracts 提供的 API 响应 DTO。
4. 同一份服务端资源缓存不得同时存在于 TanStack Query 和 Pinia/Zustand。
5. API 边界代码不得把 any 当成逃生口。
6. 公开路由必须有 schema/contract 覆盖。
7. mutation 必须声明 query 失效策略或 optimistic update（乐观更新）策略。
8. 公开 API 必须能体现在生成出的 OpenAPI 中。
9. 数据库实体不得直接作为 API 响应返回。
10. usecase 返回的是领域/应用结果，而不是 HTTP 响应对象。
11. 权限检查应集中在 policy/usecase，而不是散落在组件或路由中。
12. 后台任务应进入 queue/workflow，而不是阻塞请求线程。
13. CPU 密集型工作应交给 worker，而不是阻塞事件循环。
14. 复杂功能需要 handler/usecase/contract 测试。
15. 复杂表单应尽量复用或派生自边界 schema。
16. 新的服务端 TypeScript package 默认优先 Node.js 24 或当前稳定 Bun。
17. 新的服务端 tsconfig 基线默认优先 NodeNext module/moduleResolution 和 esModuleInterop: true。
```

## TSConfig 基线

对于新的服务端 package，如果框架没有接管 tsconfig，且项目也不是明确的 CommonJS-only（仅 CommonJS）仓库，可以默认使用这份配置：

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true
  }
}
```

如果要从 CommonJS 迁移到 `NodeNext`，应把它当成一项明确任务，而不是顺手清理。

## Hono 模块形态

```txt
modules/user/
  user.route.ts     轻量传输层胶水
  user.service.ts   业务流程
  user.repo.ts      数据库/缓存访问
  user.policy.ts    授权/领域策略
```

`user.route.ts` 可以导入 Hono 和框架适配器。`user.service.ts`、`user.repo.ts`、`user.policy.ts` 应尽量保持与框架无关。

## Elysia 模块形态

```txt
modules/user/
  user.route.ts     Elysia 路由/插件或 oRPC 适配层胶水
  user.model.ts     仅 Elysia 内部需要时才保留的本地模型
  user.service.ts   业务流程
  user.repo.ts      数据库/缓存访问
  user.policy.ts    授权/领域策略
```

如果项目是 oRPC-first，优先把契约 schema 放在 `packages/contracts`，而 `user.model.ts` 只保留给本地/内部 Elysia 接口使用。
