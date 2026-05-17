---
name: backend-data-correctness
description: Use when writing, reviewing, or designing TypeScript backend data access involving PostgreSQL, Drizzle, Kysely, Redis, cache adapters, transactions, concurrency control, idempotency, outbox, migrations, queues, or Hono/oRPC repository and usecase boundaries.
---

# Backend Data Correctness

## Overview

For TypeScript backends, treat data correctness as a hard backend contract. Hono, Elysia, Fastify, or oRPC handlers should stay thin; business invariants belong in usecases, repositories, database constraints, transactions, and cache adapters.

Default stance:

- PostgreSQL is the business source of truth.
- Drizzle plus `pg` is the default PostgreSQL layer; Kysely is allowed for SQL-heavy modules.
- Drizzle should own schema and migrations by default. Do not let Drizzle and Kysely become competing schema or migration sources of truth.
- Redis is an auxiliary layer for cache, session, rate limit, idempotency hints, short-lived state, pub/sub, or hot counters.
- Redis must not protect core business invariants such as money, inventory, permissions, order state, or legal workflow state.
- In Hono/oRPC code, route handlers must not contain ad hoc SQL, Redis commands, transaction logic, or cache key construction.

## PostgreSQL Correctness

Every write usecase must declare its concurrency strategy:

- `atomic-sql`: one conditional write expresses the invariant.
- `transaction-lock`: explicit transaction plus `SELECT ... FOR UPDATE`.
- `optimistic-version`: `version` column checked in `WHERE`.
- `serializable-retry`: Repeatable Read or Serializable transaction with retry.
- `advisory-xact-lock`: transaction-level advisory lock for a short resource-scoped critical section.
- `idempotency-record`: unique idempotency row plus business write.

Rules:

- Default isolation is Read Committed.
- Single-statement writes already run in an implicit PostgreSQL transaction. Do not add explicit transactions for ceremony.
- Use explicit transactions for multi-statement invariants, read-then-write, lock scope, isolation level, advisory locks, outbox, and idempotency records.
- Prefer atomic conditional writes over application-level read-then-write.
- Put uniqueness, foreign key, and check invariants in the database. Application checks are not enough.
- Always check `returning()` rows or affected rows for critical `update` and `delete`.
- Transaction callbacks must use the passed `tx`; never call the global `db` inside the transaction.
- Returning from a transaction callback commits the work already done. Throw, use the project's rollback helper, or call the ORM rollback API when partial writes must be aborted.
- Keep transactions short. Do not call external HTTP, send email, enqueue non-transactional side effects, or run long loops inside a transaction.

Atomic update with Drizzle:

```ts
const [row] = await db
  .update(inventory)
  .set({
    stock: sql`${inventory.stock} - ${qty}`,
  })
  .where(and(eq(inventory.sku, sku), gte(inventory.stock, qty)))
  .returning({
    sku: inventory.sku,
    stock: inventory.stock,
  });

if (!row) {
  return { ok: false, reason: "insufficient_stock_or_missing_sku" };
}
```

Get-or-create must use a unique constraint plus `ON CONFLICT`:

```ts
const [inserted] = await db
  .insert(users)
  .values({ id, email, name })
  .onConflictDoNothing({ target: users.email })
  .returning({
    id: users.id,
    email: users.email,
    name: users.name,
  });
```

If the insert returns no row, read the existing row by the same unique key and handle the impossible-missing case explicitly. Do not implement get-or-create as `SELECT exists` followed by plain `INSERT`.

State transitions must encode the current state in `WHERE`:

```ts
const [order] = await db
  .update(orders)
  .set({
    status: "paid",
    version: sql`${orders.version} + 1`,
  })
  .where(
    and(
      eq(orders.id, orderId),
      eq(orders.status, "pending"),
      eq(orders.version, expectedVersion),
    ),
  )
  .returning({
    id: orders.id,
    status: orders.status,
    version: orders.version,
  });
```

Read-then-write must lock or use optimistic versioning:

```ts
await db.transaction(async (tx) => {
  const [order] = await tx
    .select({
      id: orders.id,
      status: orders.status,
    })
    .from(orders)
    .where(eq(orders.id, orderId))
    .limit(1)
    .for("update");

  if (!order || order.status !== "pending") {
    return { ok: false };
  }

  return tx
    .update(orders)
    .set({ status: "cancelled" })
    .where(eq(orders.id, order.id))
    .returning();
});
```

Use `FOR UPDATE SKIP LOCKED` only for job claiming, worker stealing, and controlled backfill:

```ts
const rows = await tx
  .select({ id: jobs.id })
  .from(jobs)
  .where(eq(jobs.status, "pending"))
  .orderBy(desc(jobs.priority), jobs.createdAt)
  .limit(limit)
  .for("update", { skipLocked: true });
```

Do not use `SKIP LOCKED` for normal business lists, permission checks, inventory, money, or status decisions.

Lock Drizzle versions and add integration tests for generated SQL and concurrent behavior when relying on `.for("update")`, `.for("update", { skipLocked: true })`, or transaction isolation options. These are correctness boundaries, not formatting details. If the current Drizzle version does not support the needed lock shape, keep the workaround inside the repository layer with parameterized `sql`, Kysely, or tightly reviewed raw SQL.

## Transaction Retry

Repeatable Read and Serializable transactions must use one shared retry wrapper.

Rules:

- Retry SQLSTATE `40001` (`serialization_failure`).
- Usually retry `40P01` (`deadlock_detected`).
- Retry the entire transaction callback, not one failed SQL statement in the middle.
- Use max attempts, exponential backoff, and jitter.
- Do not let agents write custom retry loops in each usecase.

```ts
const retryablePgCodes = new Set(["40001", "40P01"]);

export async function withSerializableRetry<T>(
  run: () => Promise<T>,
): Promise<T> {
  for (let attempt = 1; attempt <= 5; attempt += 1) {
    try {
      return await run();
    } catch (error) {
      if (!hasPgCode(error, retryablePgCodes) || attempt === 5) {
        throw error;
      }

      await sleep(20 * 2 ** (attempt - 1) + Math.floor(Math.random() * 20));
    }
  }

  throw new Error("unreachable retry state");
}
```

## Advisory Locks

Prefer transaction-level PostgreSQL advisory locks over Redis locks when the protected resource is part of the PostgreSQL business model.

Rules:

- Prefer `pg_advisory_xact_lock`, not session-level `pg_advisory_lock`.
- Use advisory locks only for short transaction-scoped resource serialization.
- Do not hold advisory locks while calling external HTTP or running long jobs.
- Do not use advisory locks instead of unique constraints, state-machine `WHERE` clauses, or idempotency records.

```ts
await db.transaction(async (tx) => {
  await tx.execute(
    sql`select pg_advisory_xact_lock(${namespaceId}, ${resourceLockId})`,
  );

  return runShortDatabaseOnlyCriticalSection(tx);
});
```

## Redis Correctness

Redis correctness is not PostgreSQL correctness. Redis commands can be atomic, `MULTI/EXEC` serializes commands, `WATCH` can provide CAS-style optimistic checks, and Lua or Redis Functions can run small atomic scripts. Redis transactions do not provide PostgreSQL-style rollback or isolation.

Rules:

- Redis is not the business source of truth.
- Cache-only Redis usage does not need a business distributed lock by default.
- Business code must not call raw `redis.get`, `redis.set`, `JSON.parse(raw) as T`, or hand-built keys directly.
- Redis access must go through cache/session/rate-limit/idempotency adapters with typed key builders, schema or codec decoding, TTL policy, owner, and failure behavior.
- Redis keys should have namespaces and default TTLs unless explicitly documented as managed persistent keys.
- TTL should include jitter for high-volume keys.
- Redis failure behavior must be explicit: fail open, fail closed, or fall back to PostgreSQL.
- Redis clients must be created centrally, reused across requests, configured with explicit error-event, reconnect, timeout, and offline-queue policy, and closed through the application's shutdown path. Do not create a Redis client per request.
- Redis loss, expiry, eviction, or persistence gaps must have a documented recovery path; do not treat Redis durability as PostgreSQL durability.

Cache adapter shape:

```ts
type CacheCodec<T> = {
  encode: (value: T) => string;
  decode: (raw: string) => T;
};

type CacheEntry<T> = {
  key: string;
  ttlSec: number;
  codec: CacheCodec<T>;
};
```

Cache-aside example:

```ts
const cached = await redis.get(entry.key);

if (cached !== null) {
  return entry.codec.decode(cached);
}

const value = await loadFromPostgres();

if (value !== null) {
  await redis.set(entry.key, entry.codec.encode(value), {
    EX: entry.ttlSec + Math.floor(Math.random() * 30),
  });
}
```

## Redis Locks And Atomicity

Do not introduce Redis locks by default. If a cache layer has stampede problems, call the mechanism a cache-fill mutex, not a business distributed lock.

Allowed uses:

- Prevent duplicate expensive cache fills.
- Coordinate a short non-critical external operation only when duplicate execution is safe.
- Avoid duplicate background work when losing the lock is safe.

Forbidden uses:

- Protecting inventory, money, permissions, order state, or core workflow invariants.
- Replacing PostgreSQL unique constraints, row locks, advisory xact locks, idempotency records, or state-machine updates.
- Long-running tasks or external HTTP calls that require strict correctness.

If a Redis lock is used:

- Acquire with one `SET key token NX PX ttl` command.
- Token must be unique per lock attempt.
- Release with Lua compare-token-then-delete.
- Never use `SETNX` followed by separate `EXPIRE`.
- Never `DEL` a lock without token comparison.
- Use fencing tokens if a stale lock holder can still write to an external durable resource.

Pipeline is not a transaction. Use a single Redis command, `MULTI/EXEC`, `WATCH`, Lua, or Redis Functions when atomicity matters.

For Redis Cluster, any multi-key atomic logic must declare cluster compatibility. Related keys that must be handled atomically should use hash tags such as `user:{123}:profile` and `user:{123}:settings`.

## Side Effects, Idempotency, And Migrations

- External side effects should use outbox, after-commit hooks, or committed job rows. Do not call external services from inside a database transaction.
- Do not write Redis cache as final state before the database commit. After a successful commit, invalidate or delete affected cache keys, or publish an outbox/job row that performs invalidation.
- Mutating usecases must declare affected cache keys or the reason no cache invalidation is needed.
- Mutations that can be retried must be idempotent: payments, refunds, order submission, approvals, imports, webhooks, jobs, and mobile mutations.
- Critical idempotency should be backed by PostgreSQL unique constraints and records. Redis may assist, but should not be the only correctness layer.
- Migrations must use expand, backfill, switch, and contract for destructive changes.
- Drizzle `sql` template expressions are allowed for parameterized SQL fragments. Raw SQL belongs in repository modules, must be parameterized, and must not use `sql.raw` with user input.
- Dynamic column names, sort keys, and table names must use whitelist maps.

## Queues And Workers

- For ordinary backend jobs, prefer PostgreSQL-backed job rows, pg-boss, or another durable queue that matches PostgreSQL as the source of truth.
- `FOR UPDATE SKIP LOCKED` is appropriate for controlled PostgreSQL job claiming and backfill workers; it is not a generic list-query optimization.
- Use BullMQ when Redis is already an accepted system dependency and the queue feature set justifies its ioredis ecosystem.
- Use Temporal or an equivalent durable workflow engine for long-running workflows, human approvals, cross-service retries, or workflows that need explicit history and replay.

## Hono And oRPC Boundaries

- Hono/oRPC handlers parse context, call usecases, and map responses.
- Handlers must not directly construct Redis keys, run Drizzle transactions, or assemble SQL.
- Repositories and cache adapters must not import `Hono.Context`, Elysia context, React, Vue, or request-scoped UI types.
- Contract schemas own API input and output. Database rows and API responses must be mapped explicitly.

## Drizzle ESLint Gates

When using Drizzle, enable Drizzle ESLint rules where available:

```js
{
  rules: {
    "drizzle/enforce-delete-with-where": "error",
    "drizzle/enforce-update-with-where": "error"
  }
}
```

If the plugin cannot be used, enforce the same policy with review, tests, or local lint rules.

## Typecheck Performance Preference

For medium-to-large TypeScript repositories, default to full-project `tsgo --noEmit --pretty false` for local typecheck self-checks. This is usually fast and stable enough. If the human developer says the time is unacceptable and explicitly asks for more speed, prefer a fully cached incremental command such as `tsgo --noEmit --incremental --tsBuildInfoFile .cache/tsgo.tsbuildinfo --pretty false`; generally avoid treating watch mode as the performance path.

## Review Checklist

- Does every write usecase declare a concurrency strategy?
- Are business invariants backed by PostgreSQL constraints, atomic SQL, locks, or retryable transactions?
- Are `returning()` rows or affected rows checked?
- Are all transaction operations using `tx` instead of global `db`?
- Are external side effects outside transactions?
- Are RR/Serializable transactions wrapped in retry?
- Are Redis keys, values, TTLs, owners, and failure behavior declared in adapters?
- Is Redis kept out of core business correctness?
- Are cache invalidation and miss behavior explicit?
- Are migrations safe for production rollout?
- Are Hono/oRPC handlers thin and free of ad hoc data access?
