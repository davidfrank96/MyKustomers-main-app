# Homepage headline loop — 2026-09-16

Status: IMPLEMENTED AND VERIFIED LOCALLY. No push, merge or deployment in this task.

## Changed files

- `app/page.tsx`: wraps the existing h1 in the decorative component.
- `app/homepage.module.css`: transfers the h1 top margin to its wrapper.
- `components/homepage/homepage-headline-loop.tsx`: server-rendered SVG and icons.
- `components/homepage/homepage-headline-loop.module.css`: path, motion and spacing.
- `tests/e2e/homepage-motion.spec.ts`: explicit initial visibility for the offscreen case.
- This report plus `DESIGN_SYSTEM.md`, `RESPONSIVE_QA.md`, `TESTING.md` and
  `CHANGELOG.md`: scope, behavior and local verification evidence.

## Scope and implementation

The only product change is a decorative loop around the existing homepage h1.
`HomepageHeadlineLoop` renders a thin muted-green SVG curve and five Lucide
journey icons: request, confirmation, updates, delivery and feedback. Its CSS
module moves evenly spaced, upright icons around the matching rounded path over
64 seconds at constant speed. It adds no dependency, client component, timer,
per-frame JavaScript or React state.

The wrapper reserves its own clearance before hydration. The h1's existing
22px top margin moves to that wrapper; its text and typography stay unchanged.
Compact icons and padding serve narrow screens, and the wider layout uses the
existing hero gutter to retain desktop headline wrapping and short-screen CTAs.
The curve becomes shallower when the headline has longer lines.

The existing homepage motion controller observes the added headline region.
It pauses the CSS animation offscreen and while the document is hidden. Its
existing supporting-motion control also stops this loop. Reduced motion,
including a preference change during playback, and JavaScript-disabled visits
receive five static icons. The decorative subtree is aria-hidden, has no live
region and introduces no focusable controls.

The header, copy, CTA destinations, existing product-demo implementation,
supporting-motion implementation, lower sections, metadata, routes, backend,
dependencies and scheduler are unchanged. No production data or provider access
was needed for this task.

## Verification

The optimized Next build ran in an isolated workspace with loopback fixture
configuration. The user's existing server was left alone. Evidence is under
`output/playwright/hero-loop/` (ignored local artifacts).

- Chromium and WebKit: 320, 360, 375, 390, 414, 430, 440, 449, 450, 480,
  540, 599, 600, 639, 640, 768, 820, 1023, 1024, 1280, 1366, 1440 and 1600px.
  Every icon was sampled at 250ms intervals throughout the 64-second cycle.
  No word/icon intersections, viewport clipping or horizontal page overflow;
  the start/end positions match. `chromium-geometry.json` and
  `webkit-geometry.json` contain the measurements.
- Both engines pass actual playback, unchanged headline bounds during motion,
  offscreen pause and timeline-preserving resume, existing user pause/resume,
  live reduced-motion switching, static no-JavaScript rendering and decorative
  semantics. No page errors were observed in these probes.
- Alignment review: final static screenshots at 320, 390, 768 and 1440px;
  active-motion screenshots across the matrix. Existing CTA regression cases
  pass at 320×568, 360×640, 390×600, 430×650, 1024×600 and 1366×650.
- Existing public-homepage and homepage-motion E2E: **17 passed, 1 existing
  skip** across Chromium and mobile Chromium. The skip avoids duplicating the
  permanent viewport matrix in the mobile project. Copy, metadata, destinations,
  keyboard controls, demo playback and lower-section checks remain intact.
- Homepage controller and product-demo integration tests: **16 passed**.
- Production build and TypeScript: **passed**. Full lint: **0 errors**, with
  seven existing warnings in earlier ignored QA scripts. Changed TypeScript
  files pass targeted lint without warnings.

The offscreen E2E's starting state needed an explicit `scrollIntoViewIfNeeded()`.
A failing capture showed `/#features` with `scrollY: 0`, placing the demo just
below the short viewport while the observer correctly paused it. The test now
puts its subject in view before asserting playback, then performs every original
offscreen/SMIL/timeline assertion. The separate CTA/hash navigation assertions
are unchanged and pass. No application routing or motion controller was changed.

These are local browser-engine checks, not physical-device or hosted-release
certification. Alignment, responsive, motion and scoped regression passes are
complete for this implementation.
