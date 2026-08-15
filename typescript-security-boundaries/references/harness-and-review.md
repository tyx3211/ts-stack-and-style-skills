# Security Harness And Human Review

## Contents

- Boundary record
- Machine gate matrix
- Exception protocol
- Verification workflow
- Release review
- Reporting language

## Boundary Record

Require a small versioned record for every privileged boundary. Keep it beside the owning code or in the repository's established security documentation.

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

The names may follow repository conventions, but every field needs an answer. A type alias or inline comment alone is not the record.

## Machine Gate Matrix

| Boundary | Mandatory automated evidence | Human-owned decision |
|---|---|---|
| DOM/XSS | AST inventory/ban for raw sinks and code evaluation; sanitizer adapter tests; CSP/Trusted Types config tests; payload E2E | Whether HTML is needed; sanitizer allowlist; third-party widget trust |
| CORS/CSRF | exact-origin/preflight/simple-request matrix; cookie attributes; mutation CSRF denial | legitimate origins; same-site subdomain trust; cross-site product flows |
| Sessions/tokens | rotation, fixation, expiry, replay, logout, claim/key tests; log redaction | assurance level, lifetime, recovery/MFA, revocation guarantee |
| Passwords | approved library/config assertion; concurrency/load and abuse tests | calibrated cost and capacity; recovery/account-enumeration response |
| Paths/uploads | property/corpus tests; upload/archive limits; authorization denial | roots, ownership, symlink/volume assumptions, risky-format policy |
| SSRF | URL/IP/redirect corpus; timeout/size limits; network-policy integration check | allowed destinations, DNS/proxy/egress architecture |
| Electron/IPC | config snapshot; raw-IPC/flag AST bans; sender/payload/capability denial tests | which frames and renderer capabilities are legitimate |
| Local sidecar | bind/token/origin tests; redaction; lifecycle integration tests | OS-user threat boundary and capability scope |

Prefer a small repository-local lint/Semgrep rule when a risky syntax has a clear AST shape. Do not rely on broad text grep as the only gate. Route TypeScript/ESLint/Oxlint implementation to `strict-typescript-source-gates`.

Scanners and dependency audits are finding sources. Triage reachability, runtime exposure, exploit preconditions, and compensating controls. Never dismiss a finding only because types compile, and never call a dependency safe only because the current audit is clean.

## Exception Protocol

For every raw sink, dangerous Electron preference, assertion-created security brand, broad origin/path/URL capability, or suppressed scanner rule:

- use the narrowest line/config scope;
- add `[SAFETY]:` with the protected invariant, runtime enforcement point, and why a safer API cannot meet the requirement;
- identify the stable symbol/module that owns construction and consumption; avoid fragile line-number cross-references;
- link a negative test and boundary record;
- name an owner and review trigger, such as sanitizer/Electron/auth-library upgrade or each release;
- fail CI on unregistered exceptions and stale/missing tests.

An exception registry is an inventory and accountability mechanism, not proof that the code is safe.

## Verification Workflow

1. Run repository typecheck, lint, security AST/Semgrep rules, tests, and build through the shared `verify` command.
2. Run boundary-specific negative tests in the real framework/runtime. DOM parsers, browser CORS/cookies, OS paths, DNS, and Electron IPC are not faithfully modeled by pure unit mocks.
3. Use property-based or table-driven corpora for paths, URLs, origins, claims, and encodings.
4. Test both rejection and observability: stable client error, secret-safe logs, alert/metric where abuse matters, and no partial privileged effect.
5. Confirm deployment controls—TLS/proxy headers, egress, filesystem ownership, Electron fuses/signing/update channel, secret delivery—match the boundary record.
6. Review dependency/security advisories for the exact resolved versions and regenerate lockfiles/artifacts through normal package-manager commands.

Do not add a fake universal `security:check` that merely greps for terms. A shared command is useful only when it invokes the project's actual framework-aware gates and fails reliably.

## Release Review

At every release, or at the boundary record's stricter trigger:

- diff raw sinks, assertions/brands, lint suppressions, CSP/Trusted Types, CORS origins, cookie/session settings, Electron preferences/bridge methods, upload types, filesystem roots, URL destinations, and external-open policy;
- re-run bypass corpora after sanitizer, browser, framework, auth, URL client, archive parser, Node, or Electron upgrades;
- check secret/token redaction and telemetry access;
- verify session/token key rotation and rollback procedure;
- review open security exceptions and remove obsolete capability;
- state any change in the threat model or residual risk.

## Reporting Language

Use bounded claims:

- “The AST gate detected no unregistered raw HTML sinks in `src/`.”
- “The integration matrix rejected the listed hostile origins and redirect fixtures.”
- “The design assumes the OS account and packaged application resources are trusted.”
- “Immediate session revocation is not guaranteed; the documented bound is five minutes.”

Do not write:

- “Zod/TypeScript proves this input is safe.”
- “CORS prevents unauthorized requests.”
- “SameSite eliminates CSRF.”
- “Sanitized once means trusted everywhere.”
- “`path.resolve` prevents traversal.”
- “URL parsing/hostname allowlisting prevents SSRF.”
- “Context isolation makes IPC safe.”
- “The scanner/typecheck proves the application is secure.”
