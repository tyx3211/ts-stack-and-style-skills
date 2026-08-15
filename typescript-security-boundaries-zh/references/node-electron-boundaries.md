# Node 与 Electron 安全边界

## 目录

- 路径与文件访问
- 上传与 archive
- 出站 URL 与 SSRF
- Localhost BFF 与 sidecar
- Electron renderer/preload/main
- Custom protocol 与 navigation
- 必需测试
- 一手参考

## 路径与文件访问

`path.join`、`path.resolve`、`SafePath` brand 或 schema parsing 都不是 authorization。从固定 trusted root 出发，在打开文件前校验相对选择。

最低 containment model：

1. 解析前拒绝 absolute、drive-qualified、device、含 NUL 或不支持的输入。
2. 从 trusted root `resolve`。
3. 计算 `path.relative(root, candidate)`；结果为 absolute、`..` 或以 `..` 加 separator 开头时拒绝。使用 platform path semantics 比较，并按支持范围测试 Windows drive、UNC/device path、case 与替代 separator。
4. 以最小权限打开，并针对当前 principal 授权具体 read/write/delete 操作。
5. 若攻击者可创建文件系统 entry，还要处理 symlink、junction、hard link、mount change 与 TOCTOU。优先 OS isolation、安全目录 ownership、可用时的 descriptor-relative/native primitive，或从设计上不追随 attacker-controlled link。

存储名称使用 generated id，用户文件名只作 metadata。禁止把路径拼接进 shell command。

## 上传与 Archive

- Allowlist 业务需要的 extension，并用持续维护的 parser 验证实际内容/signature；不得只信 `Content-Type` 或 filename。
- 限制 bytes、file count、dimension、parse time、recursion 与 decompressed size；拒绝 archive traversal、symlink、absolute entry、duplicate/conflicting path 与 compression bomb。
- 默认存于 webroot 和 executable/plugin root 之外；通过已授权 mapping 下载，并设置安全的 `Content-Type`、`Content-Disposition` 与 download name。
- threat model 要求时 scan/transform 风险格式；parser/AV failure 必须有明确 quarantine 或 reject path。
- upload、association、processing、download、replacement 与 deletion 分别授权。

## 出站 URL 与 SSRF

先用 platform URL parser，再执行 destination policy：

- 尽可能使用 exact host allowlist，否则记录 domain policy；
- 只允许必要 scheme/port，通常只允许 HTTPS；
- 禁止 embedded credential、意外 Unicode/IDN form 或 ambiguous host syntax；
- 解析全部 IPv4/IPv6 answer，按部署 policy 拒绝 loopback、private、link-local、multicast、reserved、metadata 与 internal range；
- client/runtime 支持时 pin 或重查实际 connection target；
- 禁止 redirect，或对每一 hop 重新执行完整 policy；
- 限制 connect/read/total timeout、response byte、decompression 与 redirect count；
- response 始终不可信，redirect 跨 origin 时不得转发 credential。

DNS 可在 check 与 connect 之间变化。应用 allowlist 不是完整 DNS rebinding 防护；还需 egress/firewall/proxy 限制，使应用逻辑失效时 process 也无法访问禁止网络。

Webhook 既是 inbound authentication，也涉及 outbound retry。协议要求时对 raw body 验签，绑定 timestamp/id、拒绝 replay、轮换 secret，并在认证后授权 event/tenant。

## Localhost BFF 与 Sidecar

Loopback 可被其他本机进程连接，也可能被网页攻击。应用自有 sidecar 要求：

- 只 bind 明确 loopback address；失败时不得 fallback 到所有 interface；
- 使用 ephemeral port，通过 parent-controlled pipe/IPC 传 ready 状态和每次启动新生成的高熵 bearer capability；
- capability 不得出现在 command-line arg、URL、log、renderer-visible config 或普通 disk file；
- 每个 route 都校验它，安全比较，并验证 request schema；origin policy 必须精确且最窄；
- 浏览器可能发起请求时，mutation 使用 non-simple authenticated request，但不得把 preflight/CORS 当 authentication；
- parent/child ownership、duplicate instance、token rotation、graceful/forced shutdown 与 orphan cleanup 使用 `async-application-correctness` 设计。

诚实声明 OS-user 边界：能 debug process/read memory 的同用户 attacker 可能同时击穿 IPC 和 bearer capability。即使此 attacker 不在 scope，也不能削弱 browser/renderer isolation。

## Electron Renderer、Preload 与 Main

假设 renderer 可因 XSS 或 remote content 而被攻击者控制。

Baseline：

- remote/untrusted content 设置 `nodeIntegration: false`；
- `contextIsolation: true` 且启用 renderer sandbox；
- 保持 `webSecurity`，危险 insecure-content/experimental exception 必须审查；
- restrictive CSP；
- 显式 permission request/check handler；
- 使用当前受支持 Electron/Chromium。

Preload bridge 是 capability API，不是 transport dump。每项 operation 暴露一个方法，接收 immutable DTO 并返回窄 result。禁止暴露 `ipcRenderer`、任意 channel、generic `send`/`invoke`、raw filesystem/shell/process/network object 或 local-service token。

对于实质性 local BFF，推荐基线是 `renderer -> 窄 preload method -> 已校验/授权的 main IPC handler -> main 持有的 authenticated sidecar client`。loopback capability 由 main 持有。renderer 直连 sidecar 是受审例外，必须使用 least-privilege token，明确 compromised-renderer blast radius、origin policy 和 denial test；它不是默认推断 topology。

每个 main-process handler：

1. 对预期 frame/origin 验证 `event.senderFrame`/sender，处理 subframe 与 navigation。
2. 从 `unknown` parse payload；structured clone 与 TS type 不会验证输入。
3. 按需认证并授权 operation/caller。
4. 执行 operation-specific path、URL、device、permission 与 resource ownership policy。
5. 只返回最小 serializable DTO 与规范化 error；不得无必要泄露 secret/local path。

Context isolation 阻止直接对象共享，不会使过度强大的 preload method 安全。XSS 可以调用 renderer 获准的每个方法，所以 capability 必须细粒度；高风险动作按场景要求确认或 reauth。

## Custom Protocol、Navigation 与外部 URL

- Electron guidance 与框架支持时，packaged resource 优先 custom standard/secure scheme，而非 `file://`。
- 只注册真正需要的 privilege；不得为方便设置 `bypassCSP` 等宽能力。
- 只把已知 host/method 映射到固定 packaged-resource root，并执行完整 path containment；generic static-resource handler 不承载 business API。
- deny 或 allowlist navigation/window creation；所有 destination 都不可信。
- 不得把 untrusted value 直接交给 `shell.openExternal`。Allowlist 必要 HTTPS destination，或向用户显示 normalized destination 并显式确认；除非产品拥有窄 handler，否则拒绝 custom/dangerous scheme。
- Remote content 不得获得 Node integration、无限制 preload bridge、local BFF credential 或 privileged API。

## 必需测试

- Path corpus：empty/dot/dot-dot、mixed separator、absolute、Windows drive/UNC/device、case variant、encoded input、long path、symlink/junction，以及适用时 rename race。
- Upload/archive：伪造 MIME/extension、适用的 polyglot、oversize/count、malformed parser input、traversal entry、symlink、duplicate path 与 compression bomb。
- SSRF：IPv4/IPv6 textual variant、DNS answer、userinfo、IDN、禁止 port/scheme、redirect 到 private network、credential forwarding、timeout、oversize/decompression response。
- Local service：non-loopback bind denial、missing/wrong token、hostile origin、simple-form mutation、token redaction、parent crash、orphan 与 second instance。
- Electron：hostile sender/subframe/origin、setup 后 navigation、malformed payload、unauthorized path/URL、compromised renderer 调用每个 exposed method、external URL scheme 与 security preference snapshot。
- Sidecar topology：断言 renderer 不能读取 sidecar token 或发任意 local request；若 direct access 是批准例外，测试其 capability 无法调用声明子集之外的 route。

## 一手参考

- [Node.js Path API](https://nodejs.org/api/path.html)
- [OWASP File Upload](https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html)
- [OWASP SSRF Prevention](https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html)
- [Electron Security](https://www.electronjs.org/docs/latest/tutorial/security)
- [Electron Context Isolation](https://www.electronjs.org/docs/latest/tutorial/context-isolation)
- [Electron IPC](https://www.electronjs.org/docs/latest/tutorial/ipc)
- [Electron Protocol API](https://www.electronjs.org/docs/latest/api/protocol)
