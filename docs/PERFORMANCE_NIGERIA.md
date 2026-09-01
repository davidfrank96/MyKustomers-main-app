# Nigeria Production Performance Audit

## Status

**NIGERIA PRODUCTION PERFORMANCE — VERIFIED — OPTIMIZATION RECOMMENDED**

Audit date: 2026-08-24. Production URL:
`https://my-kustomers-main-app.vercel.app`.

The current Nigerian user experience is assessed as **GOOD**. Typical mobile 4G
core navigation was generally below 1 second, cold dashboard startup was below
1 second, and login reached a usable dashboard in about 1.1 seconds median.
Constrained mobile remained usable. Poor-network login exceeded 3 seconds, and
an offline route attempt required a refresh after connectivity returned. These
are reasons to add privacy-safe Nigerian RUM and improve network-loss feedback,
not evidence for a tenant cache, database changes, a service worker, or an Edge
Runtime migration.

## Authenticated Navigation V2 Addendum

Follow-up date: 2026-08-27. The V2 implementation was measured only after PR
#41 merged as `d2f55fd` and Vercel marked that exact `main` deployment Ready.
The disposable confirmed account and all tenant/customer/booking fixtures were
removed after verification.

The focused headed-mobile rerun reused the audit's 390 x 844 typical (7.5 Mbps,
140 ms) and constrained (2.25 Mbps, 240 ms) profiles. It distinguishes immediate
acknowledgement, destination shell, useful rows, and usable detail content.

| Journey | Typical | Constrained |
| --- | ---: | ---: |
| Dashboard to Bookings shell / useful rows | 11 / 321 ms | 14 / 323 ms |
| Dashboard to Customers shell / useful rows | 13 / 433 ms | 12 / 626 ms |
| Booking detail usable | 748 ms | 763 ms |
| Customer detail usable | 545 ms | 593 ms |
| Business switch authoritative | 311 ms | 372 ms |

Destination identity remained immediate under both profiles; useful data stayed
below one second without tenant persistence or relaxed freshness. Constrained
click-time RSC evidence was 18.9 KB for Bookings and 12.4 KB for Customers;
focused detail evidence was 13.2-19.2 KB. No broad mobile prefetch, service
worker, Redis/shared cache, index, mega-RPC, Edge migration, or direct database
bypass was introduced.

Standalone Chrome reported standalone display mode and measured a 10 ms
acknowledgement, 14 ms Bookings shell, 327 ms useful rows, and 143 ms settled
Back restoration. Production overflow/pending-state smoke passed at 390, 768,
1024, and 1440 pixels. These focused results improve the earlier shell behavior
but do not replace Lagos-origin field telemetry; privacy-safe first-party RUM
remains a separately approved follow-up.

## A-B. Starting Production State

- Branch and commit: `main` at
  `3e32252dd44bde9abcb28c1f2cedf39ea6e7ad2d`.
- Final production deployment ID: `dpl_c5RcnnENevmjYM4uiWRuoGohskf9`.
- Vercel Node functions: configured for London, `lhr1`.
- Supabase: configured AWS `eu-west-2`, London.
- The worktree was clean and matched `origin/main` before measurement.
- The baseline ran before any repository or production behavior change.

## C. Nigeria Test Location Availability

**REAL NIGERIA ORIGIN**

Globalping measurement `26fwJlW4BtOWEOqXL000210ad` ran five HTTPS requests
from Lagos. The selected probes were SiteHUB Agency, Melbikomas, Misaka Network,
Workonline Communications, and Datacamp. Workonline was tagged as an eyeball
network; the other probes were tagged as data-center networks. This is genuine
Nigeria-origin network evidence, but it is not a claim about MTN, Airtel, Glo,
or 9mobile specifically.

Globalping measurement `2Y9YNXRZLgGxEtw8y000210ad` repeated five Lagos probes
against `/api/health` to verify the dynamic function path. The public Globalping
methodology and timing definitions are documented at
`https://blog.globalping.io/get-performance-metrics-website-or-app/`.

The authenticated browser matrix could not execute inside the Lagos probes.
Those journeys ran from a Dublin host with explicit Chromium network and CPU
emulation. Nigeria-origin HTTP results and browser-emulation results are kept
separate below.

### Lagos-Origin HTTPS

| Request | n | Total median / p75 / worst | First byte median / p75 / worst |
| --- | ---: | ---: | ---: |
| Cached landing page | 5 | 1,551 / 1,741 / 1,785 ms | 1,129 / 1,312 / 1,325 ms |
| Dynamic `/api/health` | 5 | 1,328 / 1,560 / 1,600 ms | 1,060 / 1,161 / 1,188 ms |

Landing DNS median/p75/worst was 106/180/279 ms and TLS was 119/179/187 ms.
All responses were HTTP 200. The landing page was a Vercel cache hit on every
probe. Dynamic headers showed `lhr1` function execution on every health request.

## D-G. Test Profiles And Environments

Primary device emulation used a mid-range Android-class profile at 390 x 844,
2.75 device scale factor, touch input, mobile layout, and an Android Chrome user
agent. Overflow checks also ran at 360 x 800 and 430 x 932. All three widths had
zero horizontal overflow on Dashboard and Bookings.

| Profile | Down | Up | Added RTT/latency | Loss/jitter support |
| --- | ---: | ---: | ---: | --- |
| Good 4G | 20 Mbps | 7.5 Mbps | 90 ms | None |
| Typical 4G | 7.5 Mbps | 2 Mbps | 140 ms | None |
| Constrained | 2.25 Mbps | 0.75 Mbps | 240 ms | None |
| Poor | 0.75 Mbps | 0.35 Mbps | 400 ms | Separate interruption test |

The browser was Chrome for Testing 151 through Playwright 1.62.1. Cold samples
used fresh contexts with cache disabled where practical. Warm route samples
used one normal authenticated session and five transitions per journey. A 4x
CPU slowdown was used only as a relative stress test.

The PWA check used a real headed Chromium `--app` window at 390 x 844. It
reported standalone display mode. This app has a manifest and icons but no
service worker, so it is not an offline-capable installed PWA.

## H-J. Startup And Login

Click/load-to-visible-heading medians are shown below. Cold rows have three
fresh-context samples per profile. Login measures form submit to usable
authenticated Dashboard.

| Profile | Cold landing median / p75 / worst | Cold Dashboard median / p75 / worst | Login to Dashboard median / p75 / worst |
| --- | ---: | ---: | ---: |
| Good 4G | 582 / 615 / 615 ms | 1,031 / 1,216 / 1,216 ms | 1,581 / 1,593 / 1,593 ms |
| Typical 4G | 755 / 783 / 783 ms | 841 / 920 / 920 ms | 1,085 / 1,576 / 1,576 ms |
| Constrained | 1,195 / 1,202 / 1,202 ms | 1,195 / 1,198 / 1,198 ms | 1,737 / 1,850 / 1,850 ms |
| Poor | 2,164 / 2,273 / 2,273 ms | 2,192 / 2,235 / 2,235 ms | 3,051 / 3,102 / 3,102 ms |

On typical 4G the standalone app-window startup navigation was 491 ms after
launch with an existing authenticated cookie state. It was a warm startup, not
an operating-system-level first install or cold cache measurement.

Email/password login was exercised repeatedly. Google OAuth was not repeated
during this high-sample audit to avoid unnecessary provider traffic; its current
production round trip remains covered by the preceding production verification.

## K-Q. Authenticated Navigation

Five warm click-to-heading samples were collected per route and profile.

| Journey | Good 4G median / p75 / worst | Typical 4G median / p75 / worst | Constrained median / p75 / worst | Poor median / p75 / worst |
| --- | ---: | ---: | ---: | ---: |
| Dashboard to Bookings | 925 / 932 / 932 | 917 / 917 / 930 | 920 / 928 / 931 | 1,428 / 1,432 / 1,434 |
| Dashboard to Customers | 916 / 924 / 929 | 928 / 935 / 939 | 929 / 933 / 1,254 | 1,418 / 1,422 / 1,432 |
| Booking detail | 139 / 140 / 147 | 143 / 145 / 145 | 138 / 143 / 148 | 1,421 / 1,437 / 1,450 |
| Customer detail | 142 / 144 / 146 | 148 / 149 / 161 | 136 / 144 / 146 | 1,422 / 1,431 / 1,432 |
| Dashboard to Business | 143 / 144 / 145 | 140 / 141 / 141 | 140 / 144 / 146 | 1,424 / 1,431 / 1,432 |
| Dashboard to Insights | 933 / 937 / 940 | 938 / 939 / 940 | 925 / 926 / 936 | 1,428 / 1,431 / 1,436 |
| Business to Dashboard | 932 / 937 / 941 | 936 / 937 / 945 | 939 / 941 / 1,439 | 1,416 / 1,422 / 1,424 |
| Business switch | 1,737 / 2,226 / 2,239 | 1,133 / 1,722 / 1,737 | 1,209 / 1,221 / 1,725 | 1,879 / 1,885 / 1,902 |

Detail and Business pages were already present in the normal Next router cache
after parent-route use under the first three profiles, explaining their very
fast repeat results. Poor-profile latency made all repeat transitions visible
again. Typical uncached RSC medians for Bookings, Customers, Insights, and
Dashboard were about 176-223 ms; business-switch RSC median was about 227 ms.

Business switching is the slowest normal workflow but remains below 2 seconds
at typical-4G median/p75/worst except for the good-4G sample set's unexplained
variance. That non-monotonic variance is why these figures are diagnostic, not
an SLO.

## R-T. Public Customer Links

Each route used a separate controlled token and a fresh unauthenticated mobile
context. No token is retained in this document or audit artifact.

| Route | Constrained median / p75 / worst | Poor smoke heading | Poor LCP | Transfer |
| --- | ---: | ---: | ---: | ---: |
| Confirmation | 1,347 / 1,353 / 1,353 ms | 2,514 ms | 2,276 ms | 85.8 KB |
| Amendment | 1,379 / 1,426 / 1,426 ms | 2,486 ms | 2,240 ms | 85.6 KB |
| Add-on | 1,372 / 1,377 / 1,377 ms | 2,517 ms | 2,276 ms | 85.8 KB |
| Feedback | 622 / 1,490 / 1,490 ms | 827 ms | 568 ms | 2.5 KB |

All routes loaded without an account, remained usable at 390 x 844, and kept
`no-store`, `no-referrer`, and `noindex` privacy controls. Confirmation,
amendment, and add-on had zero request failures. The feedback HTML loaded
successfully; its optional first-open tracker was sometimes canceled when the
short-lived audit context closed and did not affect content.

Direct WhatsApp, Instagram, and Telegram in-app browser execution was not
available. Existing crawler-safe metadata behavior was not changed. Platform-
specific compatibility is deferred rather than inferred from user-agent
emulation.

## U-X. Network Profile Assessment

- **Good 4G:** GOOD. Core list navigation was about 0.92 seconds. Business
  switch variance reached 2.24 seconds.
- **Typical 4G:** GOOD. Cold Dashboard was 0.84 seconds, login 1.09 seconds, and
  core navigation 0.92-0.94 seconds.
- **Constrained:** ACCEPTABLE to GOOD. Login was 1.74 seconds and public links
  were about 0.62-1.38 seconds with stable content.
- **Poor:** ACCEPTABLE for existing sessions, CONCERN for login. Core navigation
  was about 1.42 seconds with immediate existing content; login crossed the
  task's severe 3-second band.

Bandwidth was not the primary warm-navigation constraint because repeat RSC
payloads were generally 2-5 KB. Added latency and server/session/business
resolution dominated. No carrier-specific conclusion is made.

## Y-Z. Browser, PWA, And Skeletons

Typical browser Dashboard-to-Bookings median was 917 ms. The matched standalone
app-window median was 939 ms (p75 947 ms, worst 952 ms), so the previously seen
large standalone penalty did not reproduce. Alternating standalone samples
were about 0.45 and 0.94 seconds, indicating router scheduling/cache variance
rather than a service-worker delay.

Skeletons appeared promptly on first uncached transitions, generally within
about 35-55 ms. Typical first visits showed roughly 195 ms on Bookings, 324 ms
on Customers, and 301 ms on Insights. Cached repeats did not need a skeleton.
The stalled-network test showed a skeleton within 34 ms and kept it visible for
about 1.70 seconds until data resumed. No blank page, permanent hung skeleton,
or layout shift occurred.

## AA. Network Recovery

- Starting offline navigation left the existing Dashboard content visible and
  did not create a hung skeleton or duplicate mutation.
- It did not show an explicit offline/retry message and did not automatically
  resume the route.
- After connectivity returned, a full refresh restored the authenticated
  Dashboard in 830 ms; the next Bookings navigation completed in 940 ms.
- Refresh on Bookings preserved the session and remained on `/bookings`.
- A deliberately stalled RSC request resumed without retry or duplicate action:
  content appeared in 1,930 ms, with a 1,461 ms RSC and 1,698 ms skeleton.

The behavior fails safely but requires user knowledge to refresh. Explicit
network-loss feedback is therefore a P2 product-resilience recommendation.

## AB-AE. Web Performance Metrics

Primary Nigeria-origin first-byte evidence is the Lagos table above: 1,129 ms
median for the cached landing page and 1,060 ms for the dynamic health route.
Synthetic Dublin-host Navigation Timing is useful only inside the browser
matrix and must not be described as Nigeria-origin TTFB.

Synthetic mobile LCP medians:

| Profile | Landing LCP | Authenticated Dashboard LCP |
| --- | ---: | ---: |
| Good 4G | 360 ms | 764 ms |
| Typical 4G | 584 ms | 580 ms |
| Constrained | 1,020 ms | 944 ms |
| Poor | 1,904 ms | 1,952 ms |

CLS was 0 across all cold landing/Dashboard samples and all public-route
samples. The repeated login interaction produced a maximum observed Event
Timing duration of 32 ms median on typical 4G, but the sample did not satisfy a
field-quality INP calculation. **INP remains unverified**, and no synthetic zero
is reported as real INP. No long task was observed in the cold samples.

## AF-AG. Data And Client Bundle

Settled fresh-route transfer estimates under typical 4G:

| Route | Total transfer | JavaScript | Requests |
| --- | ---: | ---: | ---: |
| Landing | 266.8 KB | 202.6 KB | 19 |
| Login page | 275.3 KB | 208.1 KB | 24 |
| Dashboard | 366.8 KB | 203.9 KB | 30 |
| Bookings direct | 381.8 KB | 207.3 KB | 42 |
| Booking detail direct | 396.4 KB | 228.6 KB | 34 |
| Customers direct | 287.6 KB | 207.3 KB | 34 |
| Customer detail direct | 285.6 KB | 207.7 KB | 31 |
| Business direct | 297.4 KB | 218.0 KB | 33 |

No representative journey transferred a megabyte. The first typical Dashboard
to Bookings transition transferred about 114 KB because it acquired route code
and prefetched segments; repeats transferred about 3.1 KB. Customers repeats
were about 2.4 KB, Insights 5.1 KB, and Dashboard 2.8 KB.

The compressed initial JavaScript cost of roughly 200-229 KB is acceptable on
typical 4G but remains the main cold-start data cost on poor connections. No
single measured route justified a bundle rewrite. Code splitting worked: warm
route-specific JavaScript was zero or a few hundred bytes after the first use.

## AH. Static Assets And Images

- Hashed Next JavaScript, CSS, and font responses used
  `public,max-age=31536000,immutable`; observed responses were CDN hits apart
  from one first request.
- All five Lagos landing responses were Vercel cache hits.
- Manifest: 543 bytes. Icon: 318 bytes. Both revalidate rather than use an
  immutable hash, which is appropriate for stable un-hashed URLs.
- The controlled logo was 190 bytes and served with a one-hour public max-age.
- A metadata-only sample of three existing production logos was 46 bytes,
  440 bytes, and 16,162 bytes. The application enforces WebP, 512-pixel, and
  200 KB output bounds. Existing assets are not a mobile-data concern.
- No service-worker controller or registration existed.

## AI-AL. Region And Backend Findings

- Vercel function region: **London `lhr1`, verified** on all five Nigeria-origin
  `/api/health` responses.
- Supabase region: **AWS `eu-west-2`, London**, matching documented production
  configuration.
- Region alignment: **PASS**. No routing drift or Node-to-Edge migration was
  observed.
- Nigeria ingress varied: three health probes entered through Cape Town
  (`cpt1`) and two through Washington (`iad1`) before executing in London. This
  client-edge path is a material source of Lagos variance.

An isolated Vercel-London-to-Supabase HTTP RTT is not directly exposed by the
current production responses, and no timing instrumentation was shipped for
this audit. Typical dynamic RSC medians were about 176-223 ms while prior SQL
execution remained in low milliseconds. The evidence supports the inference
that user-to-Vercel geography and network variance dominate; it does not prove
an exact Vercel-to-Supabase RTT.

## AM-AP. Backend, CPU, Prefetch, Security

No remaining database query, index, or persistent-computation bottleneck was
proven. No database or cache optimization is recommended.

The 4x CPU stress medians were effectively unchanged for core routes: Bookings
911 ms, Customers 913 ms, Insights 914 ms, and cached details 132-135 ms.
Business switch rose to 1,705 ms median. The application is network/server
bound for normal routes; the CPU result is relative and does not map to a named
handset.

Waiting 1.5 seconds for default Next prefetch reduced the matched typical-4G
Bookings median from 1,110 ms to 959 ms, but increased prefetched RSC transfer
from roughly 8-10 KB to about 22-27 KB. This is a modest measured speed/data
tradeoff. Keep framework defaults; do not aggressively prefetch every tenant
route.

All fixtures used existing auth, membership, RLS, lifecycle, confirmation,
amendment, add-on, feedback, and service-role boundaries. The database rejected
the harness's initial attempt to start a booking as confirmed; the corrected
fixture then used the real confirmation and transition workflows. Tokens,
emails, IDs, cookies, and customer data were not retained in this document.
All controlled fixtures and storage objects were deleted after testing.

## AQ. Nigerian User Experience Assessment

**GOOD**

My Kustomers is sufficiently fast for the tested Nigerian SME profile on
typical and constrained 4G. Core operations are small-data, layout-stable, and
usually complete below the 1.2-second GOOD threshold. Real Lagos first byte is
about 1.1 seconds, so geographic and carrier-path variance remains visible.
Poor-network login and offline recovery are the two meaningful weak points.

## AR-AS. Priorities And Recommendations

| Priority | Measured problem | Recommendation | Expected benefit | Security/data impact | Complexity |
| --- | --- | --- | --- | --- | --- |
| P2 | No field-quality Nigerian INP/LCP distribution; synthetic origin coverage is limited | Add privacy-safe first-party/Vercel RUM aggregated by country and route class | Confirms real carrier/device p75 and catches regressions | No content, token, customer ID, full URL, or precise location; small telemetry bytes | Medium |
| P2 | Offline route click stays on current page and requires refresh after reconnect | Add an explicit network-unavailable state and a safe retry/refresh command for failed reads | Makes interruption recovery discoverable without caching private data | No mutation replay and no private offline cache | Medium |
| P3 | Typical business-switch p75 reached 1.72 seconds; 4x CPU median reached 1.71 seconds | Add RUM around switch submit to Dashboard commit before changing implementation | Determines whether synthetic variance affects real users | Timing only; no business identifiers | Low |

Rejected: Redis/Upstash, tenant data cache, service-worker private caching,
Edge Runtime migration, broad prefetch, speculative indexes, RLS/auth changes,
and broad UI redesign.

## AT-AV. Changes And RUM

**Changes implemented: NONE.** This was an audit-only baseline. There is no
before/after claim.

Recommended RUM fields are country-level Nigeria aggregate, route class,
navigation type, TTFB, LCP, INP, CLS, and coarse connection/device class. Do not
record public capability URLs, query strings, tokens, emails, phone numbers,
customer/booking/business IDs, rendered content, cookies, or exact coordinates.
Use sampling and retention limits. No analytics package was installed.

## AW-AX. Documentation And Limitations

This file is the only repository change.

Limitations:

- Real Nigeria probes provided HTTP timing, not a full authenticated browser.
- Four of five Lagos probes were data-center networks; only one was tagged
  eyeball. No test ran through a named Nigerian mobile carrier.
- CDP supported fixed latency/bandwidth and offline state, not realistic jitter
  or packet loss distributions.
- PWA startup was a headed Chromium app-window with an existing session, not an
  operating-system install/launch study.
- No direct WhatsApp/Instagram/Telegram in-app browser was available.
- INP and an isolated Vercel-to-Supabase RTT remain unverified.
- Synthetic samples are intentionally small and should not be treated as an
  availability or latency SLO.

## AY. Final Status

**NIGERIA PRODUCTION PERFORMANCE — VERIFIED — OPTIMIZATION RECOMMENDED**
