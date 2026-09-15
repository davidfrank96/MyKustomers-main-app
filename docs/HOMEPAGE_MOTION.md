# Homepage motion — local review, 2026-09-15

Current homepage finalization: preserved the approved design/motion, corrected short desktop hero alignment and public link targets, and enlarged mobile footer text. Visual gates pass; release verification is pending. See [golden polish evidence](HOMEPAGE_GOLDEN_POLISH.md). Earlier local-review status statements below describe their original passes.

Status: VERIFIED LOCALLY — MANUAL REVIEW PENDING. This pass is an uncommitted change on `chore/public-homepage-positioning`, following baseline commit `657183676450f5870456ee9fb217e71ad688d46b`. No push, merge or deployment was performed. The scheduler was not changed.

## A. Existing animation preservation

The existing homepage product/dashboard animation was preserved and not replaced, rebuilt, or converted to media.

Both `components/homepage/homepage-product-demo.tsx` and its CSS module are byte-for-byte unchanged from the baseline. Its fixture data, sequence, durations, responsive device layout, observer, visibility handling, reduced-motion behavior and controls remain intact. Replay affects only that original demo. Its eight integration cases and real browser pause/resume/replay checks pass.

The homepage remains a statically prerendered Server Component. The new controller is a small separate client leaf; it does not wrap the hero in a client boundary.

## B. New hero motion

- Three desktop signals: Customer confirmed / Just now; Looks great! / Thank you! 🙌; Out for delivery / Today, 2:00 PM. The delivery time uses the current demo fixture. No personal identity or photo was added.
- Entrances: 250/600/950ms stagger, 450ms restrained easing, 12px vertical travel and .98→1 scale. Independent 6.5/8/9.5-second drifts stay within approximately 6px vertically, 2px horizontally and .4° on desktop.
- Below 1024px, an 18-second CSS sequence rotates confirmation+reaction → reaction+delivery → delivery+confirmation. The departing card reaches zero opacity before the replacement fades in. Tests sample all 241 points of a cycle, including transitions: maximum two visible cards. No carousel, timer or animation library was added.
- Orders confirmed and Happier customers use decorative handwritten-style text and inline SVG arrows drawn once over 900ms, followed by a 3px drift. No additional font download is used.
- A separate pale background form breathes over 12 seconds, with scale 1→1.015 and opacity .75→.9. Existing demo background styles are untouched. No blur or shadow animation.
- Placement adapts the reference around the actual existing device. Reserved upper/lower space keeps the signals clear of its content, the CTAs and replay controls; the screenshot's alternate dashboard was not reconstructed.

## C. Lower motion

The final CTA becomes “Turn updates into loyal customers.” with the existing professional-experience supporting copy and `/signup` destination. Its three semantic HTML cards read Booking confirmed, Out for delivery and Thank you! / Private feedback.

Copy and cards enter at 0/250/750/1250ms. The inline Bézier wire draws over 1300ms starting at 450ms; a small green point and halo begin traveling after two seconds and loop over six seconds. The static path is never rewritten or morphed. A wrapper moves by 2px/.2° over ten seconds. Cards drift independently over 8/9.5/7 seconds, with small final rotations. Stronger relationships appears after 1800ms with its once-drawn arrow and quiet drift.

Separate inline SVG geometries fit the stacked mobile cards and desktop diagonal layout. Only the SVG for the active breakpoint runs. The existing five-node journey gets one-time 120ms-staggered opacity/vertical entrances; its connections fade after adjacent nodes and settle.

## D. Exact mobile differences

| Width | Hero treatment | Lower section |
| --- | --- | --- |
| 320px | 130px minimum signal width; two-card maximum; one Orders confirmed annotation below the phone; Happier customers hidden; 86px upper/82px lower reserved space | Readable stacked cards in a 430px visual; contained vertical wire |
| 360px | Approximately 141px signals; same one-annotation/86px upper-space strategy | Same stack; more text room |
| 390px | Approximately 154px signals; 96px upper space; smaller Orders confirmed above the phone and Happier customers below | Same stack; 258px maximum card width |
| 430px | Approximately 170px signals; same two-annotation/96px strategy | Same bounded card width and stack |

All phone widths reduce drift to 4px vertically, 2px horizontally and .25°. The phone's own sizing rules are unchanged. No page-level overflow masking is used.

## E. Reduced motion and no scripting

Reduced motion shows final content immediately, with no supporting loops, cycling, pulse, draw or breathing. Mobile shows static confirmation and delivery signals; the reaction remains in the semantic DOM. All three lower messages and their wire remain visible. Changing the preference during playback works. The existing demo retains its own completed reduced-motion state.

No-JavaScript browser verification revealed that the inherited root loading boundary streamed the completed homepage into a hidden wrapper. A homepage-scoped `@media (scripting: none)` rule exposes only the wrapper containing this page and hides that loading skeleton. It uses the same CSS base layer as Tailwind's important hidden reset. It does not modify the root layout/loading component, authenticated shell, or other routes. Chromium and WebKit verify actual visible headings, cards, signup destination and containment with JavaScript disabled.

The CSS feature is documented by [MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/At-rules/%40media/scripting); React describes the streamed fallback/content mechanism in its [server-rendering documentation](https://react.dev/reference/react-dom/server/renderToPipeableStream). The page-local regression test protects this behavior on framework upgrades.

## F. Performance

Measured on the local optimized build, three fresh Chromium contexts per version, 390×844, no CPU/network throttling, 2.5 seconds per observation. These are local comparisons, not field performance or physical-device battery measurements.

| Measure | Before | After | Change |
| --- | ---: | ---: | ---: |
| Initial script count | 15 | 15 | 0 |
| Decoded initial JavaScript | 910,627 B | 915,086 B | +4,459 B (+0.49%) |
| Gzipped initial JavaScript (same local compression) | 291,923 B | 293,257 B | +1,334 B |
| Decoded CSS | 94,448 B | 107,663 B | +13,215 B |
| Median LCP | 368ms | 372ms | +4ms; within local run variation |
| Observed CLS | 0.000332 | 0.000272 | No regression |

Dependencies added: **0**. New client controller source: 3,561 bytes. No new image, font, video or GIF download is used in the homepage. The optional recordings below are review artifacts only.

One supporting IntersectionObserver serves the hero, journey and loyalty regions. Only viewport/media/document-visibility changes update DOM attributes. React state changes only when the user operates the supporting pause control. No new timers, intervals, scroll listeners or requestAnimationFrame loops exist. CSS animation play states and SVG timelines freeze offscreen/hidden; inactive breakpoint SVGs remain paused. Observer/listeners clean up on unmount. Reserved visual and control dimensions prevent hydration sizing jumps. No permanent will-change or frame-by-frame layout reads were added.

Evidence: `output/playwright/homepage-motion/performance-before.json`, `performance-after.json`, `review-results.json`, and the browser motion tests.

## G. Alignment

HOMEPAGE MOTION ALIGNMENT GATE: PASS

Reviewed desktop and mobile screenshots after correcting the replay/callout collision and lower mobile annotation spacing. Device centering, CTA clearance, contained signals, journey baselines, lower card separation and wire placement are checked. The existing demo retains visual priority.

## H. Polish

HOMEPAGE MOTION POLISH GATE: PASS

Reviewed entrance timing, subtle independent drift, translucent white surfaces, restrained shadows, pale background, annotation weight and line/pulse intensity. No bounce, flashing, spin, continuous redraw or whole-card pulse was added. Desktop and mobile recordings show the original demo completing before the lower story.

## I. Responsive results

| Viewport | Chromium | WebKit |
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
| 1440×900 | PASS | PASS |
| 1600×900 | PASS | PASS |

All 22 cases assert `document.documentElement.scrollWidth <= document.documentElement.clientWidth`, no visible signal/device collision, contained lower cards, no card-to-card overlap and a drawn visible wire. Zero browser page errors. These are browser viewports, not physical-device certification.

## J. Accessibility and functional boundaries

New informational cards use lists and normal HTML text, are not focusable, and do not add live regions. Decorative SVGs/annotations are hidden from assistive technology and cannot take focus. A keyboard-operable Pause supporting motion control exposes a complete static story and retains focus when toggled. Reduced-motion and no-JavaScript fallbacks pass. Semantic lower-card content is verified against the accessibility tree.

Existing demo announcements and controls are preserved. Signup, login, both See how it works targets, section anchors, metadata and anonymous dashboard protection pass. No authenticated app, booking, customer, Insights, profile, confirmation, feedback, payment, email, database, PWA, provider, environment, security authority or scheduler code changed. No live account/customer mutation was performed.

## K. Final checks

| Check | Final result |
| --- | --- |
| `npm run lint` | PASS — 0 errors, 1 pre-existing warning in `output/playwright/golden-stability/preview-diagnostic.mjs` |
| Final ESLint on changed TS/TSX | PASS — 0 errors, 0 warnings |
| `npm run typecheck` | PASS |
| `npm test` | **1,032 passed, 0 failed, 24 skipped**; 165 files passed, 21 skipped |
| `npm run build` | PASS — homepage remains statically prerendered |
| Chromium homepage/public-entry/motion E2E | **11 passed, 0 failed, 0 skipped** |
| WebKit motion/accessibility/no-JS/demo E2E | **6 passed, 0 failed, 0 skipped** |
| Responsive visual cases | **22 passed, 0 failed, 0 skipped** |
| `git diff --check` | PASS |
| Existing demo component/CSS and dependency diff | Empty |

The 24 Vitest skips are existing optional/environment-dependent cases; no test was skipped or weakened for this pass. Final browser counts follow correction of the no-JS fixture and real streamed-fallback issue. A transient generated dev type file was regenerated after stopping the dev server; the build required sandbox permission to fetch the existing Google font. No application dependency or provider setting changed.

Reproduction commands:

```sh
npm run lint
npm run typecheck
npm test
npm run build
npm run start -- --hostname 127.0.0.1 --port 3421
PORT=3421 npx playwright test tests/e2e/homepage-motion.spec.ts tests/e2e/public-homepage.spec.ts tests/e2e/app-loads.spec.ts --project chromium
npx playwright test --config output/playwright/homepage-motion/webkit.config.ts
node output/playwright/homepage-motion/review.mjs
git diff --check
```

The WebKit config, detailed review harness, logs and media are local ignored artifacts; the six browser tests and eight new integration tests are repository source.

## L. Screenshots and recordings

Mobile captures:

| Width | Initial | Floating cards | Loyalty/wire |
| --- | --- | --- | --- |
| 320px | [Initial](/Users/frankenstein/Desktop/MyKustomers/MyKustomers-main-app/output/playwright/homepage-motion/chromium-320-initial.png) | [Hero](/Users/frankenstein/Desktop/MyKustomers/MyKustomers-main-app/output/playwright/homepage-motion/chromium-320-hero.png) | [Loyalty](/Users/frankenstein/Desktop/MyKustomers/MyKustomers-main-app/output/playwright/homepage-motion/chromium-320-loyalty.png) |
| 390px | [Initial](/Users/frankenstein/Desktop/MyKustomers/MyKustomers-main-app/output/playwright/homepage-motion/chromium-390-initial.png) | [Hero](/Users/frankenstein/Desktop/MyKustomers/MyKustomers-main-app/output/playwright/homepage-motion/chromium-390-hero.png) | [Loyalty](/Users/frankenstein/Desktop/MyKustomers/MyKustomers-main-app/output/playwright/homepage-motion/chromium-390-loyalty.png) |
| 430px | [Initial](/Users/frankenstein/Desktop/MyKustomers/MyKustomers-main-app/output/playwright/homepage-motion/chromium-430-initial.png) | [Hero](/Users/frankenstein/Desktop/MyKustomers/MyKustomers-main-app/output/playwright/homepage-motion/chromium-430-hero.png) | [Loyalty](/Users/frankenstein/Desktop/MyKustomers/MyKustomers-main-app/output/playwright/homepage-motion/chromium-430-loyalty.png) |

Desktop captures:

| Width | Three hero signals | Journey | Loyalty/wire |
| --- | --- | --- | --- |
| 1024px | [Hero](/Users/frankenstein/Desktop/MyKustomers/MyKustomers-main-app/output/playwright/homepage-motion/chromium-1024-hero.png) | [Journey](/Users/frankenstein/Desktop/MyKustomers/MyKustomers-main-app/output/playwright/homepage-motion/chromium-1024-journey.png) | [Loyalty](/Users/frankenstein/Desktop/MyKustomers/MyKustomers-main-app/output/playwright/homepage-motion/chromium-1024-loyalty.png) |
| 1280px | [Hero](/Users/frankenstein/Desktop/MyKustomers/MyKustomers-main-app/output/playwright/homepage-motion/chromium-1280-hero.png) | [Journey](/Users/frankenstein/Desktop/MyKustomers/MyKustomers-main-app/output/playwright/homepage-motion/chromium-1280-journey.png) | [Loyalty](/Users/frankenstein/Desktop/MyKustomers/MyKustomers-main-app/output/playwright/homepage-motion/chromium-1280-loyalty.png) |
| 1440px | [Hero](/Users/frankenstein/Desktop/MyKustomers/MyKustomers-main-app/output/playwright/homepage-motion/chromium-1440-hero.png) | [Journey](/Users/frankenstein/Desktop/MyKustomers/MyKustomers-main-app/output/playwright/homepage-motion/chromium-1440-journey.png) | [Loyalty](/Users/frankenstein/Desktop/MyKustomers/MyKustomers-main-app/output/playwright/homepage-motion/chromium-1440-loyalty.png) |
| 1600px | [Hero](/Users/frankenstein/Desktop/MyKustomers/MyKustomers-main-app/output/playwright/homepage-motion/chromium-1600-hero.png) | [Journey](/Users/frankenstein/Desktop/MyKustomers/MyKustomers-main-app/output/playwright/homepage-motion/chromium-1600-journey.png) | [Loyalty](/Users/frankenstein/Desktop/MyKustomers/MyKustomers-main-app/output/playwright/homepage-motion/chromium-1600-loyalty.png) |

Completed demo and static overviews:

- 390px: [completed demo](/Users/frankenstein/Desktop/MyKustomers/MyKustomers-main-app/output/playwright/homepage-motion/chromium-390-hero-complete.png), [full static page](/Users/frankenstein/Desktop/MyKustomers/MyKustomers-main-app/output/playwright/homepage-motion/chromium-390-static-full.png), [motion recording](/Users/frankenstein/Desktop/MyKustomers/MyKustomers-main-app/output/playwright/homepage-motion/recordings/390-motion.webm).
- 1440px: [completed demo](/Users/frankenstein/Desktop/MyKustomers/MyKustomers-main-app/output/playwright/homepage-motion/chromium-1440-hero-complete.png), [full static page](/Users/frankenstein/Desktop/MyKustomers/MyKustomers-main-app/output/playwright/homepage-motion/chromium-1440-static-full.png), [motion recording](/Users/frankenstein/Desktop/MyKustomers/MyKustomers-main-app/output/playwright/homepage-motion/recordings/1440-motion.webm).

All eleven widths have hero/journey/loyalty captures for both engines under `/Users/frankenstein/Desktop/MyKustomers/MyKustomers-main-app/output/playwright/homepage-motion`. The JSON geometry report is `/Users/frankenstein/Desktop/MyKustomers/MyKustomers-main-app/output/playwright/homepage-motion/review-results.json`.

## M. Manual review URL

[Open the local production preview](http://127.0.0.1:3421/).

Review the hero, use the existing Replay demo control, and scroll to the loyalty section to see the wire/pulse. The supporting pause button controls only the newly added motion. No push, merge or deployment is part of this result.

## Documentation and final diff audit

Updated documentation: README; MASTER_PLAN; PRODUCT_SPEC; PHASES; TESTING; RESPONSIVE_QA; DESIGN_SYSTEM; CHANGELOG; PRODUCT_POSITIONING; the previous PUBLIC_HOMEPAGE_POSITIONING report; and this report. Architecture/security/data-model/migration guidance did not require changes because no corresponding authority, schema, provider or system boundary changed.

Runtime changes are limited to `app/page.tsx`, `app/homepage.module.css`, and the three new `components/homepage/homepage-motion*` files. Tests add the supporting-motion integration/browser cases and change only the old final-heading expectation in the existing homepage test. Demo, metadata, app shell, dependencies, backend and scheduler files remain unchanged.
