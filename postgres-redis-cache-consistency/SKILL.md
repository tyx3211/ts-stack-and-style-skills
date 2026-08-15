---
name: postgres-redis-cache-consistency
description: Use when designing, implementing, reviewing, or testing PostgreSQL-backed Redis caches, cache-aside invalidation, read-your-write behavior, versioned projections, stale or negative cache handling, outbox/CDC projection delivery, session revocation caches, Redis leases, CAS, fencing tokens, or deterministic cache race harnesses in TypeScript backends.
---

# PostgreSQL–Redis Cache Consistency

## Objective

Keep PostgreSQL authoritative and state exactly what each Redis projection guarantees. Never imply that a DB transaction plus a Redis command is a cross-system atomic transaction.

Read [references/protocol-and-testing.md](references/protocol-and-testing.md) when implementing Lua/Functions, outbox consumers, tombstones, fencing, or deterministic concurrency tests.

## Workflow

1. Identify the authoritative state, aggregate, and every table contributing to the cached DTO.
2. Classify the read contract as `none`, `weak`, `read-your-write`, or `versioned`.
3. Register stale budget, decision policy, miss source, failure behavior, version source, and write protocol.
4. Model DB commit, Redis timeout, process crash, eviction, replica lag, duplicate delivery, and reordered delivery.
5. Keep commands and business invariants in PostgreSQL. Treat Redis as a rebuildable projection unless explicitly designed as an authoritative subsystem.
6. Add deterministic integration tests for the selected contract. Do not approve the protocol from happy-path unit tests alone.

## Consistency Registry

Require every cache adapter to expose a reviewable registry entry:

```ts
type CacheConsistency = "none" | "weak" | "read-your-write" | "versioned";

type CachePolicy = {
  owner: string;
  aggregate: string;
  consistency: CacheConsistency;
  staleBudgetMs: number | null;
  maxTtlJitterMs: number;
  maxInFlightFillMs: number;
  maxReplicaLagMs: number;
  mayDriveBusinessDecisions: false;
  missSource: "primary" | "replica-allowed";
  redisFailure: "bypass-to-primary" | "serve-bounded-stale" | "fail-closed";
  writeProtocol: "none" | "delete-after-commit" | "version-floor" | "outbox";
  ttlSec: number;
  sourceVersion?: "aggregate-version" | "none";
};
```

Do not allow a cache to drive money, inventory, entitlement consumption, immediate permission revocation, payment, order transitions, or legal/medical workflow decisions. Recheck those in PostgreSQL with constraints, conditional SQL, locks, or transactions.

## Contract Selection

### `none`

Use PostgreSQL directly for strong reads, inexpensive queries, and correctness-critical decisions.

### `weak`

Use ordinary cache-aside only when a complete historical DTO may be stale for the declared budget:

```text
read: Redis hit -> return; miss/error -> authoritative read -> best-effort fill
write: PostgreSQL commit -> best-effort DEL
```

Its contract is bounded stale data, not latest data, only when the bound is actually established. Require and test `ttlSec * 1000 + maxTtlJitterMs + maxInFlightFillMs + maxReplicaLagMs <= staleBudgetMs`; `ttlSec` is the base TTL and `maxTtlJitterMs` is the greatest positive jitter the writer can add. Use zero for a component that is absent. Alternatively record `ttlSec` as the maximum effective TTL including jitter and keep `maxTtlJitterMs` zero, but state that convention explicitly. If any component has no defensible bound, set `staleBudgetMs: null` and describe the cache as best-effort stale rather than bounded stale. Do not assemble a correctness-sensitive view from independently cached fragments.

### `read-your-write`

Return the committed DTO and version from the mutation. Then use one or more of:

- update the caller's local state from the mutation result;
- pass `minVersion` on following reads;
- bypass cache briefly for that caller;
- read PostgreSQL directly.

A Redis value below `minVersion` is a miss. Read from the primary when replica lag could violate the requested minimum.

### `versioned`

Use only when reads are hot, rebuilding is expensive, the DTO must be internally coherent, stale data is tolerable, but projection rollback is not.

The guarantee without a PostgreSQL version check is only:

- the value represents one committed aggregate version;
- older fills cannot overwrite newer fills;
- readers can observe the source version;
- the projection is internally coherent.

It does **not** guarantee the latest PostgreSQL version. For a latest-version read, query the primary for the current aggregate version and accept Redis only when it satisfies that version; otherwise rebuild or read PostgreSQL.

## Aggregate And Snapshot Versioning

Use a monotonic `bigint` aggregate version. Increment it in the same transaction as every change that can affect the projection. Do not use timestamps as an implicit version.

Build a projection with one SQL statement or a database snapshot whose isolation makes all contributing rows coherent. A version label does not repair a fractured multi-query read.

Keep these concepts explicit:

- optimistic `expectedVersion`: prevents lost updates;
- projection `sourceVersion`: identifies the snapshot cached;
- `minVersion`: a reader's freshness floor;
- `floorVersion`: Redis-side lower bound that rejects obsolete fills.

They may share one aggregate counter, but they serve different protocol roles.

## Version Floor And Equal-Version Rule

Prefer state with an explicit floor:

```ts
type VersionedState<T> = {
  floorVersion: bigint;
  data?: { version: bigint; digest: string; value: T };
};
```

Apply one atomic Lua/Redis Function rule:

```text
markFloor(v): floorVersion = max(floorVersion, v)
               discard data when data.version < floorVersion

put(v, digest, value):
  reject when v < floorVersion or v < data.version
  when v == data.version, accept only the same digest as an idempotent replay
  otherwise store the complete value and preserve max(floorVersion, v)
```

An explicitly verified floor→clean transition at the same version is allowed. Equal-version, different-digest data is a protocol violation: reject and alert. A plain `incoming.version >= current.version` rule is too permissive.

Never replace a version floor with `DEL` in a versioned protocol. Deletion makes the key empty and permits an old in-flight miss to refill obsolete data:

```text
R1: miss -> read PostgreSQL v42 -> pause
W1: commit v43 -> DEL
R1: key is empty -> fill v42
```

Retain the floor for at least the maximum in-flight read/fill duration and the protocol's invalidation-recovery window. Eviction or expiry destroys the Redis-side fence. After that, treat the entry as an untrusted miss: a strict or `minVersion` read must consult the primary before accepting or rebuilding data. If this fallback is absent, document that the protocol has degraded to weak consistency.

For negative caches and deletes, cache a versioned `missing`/tombstone state. Treat deletion and revocation as state transitions, not absence of history.

## Commit And Failure Semantics

Never call Redis inside a PostgreSQL transaction. Redis cannot roll back with PostgreSQL.

After commit:

- weak cache: best-effort delete; error/timeout does not roll back business state;
- versioned cache: best-effort `markFloor` or `put`; do not fall back to plain delete;
- required eventual invalidation: write an outbox row in the business transaction;
- strong/latest read: consult PostgreSQL regardless of invalidation status.

Treat Redis network errors as `unknown`, not proof that a command did not execute. Make retries idempotent. Emit metrics for bypasses, stale hits, floor rejections, digest conflicts, outbox lag, retries, and dead letters.

An in-memory after-commit callback can be lost after DB commit. It is acceptable only when TTL-bounded staleness is acceptable. Use a PostgreSQL outbox when delivery must survive process failure.

## Outbox And Projection Consumers

Write `{eventId, aggregateId, version, type}` in the same transaction as the aggregate change. Enforce unique `eventId` and idempotent consumption.

Choose one event model:

- **State notification:** coalesce by aggregate high-water mark, reload authoritative current state, and publish with the version-floor rule. Duplicate or reordered `42,44,43` deliveries converge to at least 44.
- **Delta event:** preserve per-aggregate ordering, detect version gaps, and replay missing deltas. Never skip directly to the maximum version unless the event contains a complete state.

Redis remains an eventually consistent projection. Reconcile from PostgreSQL desired/current versions and monitor lag. `NOTIFY` may wake a worker but is not the durable queue or source of truth.

## Sessions And Revocation Honesty

Do not claim immediate revocation from a PG-backed cache-aside session check merely because values use versions. A cached valid entry can be accepted between DB commit and Redis floor/tombstone publication; eviction can also remove the Redis fence.

Choose and document one honest contract:

- bounded revocation delay;
- primary lookup for authoritative checks;
- or Redis as an explicitly authoritative, fail-closed session store with durability, HA, memory, and no-eviction policy.

Model logout as a version advance to `revoked`. Keep tombstones through the remaining credential lifetime plus the maximum in-flight fill window. Never reuse `sid`/`jti`; use at least 128 bits of CSPRNG entropy for a random credential identifier. A 64-bit integer is suitable for a monotonic version, not a security token.

## Locks And Fencing

Keep ownership and fencing separate:

- a random lock token supports compare-token-then-delete only;
- a fencing token is monotonic and must be checked by the durable resource receiving the write.

Lease expiry does not stop a paused holder from resuming. If the sink does not reject an older fence, the lock does not protect correctness. Do not assume Redis `INCR` is a durable cross-resource fence without an explicit failover and persistence analysis. Prefer PostgreSQL conditional updates, row locks, or transaction-level advisory locks for PostgreSQL-owned state.

Call a Redis lease used only to reduce duplicate fills a `cache-fill mutex`. Recheck the cache after acquiring it, bound its wait, and keep a fallback path. It is load shedding, not a business correctness lock.

## Required Gates

- Prevent route/usecase modules and PostgreSQL transaction callbacks from importing the raw Redis client.
- Require the registry entry and stale budget in review for every new cache.
- Require primary reads for `minVersion`, authoritative revocation, and strict projection reconstruction.
- Require tests for miss-fill-after-delete, reordered writers, Redis timeout/unknown, process death after commit, replica lag, duplicate/reordered outbox delivery, equal-version digest conflict, and expired-lease stale holders.
- Verify weak caches only against their declared stale bound; never write a test that accidentally upgrades their contract to strong consistency.
