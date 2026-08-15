# 浏览器、HTTP 与认证边界

## 目录

- 渲染与 XSS
- 富文本与可信值
- CORS 与 CSRF
- Cookie 与会话
- Token 与授权
- 密码路径
- 必需测试
- 一手参考

## 渲染与 XSS

按动态值最终进入的解释器分类。同一值在 text sink 中可能无害，在另一 sink 中却可能执行。

优先使用：

- React/Vue 普通插值；
- `textContent`、`createTextNode`，以及固定且无害的 DOM property；
- URL constructor 加显式 scheme/destination policy；
- 带正确 `Content-Type` 的 JSON response。

机器盘点并禁止或隔离：

- `innerHTML`、`outerHTML`、`insertAdjacentHTML`、`document.write`；
- React `dangerouslySetInnerHTML`、Vue `v-html` 等 raw-template directive；
- `eval`、`Function`、字符串 timer、inline event handler、动态 script 构造；
- 动态 attribute name、CSS、`srcdoc`、script URL 与 navigation URL；
- 允许 raw HTML 穿透的 Markdown renderer 或 template engine。

Encoding 必须匹配上下文。HTML-body escape 不能复用于 attribute、URL、CSS 或 JavaScript。优先彻底移除 code context 中的动态值。即使框架会转义 attribute，也必须另行验证 URL scheme 与 destination policy。

CSP、nonce/hash 与 Trusted Types 能降低可利用性并暴露 unsafe sink。先以 report-only 测量，再切换 enforce。它们不会修复 unsafe sink，也不会授权 URL。

## 富文本与可信值

按以下优先级处理：

1. 用 typed AST 或 component model 表达允许的内容，并通过普通框架 API 渲染节点。
2. 只有 raw rich HTML 是不可避免的兼容边界时，才使用一个持续维护的 parser/sanitizer 与最小 allowlist。
3. 只通过一个 adapter 渲染；尽可能紧邻 sink 才 sanitize，之后禁止修改或拼接。

Sanitizer config、版本、URL hook 与 rendering adapter 共同构成 trusted kernel。维护已知 bypass regression fixture，并随 sanitizer/browser 生态更新。

Brand 可以在纪律严格的 TS 工程中减少误混：

```ts
declare const safeHtmlBrand: unique symbol;
export type SafeHtml = string & { readonly [safeHtmlBrand]: true };
```

它不能证明安全。只有不导出的构造路径可 assert brand，且该路径必须调用 sanitizer。不得用 regex、关键字黑名单或 `isSafeHtml`/`assertSafeHtml` 假装重新证明 HTML 安全；安全性取决于 parser、config、sink context、browser behavior 与之后是否修改。

## CORS 与 CSRF

CORS 告诉浏览器哪些 origin 可以读响应；对于 non-simple request，还决定 preflight 后能否发送真实请求。它不约束 curl、native client、server 或同用户恶意进程；即使 response 不可读，simple cross-site request 仍可能到达 server。

CORS 要求：

- 使用精确、normalised allowlist；绝不反射任意 `Origin`；
- credentialed request 只返回一个被允许的 origin 与 `Access-Control-Allow-Credentials: true`，不得配 `*`；
- cache 可能复用 origin-dependent response 时设置 `Vary: Origin`；
- 只开放必要 method/header；未审查 subdomain takeover 前禁止宽泛 regex；
- 测试 allowed/denied origin、preflight、simple request、`null` origin policy 与 cache behavior。

Cookie-authenticated mutation 要求：

- GET/HEAD/OPTIONS 不产生业务副作用；
- threat model 需要时，使用框架维护的 CSRF protection、synchronizer token 或正确绑定并签名的 double-submit；
- 验证 `Origin`，谨慎以 `Referer` fallback；Fetch Metadata 可作为额外层拒绝明显 cross-site request；
- 要求预期 Content-Type，并拒绝意外 form/simple-request shape；
- `SameSite=Lax/Strict` 只作 defense in depth。`same-site` 不等于 `same-origin`，sibling subdomain 可能不可信；`SameSite=None` 必须配完整 cross-site CSRF 设计。

OAuth/OIDC callback 还需 protocol state、适用时的 PKCE、精确 redirect URI、issuer/client binding 与 replay handling。CORS/Cookie flag 不提供这些性质。

## Cookie 与会话

浏览器 session 默认使用 CSPRNG 生成的 opaque id：

```text
Secure; HttpOnly; SameSite=Lax; Path=/
```

不需要 `Domain` 时优先 `__Host-` prefix。显式选择持久化、idle timeout、absolute timeout 与 renewal。`HttpOnly` 能减少 JavaScript 离线盗取 token，但不能阻止 XSS 发起已认证动作。

Server 必须：

- 只接受自己签发的 id；
- 不需要恢复 raw bearer 时只保存 digest；
- login 与每次 privilege change 后轮换 id；
- 使旧凭据失效，并定义 logout/revocation 传播；
- 日志和 trace 脱敏 session id 与 authorization header；
- 定义并发会话、device、recovery、step-up 与高风险动作 reauth policy。

通过 Redis 宣称立即撤销前使用 `postgres-redis-cache-consistency`。typed `Session` 与 cache hit 都不能证明当前授权仍有效。

## Token 与授权

区分 transport 与 format：Cookie/`Authorization` 是 transport；opaque id/JWT 是 credential format。

- 第一方浏览器 app 若 JS 不必接触 token，优先 HttpOnly Cookie/BFF 或 server session。
- Native/Electron 使用适当的 system-browser OAuth/OIDC + PKCE；refresh credential 放 main process 或 OS-backed storage，绝不暴露给 renderer。
- Access token 短期且限定 audience；验证固定允许的 algorithm、signature/key source、`iss`、`aud`、使用时的 `exp`/`nbf`、token type/purpose、client/tenant binding 与 scope。
- Refresh token 轮换，用 token family 或等价 server state 检测 replay，并尽量只存 digest。完全 stateless refresh 无法承诺立即撤销或 replay detection。
- JWT payload 不得放 password、password hash、不必要个人数据或可复用 server secret。签名不等于加密。

先认证调用方，再由权威侧授权当前 action/resource。旧 token 中的 role/scope 可能 stale；必须声明可接受的 staleness 或重查当前 policy。明确绑定 tenant、resource、client 与 operation，避免 confused deputy。

## 密码路径

- 新密码使用持续维护的 Argon2id 实现与 library-managed unique salt。公开参数只是当前 baseline；按部署校准并记录。
- 只有 Argon2id/scrypt 不可用或迁移 legacy 时使用 bcrypt，并处理 input length 语义；成功登录时逐步 rehash 旧参数。
- 密码只在 login、注册确认、改密、recovery 或显式 reauth 时验证；不得进入普通已认证请求，也不得携带在 token 中。
- 使用适合 runtime 的 async/worker execution，同时限制 verify 并发。移出 event loop 不会消除 CPU/内存成本。
- 按多种 signal 限流，使用足够通用的失败响应，处理 account enumeration，并单独设计 MFA/recovery。不得记录 raw credential。

## 必需测试

- 每个 raw sink/sanitizer policy 的 DOM/server-render payload corpus；确保 sanitize 后转换不能重引入 markup。
- allowed、denied、credentialed、preflight、simple 与 cached response 的 CORS matrix。
- missing/invalid token、hostile Origin/Referer/Fetch Metadata、simple form、state-changing GET 的 CSRF denial。
- Cookie attribute 与 session lifecycle：fixation、rotation、old-id rejection、idle/absolute expiry、logout、privilege change、轮换时并发请求。
- JWT/token：algorithm confusion、错误 issuer/audience/type/client、expiry/not-before、key rotation、refresh replay、redaction。
- Password verify concurrency/load：保留资源余量，普通 traffic 仍能响应。

## 一手参考

- [OWASP XSS Prevention](https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html)
- [OWASP CSRF Prevention](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html)
- [MDN CORS](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/CORS)
- [OWASP Session Management](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html)
- [OWASP Password Storage](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html)
- [NIST SP 800-63B](https://pages.nist.gov/800-63-4/sp800-63b.html)
