---
name: async-application-correctness
description: Use when writing, reviewing, debugging, or designing TypeScript/JavaScript async applications involving command queues, mutexes, actors, cancellation, timeouts, backpressure, local SQLite, PostgreSQL, files or device side effects, React Ink or CLI entry points, Electron IPC, local BFFs or sidecars, workers, single-instance desktop apps, multiple processes, shutdown, crash recovery, or deterministic concurrency tests.
---

# Async Application Correctness

## Core Contract

Treat scheduling, transactionality, process ownership, and crash recovery as separate contracts.

- `async` creates possible logical interleaving; it does not imply that a command queue is required.
- A command queue orders work inside one owner. It is not a database transaction, cross-process lock, or durable job system.
- A mutex protects a critical section. A queue additionally defines admission order, backpressure, cancellation, and shutdown behavior.
- CAS/version checks reject stale work. They do not serialize unrelated work.
- SQLite and PostgreSQL protect only state they own. They cannot roll back a file write, device command, HTTP call, or message already sent.
- An in-memory queue disappears on crash. Persist work before acknowledging it when recovery is required.

Load [references/decision-and-test-matrix.md](references/decision-and-test-matrix.md) when choosing among a queue, mutex, CAS, SQLite, PostgreSQL, outbox, or durable job table, or when building concurrency and crash tests.

When PostgreSQL schemas, Drizzle/Kysely transactions, Redis, idempotency records, outbox tables, or migrations are in scope, also load `backend-data-correctness`.

## Start With The Execution Model

Before editing code, record:

1. The authoritative state and every external projection or side effect.
2. Every possible writer: handler, timer, retry, UI event, worker, CLI process, Electron window, sidecar, or another service instance.
3. The ownership boundary: JS turn, thread, process, host, or database.
4. The invariant and the smallest commit point that establishes it.
5. What success means: accepted, committed, applied, observed, or durably queued.
6. What cancellation, timeout, shutdown, and crash mean before and after that commit point.

Do not infer serial execution from one UI, one user, one renderer, or one JavaScript thread. Double submission, retries, timers, background sync, multiple windows, and continuations after `await` still create logical concurrency.

## Decide Whether To Queue

Do not add a queue merely because a function is `async`.

Use no application queue by default when all of these hold:

- One process and one JS thread own the state.
- The complete mutation is a short synchronous run-to-completion section.
- No `await`, callback reentry, worker, or second process can write during the section.
- The database transaction or atomic file replacement is the real commit boundary.

Use a command queue or actor when one owner must order multiple reentrant callers, bound pressure, centralize admission, or serialize a consistency domain. Queue only the commit portion when long I/O or CPU work can run outside it. Re-read state or check a version/CAS before committing results computed from an earlier snapshot.

Use a mutex when callers need mutual exclusion but FIFO admission, buffering, and a command lifecycle are unnecessary. Keep lock scope short and never assume a process-local mutex coordinates other processes.

Use per-resource queues only when resource keys are independent and stable. Prefer a single global queue first for a genuinely single consistency domain; split it only after proving safe commutativity and a real throughput need.

For a deliberately single-instance small GUI/TUI with one state owner and no durable recovery requirement, a process-local command queue is a strong low-complexity default when mutations can interleave across `await`. Enforce the single-instance promise, route every writer through that owner, and document that a crash loses queued work. This owner queue is different from UI debounce or disabling a button. Prefer SQLite instead when restart recovery, multiple processes, constraints, or durable history matter.

Do not classify by HTTP method alone. Classify operations by the state and invariant they affect. A POST may be safely concurrent through atomic SQL; a nominal query may still trigger unsafe lazy writes.

## SQLite And PostgreSQL Boundaries

For a local CLI, desktop app, or single sidecar with SQLite:

- Prefer one explicit database owner and short transactions.
- A synchronous SQLite transaction with no `await` already forms a process-local run-to-completion critical section; a pre-command queue is optional.
- With an async driver, require transaction connection ownership, ordered statements, exclusive use of `tx`, and no unrelated external waits inside the transaction.
- Use constraints and conditional updates even when writes are serialized.
- Use `BEGIN IMMEDIATE` intentionally when a transaction will write; define busy timeout/retry behavior.
- Use WAL for reader/writer coexistence when appropriate, but remember that SQLite still has one writer at a time.

For multiple processes sharing SQLite, one in-memory queue per process is insufficient. Prefer one of:

1. Enforce a single application instance.
2. Run one database-owning daemon/sidecar and make all clients use RPC.
3. Accept database-level lock contention and implement bounded `BUSY` retry, idempotency, and external-resource coordination.

Move to PostgreSQL when multiple service instances, high write concurrency, or complex concurrent transactions are part of the intended model. Do not recreate a global command queue in every service instance. Protect invariants with atomic SQL, constraints, row locks, optimistic versions, advisory transaction locks, Serializable retry, and idempotency. Use a local queue only for local backpressure or process-owned resources.

## Files, Devices, HTTP, And Other Side Effects

Never present a queue or a database transaction as atomicity across external systems.

- For files, use a unique temporary file, flush/fsync according to durability needs, atomic rename/replace, and startup cleanup or reconciliation.
- For SQLite/PG plus an external system, record desired state or an outbox/job in a short transaction, perform an idempotent apply, record observed/applied state, and reconcile after interruption.
- Use version/hash/fencing checks so stale work cannot overwrite newer desired state.
- Keep external HTTP, device I/O, user input, and long computation outside database transactions and mutex-held sections.
- Define whether an error after commit but before response is an uncertain outcome; provide an operation or idempotency key for safe retry.

For low-value, reproducible artifacts, deletion and recomputation may be the correct recovery policy. Reserve heavier state machines for user data, irreversible effects, and multi-system truth.

## Electron, Sidecar, Ink, And CLI

For Electron:

- Keep renderer as UI, preload as a narrow capability bridge, main as lifecycle/security control plane, and a sidecar or utility process as the owner of local business state when the application is nontrivial.
- Recommended substantial-BFF baseline: renderer calls one narrow preload method; preload invokes a validated main-process handler; main holds the authenticated loopback client/token and calls the sidecar. Do not give the renderer a generic network primitive or sidecar credential. A direct renderer-to-sidecar design is allowed only as a documented least-privilege exception with compromised-renderer tests.
- Use Electron IPC for narrow native control operations. Prefer a typed RPC/HTTP boundary for a substantial local BFF rather than growing an ad hoc IPC framework.
- Acquire `app.requestSingleInstanceLock()` before starting the state-owning sidecar or opening shared local state. Route the `second-instance` event to the existing owner.
- Treat the single-instance lock as an application-instance policy, not protection from external editors, other binaries, stale helper processes, or shared network storage.
- Give sidecar startup a ready handshake, timeout, authenticated local endpoint, parent/child ownership, and explicit graceful/forced shutdown behavior. Detect orphaned or duplicate owners.

For React Ink/TUI:

- Treat Ink as a UI renderer, not a serialization boundary.
- Expect rapid key events, duplicate submit, effect restart, retry, and cancellation to overlap.
- Disable duplicate UI actions for usability, but enforce correctness in the command/database layer.

For CLI:

- Assume separate CLI invocations are separate OS processes.
- A queue created inside one invocation cannot coordinate concurrent invocations.
- Use a single-owner daemon, SQLite/PostgreSQL coordination, an appropriate OS lock, or isolated outputs followed by atomic publication.
- Define SIGINT/SIGTERM behavior and whether interruption before or after commit is retryable.

Workers may parallelize pure CPU computation. Pass snapshots in and pure results out. Do not give workers database connections, file ownership, or device writers unless the architecture explicitly transfers ownership. Validate the snapshot version again at commit.

## Queue Contract

Before implementing or approving a queue, specify:

- **Scope:** global, per resource, per process, or durable across processes.
- **Ordering:** FIFO, priority, coalescing, latest-wins, or no guarantee.
- **Poisoning:** one failure must not silently block later work.
- **Cancellation:** distinguish cancelled while queued from cancellation after execution starts.
- **Timeout:** state whether caller timeout cancels work or leaves an uncertain outcome.
- **Backpressure:** set a capacity and reject, block, shed, or coalesce explicitly.
- **Fairness:** prevent priority or hot-key starvation where it matters.
- **Reentrancy:** forbid or handle enqueueing work onto the same serial queue from inside a running command.
- **Shutdown:** define stop-admission, drain deadline, abort, and forced-exit behavior.
- **Crash:** state whether queued/running work is lost, retried, or recovered from durable state.
- **Observability:** expose command id, resource key, queue time, run time, outcome, and retry count.

Do not write a bare Promise tail and call the contract complete. Ensure rejected work does not poison the tail, and do not swallow task errors returned to callers merely to keep the tail alive.

## Verification Workflow

1. Write the invariant and owner map.
2. Identify each yield, commit, external-effect, response, and shutdown boundary.
3. Choose the smallest mechanism that covers the actual boundary.
4. Add deterministic interleaving tests rather than relying on repeated timing races.
5. Add multi-process and crash-injection tests whenever correctness crosses a process or persistence boundary.
6. Verify behavior after timeout, cancellation, duplicate delivery, shutdown, and restart.

## Review Checklist

- Is `async` being incorrectly equated with requiring a queue?
- Does the chosen queue or mutex cover every writer in its claimed scope?
- Is an in-memory queue being mistaken for cross-process or durable coordination?
- Are SQLite and PostgreSQL responsibilities distinguished correctly?
- Are database invariants represented by constraints, conditional writes, locks, or versions?
- Does any database transaction or lock contain external or long-running I/O?
- Can stale computed work overwrite a newer version?
- Are success, timeout, cancellation, and uncertain outcome semantics explicit?
- Are Electron single-instance and sidecar lifecycle ordered correctly?
- Can concurrent CLI processes or multiple windows reach the same resource?
- Does the queue contract cover poisoning, cancellation, backpressure, fairness, reentrancy, shutdown, and crash?
- Do tests force specific interleavings and crash points?
