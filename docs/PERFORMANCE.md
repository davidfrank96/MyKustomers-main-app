# Performance And Cache Governance

## Status

STATUS: VERIFIED

Audit date: 2026-08-24. Measurements use the configured non-production Supabase
project and a local production-style application server. They are diagnostic
samples, not production Web Vitals or a latency service-level objective.

## Permanent Rules

- No cache may be introduced for authenticated or tenant-scoped data without
  explicit cache scope, key, invalidation behavior, and cross-tenant security
  analysis.
- Public capability-token pages must remain non-cacheable unless a future
  security review explicitly changes the rule.
- Longer asynchronous route/data transitions should provide structural loading
  feedback without exposing stale tenant data or requiring full-page client
  rendering.
- Redis, global maps, framework persistent caches, and browser persistence are
  not tenant-authority mechanisms.

## Current Cache Model

Authenticated user, membership, and current-business resolution use React
server `cache` for request-scoped deduplication. The cache is discarded after
the server render request; it does not survive navigation requests or processes.
Stable shared functions and zero-argument call sites ensure layout and page
loads share one resolution chain.

There is no persistent application cache for bookings, customers, insights,
business membership, business identity, search, or public capability-token
data. Therefore there is no application cache invalidation protocol: database
state, RLS, and membership checks are reevaluated on the next request. `/c`,
`/a`, `/x`, and `/f` route families explicitly return non-cacheable headers.

## Measured Server Work

Before request memoization, an authenticated layout and page could each perform
user validation, membership lookup, and business identity lookup. The shared
request now performs one of each, removing three duplicate remote reads from a
typical route render. Customer detail also begins its authorized customer and
feedback reads in parallel. Booking detail already used parallel independent
subqueries, and debounced list search already retained its previous result UI.

Warmed local median response samples in milliseconds:

| Route | Baseline | First changed run | Repeat changed run |
| --- | ---: | ---: | ---: |
| Dashboard | 636 | 662 | 1316 |
| Bookings | 465 | 509 | 1423 |
| Booking detail | 748 | 574 | 1191 |
| Customers | 404 | 414 | 673 |
| Customer detail | 461 | 444 | 434 |
| Insights | 508 | 1016 | 484 |
| Business | 465 | 433 | 416 |
| Login | 402 | 375 | 410 |

The repeated runs varied with remote database/network latency. These samples do
not support a blanket wall-clock speed claim. They do support retaining the
deterministic request-count reduction, and they show no reason to add a
cross-request tenant cache to mask external latency.

## Query Review

Read-only `EXPLAIN ANALYZE` against controlled development fixtures found:

- Booking list: existing `bookings_business_schedule_status_idx`, 1.848 ms.
- Customer list: sequential scan over 23 rows, 0.141 ms.
- Feedback summary: sequential scan over a small table, 0.123 ms.

List projections remain narrow and paginated. The measured small-table scans do
not justify speculative indexes. No schema index, Redis dependency, analytics
snapshot, or client-side tenant cache was added.

## Loading Behavior

Dashboard, booking/customer lists and details, New Booking, Insights, and
Business use route-level structural loading. Placeholders use stable grids,
hide decorative shapes from assistive technology, expose one status, and stop
animation for reduced motion. Search controls retain prior results during their
short debounced navigation. Business switching uses an opaque pending overlay so
the previous tenant workspace is not presented during resolution.

## Deferred Work

- Capture production Core Web Vitals after a representative observation window.
- Reassess analytics caching only with explicit tenant keys, invalidation, and
  revocation analysis.
- Define deterministic logo versioning before considering longer-lived identity
  asset references.
- Replace bounded in-memory customer picker results with server pagination if
  measured business scale requires it.
