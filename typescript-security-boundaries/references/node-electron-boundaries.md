# Node And Electron Security Boundaries

## Contents

- Path and file access
- Upload and archive handling
- Outbound URLs and SSRF
- Localhost BFF and sidecars
- Electron renderer/preload/main
- Custom protocols and navigation
- Required tests
- Primary references

## Path And File Access

Do not treat `path.join`, `path.resolve`, a `SafePath` brand, or schema parsing as authorization. Start from a fixed trusted root and validate a relative user selection before opening the file.

Minimum containment model:

1. Reject absolute, drive-qualified, device, NUL-containing, or otherwise unsupported input before resolution.
2. Resolve from the trusted root.
3. Compute `path.relative(root, candidate)` and reject an absolute result, `..`, or a result beginning with `..` plus a separator. Compare using the platform's path semantics; test Windows drives, UNC/device paths, case behavior, and alternate separators when supported.
4. Open with the least privilege and authorize the specific read/write/delete operation for the current principal.
5. When an attacker can create filesystem entries, account for symlinks, junctions, hard links, mount changes, and time-of-check/time-of-use. Prefer OS isolation, safe directory ownership, descriptor-relative/native primitives where available, or a design that never follows attacker-controlled links.

Use generated identifiers instead of user filenames for storage. Preserve the display name only as metadata. Never concatenate a path into a shell command.

## Upload And Archive Handling

- Allowlist the business-required extensions and verify actual content/signature with maintained parsers; never trust `Content-Type` or filename alone.
- Bound bytes, file count, dimensions, parse time, recursion, and decompressed size. Reject archive traversal, symlinks, absolute entries, duplicate/conflicting paths, and decompression bombs.
- Store outside the webroot and executable/plugin roots by default. Serve through an authorized mapping with a safe `Content-Type`, `Content-Disposition`, and download name.
- Scan or transform risky formats when the product threat model requires it. Parsing/AV failures must have an explicit quarantine or rejection path.
- Authorize upload, association, processing, download, replacement, and deletion independently.

## Outbound URLs And SSRF

Use the platform URL parser, then enforce a destination policy:

- exact host allowlist where possible; otherwise a documented domain policy;
- only required schemes and ports; normally HTTPS;
- no embedded credentials, unexpected Unicode/IDN form, or ambiguous host syntax;
- resolve all IPv4/IPv6 answers and deny loopback, private, link-local, multicast, reserved, metadata, and internal ranges according to deployment policy;
- pin or recheck the actual connection target when the client/runtime permits it;
- disable redirects or re-run the complete policy on every hop;
- bound connect/read/total time, response bytes, decompression, and redirect count;
- keep response data untrusted and prevent credentials from crossing origins on redirects.

DNS can change between checks and connections. Application allowlists are not a complete DNS-rebinding defense. Apply network egress/firewall/proxy restrictions so the process cannot reach forbidden networks even when application logic fails.

Webhooks are inbound authentication problems as well as outbound retry problems. Verify signatures against the raw body where the protocol requires it, bind timestamp/identifier, reject replay, rotate secrets, and authorize the event/tenant after authentication.

## Localhost BFF And Sidecars

Loopback is reachable by other local processes and can be targeted from browser pages. For an application-owned sidecar:

- bind only to explicit loopback addresses; do not silently fall back to all interfaces;
- choose an ephemeral port and pass readiness plus a fresh high-entropy bearer capability over a parent-controlled pipe/IPC channel;
- do not put the capability in command-line arguments, URLs, logs, renderer-visible config, or ordinary disk files;
- require it for every route, compare safely, validate request schema, and keep a narrow exact origin policy;
- require non-simple authenticated mutations where browser requests are possible, but do not rely on preflight/CORS as authentication;
- define parent/child ownership, duplicate-instance behavior, token rotation, graceful/forced shutdown, and orphan cleanup with `async-application-correctness`.

State the OS-user boundary honestly. A same-user attacker able to debug processes or read memory may defeat both IPC and bearer-capability designs. Do not weaken browser/renderer isolation merely because that stronger attacker is out of scope.

## Electron Renderer, Preload, And Main

Assume the renderer can become attacker-controlled through XSS or remote content.

Baseline:

- `nodeIntegration: false` for remote/untrusted content;
- `contextIsolation: true` and renderer sandboxing enabled;
- `webSecurity` enabled and no insecure-content or experimental-feature exceptions without a security review;
- a restrictive CSP;
- explicit permission request/check handlers;
- current supported Electron/Chromium.

The preload bridge is a capability API, not a transport dump. Expose one method per operation with immutable DTOs and narrow results. Never expose `ipcRenderer`, arbitrary channel names, generic `send`/`invoke`, raw filesystem/shell/process/network objects, or a local-service token.

For a substantial local BFF, the recommended baseline is `renderer -> narrow preload method -> validated/authorized main IPC handler -> main-owned authenticated sidecar client`. The main process holds the loopback capability. Direct renderer-to-sidecar access is a reviewed exception requiring a least-privilege token, explicit compromised-renderer blast radius, origin policy, and denial tests; it is not the default inferred topology.

At every main-process handler:

1. Validate `event.senderFrame`/sender against the expected frame and origin. Account for subframes and navigation.
2. Parse the payload from `unknown`; structured clone and TypeScript types do not validate it.
3. Authenticate and authorize the operation/caller when relevant.
4. Apply operation-specific path, URL, device, permission, and resource ownership policy.
5. Return a minimal serializable DTO and normalized error; do not leak secrets or local paths unnecessarily.

Context isolation prevents direct object sharing; it does not make an overpowered preload method safe. XSS can call every method the renderer is allowed to call, so keep capabilities fine-grained and require confirmation/reauthentication for high-risk actions where appropriate.

## Custom Protocols, Navigation, And External URLs

- Prefer a custom standard/secure scheme over `file://` for packaged resources when Electron guidance and the framework support it.
- Register only the privileges actually required. Do not set `bypassCSP` or other broad privileges by convenience.
- Map only known hosts/methods to a fixed packaged-resource root using the full path-containment policy. Keep business APIs out of a generic static-resource protocol handler.
- Deny or allowlist navigation and window creation. Treat all navigation destinations as untrusted.
- Never pass an untrusted value directly to `shell.openExternal`. Allowlist required HTTPS destinations or present the normalized destination for explicit confirmation; reject dangerous/custom schemes unless the product owns a narrow handler.
- Loading remote content must not grant Node integration, an unrestricted preload bridge, local BFF credentials, or privileged APIs.

## Required Tests

- Path corpus: empty/dot/dot-dot, mixed separators, absolute paths, Windows drives/UNC/device forms, case variants, encoded input, long paths, symlinks/junctions, and rename races where relevant.
- Upload/archive corpus: spoofed MIME/extensions, polyglots as applicable, oversize/count, malformed parser inputs, traversal entries, symlinks, duplicate paths, and compression bombs.
- SSRF corpus: IPv4/IPv6 textual variants, DNS answers, userinfo, IDN, forbidden ports/schemes, redirects to private networks, credential forwarding, timeout, and oversized/decompression responses.
- Local service: non-loopback binding denial, missing/wrong token, hostile origin, simple-form mutation, token redaction, parent crash, orphan, and second instance.
- Electron: hostile sender/subframe/origin, navigation after setup, malformed payload, unauthorized path/URL, compromised renderer invoking every exposed method, external URL schemes, and security preference snapshots.
- Sidecar topology: assert the renderer cannot read the sidecar token or issue arbitrary local requests; if direct access is an approved exception, test that its capability cannot invoke routes outside the declared subset.

## Primary References

- [Node.js Path API](https://nodejs.org/api/path.html)
- [OWASP File Upload](https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html)
- [OWASP SSRF Prevention](https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html)
- [Electron Security](https://www.electronjs.org/docs/latest/tutorial/security)
- [Electron Context Isolation](https://www.electronjs.org/docs/latest/tutorial/context-isolation)
- [Electron IPC](https://www.electronjs.org/docs/latest/tutorial/ipc)
- [Electron Protocol API](https://www.electronjs.org/docs/latest/api/protocol)
