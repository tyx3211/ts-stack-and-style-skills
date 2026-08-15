# Error Handling

Use this policy to keep expected failure, unexpected defects, transport mapping, and asynchronous termination distinct.

## Choose The Failure Channel

| Condition | Default channel |
|---|---|
| Caller must branch, retry, compensate, or reject a valid business request | `Result<T, E>` with a closed feature-specific union |
| Value is simply absent | `T | null | undefined` |
| Absence has multiple business meanings | Tagged union |
| Programmer mistake, impossible state, corrupt trusted state, invalid startup configuration | `throw Error` |
| Framework requires an exception for rollback or termination | Throw internally, translate at the owning boundary |

Do not Rust-encode every helper. Pure transformations should return values directly. Use Result heavily in domain rules, usecases, and adapters only where the caller can act on the error.

## Model Typed Errors Locally

- Define a closed error union per feature or usecase, not one repository-wide `AppError`.
- Give each variant a stable tag and only the context needed to decide or diagnose it.
- Keep platform classification such as `code`, `kind`, `retryable`, `safeMessage`, `source`, and `traceId` separate from feature variants when multiple transports need it.
- Map unions exhaustively. Prefer a typed `switch` plus `assertNever`; enable the repository's exhaustive-switch lint gate.
- Never expose raw database messages, SDK objects, stack traces, or `cause` in public responses.

## Validate At Trust Boundaries

- Parse request and public contract input as `unknown`. A schema failure is an expected validation result and normally maps to a stable 4xx contract error.
- Validate external HTTP, SDK, queue, and cache payloads. A decode failure is a protocol/infrastructure error, not invalid user input.
- Treat a schema failure in trusted persisted/domain state as corruption or a broken invariant. Quarantine or stop the affected operation, record diagnostics, and do not silently substitute defaults.
- Treat invalid startup configuration as startup failure. Do not start in a partially configured state.
- Use throwing schema APIs only when failure is intentionally owned by the surrounding exception boundary; otherwise prefer a safe/result parse.

## Translate External Failures Once

At DB, HTTP, SDK, filesystem, queue, and cache adapters:

1. Catch `unknown` only when the adapter can add meaning, retry, clean up, or translate.
2. Narrow or normalize the caught value; JavaScript may throw non-`Error` values.
3. Return a typed infrastructure variant when an upper layer must retry, degrade, compensate, or choose a response.
4. Otherwise throw a normalized `Error` with `cause` and let the terminating operation boundary own it.

Do not catch and rethrow unchanged. Do not log the same failure in every layer. Add context as it crosses a semantic boundary, and log once where the request, job, task, or process terminates.

## Own Promise Rejections

- Every Promise must be awaited, returned, explicitly caught, or registered with a task supervisor.
- `void task()` only discards the value; it does not handle rejection. Use `void task().catch(reportFailure)` only when detached execution is intentional and the handler establishes the final failure state.
- Do not pass an unguarded async callback to APIs that ignore returned Promises, including DOM/EventEmitter-style callbacks and `forEach`. Wrap it and handle rejection inside the callback.
- A catch handler must intentionally recover, translate, or rethrow. Returning a normal value converts the chain back to fulfilled state; empty catches silently erase failure.
- Use `Promise.all` for fail-fast grouped work and `Promise.allSettled` only when partial failure is explicitly modeled and inspected.
- Global `unhandledRejection`, `uncaughtException`, browser `error`, and `unhandledrejection` hooks are observability/fatal-policy hooks, not business recovery mechanisms.

## Terminating Boundaries

- HTTP/RPC boundary: exhaustively map expected variants; return a generic 500 for unknown defects; attach request/trace identifiers; do not use the global handler as normal business control flow.
- Worker/job boundary: record final attempt, retryability, job identity, and trace; acknowledge, retry, dead-letter, or fail according to an explicit policy.
- Browser boundary: report the defect and move corrupted interaction or shared state to an error boundary/fatal state instead of pretending recovery succeeded.
- Process boundary: after an uncaught defect, perform only bounded necessary cleanup and exit when process state may be unreliable; let the supervisor restart it.

Log expected business rejection at an appropriate lower severity or as a metric. Log unexpected defects once with structured context and the internal cause.

## Library Escalation Thresholds

- Start with native discriminated unions and a minimal Result type.
- Adopt neverthrow only when repeated async Result composition and early-return boilerplate materially hurts readability; do not mix several Result representations in one feature.
- Adopt Effect only as a deliberate module island for typed retry/timeout/cancellation, structured concurrency, resource lifetime, or complex external orchestration. Keep expected failures in its typed error channel and defects as defects; fold both at one Promise/transport boundary.
- Do not introduce Effect merely to eliminate `throw`, and do not let an Effect island spread without an explicit architecture decision.

## Transactions And Cleanup

- It is valid to throw inside a transaction when the ORM requires it to roll back. Catch outside the transaction and translate according to the operation's public error contract.
- Keep the original failure as primary. A rollback, close, release, or compensation failure must be attached/logged as secondary context, not silently replace the original cause.
- Destroy or quarantine resources whose cleanup failed and whose state is no longer trustworthy.
- Never continue after partial writes unless the transaction or compensation contract proves the resulting state is valid.

## Review And Test Gates

- Review each operation for expected, infrastructure, invariant, and fatal failures.
- Reject mixed business `throw` and Result handling, catch-all defaults that hide new variants, empty catches, floating Promises, repeated logs, internal-message leakage, and silent fallback.
- Test every error variant to transport/job outcome mapping, schema-invalid inputs, adapter rejection normalization, retry/cancellation paths, cleanup failure, and fatal-boundary behavior.
- Put executable lint policy in `strict-typescript-source-gates`; keep semantic error ownership here.
