# Protocol And Testing Reference

## Contents

- Atomic version-floor behavior
- Deterministic race harness
- Outbox and projection cases
- Lease and fencing cases
- Static and operational gates

## Atomic Version-Floor Behavior

Implement one server-side Redis operation for each transition. Do not split read/compare/write across commands.

Recommended abstract state:

```json
{
  "floorVersion": "43",
  "data": {
    "version": "43",
    "digest": "sha256:...",
    "value": {}
  }
}
```

Encode 64-bit versions losslessly. JavaScript `number` is unsafe above `2^53 - 1`; use decimal strings or a codec with `bigint` support.

`markFloor(v)` must be monotonic. `put(v,digest,value)` must atomically:

1. reject `v < floorVersion`;
2. reject `v < currentData.version`;
3. reject and report equal-version/different-digest data;
4. allow equal-version/same-digest replay;
5. allow a verified clean value at the current floor;
6. preserve TTL and the maximum observed floor according to policy.

Set floor retention no shorter than the maximum in-flight fill plus the invalidation-recovery window. Test expiry and eviction explicitly; once the fence is gone, strict readers must re-establish freshness from the primary.

Use a separate metadata key only if both keys are placed in one Redis Cluster hash slot and every transition is atomic. A single encoded state is simpler.

## Deterministic Testcontainers Harness

Use real PostgreSQL and Redis containers. Do not simulate these races with arbitrary sleeps. Add explicit barriers controlled by the test:

```ts
const readCompleted = deferred<void>();
const allowFill = deferred<void>();

const slowRead = cache.getForTest(id, {
  afterDatabaseRead: async () => {
    readCompleted.resolve();
    await allowFill.promise;
  },
});

await readCompleted.promise;
await updateAggregateToV43(id);
allowFill.resolve();
await slowRead;
```

Production adapters need not expose test hooks publicly. Inject a narrow barrier/observer port in the integration harness or pause a controlled repository/fill stage.

### Required Interleavings

1. **Old miss fill after delete**
   - R1 misses and reads v42.
   - W1 commits v43 and invalidates.
   - R1 resumes.
   - Show weak cache may contain v42; show a v43 floor rejects it.

2. **Reordered rebuild writers**
   - W1 obtains v42 and pauses before Redis.
   - W2 writes v43 to Redis.
   - W1 resumes.
   - Assert cached version never falls below 43.

3. **Equal-version conflict**
   - Submit v43 with digest A, then v43 with digest B.
   - Assert the second operation is rejected and a metric/error is emitted.

4. **Commit then crash**
   - Commit the aggregate and outbox row.
   - Terminate the request path before Redis work.
   - Start the consumer and assert the projection converges.

5. **Redis timeout/unknown**
   - Let Redis execute a command but drop/delay the reply.
   - Assert retries are idempotent, PostgreSQL is not rolled back, and the outbox remains recoverable.

6. **Replica lag**
   - Commit v43 on primary while the read source exposes v42.
   - Assert strict/minVersion reconstruction refuses the replica result.

7. **Negative cache race**
   - Cache `missing` v42, create the entity at v43, then replay the old negative fill.
   - Assert the v43 floor/tombstone protocol prevents hiding the entity.

## Outbox And Projection Cases

For complete-state notifications, deliver versions `42,44,43,44` with duplicates. Assert:

- unique `eventId` handling is idempotent;
- the aggregate high-water mark never decreases;
- Redis publishes a complete authoritative snapshot at version 44 or later.

For deltas, withhold version 43 and deliver 44. Assert the consumer detects the gap and does not apply 44 until it reloads state or replays the missing delta.

Test periodic reconciliation independently of event delivery. Delete or evict the Redis projection, then assert it can be rebuilt from PostgreSQL without treating Redis history as authoritative.

## Lease And Fencing Cases

Use a fake durable sink that stores `lastAcceptedFence` and rejects `fence <= lastAcceptedFence`.

1. Worker A receives fence 10 and pauses beyond lease expiry.
2. Worker B receives fence 11 and writes successfully.
3. Worker A resumes with fence 10.
4. Assert the sink rejects A.

Repeat with only random ownership tokens to demonstrate that compare-and-delete protects release but cannot order writes to the sink.

## Static And Operational Gates

- ESLint restricted imports or architecture tests: no raw Redis client in handlers, usecases, or DB transaction modules.
- Type-level cache registry: require consistency, stale budget, miss source, failure policy, TTL, and write protocol.
- Schema gate: aggregate version is `bigint`; outbox has unique `event_id` and an aggregate/version index.
- Review gate: every dependency affecting a projection bumps the aggregate version in the same transaction.
- Metrics: hit/miss/bypass, served version age, floor rejection, digest conflict, Redis unknown outcome, outbox oldest age, retry count, dead letters, reconciliation repairs.
- Alert when observed staleness exceeds the registered budget; do not relabel the cache as strongly consistent.
