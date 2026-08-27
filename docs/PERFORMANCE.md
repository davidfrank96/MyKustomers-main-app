# Performance And Cache Governance

## Status

STATUS: VERIFIED

Audit date: 2026-08-24. Measurements use a disposable controlled account against
both a local production build and the deployed Vercel application. Samples are
three-run medians unless stated otherwise. They are diagnostic evidence, not a
latency service-level objective.

## Authenticated Navigation V2

Implementation date: 2026-08-27. Production after-measurement is recorded after
the exact merged deployment; until then this section describes the production
baseline and verified local implementation behavior.

### Production baseline

A disposable confirmed Auth user owned two isolated businesses with six and two
controlled customer/booking records. Headed Chromium measured in-page click,
visible loading acknowledgement, destination `h1`, useful content, enabled
primary controls, and settled content. It did not log credentials, query strings,
record identifiers, or customer data. Three warm samples were used for primary
routes; detail samples were focused single runs.

| Surface           | Route                  | Acknowledgement | Destination/useful median | Observed useful range |
| ----------------- | ---------------------- | --------------: | ------------------------: | --------------------: |
| Desktop 1440x1000 | Dashboard to Bookings  |           11 ms |                    321 ms |            313-516 ms |
| Desktop 1440x1000 | Dashboard to Customers |           10 ms |                    314 ms |            306-442 ms |
| Desktop 1440x1000 | Dashboard to Insights  |            9 ms |                    314 ms |            311-494 ms |
| Desktop 1440x1000 | Dashboard to Business  |            9 ms |                    316 ms |            313-386 ms |
| Desktop 1440x1000 | Bookings to detail     |           11 ms |                    661 ms |           focused run |
| Desktop 1440x1000 | Customers to detail    |            9 ms |                    401 ms |           focused run |
| Mobile 390x844    | Dashboard to Bookings  |           11 ms |                    324 ms |            312-469 ms |
| Mobile 390x844    | Dashboard to Customers |           11 ms |                    315 ms |            314-345 ms |
| Mobile 390x844    | Dashboard to Insights  |            9 ms |                    352 ms |            313-564 ms |
| Mobile 390x844    | Dashboard to Business  |            8 ms |                    314 ms |            307-930 ms |
| Mobile 390x844    | Bookings to detail     |            9 ms |                    569 ms |           focused run |
| Mobile 390x844    | Customers to detail    |           10 ms |                    361 ms |           focused run |

The separate three-run current-business switch baseline kept the prior tenant
behind the existing opaque pending layer within 9-10 ms. Authoritative switcher
identity and the new Dashboard settled at a 514 ms desktop median (512-521 ms)
and 312 ms mobile median (306-321 ms).

The generic route loader acknowledged clicks quickly in the controlled harness,
but did not identify the destination. A separate real-session sample reproduced
meaningful remote variance: desktop Bookings ranged from 591 to 3,188 ms and
Customers from 879 to 3,219 ms to useful content. The V2 work therefore targets
deterministic destination identity and progressive authorized rendering, not a
claim that the remote database always settles below a fixed threshold.

### Waterfall and request findings

Dashboard to Bookings remains one semantic Next `Link` transition. Request-level
React caching shares signature-verified claims and current-business resolution
between layout and page. The layout now starts `requireUser()` and
`getCurrentBusinessContext()` together; the shared cached claims promise still
performs one authentication resolution. A normal unsearched Bookings render has
one current-business membership/identity read and one narrow paginated booking
read. Search adds one bounded customer-ID lookup only when a query is present.

Warm benchmark clicks consumed route data already obtained by Next's default
prefetch and therefore initiated zero additional RSC responses at click time.
The previous Nigeria trace measured roughly 22-27 KB of prefetched RSC versus
8-10 KB without waiting for prefetch, for a modest and variable gain. No explicit
or idle full-route prefetch was added. Streaming remains within the same route
RSC response and does not add a second destination request.

### V2 rendering changes

- Desktop and mobile navigation immediately mark the selected destination busy,
  replace its icon with a reduced-motion-safe progress glyph, announce
  `Opening <destination>`, and suppress only a repeated click on that same
  pending destination. Links, browser history, modifier-click behavior, and
  Next routing remain native.
- Major route loaders now include truthful destination identity for Bookings,
  Customers, Insights, Business, booking detail, and customer detail.
- Bookings and Customers render their authorized heading, search, filters, and
  create action before the paginated row query settles. Rows and pagination
  stream through one meaningful Suspense boundary.
- Customer identity/contact editing no longer waits for private feedback.
  Feedback starts in parallel and streams in a bounded secondary section.
- Booking operational issues start in parallel and no longer hold the primary
  booking journey/payment/action boundary. Other booking summaries remain in
  the primary boundary where lifecycle, confirmation, add-on, feedback, or
  payment correctness depends on them.
- Business switching is unchanged: the opaque switch overlay continues to hide
  the previous tenant until the selected membership is reauthorized.

### Bundle comparison

Exact webpack route client-reference manifests were built from unchanged main
and the V2 branch with the same dependency tree. Totals include shared chunks
referenced by each route and are gzip bytes, not transfer measurements.

| Route           | Before |     V2 | Difference |
| --------------- | -----: | -----: | ---------: |
| Bookings        | 68,992 | 69,243 |     +251 B |
| Booking detail  | 95,860 | 95,727 |     -133 B |
| Customers       | 68,992 | 69,242 |     +250 B |
| Customer detail | 73,288 | 73,532 |     +244 B |
| Dashboard       | 65,684 | 65,934 |     +250 B |
| Insights        | 65,271 | 65,527 |     +256 B |
| Business        | 81,813 | 82,099 |     +286 B |

No admin module or logo preprocessor entered the vendor route manifests. The
small shared delta is the navigation pending state and one Lucide glyph.

### Budgets and rejected changes

- Primary list server reads: two normal Supabase operations after claims; search
  may add one bounded lookup.
- Destination navigation: one RSC response when not already prefetched; streaming
  must not create duplicate destination requests.
- Routine route-manifest gzip growth: keep below 2 KB without measured benefit;
  V2 stays below 0.2 KB on every ordinary vendor route.
- Routine dynamic RSC: retain the prior 8-10 KB no-wait reference and investigate
  material growth; broad prefetch remains rejected at the prior 22-27 KB cost.

Rejected again: Redis/shared tenant caching, browser-persisted tenant data,
private service-worker caching, a mega-RPC, speculative indexes, Edge migration,
direct PostgreSQL bypass, broad mobile prefetch, auth/RLS removal, and payment or
live-sync caching.

RUM is recommended as a separate first-party follow-up. A minimized event could
contain route category, coarse duration buckets, device/viewport/network class,
browser versus standalone context, and server timestamp. It must exclude user,
business, customer and booking identifiers, capability paths, query strings,
contact data, content, and precise location. Storage requires an approved schema
and retention design, so no telemetry table, vendor, script, or environment
variable is introduced here.

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

## Navigation Deep Audit

The measured production request path entered Vercel through Dublin but executed
the Next.js function in `iad1` (Washington). The configured Supabase project is
in AWS `eu-west-2` (London). `vercel.json` now pins functions to `lhr1`, the
Vercel London region, so the application server and Supabase API are colocated
geographically. This is an application runtime setting only; no database,
credential, environment-variable, or Edge Runtime change is involved.

The profiling sequence was click, Next.js navigation, destination RSC request,
server auth/tenant/data work, RSC arrival, React commit, and visible level-one
destination heading. Each transition used a fresh authenticated browser context
to avoid carrying a favorable route cache between samples. Local baseline and
changed builds ran concurrently against the same Supabase project. Production
was measured separately before deployment of the change.

Local destination RSC medians in milliseconds:

| Transition                   | Baseline | Changed | Difference |
| ---------------------------- | -------: | ------: | ---------: |
| Dashboard to Bookings        |      330 |     152 |       -54% |
| Bookings to booking detail   |      656 |     522 |       -20% |
| Dashboard to Customers       |      289 |     179 |       -38% |
| Customers to customer detail |      345 |     190 |       -45% |
| Dashboard to Insights        |      344 |     188 |       -45% |
| Dashboard to Business        |      263 |     159 |       -40% |
| Business to Dashboard        |      541 |     382 |       -29% |

Click-to-heading medians remained clustered around 0.83 seconds on most local
dynamic-route samples because Next's transition scheduling and partial route
prefetch dominated once server work became shorter. Customer detail had a
236 ms changed median. The deterministic RSC duration reduction is therefore
stronger evidence for the server changes than a blanket click-timing claim.

Pre-deployment Vercel click-to-heading medians were 1,366 ms for Bookings,
1,611 ms for booking detail, 1,060 ms for Customers, 1,026 ms for customer
detail, 1,077 ms for Insights, 1,038 ms for Business, 3,080 ms from Business
back to Dashboard, 2,346 ms from login to Dashboard, and 1,052 ms for a business
switch. Browser Back from Bookings to Dashboard was already fast at 17 ms.
Production remained materially slower than local after warm-up, confirming that
the cross-Atlantic function-to-Supabase path, not SQL execution or hydration,
was the dominant production cost.

After merge and Vercel promotion, `x-vercel-id` changed from `dub1::iad1` to
`dub1::lhr1`. Fresh-context production click-to-heading medians in milliseconds:

| Transition                   | Before | After | Difference |
| ---------------------------- | -----: | ----: | ---------: |
| Login to Dashboard           |  2,346 | 1,334 |       -43% |
| Dashboard to Bookings        |  1,366 |   555 |       -59% |
| Bookings to booking detail   |  1,611 |   571 |       -65% |
| Dashboard to Customers       |  1,060 |   563 |       -47% |
| Customers to customer detail |  1,026 |   494 |       -52% |
| Dashboard to Insights        |  1,077 |   513 |       -52% |
| Dashboard to Business        |  1,038 |   550 |       -47% |
| Business to Dashboard        |  3,080 |   644 |       -79% |
| Business switch to Dashboard |  1,052 |   555 |       -47% |

Browser Back remained effectively immediate at 11 ms after versus 17 ms before.
The repeatable reductions across every authenticated path support both the
round-trip changes and region alignment. Individual samples still varied, so
these medians remain diagnostic rather than an SLO.

## Round Trips And Streaming

- Current-business resolution now reads active membership and business identity
  through one RLS-scoped embedded relationship query instead of two sequential
  PostgREST requests. Request-scoped React memoization remains unchanged.
- Booking lists, booking details, and dashboard queues embed their customer
  summary through the existing composite foreign key. This removes one
  conditional sequential customer request without widening the selected fields.
- Customer feedback embeds booking label data through its existing composite
  foreign key, removing another conditional sequential request.
- Dashboard operational counts and queues remain the primary render boundary.
  Monthly analytics starts concurrently and streams through one meaningful
  Suspense boundary, so its aggregate RPCs no longer hold back operational
  content.

Temporary local instrumentation recorded method, Supabase pathname, and elapsed
time only. It showed typical individual PostgREST calls around 60-200 ms with
occasional larger network variance. The first local JWT key-set lookup was about
70 ms; subsequent route transitions did not make a separate Auth endpoint call.
Proxy claim validation remains in place because it is required for protected
route/session behavior. Timing instrumentation is not shipped.

## Prefetch, Client, And PWA Findings

All five primary desktop and mobile destinations already use ordinary Next.js
`Link` elements. No `router.push` wrapper or disabled prefetch was found. Waiting
1.5 seconds for default prefetch produced variable results and no repeatable
click-to-content improvement for these dynamic authenticated routes. Explicitly
prefetching all five full RSC payloads was rejected because it would amplify
authorized backend reads and increase stale workspace exposure without measured
benefit.

The root client bundle measured about 361 KB gzip and authenticated route chunks
about 20 KB gzip before and after; the server-only changes did not increase the
client payload. Named Lucide imports remain tree-shakeable, and the shared Radix
menu boundary was not a material bundle outlier. Next's hashed static assets use
the platform defaults; a deployed chunk returned a cache hit with
`public,max-age=31536000,immutable`. Fonts use the existing Next font
optimization.

The repository has a web manifest and icons but no service worker registration
or worker file. Browser checks confirmed `navigator.serviceWorker.controller`
was absent, so no worker intercepts, delays, or caches authenticated HTML/RSC.
Headed Chromium app-window checks reported real standalone display mode, no
horizontal overflow, successful authenticated navigation, and no worker control.
In matched three-run samples, normal headed browser navigation had a 359 ms
median while standalone app-window navigation had an 826 ms median. Because
both used the same network path and no service worker, the difference is not a
cache delay; app-window launch/prefetch scheduling remains a follow-up trace
candidate.

Production page-load samples had zero CLS. Desktop TTFB/LCP was effectively flat
at 146/1,856 ms after versus 143/1,788 ms before. Mobile TTFB/LCP improved to
151/1,408 ms from 194/2,504 ms. Synthetic page loads produced no qualifying INP
interaction, so the observed zero is not reported as a real INP measurement.

## Deliberately Rejected

- No Redis, persistent React/Next cache, browser tenant cache, keep-alive request,
  direct PostgreSQL connection, speculative index, or Edge Runtime conversion.
- No removal of proxy claim validation, RLS filters, capability-route `no-store`,
  authenticated `force-dynamic`, or business-switch authorization.
- No explicit five-route full prefetch and no service worker. Either would need
  separate evidence and a private-data cache/security design.
- No server-timing production header. Temporary pathname-only local timing was
  sufficient and avoids permanent production implementation disclosure/noise.

## Measured Server Work

Before request memoization, an authenticated layout and page could each perform
user validation, membership lookup, and business identity lookup. The shared
request now performs one of each, removing three duplicate remote reads from a
typical route render. Customer detail also begins its authorized customer and
feedback reads in parallel. Booking detail already used parallel independent
subqueries, and debounced list search already retained its previous result UI.

Warmed local median response samples in milliseconds:

| Route           | Baseline | First changed run | Repeat changed run |
| --------------- | -------: | ----------------: | -----------------: |
| Dashboard       |      636 |               662 |               1316 |
| Bookings        |      465 |               509 |               1423 |
| Booking detail  |      748 |               574 |               1191 |
| Customers       |      404 |               414 |                673 |
| Customer detail |      461 |               444 |                434 |
| Insights        |      508 |              1016 |                484 |
| Business        |      465 |               433 |                416 |
| Login           |      402 |               375 |                410 |

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

The booking-detail live-state detour uses one bounded five-second request only
while the document is visible, performs an immediate check on focus, prevents
overlapping requests, aborts on unmount, and returns only a minimal private
revision. It does not add cross-request caching, repeated database polling from
the server, a Realtime publication, service worker, background sync, or push.
The maximum expected visible update delay is one polling interval.

- Capture production Core Web Vitals after a representative observation window.
- Reassess analytics caching only with explicit tenant keys, invalidation, and
  revocation analysis.
- Define deterministic logo versioning before considering longer-lived identity
  asset references.
- Replace bounded in-memory customer picker results with server pagination if
  measured business scale requires it.
