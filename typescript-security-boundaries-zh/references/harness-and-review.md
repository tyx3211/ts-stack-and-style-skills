# 安全 Harness 与人工审查

## 目录

- Boundary record
- Machine gate 矩阵
- 例外协议
- 验证工作流
- 发版审计
- 报告语言

## Boundary Record

每个 privileged boundary 都要有一份简短、版本化的记录，放在 owning code 附近或仓库既有安全文档位置。

```yaml
boundary: electron.export-file
owner: desktop-platform
asset_or_capability: write a user-selected export
untrusted_sources: [renderer, imported-project-name]
trusted_principals: [main-frame at app://desktop]
allowed_sink: one chosen file below an approved directory
enforcement_point: main/export-file.handler.ts
authentication: expected sender frame and origin
authorization: user gesture plus current project access
validation: ExportRequestSchema
context_policy: canonical path containment and extension allowlist
failure: reject without partial output; return stable error code
machine_gates: [ipc-denial-tests, path-property-tests, electron-config-test]
human_assumptions: [OS account is trusted, export directory ownership]
exceptions: []
```

字段命名可按仓库惯例调整，但每项都必须有答案。单独的 type alias 或 inline comment 不能替代该记录。

## Machine Gate 矩阵

| 边界 | 必需自动化证据 | 人工负责的决策 |
|---|---|---|
| DOM/XSS | raw sink/code eval 的 AST inventory/ban；sanitizer adapter test；CSP/Trusted Types config test；payload E2E | 是否真需 HTML；sanitizer allowlist；third-party widget 信任 |
| CORS/CSRF | exact-origin/preflight/simple-request matrix；Cookie attribute；mutation CSRF denial | 合法 origin；same-site subdomain 信任；cross-site 产品流程 |
| Session/token | rotation、fixation、expiry、replay、logout、claim/key test；日志脱敏 | assurance level、lifetime、recovery/MFA、revocation guarantee |
| Password | approved library/config assertion；concurrency/load 与 abuse test | cost/capacity 校准；recovery/account-enumeration 响应 |
| Path/upload | property/corpus test；upload/archive limit；authorization denial | root、ownership、symlink/volume assumption、风险格式 policy |
| SSRF | URL/IP/redirect corpus；timeout/size limit；network-policy integration check | destination、DNS/proxy/egress 架构 |
| Electron/IPC | config snapshot；raw-IPC/flag AST ban；sender/payload/capability denial test | 合法 frame 与 renderer capability |
| Local sidecar | bind/token/origin test；redaction；lifecycle integration | OS-user threat boundary 与 capability scope |

风险语法具备清晰 AST shape 时，优先写小型 repository-local lint/Semgrep rule。不得只靠 broad text grep。TypeScript/ESLint/Oxlint 的具体实现路由到 `strict-typescript-source-gates`。

Scanner 与 dependency audit 是 finding source。需要人工判断 reachability、runtime exposure、exploit prerequisite 与 compensating control。不得因为 type 编译通过就忽略 finding，也不得因为当前 audit clean 就宣称 dependency 安全。

## 例外协议

每个 raw sink、危险 Electron preference、assertion 创建的安全 brand、宽 origin/path/URL capability 或 scanner suppression 都必须：

- 使用最窄 line/config scope；
- 写 `[SAFETY]:`，说明受保护 invariant、runtime enforcement point，以及为何安全 API 无法满足需求；
- 用稳定 symbol/module 指出 construction/consumption owner，避免脆弱 line-number cross-reference；
- 链接 negative test 与 boundary record；
- 指定 owner 与 review trigger，例如 sanitizer/Electron/auth library upgrade 或每次 release；
- 未登记例外或缺失/过期测试必须使 CI 失败。

Exception registry 是 inventory/accountability mechanism，不是安全证明。

## 验证工作流

1. 通过共享 `verify` command 执行 typecheck、lint、安全 AST/Semgrep rule、test 与 build。
2. 在真实 framework/runtime 中执行 boundary-specific negative test。DOM parser、browser CORS/Cookie、OS path、DNS、Electron IPC 不能由 pure unit mock 忠实建模。
3. 对 path、URL、origin、claim 与 encoding 使用 property-based 或 table-driven corpus。
4. 同时测试拒绝与可观测性：稳定 client error、不会泄密的 log、需要时的 alert/metric，以及不存在部分 privileged effect。
5. 核对部署控制——TLS/proxy header、egress、filesystem ownership、Electron fuse/signing/update channel、secret delivery——与 boundary record 一致。
6. 对 exact resolved version 检查依赖/security advisory，并通过正常 package-manager command 重新生成 lockfile/artifact。

不得增加一个只 grep 关键字的伪通用 `security:check`。共享命令只有在调用项目真实、framework-aware 且可靠失败的 gate 时才有价值。

## 发版审计

每次 release，或 boundary record 规定的更严格触发点：

- diff raw sink、assertion/brand、lint suppression、CSP/Trusted Types、CORS origin、Cookie/session setting、Electron preference/bridge method、upload type、filesystem root、URL destination 与 external-open policy；
- sanitizer、browser、framework、auth、URL client、archive parser、Node 或 Electron upgrade 后重新运行 bypass corpus；
- 核对 secret/token redaction 与 telemetry access；
- 验证 session/token key rotation 与 rollback procedure；
- 审查全部 open security exception，删除不再需要的 capability；
- 声明 threat model 或 residual risk 的变化。

## 报告语言

使用有边界的陈述：

- “AST gate 在 `src/` 中未检测到未登记 raw HTML sink。”
- “集成矩阵拒绝了所列 hostile origin 与 redirect fixture。”
- “设计假设 OS account 与 packaged application resource 可信。”
- “不保证 session 立即撤销；文档保证上限为五分钟。”

禁止写：

- “Zod/TypeScript 证明输入安全。”
- “CORS 阻止未授权请求。”
- “SameSite 消灭 CSRF。”
- “sanitize 一次后处处可信。”
- “`path.resolve` 防止 traversal。”
- “URL parsing/hostname allowlist 防止 SSRF。”
- “context isolation 使 IPC 安全。”
- “scanner/typecheck 证明应用安全。”
