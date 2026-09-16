# PR #84 CI recovery — 2026-09-16

Status: local verification passed; exact-head CI, merge and Production verification pending.
This recovery supersedes the previous feature task's manual-review-only release
boundary. No feature redesign or application behavior change is included.

## Frozen starting state

- PR #84, branch `feat/secure-social-preview-refresh`.
- Head `46b6f90ff7fc2ac984fcff1cf1822ab955b78385`; clean working tree.
- Current main `90ff4f8e680f9bf210db78968e23b42f4764d66c`.
- CI run 196 / `34980857366`: Quality, Profile/Social and E2E failed.
  Tests, Build, Dependency Security and Notification Contracts passed.
  Runtime Security was skipped by the existing protected-target guard.
- Preview `dpl_8xvhDP3sNECxBsfzWW5mRW8rEZph` Ready at that exact head.
  Authenticated CLI inspection confirmed the SHA; the connector returned 404.

## Proven causes and minimal repairs

1. OFL line 21 had one trailing ASCII space. Only that byte is removed.
2. E2E finished with 78 passed, 5 failed and 19 existing skips. Both canonical
   booking journeys expected the old share greeting; all three confirmation
   hotfix projects expected the old social title. The same journeys also
   contained stale feedback/default-message/description expectations later in
   their sequence. They now assert the approved wording. Full default messages
   use equality rather than substring matching, and the no-account assurance
   remains asserted in its current dialog location. Privacy, crawler mutation,
   channel composition, confirmation and submission assertions remain intact.
3. The unchanged Profile destination test's request-count snapshot could be zero
   before Next scheduled the next prefetch batch. It now waits for Playwright's
   network-idle lifecycle before confirming that no RSC requests remain.
   No fixed sleep, retry, error filter, assertion removal or application fix.

## Main comparison and request evidence

Classification: **PRE-EXISTING WEBKIT/NEXT BEHAVIOR exposed by test sequencing**.
Reproduced on current main: **YES**.

Both snapshots used Playwright 1.62.1 / WebKit revision 2336, the same optimized
build command, fixture server, navigation sequence and origin
`http://127.0.0.1:3420`. Diagnostics only added event listeners and navigation
markers; they did not intercept, delay or alter requests.

| Original destination test | Main | Original PR |
| --- | --- | --- |
| macOS, three fixed repetitions | 3 passed | 3 passed |
| Linux, three fixed repetitions | 2 passed, 1 failed | 3 failed |

Every failing run completed the functional matrix and failed the final
`expect(errors).toEqual([])`. Main's failing trace shows reload at time zero,
the deferred RSC batch starting **11 ms later**, and cancellation/page errors
**18 ms after reload**. WebKit reports `Load request cancelled` alongside the
access-control-style page errors. Navigation then completes normally.

Recorded requests use Host `127.0.0.1:3420`, no Origin header, `RSC: 1`,
`Next-Router-Prefetch: 1`, and fetch mode `cors`. No localhost substitution,
port change or redirect was observed. Completed requests return HTTP 200 with
`text/x-component`; cancelled requests have no completed HTTP response. The
same business/settings URLs succeed at other points in the matrix. This is
not evidence of a Production CORS failure. Historical corroboration is in
[Golden stability pass](GOLDEN_STABILITY_PASS.md), section AJ, and the PR #83
release evidence. No CORS, CSP, cache, auth or capability policy changed.

## Verification and release boundary

Before the sequencing repair: full Profile/Social **39 passed**; normal E2E
**83 passed, 19 skipped**; unit/integration **1039 passed, 24 skipped**
(166 passing files, 21 skipped); runtime security **21 skipped** by its guard.
Lint has zero errors (four existing warnings in ignored local evidence);
typecheck, production build and moderate dependency audit pass (0 vulnerabilities).
After the sequencing repair: full Profile/Social **39 passed** (4.5 minutes);
three independent fixed Linux WebKit destination repetitions **3 passed**
(5.8 minutes including build). The same diagnostics recorded zero page errors
in every fixed Linux repetition. Final lint/typecheck and explicit production
build passed. The unchanged E2E implementation still has **83 passed, 19 existing
skips**; no new skips.

The initial CI artifact was listed by the GitHub connector, but its download URL
returned 403. All five exact failures were inspected directly in the full job
log; the artifact is supplementary evidence, not a replacement for those logs.

The final release must use the same PR, exact-head green checks, normal merge,
and exact merge-SHA current Production deployment. Production smoke must verify
both safe controlled vendor previews, unchanged crawler state, homepage, shared
capability boundaries, authenticated areas, Profile reload/Back and bounded logs.
Sentry cannot be inferred from Vercel logs.

Database/schema, environment, providers, DNS and dependencies: **no changes**.
Scheduler: untouched and remains active. Synthetic test fixtures use the normal
cleanup paths; no customer messages are sent by the release smoke.
