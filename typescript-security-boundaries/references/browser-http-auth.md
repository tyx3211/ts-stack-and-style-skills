# Browser, HTTP, And Authentication Boundaries

## Contents

- Rendering and XSS
- Rich content and trusted values
- CORS and CSRF
- Cookies and sessions
- Tokens and authorization
- Password paths
- Required tests
- Primary references

## Rendering And XSS

Classify every dynamic value by its eventual interpreter. A value can be harmless text in one sink and executable in another.

Prefer these sinks:

- React/Vue ordinary interpolation;
- `textContent`, `createTextNode`, and DOM property assignment for innocuous fixed-name properties;
- URL constructors plus an explicit scheme/destination policy;
- JSON responses with the correct `Content-Type`.

Inventory and deny or isolate:

- `innerHTML`, `outerHTML`, `insertAdjacentHTML`, `document.write`;
- React `dangerouslySetInnerHTML`, Vue `v-html`, or equivalent raw-template directives;
- `eval`, `Function`, string-form timers, inline event handlers, dynamic script construction;
- dynamic attribute names, CSS, `srcdoc`, script URLs, and navigation URLs;
- Markdown renderers or template engines configured to pass raw HTML.

Encoding is context-specific. Do not reuse HTML-body escaping for an attribute, URL, CSS, or JavaScript context. Prefer removing the dynamic value from code contexts entirely. Validate URL schemes and destination policy even when a framework escapes the attribute.

CSP, nonces/hashes, and Trusted Types reduce exploitability and make unsafe sinks more visible. Keep them in report-only mode while measuring violations, then enforce. They do not repair an unsafe sink or authorize a URL.

## Rich Content And Trusted Values

Use this order:

1. Represent supported content as a typed AST or component model and render nodes through ordinary framework APIs.
2. If raw rich HTML is an unavoidable compatibility boundary, parse and sanitize it with one maintained library and a minimal allowlist.
3. Render only through one adapter. Sanitize as close to that sink as practical; never mutate or concatenate the result afterward.

Treat the sanitizer configuration, library version, URL hook, and rendering adapter as one trusted kernel. Add known-bypass regression fixtures and update them with the sanitizer/browser ecosystem.

A brand can prevent accidental mixing inside a disciplined TS project:

```ts
declare const safeHtmlBrand: unique symbol;
export type SafeHtml = string & { readonly [safeHtmlBrand]: true };
```

It cannot demonstrate safety. Only the non-exported construction route may assert the brand, and that route must call the sanitizer. Do not write `isSafeHtml`/`assertSafeHtml` by regex or by checking that forbidden substrings are absent. HTML safety depends on parsing, configuration, sink context, browser behavior, and later mutation.

## CORS And CSRF

CORS tells a browser which origins may read a response and, for non-simple requests, whether it may send the actual request after preflight. It does not constrain curl, native clients, servers, or same-user malware, and a simple cross-site request can reach the server even when the response is unreadable.

CORS requirements:

- keep an exact normalized allowlist; never reflect arbitrary `Origin`;
- for credentialed requests, return one permitted origin and `Access-Control-Allow-Credentials: true`; never combine credentials with `*`;
- set `Vary: Origin` when a cache may serve origin-dependent responses;
- allow only required methods and headers; do not use wildcard subdomain regexes without a takeover review;
- test allowed/denied origins, preflight, simple requests, `null` origin policy, and cache behavior.

For cookie-authenticated mutations:

- keep GET/HEAD/OPTIONS free of business side effects;
- use the framework's maintained CSRF protection, synchronizer token, or a correctly bound signed double-submit pattern when the threat model needs it;
- validate `Origin` and fall back carefully to `Referer`; Fetch Metadata can reject obvious cross-site requests as another layer;
- require an expected content type and reject unexpected form/simple-request shapes;
- treat `SameSite=Lax` or `Strict` as defense in depth. `same-site` is not `same-origin`, sibling subdomains can matter, and `SameSite=None` requires a complete cross-site CSRF design.

OAuth/OIDC callbacks also require protocol state, PKCE where applicable, exact redirect URI checks, issuer/client binding, and replay handling. CORS and cookie flags do not supply these properties.

## Cookies And Sessions

For a browser session, default to an opaque CSPRNG identifier in a cookie with:

```text
Secure; HttpOnly; SameSite=Lax; Path=/
```

Prefer the `__Host-` prefix when no `Domain` is needed. Explicitly choose persistence, idle timeout, absolute timeout, and renewal. `HttpOnly` reduces offline token theft from JavaScript but cannot stop an XSS payload from issuing authenticated actions.

The server must:

- accept only identifiers it issued;
- store only a digest where a raw bearer value need not be recoverable;
- rotate identifiers on login and every privilege change;
- invalidate old credentials and define logout/revocation propagation;
- redact identifiers and authorization headers from logs and traces;
- define concurrent-session, device, recovery, step-up, and risky-action reauthentication policy.

Use `postgres-redis-cache-consistency` before promising immediate revocation through Redis. A typed `Session` value and a cache hit do not prove current authorization.

## Tokens And Authorization

Distinguish transport from format: cookies and `Authorization` are transports; opaque identifiers and JWTs are credential formats.

- Prefer an HttpOnly cookie/BFF or server session for first-party browser applications when JavaScript does not need the token.
- For native/Electron applications, use an appropriate system-browser OAuth/OIDC flow with PKCE and keep refresh credentials in the main process or OS-backed storage; do not expose them to the renderer.
- Keep access tokens short-lived and audience-specific. Validate fixed allowed algorithms, signature/key source, `iss`, `aud`, `exp`, `nbf` as used, token type/purpose, client/tenant binding, and scopes.
- Rotate refresh tokens, detect replay by token family or equivalent state, and store only a digest when possible. A fully stateless refresh design cannot promise immediate revocation or replay detection.
- Never put passwords, password hashes, unnecessary personal data, or reusable server secrets in JWT payloads. Signing is not encryption.

Authenticate the caller, then authorize the current action and resource on the authoritative side. A role/scope in an old token may be stale; define the accepted staleness or recheck current policy. Prevent confused-deputy behavior by binding tenant, resource, client, and requested operation explicitly.

## Password Paths

- Hash new passwords with a maintained Argon2id implementation and a unique library-managed salt. Treat published parameter values as a current baseline; calibrate and record them for the deployment.
- Use bcrypt only for compatible legacy migration when Argon2id/scrypt is unavailable, respecting input-length behavior. Rehash after successful login when parameters become obsolete.
- Verify passwords only on login, registration confirmation, password change, recovery, or explicit reauthentication—not on every authenticated request and never by carrying a password in a token.
- Use async/worker execution appropriate to the runtime, but also bound password-verification concurrency. Moving work off the event loop does not remove CPU/memory cost.
- Rate-limit by multiple signals, use generic failure responses, handle account enumeration, and design MFA/recovery separately. Do not log raw credentials.

## Required Tests

- DOM/server-render payload corpus for every raw sink and sanitizer policy; ensure post-sanitize transformations cannot reintroduce markup.
- CORS matrix for allowed, denied, credentialed, preflight, simple, and cached responses.
- CSRF denial for missing/invalid token, hostile Origin/Referer/Fetch Metadata, simple forms, and state-changing GET attempts.
- Cookie attribute and session lifecycle tests: fixation, rotation, old-ID rejection, idle/absolute expiry, logout, privilege change, and concurrent requests during rotation.
- JWT/token tests for algorithm confusion, wrong issuer/audience/type/client, expiry/not-before, key rotation, refresh replay, and redaction.
- Password verification concurrency/load tests that preserve resource headroom and keep ordinary traffic responsive.

## Primary References

- [OWASP Cross Site Scripting Prevention](https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html)
- [OWASP CSRF Prevention](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html)
- [MDN CORS](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/CORS)
- [OWASP Session Management](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html)
- [OWASP Password Storage](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html)
- [NIST SP 800-63B](https://pages.nist.gov/800-63-4/sp800-63b.html)
