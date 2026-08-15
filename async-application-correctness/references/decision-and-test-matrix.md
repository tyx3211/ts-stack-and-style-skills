# Decision And Test Matrix

## Mechanism Matrix

| Situation | Primary mechanism | Queue role | Required tests |
|---|---|---|---|
| One JS thread, synchronous SQLite-only mutation | Short transaction, constraints, run-to-completion | Optional organization | Duplicate request, rollback, affected-row invariant |
| Async SQLite transaction, one process | Transaction-owned connection, `tx` only, short scope | Optional DB actor/backpressure | Forced interleaving, connection bleed, `BUSY` behavior |
| In-memory read/modify/write across `await` | Mutex/queue or versioned CAS | Serialize commit or reject stale work | Barrier between read and write, stale-version rejection |
| One sidecar serving several windows | One state owner; query/command separation | Global or per-key ordering where needed | Same-key order, different-key parallelism, retry |
| Several processes sharing SQLite | Single owner or SQLite locks with bounded retry | Per-process queue is not global | Spawned-process contention, kill, restart, final invariant |
| Several service instances using PostgreSQL | Atomic SQL, constraints, locks, retry, idempotency | Local backpressure only | Concurrent SQL, deadlock/serialization retry, duplicate delivery |
| Database plus file/device/HTTP | Outbox/job or desired/observed state machine | Order attempts only | Crash at every persistence/apply boundary, reconcile |
| Long-running or restartable work | Durable job table/queue and idempotent worker | Memory queue only as executor admission | Worker death, lease expiry, duplicate claim, resume |
| Concurrent CLI invocations | Daemon, DB/OS coordination, or isolated atomic publish | Invocation-local queue is ineffective | Spawn N processes, SIGINT, same-target publish |
| Single-instance Ink/Electron app, one process-owned consistency domain | Enforced single owner; add SQLite when durable recovery or constraints matter | Owner command queue can cheaply serialize mutations across `await`; UI debounce is usability only | Double submit, forced interleaving, owner bypass, crash-loss contract |
| Multi-process or restart-durable desktop state | SQLite/daemon ownership, constraints, idempotency, reconciliation | Process-local queue is only local admission | Multiple windows/processes, `BUSY`, kill/restart, retry after timeout |

## Queue Versus Other Mechanisms

- Choose a **queue** for ordered admission, capacity control, or one-owner command execution.
- Choose a **mutex** for a short critical section when buffered ordering is unnecessary.
- Choose **CAS/versioning** when speculative work may run concurrently but stale commits must fail.
- Choose **SQLite transactions** for atomic local database state; do not infer file/device atomicity.
- Choose **PostgreSQL concurrency control** for multi-instance database invariants.
- Choose an **outbox or committed job row** to bridge a database commit to later external delivery.
- Choose a **desired/observed state machine** when an external target must converge and report applied state.
- Choose a **durable workflow system** when execution spans long delays, human input, or many retrying services.

Combinations are normal. A sidecar may use a queue for local admission, SQLite for atomic metadata, versioned file replacement for publication, and startup reconciliation for crash recovery.

## Deterministic Interleaving Harness

Avoid tests that only run a race many times. Insert controllable barriers at semantic boundaries:

```ts
type Gate = {
  reached: Promise<void>;
  release: () => void;
  wait: () => Promise<void>;
};

// Command A pauses after reading version 4.
// Command B commits version 5.
// Release A and require its CAS/version check to reject the stale commit.
```

Inject gates after read, after validation, before lock, before commit, after commit, before external apply, after apply, and before response. Assert the invariant and user-visible outcome for each schedule.

## Queue Contract Tests

Test at least:

1. Task A rejects; task B still runs; A's caller still receives A's error.
2. A queued task is cancelled without running.
3. A running task receives cancellation, ignores it, or reaches commit according to the declared policy.
4. Caller timeout does not silently imply execution cancellation.
5. Capacity overflow follows the documented reject/block/coalesce policy.
6. Priority and hot keys do not starve normal work beyond the declared bound.
7. Same-queue recursive enqueue is rejected or handled without deadlock.
8. Shutdown stops admission, drains until a deadline, and reports abandoned work.
9. Process crash demonstrates whether memory work is lost or recovered from durable records.

## SQLite And Multi-Process Harness

- Create a temporary database and schema with hard invariants.
- Spawn independent child processes, not worker tasks in one process.
- Make them contend with `BEGIN IMMEDIATE`, conditional updates, and deliberate pauses.
- Test both successful bounded retry and exhausted `SQLITE_BUSY` behavior.
- Kill a writer before commit and confirm rollback; kill after commit and before response and confirm idempotent retry.
- If files are also written, kill before/after fsync and rename and run startup reconciliation.

## PostgreSQL Harness

Use an isolated real PostgreSQL instance. Force:

- Lost-update candidates resolved by atomic SQL or version checks.
- Row-lock blocking and lock timeout.
- Serializable `40001` and deadlock `40P01`, with whole-transaction retry.
- Duplicate operation keys before and after commit.
- Outbox claiming by multiple workers without duplicate durable effect.

## Electron, Sidecar, CLI, And Ink Harness

- Launch two Electron instances concurrently; assert only the winner starts the state owner and the loser routes intent through `second-instance`.
- Delay or fail the sidecar ready handshake; verify timeout, cleanup, and no orphan owner.
- Crash main and sidecar independently; verify ownership and restart policy.
- Issue writes from multiple BrowserWindows and verify the claimed queue/database scope.
- Spawn several CLI processes against the same resource; never substitute concurrent functions in one process for this test.
- Send rapid duplicate Ink input, retry after timeout, and SIGINT during queued and committed phases.
- Treat UI button disabling and debounce as supplementary usability behavior, not the passing correctness condition.

## Crash Matrix

For a database plus external target, inject termination at:

1. Before desired/outbox commit.
2. After desired/outbox commit, before apply.
3. During temporary write or external request.
4. After atomic publish/apply, before observed-state update.
5. After observed-state update, before response.

After restart, assert whether the operation is absent, pending, safely retried, recognized as applied, or explicitly requires intervention. Never accept an untraceable half-state.
