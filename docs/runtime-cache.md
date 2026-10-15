# Shared public read cache

Issue: [#130](https://github.com/hatsyio/atiny-world/issues/130).

The database remains the source of truth. The server caches public country/city options, public letter/country totals, and the geographic metadata persisted by #129. It never caches letters, viewport results, pagination, private data or administrative reads. A cache failure falls back to the database; it does not call Geoapify directly. Only the existing geographic resolver can call Geoapify after a successful database lookup finds no persisted record.

## Activation and cost review (15 October 2026)

**Production activation is blocked pending verification of included usage and remaining allowance.** This PR adds an explicit opt-in and leaves it disabled. It does not provision a service, upgrade the account, change a billing setting, or set deployed environment variables.

Read-only account checks confirmed:

| Check | Result |
| --- | --- |
| Project | `atiny-world` (`prj_6Oy7LVZcW0kPffeiQZ12BMUe0KfU`) |
| Team | `joseppascualbadia-8623s-projects` |
| Default function region | `iad1` (`resourceConfig.functionDefaultRegions` in project API) |
| Actual team plan | Hobby, active (`GET /v2/teams/:teamId`, selected `billing.plan/status`) |
| Current billing usage | `vercel usage --format json`: `Costs not found (404)` |
| Shared project usage, 1–14 October | `vercel usage --from 2026-10-01 --to 2026-10-14 --group-by project --format json`: same 404 |
| Verified remaining Runtime Cache allowance | Unavailable; no free operation quota inferred |

The [Runtime Cache documentation](https://vercel.com/docs/caching/runtime-cache) says storage is regional and ephemeral, split by deployment environment. Hobby projects share a cache at team level, so other projects may also cause eviction. The documentation does not give a numeric storage capacity. The current published limits are 2 MB per item, 128 tags per item and 256 bytes per tag. TTL limits age, not guaranteed retention.

The [regional pricing table](https://vercel.com/docs/pricing/regional-pricing) publishes Runtime Cache read units at $0.40–$0.64 per million and write units at $4.00–$6.40 per million, depending on region. The [Hobby plan table](https://vercel.com/docs/plans/hobby) does not identify a specific Runtime Cache free operations quota. Availability on Hobby is not evidence of free operations. Prices, units, storage limits and allowance must be rechecked before activation.

For planning, assuming each operation consumes one unit and payloads remain small:

- A validated hit uses three reads: generation, value, generation confirmation.
- A miss reads the generation/value, queries the database, then writes the successful value under that generation. A concurrent invalidation makes that generation inaccessible. Initializing an absent generation adds a write.
- Invalidation rotates shared generation metadata and expires tags. Count these operations and any failed calls in observed usage rather than treating writes as free.
- At 100,000 lookups/month and 95% hits, a simple 295,000-read/5,000-value-write estimate is $0.138–$0.2208/month at published rates, before generation initialization, invalidation, larger payload units and other project usage. This is an example, not observed traffic or an approved cost.

Before enabling production, an operator must recheck the configured region (`iad1` at review time), team allowance/credits, current shared consumption, measured read/write units and an agreed traffic estimate. Check Billing/Usage and Observability → Runtime Cache in the existing Vercel account if CLI usage remains unavailable. Confirm the forecast fits the included usage. If this cannot be established, keep the opt-in disabled and obtain an explicit cost decision. No paid plan or additional service is required by this implementation.

## Configuration

| Server variable | Default | Purpose |
| --- | --- | --- |
| `PUBLIC_READ_CACHE_ENABLED` | disabled | Explicitly opt in with `true`; still requires a Vercel runtime and project/environment identity |
| `PUBLIC_READ_CACHE_GEOGRAPHY_TTL_SECONDS` | `86400` | Persisted geographic metadata, 24 hours |
| `PUBLIC_READ_CACHE_OPTIONS_TTL_SECONDS` | `300` | Public countries/cities, five minutes |
| `PUBLIC_READ_CACHE_STATS_TTL_SECONDS` | `60` | Public letter/country totals, one minute |

TTLs accept positive safe integer seconds; invalid values fall back to the defaults. Changing TTL does not rewrite existing cache entries; purge or change the policy version when reducing existing retention. `VERCEL`, `VERCEL_PROJECT_ID`, `VERCEL_ENV` and, when present, `VERCEL_TARGET_ENV` establish platform identity. Project policy versions and hashes separate keys and tags. Development without the Vercel runtime bypasses the cache. The adapter also requires the request runtime cache context: `@vercel/functions` 3.9.11 otherwise silently chooses process memory or a build client. The adapter checks that context and uses an explicit SHA-256 SDK key hash, keeping those platform details out of policy code. The context symbol is a pinned SDK implementation detail; reverify it and run a real Vercel smoke test when upgrading the SDK. If the context is absent or changes, reads bypass caching and log the bounded initialization error. Unit tests inject a controlled provider with no platform or network dependency.

## Consistency and operations

Invalidation runs after confirmed database commits. The public option/statistics groups are invalidated conservatively after successful publication, edit, deletion, moderation, author suspension/reactivation and settings changes. Geographic saves invalidate the geographic group, including identity and search variants. Public-city preference ordering continues to read live public visibility from the database.

The current runtime has one configured region, `iad1`. Generation tokens are regional too. Before adding runtime regions, coordinate generation invalidation across every serving region and test concurrent fills there; rotating a generation in one region does not rotate the others. Keep the opt-in disabled during that change until regional invalidation is verified.

Generation tokens shared through the cache prevent a database read started before invalidation from refilling a current key with old data. Removing or expiring generation metadata creates a new random generation instead of reusing a fixed token. This does not make the database and cache an atomic transaction. A cache outage or failed invalidation can leave an older entry visible until TTL; such failures are logged. There is no stale-while-revalidate path. Pages already open in browsers keep their existing refresh behavior.

Preview and Production currently share the remote database (see README). Their cache generations are deliberately isolated, so a write through Preview cannot invalidate a Production cache. Before activation, separate the databases or provide coordinated invalidation for every environment sharing a database. Until that is resolved, keep caching disabled; TTL alone does not provide immediate removal across environments.

Queries or writes made outside the application's supported repositories (manual SQL, imports, future jobs or webhooks) must invalidate the corresponding group after commit, or leave caching disabled while they run. There is no implemented user-deletion webhook in this codebase. Add invalidation when implementing one that changes public visibility.

Use the existing server logger and Vercel Runtime Cache graphs to inspect cache hits, misses, database loads, invalidations and errors; use Vercel graphs for write counts. A hit is a database query avoided for an eligible read. Compare hit/(hit + miss) and database-load counts per group against traffic; track error and invalidation rates before increasing scope or TTL. Do not log cached content, queries, credentials or provider payloads.

Disabling the opt-in bypasses the cache. Before re-enabling after out-of-band changes or a disabled interval, use a fresh cache version/namespace or purge the old entries so persisted cache state cannot reappear. Rolling back this PR restores direct database reads.
