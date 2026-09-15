# Homepage golden polish — 2026-09-15

Pre-release gate record: VERIFIED LOCALLY — RELEASE VERIFICATION PENDING. The approved current branch, including its uncommitted supporting-motion pass, is the baseline. This report records the finalization work; the earlier positioning and motion reports remain historical local evidence. Release gates below must complete before Production can be claimed.

## A–C. Scope and preservation

This finalization pass changes only `app/homepage.module.css`, focused public/SEO/crawler browser tests and documentation. It preserves the existing copy, section order, branding, device preview, illustrations, motion concept, sequences and controls. The eventual PR also contains the already-approved positioning commit and supporting-motion work present before this pass.

**HOMEPAGE ANIMATION CONTENT: UNCHANGED**

SHA-256 comparison with snapshots taken before edits confirms that `app/page.tsx` and all five homepage demo/motion component and stylesheet files are byte-for-byte unchanged by golden finalization. No animation-container correction was necessary.

## D–N. Baseline findings and corrections

| Area | Finding and final treatment |
| --- | --- |
| D. Baseline | Captured both engines at all 11 primary and five short-height sizes before editing. No baseline page overflow or runtime errors. |
| E. Hero | At desktop widths and heights up to 700px, align the existing hero copy to the top of its grid cell. The 1024×600 CTA bottom moves from 694px to 532px; 1366×650 moves from 709px to 562px. Taller desktop and mobile composition are preserved. |
| F. Header | Preserve layout and destinations. Give the brand and desktop text links at least 44px target height and explicit visible focus. No menu or sticky behavior exists; none added. |
| G. Containers | Preserve the common 1220px cap, 16px mobile gutters and 24px tablet gutters. All sections retain their common axis. |
| H. Typography | Increase mobile footer navigation from 10.5px to 12px. Brand font, hero scale and approved copy unchanged. |
| I. Rhythm | Preserve section spacing. Footer grows only as required by readable text and targets; it wraps naturally at narrow widths. |
| J. Cards/grids | Preserve approved preview, five-node journey and three-card loyalty layout. No content, geometry or animation change. |
| K. Images/media | Preserve official dimensioned logos and existing HTML/SVG visuals. No additional assets, fonts, libraries or media. |
| L. CTAs | Preserve signup, login and responsive See how it works destinations. Short-screen CTAs are fully in the initial viewport. |
| M. Footer | At least 44×44px link targets, legible mobile text, explicit keyboard outline; same content and layout concept. |
| N. Overflow | No offending component found. No root overflow masking added. |

Actual rendered section inventory, in order:

| Section | Container/heading/layout | Responsive behavior | Issue |
| --- | --- | --- | --- |
| Header | Shared page container; brand, section links, account actions | Compact mobile brand/login; more actions from 640px; section links from 1024px | Small plain-link targets |
| Hero + demo | Shared container; H1 Keep every customer in the loop.; copy and existing visual | Stacked centered mobile/tablet; desktop split | Short desktop vertical centering hid CTAs below fold |
| Journey | Shared container; H2 One clear journey; five steps and connectors | Same bounded five-step concept across widths | None |
| Loyalty CTA | Shared container; H2 Turn updates into loyal customers.; existing copy/cards/wire | Mobile stack, desktop text/visual split | None |
| Footer | Shared container; official logo and three links | Natural flex wrap, desktop distribution | Tiny mobile type and short targets |

## O–T. Responsive verification

All results use an optimized production-style build. Both engines pass the strict assertion `document.documentElement.scrollWidth <= document.documentElement.clientWidth`, header/CTA/footer/device bounds, safe link destinations, and zero console errors, failed assets or private API requests. Captures wait for the streamed content to be visibly ready; an early after-capture of the loading fallback was discarded and regenerated.

| O. Primary viewport | Chromium | WebKit |
| --- | --- | --- |
| 320×568 | PASS | PASS |
| 360×800 | PASS | PASS |
| 375×812 | PASS | PASS |
| 390×844 | PASS | PASS |
| 414×896 | PASS | PASS |
| 430×932 | PASS | PASS |
| 768×1024 | PASS | PASS |
| 1024×768 | PASS | PASS |
| 1280×800 | PASS | PASS |
| 1366×768 | PASS | PASS |
| 1440×900 | PASS | PASS |

| P. Short viewport | Chromium | WebKit |
| --- | --- | --- |
| 360×640 | PASS | PASS |
| 390×600 | PASS | PASS |
| 430×650 | PASS | PASS |
| 1024×600 | PASS | PASS |
| 1366×650 | PASS | PASS |

Q. Landscape: 568×320 and 1024×600 PASS in both engines; content remains scrollable, contained and collision-free.

R. Breakpoint boundaries: 374/376, 639/641, 767/769, 1023/1025, 1279/1281 PASS in both engines. A 320→1440 sweep in 16px increments also passes both engines. In total: 56 named viewport/engine cases and two sweeps.

S. Chromium: PASS. T. WebKit: PASS. These are browser-engine checks, not physical iOS/Android device claims.

## U–Z. Accessibility, performance and runtime

U/V. One H1, logical section headings, header/main/footer and named navigation landmarks remain intact. Public navigation uses anchors; motion controls use buttons. Keyboard navigation, visible focus, CTA destinations and the original/supporting pause/replay controls pass. Reduced-motion and JavaScript-disabled visitors retain readable complete content. Main and muted text retain the approved high-contrast palette. No new live announcements or focusable decorative elements. Footer and plain navigation targets are enlarged without modifying the locked animation controls.

W/X/Y. Three fresh Chromium contexts at 390×844, optimized local server, no artificial CPU/network throttling, 2.5-second observation:

| Metric | Golden baseline | After polish |
| --- | ---: | ---: |
| Decoded initial JS | 915,086 B | 915,086 B |
| Gzipped initial JS (same local compression) | 293,257 B | 293,257 B |
| Initial scripts | 15 | 15 |
| Median LCP | 352ms | 112ms |
| Observed CLS | 0.000272 | 0.000272 |

The LCP range (96–392ms across runs) reflects local variation; no performance improvement is claimed from CSS alignment. No new client boundary, script, image or font. The homepage remains a server component with existing leaf motion controllers. Images retain fixed dimensions and official branding. This is not field Core Web Vitals evidence.

Z. No homepage console/runtime errors, hydration warnings, failed assets or private data requests in either engine.

## AA–AG. Regression gates

| Gate | Result |
| --- | --- |
| AA. Public navigation | PASS: signup/login plus header, responsive secondary CTA and footer anchors resolve to the existing destinations. |
| AB. SEO | PASS locally: approved root title, description, canonical, structured data, OG/Twitter metadata and server-rendered positioning. No SEO strategy changes in this pass. |
| AC. Open Graph | Root retains official platform branding. Vendor-preview architecture unchanged; isolated capability branding PASS in both engines. |
| AD. PWA | Manifest/service-worker source unchanged. Isolated notification/PWA checks PASS in Chromium and WebKit; all three cloud-backed Chromium/mobile Chromium/WebKit PWA journeys PASS. Physical installed-device launch is not claimed. |
| AE. Authenticated shell | CI-style desktop app matrix PASS: dashboard, bookings/details, customers, insights, profile and mobile bottom navigation. All executable E2E cases have passed with controlled fixtures and development email delivery. |
| AF. Customer capability pages | PASS: isolated confirmation, feedback, amendment and add-on rendering, ownership, invalid-state and privacy checks in both engines. |
| AG. Vendor trust | PASS: vendor image geometry, square thumbnail crop, initials fallback and all nine business-owned email templates at mobile/desktop/blocked-image sizes. No live email sent. |

## AH–AM. Scope and tests

AH. Database/schema/migrations/RLS changes: NONE. Existing E2E uses its established synthetic fixtures and cleanup; no product data changes are part of implementation.

AI. Saved environment changes: NONE. Local test processes use development email delivery; Preview receives no Production secrets.

AJ. Provider/DNS changes: NONE. Scheduler configuration/status: UNTOUCHED.

AK. Dependency changes: NONE.

AL. Golden code changes: `app/homepage.module.css`, `tests/e2e/public-homepage.spec.ts`, `tests/e2e/seo-foundation.spec.ts`, `tests/profile-ui/social-previews.spec.ts`. Documentation: this report, README, changelog, testing, responsive QA, design-system and current positioning/motion status references. Approved earlier branch files are included in the eventual release diff; see its PR for the complete immutable file list.

AM. Added one behavior-focused browser regression covering short-screen CTA visibility, footer target sizes, visible keyboard focus and overflow. Added 1366×768 to the permanent homepage matrix. Existing motion behavior tests are preserved. The full gates uncovered old homepage copy/title expectations in SEO and social-crawler tests; only those literals/headings were updated to the already-approved positioning. Privacy, canonical, metadata, schema and crawler assertions remain intact.

## AN–AV. Engineering evidence

| Gate | Result |
| --- | --- |
| AN. Focused browser tests | 23 PASS; one duplicate WebKit screenshot matrix SKIPPED. Both engines cover behavior and the separate complete visual matrix. |
| AO. Lint | PASS, zero errors; one pre-existing warning in an ignored local diagnostic artifact. |
| AP. Typecheck | PASS |
| AQ. Unit/integration/static security | 1,032 PASS, 24 SKIPPED; 165 files PASS, 21 SKIPPED. |
| AR. Runtime Security | SKIPPED: 21 guarded tests in 21 files. Protected runtime opt-ins remain disabled; no test-target claim for Production-backed Supabase. |
| AS. Full E2E | CI-style run: 82 PASS, 19 SKIPPED, one Supabase AuthRetryableFetchError during fixture creation. The unchanged affected mobile inline-customer case passed its single targeted recheck (1/1). All 83 executable cases have passed. |
| AT. Build | PASS: final `npm run build` with Production SEO semantics; local telemetry disabled only in the test process |
| AU. Dependency audit | PASS: zero vulnerabilities |
| AV. Diff check | PASS; all six locked source hashes match baseline. Incidental tracked E2E screenshots restored after saving local evidence. |

The isolated profile/social suite initially passed 29/31 with only the two old homepage-title expectations failing; both corrected crawler cases pass their focused recheck (2/2). Notification center, preferences, history, scroll lock, PWA and terminal-window fixture suite: 24/24 PASS in Chromium and WebKit. No tests were removed, relaxed or force-skipped.


The initial full run used the optimized local server and returned 74 PASS / 19 SKIPPED / 9 FAIL. Three failures expected old homepage copy/headings, two were caused by the local build lacking CI's Production SEO flag, and the unchanged share-dismissal, delayed-prefetch request-count and WebKit PWA checks failed in that alternate server mode. Re-running the repository's established CI dev-server configuration in an isolated copy passed those unchanged cases; its sole failure was the transient Auth fixture fetch described above. No application workaround, relaxed assertion, provider/configuration change or new skip was used. Optimized WebKit navigation limitations are also documented in the previous golden-stability baseline; the exact hosted release still requires safe Production smoke.

This document is the pre-release gate record. Immutable commit, PR, CI, Preview, merge and Production identities and post-release observations are recorded in the release PR and the final A–BL report, so this file does not predict a deployment outcome.

## AW–AY. Visual gates

HOMEPAGE MASTER ALIGNMENT: PASS

HOMEPAGE RESPONSIVE MATRIX: PASS

HOMEPAGE FINAL POLISH: PASS

Matching full-page mobile 390×844 and desktop 1440×900 walkthroughs preserve the approved composition, with only the documented corrections. Primary/short before-and-after captures, metrics and source hashes are local ignored evidence under `output/playwright/homepage-golden/`; bulky screenshots are not committed.

## AZ–BL. Release evidence

| Gate | Result |
| --- | --- |
| AZ. Commit | Local gates complete; commit identity recorded in the release PR and final report |
| BA. Push | Pending |
| BB. PR | Pending; source chore/public-homepage-positioning, target main |
| BC. CI | Pending |
| BD. Exact-SHA Preview | Pending |
| BE. Merge SHA | Pending |
| BF. Production deployment | Pending exact-SHA READY/PRODUCTION/CURRENT verification |
| BG. Mobile Production smoke | Pending 390×844 and 430×932 |
| BH. Desktop Production smoke | Pending 1440×900 |
| BI. Application Production smoke | Pending safe existing-session checks |
| BJ. Sentry | SENTRY — NOT VERIFIED |
| BK. Remaining issues | CI, Preview and Production checks remain release gates. Vercel connector returns an empty project list/404, but existing CLI authentication successfully inspects the correct project, immutable SHA and Production aliases. Existing automation access is available for Preview; no protection setting changed. |
| BL. Final status | MY KUSTOMERS HOMEPAGE GOLDEN POLISH — IMPLEMENTED — VERIFICATION PENDING |
