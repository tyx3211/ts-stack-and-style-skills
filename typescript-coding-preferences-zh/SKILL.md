---
name: typescript-coding-preferences-zh
description: Use when writing, refactoring, or reviewing TypeScript code with Chinese workflow preferences around style, schema boundaries, class usage, type safety, local hooks, and avoiding Java/NestJS-style over-OOP patterns.
---

# TypeScript 编码偏好

## 概览

这里采用的 TypeScript 风格是：边界以 schema（运行时校验结构）为先，流程以函数 / 模块为先，建模以数据为先，并且有意识地减少面向对象编程（OOP，面向对象编程）的默认比重。它应被视为项目默认纪律，而不是柔性的审美偏好。class（类）只作为局部工具使用，主要服务于 entity / value object（实体 / 值对象），而不是整个架构的默认基石。

这是一种有意偏 Go 式的 TypeScript：plain data（朴素数据）、函数、小接口、显式组合，以及只有在确实有收益时才使用 class。

## 默认立场

- 默认使用显式数据流、普通函数和小模块。
- 在代码复用上，使用组合与委托，而不是继承；只有当领域里真的存在稳定的 `is-a` 关系，并且仓库已经从这种形态中获益时，才使用继承。
- 把经典 OOP 模式当成“问题形状词汇”，而不是默认实现模板。
- 避免 Java / Spring 风格的 TypeScript：controller class（控制器类）、厚重的 service / repository / manager 分层、装饰器密集的依赖注入，以及空转发抽象层。
- 如果仓库已经有明确框架约定，应当尊重本地惯例；但在没有本地理由时，不得额外引入更重的模式。

## 运行时与 TSConfig 默认项

- 新的服务端 TypeScript 项目，按部署目标使用 Node.js 24 或当前稳定版 Bun。
- 如果项目不是明确的 CommonJS-only（仅 CommonJS）形态，使用面向 ESM 的 TypeScript 配置：`module: "NodeNext"` 与 `moduleResolution: "NodeNext"`。
- 默认开启 `esModuleInterop: true`，减少 CommonJS / ESM 包互操作摩擦。
- 除非任务明确要求现代化改造或重新设定基线，否则应尊重现有仓库的运行时与模块系统。

在创建或调整 `tsconfig`、`package.json` 的模块类型、运行时基线或 Node / Bun 方案时，请读取 [references/runtime-tsconfig.md](references/runtime-tsconfig.md)。

## 建模决策

在新增类型或抽象前，必须按以下顺序判断。没有完成这个检查前，不要新增 class、service 层、factory、manager 或 interface：

1. 对于 API 输入输出、DTO、配置、数据库行和临时数据，优先使用普通对象数据配合 `type` 或 `interface`。
2. 对于具有稳定局部行为的领域实体和值对象，当 `obj.method()` 可读性或原型方法共享有明确收益时，再使用 `class + interface`。
3. 对于跨对象、跨资源、I/O 较重或工作流编排逻辑，优先使用外部函数、`Service` / `Ops` 模块，或者小型 capability object（能力对象），而不是实例方法。
4. 对于 AST 节点、协议消息、命令种类、状态机等有限变体，优先使用带 `kind` / `tag` 的 discriminated union（可判别联合）和尽量穷尽式的 `switch`。
5. 对于 repo / client / service 这类只会存在少量实例的对象，factory（工厂）返回方法对象是可接受的；但不要把这种模式复制到大批量数据数组上。

当需要在 `class`、普通对象、operations module（操作模块）和 tag-based dispatch（标签分发）之间做选择时，请读取 [references/object-modeling.md](references/object-modeling.md)。

## Interface 规则

- 对于开放能力约束和未来可能有多个实现者的对象契约，使用 `interface`。
- 对于闭合集合、映射类型、条件类型，以及不希望被重新打开的数据形状，使用 `type`。
- 把数据接口与能力接口分开。`UserData` 不应该被迫满足 `UserService`。
- 当字面量既要接受接口检查，又要保留精确推导类型时，使用 `satisfies`。
- 对 callback 类能力形状，使用 function property（函数属性），不要写 method signature（方法签名），除非框架明确要求 method 语法。
- 除非领域关系真的是稳定的 `is-a`，或者框架 / 库明确要求，否则不要用 `class extends` 做复用。

## Class 规则

只有在 class 真正值得时才使用：

- 实体 / 值对象需要稳定不变量。
- 实例数量很多，使用原型方法可以避免每实例函数分配。
- 对象上只有少量内禀方法，例如 `price.isZero()`、`range.contains(x)`。
- 需要受控构造，或者对象内部确实需要私有可变状态。

class 方法应保持轻薄且内禀。持久化、编排、授权、格式化、缓存策略和多对象工作流都应放在实体外部。

不要把原型方法不绑定地直接当作回调传出。应使用 `obj.method()` 调用，或者显式包装成 `(...args) => obj.method(...args)`，或者改成外部函数。

不要在轻量 Hono / oRPC / Elysia 代码库里引入 class controller、decorator（装饰器）、DI container（依赖注入容器）或类框架 base class，除非仓库已经明确采用这种约定。

## 函数与闭包

- 可复用逻辑使用普通辅助函数。
- 局部回调和局部 helper closure（辅助闭包）是可以接受的，只要它们不会远离作用域长期逃逸。
- factory closure（工厂闭包）只在依赖装配场景中适度使用，例如 `makeUserHandlers(deps)`。
- 避免层层柯里化 API、长期逃逸闭包，以及用闭包 DSL（领域特定写法）隐藏状态与控制流。
- 在 UI 代码中，React hooks 和 Vue Composition API 的闭包是框架语义，应按框架习惯写；但不要在此之上再搭私有闭包小框架。

## 边界规则

- 外部输入输出的真实边界，应由运行时 schema 负责定义。
- 在 oRPC-first 项目里，contract schema 应集中放在 contract package 中，不要在 Hono validator 或 Elysia route options 中为同一接口重复写一遍 schema。
- HTTP / RPC handler 应保持轻薄：解析上下文、调用 usecase / service、映射响应和错误。
- 不要让 `Hono.Context`、`Elysia.Context`、React 组件 props 或 Vue 组件状态泄漏进 service / usecase / repo 代码。
- 不要把公开 API 响应类型从 schema / contract 输出之外再手写一份。

在修改 Hono / oRPC / Elysia 路由、service、repo、policy、schema 或基于闭包的依赖装配代码前，请读取 [references/service-boundaries.md](references/service-boundaries.md)。

## ESLint、Hooks 与类型安全

- 把 ESLint 和 TypeScript 配置视为可执行的项目法律，而不是可商量的风格建议。
- 当定义或收紧 `src/` 的 tsconfig、ESLint、npm scripts、hooks、CI 门禁、断言策略或双变安全规则时，加载 `strict-typescript-source-gates-zh`。
- 在非测试、手写的生产代码中，显式 `any` 应视为禁止；同时应开启 `noImplicitAny`，避免隐式 `any`。
- 对不可信的外部值优先使用 `unknown`，然后再用 `typeof`、自定义 type guard（类型守卫）或 schema parse（校验解析）收窄。
- 不要把 `as` 断言拿来替代运行时校验。尤其要避免 `JSON.parse(...) as T`、`payload.value as number` 和 `as unknown as T`，除非这里有非常窄且有注释说明的互操作原因。
- 使用 `eqeqeq: "error"` 去掉宽松相等，但要记住 `eqeqeq` 并不能防住 `NaN`、`Infinity`、truthy/falsy（真假值）误判或未校验外部输入。
- 数值边界不仅要校验类型，还要校验数值本身，例如 `typeof x === "number" && Number.isFinite(x)`，然后再叠加业务范围检查。
- 本地 hooks（钩子）应保持轻薄：只调用稳定命令，比如 `npm run lint`、`npm run typecheck`、`npm run build`、`npm run verify`，不要在 hook 里再复制隐藏逻辑。
- CI 依然是干净环境下的最终判决；hooks 的作用是提供快速反馈，也帮助代理在本地尽早理解失败原因。

在修改 ESLint、hooks、CI 门禁、生成代码 lint 策略、`any` / `unknown`、断言、type guard、schema parse、相等性检查或数值校验时，请读取 [references/lint-hooks-type-safety.md](references/lint-hooks-type-safety.md)。如果是 `src/` 硬门禁，也要加载 `strict-typescript-source-gates-zh`。

## 性能与对象形状纪律

- 不要给大集合里的每个对象都挂上函数属性。
- 对象构造完成后尽量保持 shape（对象形状）稳定，不要在运行中随意补丁式加字段。
- 在热路径中，避免重复分配、重复解析 / 校验、混乱的动态分发，以及对象形状频繁变化。
- 当数据量或热循环确实相关时，优先考虑 `tag + switch`、扁平数组、稳定 class 布局和预计算结果。
- 在普通应用代码里，不要在弄清网络、数据库、渲染、序列化和分配成本之前，就过早优化分发风格。

## 需要主动顶回去的坏味道

- 只是为了让一个 class 去实现，而额外创建的抽象 interface。
- `Manager`、`Factory`、`Adapter`、`Facade` 或 `Service` 层本身几乎只做转发。
- entity 方法里直接碰数据库、Redis、HTTP、日志、请求上下文或框架上下文。
- 把 Hono 代码改写成 NestJS 风格的 controller class 和 decorators（装饰器）。
- 同一份 API 数据同时缓存在 TanStack Query 和 Pinia / Zustand。
- 公开 API 响应类型又手写了一份，与 contract / schema 输出脱节。
