---
name: typescript-security-boundaries
description: Use when designing, implementing, reviewing, or testing TypeScript/JavaScript security boundaries involving browser DOM rendering and XSS, CORS or CSRF, cookies, authentication, sessions, password handling, uploads, local files, paths, outbound URLs or SSRF, webhooks, localhost services, or Electron preload/main/IPC security.
---

# TypeScript Security Boundaries

## Objective

Make trust transitions explicit and put enforceable checks at the component that owns the capability. TypeScript types improve reviewability; they do not prove that HTML, a path, a URL, a principal, or an IPC caller is safe.

Read the applicable reference before changing code:

- [references/browser-http-auth.md](references/browser-http-auth.md) for DOM output, CORS, CSRF, cookies, sessions, tokens, passwords, and authorization.
- [references/node-electron-boundaries.md](references/node-electron-boundaries.md) for paths, files, uploads, outbound URLs, SSRF, localhost services, and Electron.
- [references/harness-and-review.md](references/harness-and-review.md) for machine gates, boundary records, test matrices, exceptions, and release review.

## Boundary Workflow

1. Inventory the asset or capability: account, privileged action, credential, DOM code sink, filesystem root, outbound network, shell, clipboard, camera, or native API.
2. List every untrusted producer and every transformation. Include URL/query/hash, database/CMS content, third-party responses, local storage, postMessage, IPC, files, redirects, DNS, and compromised renderer code.
3. Name the enforcement point that owns the capability. Enforce authorization in the backend or Electron main process, output context at the rendering sink, path containment at file open, and destination policy at every outbound connection.
4. Select the narrowest allowlist and failure behavior. Reject by default; do not silently broaden origins, paths, schemes, hosts, IPC methods, or sanitizer policy.
5. Install machine gates for syntax, configuration, and executable denial cases. Keep business trust relationships and deployment assumptions in a short human-reviewed boundary record.
6. Test bypasses and negative cases before the happy path. Include alternate encodings, redirects, IPv4/IPv6, symlinks when relevant, hostile origins, missing credentials, compromised renderer calls, and post-sanitization mutation.
7. Report precisely what was checked. Never conclude “secure” from typecheck, lint, schema validation, a scanner, or passing fixtures alone.

## Non-Negotiable Model

- Treat all external and persisted data as untrusted at each new interpreter or authority boundary. Prior validation for one predicate does not make a value universally trusted.
- Keep authentication, authorization, validation, encoding, sanitization, canonicalization, and concurrency as distinct controls.
- Parse and validate data shape at ingress, then enforce the sink-specific policy at use. Do not attempt to “sanitize all strings” globally.
- Prefer framework defaults and mature maintained security primitives. Do not invent escaping, password hashing, token signing, HTML sanitization, or URL canonicalization algorithms.
- Keep secrets, password hashes, session identifiers, refresh tokens, authorization headers, and raw credentials out of logs, URLs, analytics, errors, and client-visible payloads.
- Use least privilege across modules and processes. A renderer, browser client, plugin, worker, or sidecar is not trusted merely because the same team wrote it.

## Type-Level Security Claims

Treat names such as `SafeHtml`, `SafePath`, `ValidatedUrl`, `AuthenticatedUser`, and `AuthorizedCommand` as evidence of a reviewed construction route, not as proof.

- `unknown`, a schema, a type predicate, an assertion function, a brand, a wrapper class, or a private field proves only the predicate and construction discipline actually enforced at runtime.
- A schema that proves `string` or an allowlisted character set does not perform context-specific HTML/attribute/URL/JavaScript encoding.
- A `SafeHtml` brand cannot independently prove sanitizer correctness, policy freshness, absence of later mutation, or fitness for a different sink.
- IPC payload validation does not authenticate the sender or authorize the capability.
- URL parsing does not enforce an outbound destination policy. Path normalization does not authorize a filesystem object.
- Keep rare branded or asserted security values in a small trust-boundary module. Follow `strict-typescript-source-gates` for assertion inventory and `[SAFETY]:` exceptions.

## Browser And HTTP Rules

- Render ordinary values through React/Vue template interpolation or DOM text APIs. Treat raw HTML and code-capable sinks as audited escape hatches.
- If product requirements truly need HTML, use one centrally configured maintained sanitizer immediately before one narrow rendering adapter. Do not “verify” sanitized HTML with a hand-written type guard or regex.
- Apply encoding for the actual output context. HTML body, attribute, URL, CSS, and JavaScript contexts are not interchangeable. Prefer eliminating dynamic data from JavaScript/CSS/code contexts.
- Use CSP and Trusted Types as defense in depth and machine-enforced sink reduction, not substitutes for safe rendering.
- Treat CORS as a browser response-sharing policy, never authentication, authorization, or complete CSRF protection. Use exact origin allowlists; credentialed responses cannot use wildcard origins.
- Keep GET/HEAD safe. For cookie-authenticated mutations, define an intentional CSRF defense appropriate to the deployment; `SameSite` is useful defense in depth, not a universal proof.
- Default browser sessions to server-issued opaque credentials in `Secure`, `HttpOnly`, narrowly scoped cookies, normally `SameSite=Lax` or `Strict`. Prefer a `__Host-` cookie when compatible.
- Rotate session identifiers after authentication and privilege changes. Define idle/absolute expiry, logout/revocation, concurrent-session, recovery, reauthentication, and abuse-rate policies.
- Verify passwords only on registration, login, password change, or explicit reauthentication. Use a maintained Argon2id implementation and calibrated resource limits; keep slow verification off the ordinary request path and bound its concurrency.
- Authenticate first, authorize every operation against current server-side policy, and avoid trusting roles/tenant/resource ownership merely because a client token or typed context contains them.

## Node, File, URL, And Electron Rules

- Resolve file operations under a fixed trusted root and enforce path-segment-aware containment. Treat symlinks, TOCTOU, Windows drive/case rules, upload names, and download authorization as separate concerns.
- Generate server-side upload identifiers, verify allowed content as well as declared metadata, bound size/count/decompression, and store outside executable or public roots by default.
- For outbound requests, allow only required schemes, ports, and destinations. Revalidate every redirect and resolved address; bound time, redirects, and response size. Network egress controls remain necessary for meaningful SSRF defense.
- Bind localhost services only to loopback, use a fresh high-entropy capability delivered over an authenticated parent/child channel, require it on every request, validate Origin/Fetch Metadata where applicable, and assume another local process can connect.
- Treat an Electron renderer as compromised after XSS. Keep `nodeIntegration` off for remote/untrusted content, enable context isolation and sandboxing, keep `webSecurity` on, and restrict navigation, new windows, permissions, and external URL opening.
- Expose one narrow preload method per capability. Never expose raw `ipcRenderer`, generic send/invoke, filesystem, shell, process, or unrestricted HTTP primitives.
- In the main process, validate the sender frame/origin, payload schema, authorization, and capability-specific path/URL policy on every IPC operation.

## Harness Before Prose

Delegate objective controls to the repository harness:

- AST lint or Semgrep rules for unsafe DOM/code sinks, raw IPC exposure, dangerous Electron flags, and prohibited escape hatches;
- typecheck and schema/codegen drift checks;
- configuration tests for cookies, CORS, CSRF, CSP/Trusted Types, Electron preferences, and localhost binding;
- integration/property tests for hostile origins, traversal, uploads, SSRF redirects and addresses, IPC sender denial, session rotation/revocation, and XSS payloads;
- dependency lock, provenance/update policy, secret scanning, and relevant ecosystem audits.

Do not outsource these judgments to a scanner:

- which origins, paths, hosts, frames, principals, and capabilities are legitimately trusted;
- authorization semantics, authentication assurance, recovery/MFA, session lifetime, and reauthentication points;
- sanitizer policy, egress/network isolation, proxy behavior, filesystem ownership, symlink assumptions, and operational response;
- whether a reviewed exception still has a business need.

Use [references/harness-and-review.md](references/harness-and-review.md) to turn both categories into reviewable gates.

## Scope Routing

- Use `strict-typescript-source-gates` to implement ESLint/Oxlint/TypeScript/CI rules and inventory assertions or suppressions.
- Use `typescript-coding-preferences` for ordinary schema-first boundary structure and handler/usecase organization.
- Use `backend-data-correctness` for authorization-related database invariants and transactional state.
- Use `postgres-redis-cache-consistency` for session-cache revocation, Redis authority, tombstones, or revocation-delay claims.
- Use `async-application-correctness` for Electron/sidecar lifecycle, queues, shutdown, crash recovery, and multi-process coordination.
- Use `choosing-typescript-stack` when selecting an auth product or framework; this skill owns implementation and review constraints, not vendor selection.

## Review Exit Criteria

- Every privileged sink has an owning enforcement point and deny-by-default policy.
- Every external input is validated for shape and again for its eventual context/capability.
- Authentication and authorization are separate, server-side, and covered by denial tests.
- Browser, Node, and Electron escape hatches are mechanically inventoried with reviewed exceptions.
- Failure, timeout, redirect, revocation, and compromised-client behavior are explicit.
- The boundary record lists assumptions that tests cannot prove.
- The report states detected findings and residual assumptions without claiming a security proof.
