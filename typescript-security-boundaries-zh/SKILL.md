---
name: typescript-security-boundaries-zh
description: 用于中文工作流中设计、实现、审查或测试 TypeScript/JavaScript 安全边界，尤其涉及浏览器 DOM 渲染与 XSS、CORS/CSRF、Cookie、认证、会话、密码、上传、本地文件与路径、出站 URL/SSRF、Webhook、localhost 服务，或 Electron preload/main/IPC 安全时。
---

# TypeScript 安全边界

## 目标

显式标出每一次信任转换，并让真正拥有 capability（能力）的组件实施可执行约束。TypeScript 类型可以提高可审计性，但不能证明 HTML、路径、URL、principal（主体）或 IPC caller（调用方）安全。

修改代码前，按主题读取对应 reference：

- 浏览器输出、CORS、CSRF、Cookie、session、token、密码与授权：读 [references/browser-http-auth.md](references/browser-http-auth.md)。
- 路径、文件、上传、出站 URL、SSRF、localhost 服务与 Electron：读 [references/node-electron-boundaries.md](references/node-electron-boundaries.md)。
- 机器 gate、boundary record、测试矩阵、例外和发版审计：读 [references/harness-and-review.md](references/harness-and-review.md)。

## 边界工作流

1. 盘点资产或 capability：账户、高权限动作、凭据、DOM code sink、文件系统根、出站网络、shell、剪贴板、摄像头或 native API。
2. 列出全部不可信 producer 与转换。包括 URL/query/hash、数据库/CMS 内容、第三方响应、local storage、postMessage、IPC、文件、redirect、DNS 和已失陷 renderer。
3. 指定真正拥有 capability 的执行点。后端或 Electron main 执行授权；渲染 sink 决定输出上下文；打开文件时校验路径包含关系；每次出站连接都执行目的地策略。
4. 选择最窄 allowlist 与失败语义。默认拒绝；不得静默放宽 origin、path、scheme、host、IPC method 或 sanitizer policy。
5. 对语法、配置和可执行的拒绝用例建立 machine gate；把业务信任关系与部署假设写入简短、需人工审查的 boundary record。
6. happy path 前先测绕过与负例。按场景覆盖替代编码、redirect、IPv4/IPv6、symlink、恶意 origin、缺失凭据、renderer 恶意调用与 sanitize 后修改。
7. 只报告实际检查到的事实。不得由 typecheck、lint、schema、scanner 或通过 fixture 推导“已经安全”。

## 不可妥协的模型

- 外部数据和持久化数据每进入一个新的解释器或权限边界，都重新视为不可信。之前对某个 predicate 的校验不产生全局信任。
- authentication、authorization、validation、encoding、sanitization、canonicalization 与 concurrency 是不同控制，不得混为一谈。
- ingress 先解析数据形状，使用点再执行 sink-specific policy。不要全局“清洗所有字符串”。
- 优先框架默认安全路径和成熟、持续维护的安全 primitive。不得自行发明 escaping、密码哈希、token 签名、HTML sanitizer 或 URL canonicalization 算法。
- secret、password hash、session id、refresh token、Authorization header 与原始 credential 不得进入日志、URL、analytics、错误或 client-visible payload。
- 模块和进程间按最小权限设计。浏览器 client、renderer、plugin、worker 或 sidecar 不会因为由同一团队编写而天然可信。

## 类型层安全声明

把 `SafeHtml`、`SafePath`、`ValidatedUrl`、`AuthenticatedUser`、`AuthorizedCommand` 视为“经过受审构造路径”的提示，不是证明。

- `unknown`、schema、type predicate、assertion function、brand、wrapper class 或 private field，只能证明运行时真实检查到的 predicate 与构造纪律。
- 证明值是 `string` 或只含 allowlist 字符，并不等于为 HTML body、attribute、URL 或 JavaScript 上下文完成 encoding。
- `SafeHtml` brand 不能独立证明 sanitizer 正确、policy 仍新鲜、后续未修改，或可用于另一种 sink。
- IPC payload schema validation 不会认证 sender，也不会授权 capability。
- URL parser 不会实施出站目的地策略；path normalization 不会授权文件系统对象。
- 少数通过 assertion 创建的安全 brand 只放在很小的 trust-boundary module；其 assertion inventory 与 `[SAFETY]:` 例外遵循 `strict-typescript-source-gates`。

## 浏览器与 HTTP 规则

- 普通值使用 React/Vue 模板插值或 DOM text API 渲染；raw HTML 与 code-capable sink 是需要集中审计的 escape hatch。
- 产品确实需要 HTML 时，只允许一个集中配置、持续维护的 sanitizer，并紧邻唯一的渲染 adapter。不得用手写 type guard 或 regex “证明” sanitize 后的 HTML 安全。
- encoding 必须匹配实际输出上下文；HTML body、attribute、URL、CSS、JavaScript 不可互换。优先彻底禁止动态数据进入 JS/CSS/code context。
- CSP 与 Trusted Types 是 defense in depth 和可机器执行的 sink 缩减，不替代安全渲染。
- CORS 是浏览器 response-sharing policy，不是 authentication、authorization 或完整 CSRF 防护。使用精确 origin allowlist；带 credential 的响应不得使用 wildcard origin。
- GET/HEAD 必须安全。Cookie 认证的 mutation 要按部署明确选择 CSRF 防护；`SameSite` 是有效的 defense in depth，不是通用证明。
- 浏览器 session 默认使用 server-issued opaque credential，放入 `Secure`、`HttpOnly`、窄 scope、通常 `SameSite=Lax` 或 `Strict` 的 Cookie；兼容时优先 `__Host-`。
- login 与 privilege change 后轮换 session id；显式定义 idle/absolute expiry、logout/revocation、并发会话、recovery、reauthentication 与 abuse-rate policy。
- 密码只在注册、login、改密或显式 reauth 时验证。使用持续维护的 Argon2id 实现并校准资源上限；慢验证不得进入普通请求路径，且必须限制并发。
- 先认证，再依据当前服务端 policy 授权每项操作；不能因为 client token 或 typed context 带有 role/tenant/resource ownership 就直接信任。

## Node、文件、URL 与 Electron 规则

- 文件操作从固定 trusted root 解析，并执行 path-segment-aware containment。symlink、TOCTOU、Windows drive/case、upload name 和 download authorization 需分别处理。
- 上传使用 server-generated id，核验允许的真实内容而非只信 metadata，限制大小/数量/解压，并默认存于 executable/public root 之外。
- 出站请求只允许业务必要的 scheme、port 与 destination；每次 redirect 和解析到的 address 都重新校验，并限制时间、redirect 和 response size。有效 SSRF 防护还需要网络 egress control。
- localhost 服务只 bind loopback；通过认证的 parent/child channel 传递每次启动新生成的高熵 capability；每个请求都必须携带；按场景验证 Origin/Fetch Metadata，并假设其他本机进程可以连接。
- Electron renderer 在 XSS 后应视为已失陷。remote/untrusted content 关闭 `nodeIntegration`，启用 context isolation 与 sandbox，保持 `webSecurity`，限制 navigation、new window、permission 与外部 URL。
- preload 每个 capability 只暴露一个窄方法；禁止暴露 raw `ipcRenderer`、generic send/invoke、filesystem、shell、process 或无限制 HTTP primitive。
- main process 对每项 IPC 都验证 sender frame/origin、payload schema、authorization，以及 capability-specific path/URL policy。

## Harness 优先于自然语言

把客观可执行的控制委托给 repository harness：

- AST lint 或 Semgrep：禁止/盘点 unsafe DOM/code sink、raw IPC 暴露、危险 Electron flag 与 escape hatch；
- typecheck 与 schema/codegen drift check；
- Cookie、CORS、CSRF、CSP/Trusted Types、Electron preference、localhost bind 的配置测试；
- hostile origin、traversal、upload、SSRF redirect/address、IPC sender denial、session rotation/revocation 与 XSS payload 的集成/属性测试；
- lockfile、依赖 provenance/update policy、secret scan 与适用的生态 audit。

以下判断不可外包给 scanner：

- 哪些 origin、path、host、frame、principal 与 capability 具有真实业务信任；
- authorization semantics、authentication assurance、recovery/MFA、session lifetime 与 reauth 点；
- sanitizer policy、egress/network isolation、proxy、filesystem ownership、symlink assumption 与事故响应；
- 已登记例外是否仍有业务必要性。

使用 [references/harness-and-review.md](references/harness-and-review.md) 把两类要求都转为可审计 gate。

## 范围路由

- ESLint/Oxlint/TypeScript/CI 规则及 assertion/suppression inventory：使用 `strict-typescript-source-gates`。
- 普通 schema-first boundary 与 handler/usecase 组织：使用 `typescript-coding-preferences`。
- authorization 相关 DB invariant 与事务状态：使用 `backend-data-correctness`。
- session cache revoke、Redis authority、tombstone 或撤销延迟声明：使用 `postgres-redis-cache-consistency`。
- Electron/sidecar lifecycle、queue、shutdown、crash recovery、多进程协调：使用 `async-application-correctness`。
- auth 产品或框架选型：使用 `choosing-typescript-stack`；本 skill 负责实现与审计约束，不负责 vendor 选择。

## 审查退出条件

- 每个 privileged sink 都有唯一 owning enforcement point 与 deny-by-default policy。
- 每个外部输入既校验 shape，也针对最终 context/capability 再校验。
- 认证与授权分离、在权威侧执行，并有 denial test。
- Browser、Node、Electron escape hatch 均被机器盘点，例外已审核。
- failure、timeout、redirect、revocation 与 compromised-client behavior 均已显式定义。
- boundary record 记录测试无法证明的假设。
- 报告区分“检测结果”与“残余假设”，不宣称 security proof。
