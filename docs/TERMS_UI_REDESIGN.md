# Terms presentation refactor — 12 October 2026

Status: VERIFIED LOCALLY — not released.

## Content and route boundary

The 16 existing section headings, paragraphs, ordering, punctuation and both
8 October 2026 dates are unchanged. The approved reference controls presentation
only. No new legal introduction or clause was added. The section source is
byte-for-byte equal to main `1aa41cc`; an immutable SHA-256 regression fixture
checks it. `/terms`, canonical metadata, public access and indexing are retained.

## Presentation and accessibility

The server page uses the approved BrandLogo, a safe same-origin Back action with
home fallback, a constrained document column and paired date blocks. A small
client disclosure follows the existing booking disclosure button/ARIA pattern,
without importing booking lifecycle/context concerns into the public document.
The first section starts open; all 16 full paragraphs remain in server HTML.
Previews render the same content with CSS clamping and are hidden from assistive
technology to avoid reading duplicates. Expanded bodies are not truncated.
Buttons expose numbered names, expanded state, controls and visible focus;
native Enter/Space activation works. Print reveals all paragraphs and suppresses
previews. The canonical page scrolls normally. The existing optional Terms
modal retains its focus trap, Escape/close behavior and full-page link.

## Verification

TERMS ALIGNMENT GATE: PASS

TERMS UI POLISH GATE: PASS

Manual review covers brand/title/date alignment, badges, card edges, chevrons,
body indentation, borders, radius, focus and whitespace. It caught and fixed
a focus-outline/body collision. A browser print test caught the reset’s hidden
rule; the scoped print override now works in the reset’s CSS layer.

Verified matrix:
320×568, 360×800, 375×812, 390×844, 414×896, 430×932, 768×1024,
1024×768, 1280×800 and 1440×900 in Chromium and WebKit.
Screenshots: `output/playwright/legal/{chromium,webkit}/terms-{width}-{first,later}.png`
for widths 320, 390, 430, 768, 1024 and 1440. These are local, ignored artifacts.

No dependency, backend, auth, booking, or provider behavior changes in this first
pass. Rescheduling, WhatsApp diagnosis and About follow only after this pass.

Lint: zero errors, one pre-existing unused-import warning in the WhatsApp fixture.
Typecheck, optimized production build and `git diff --check`: pass.
Full unit/integration suite: 1,197 passed, 24 guarded tests skipped, zero failures
(185 passed files, 21 skipped files). Focused browser suite: six passed, zero
failures/skips across Chromium and WebKit. The matrix loops cover all ten widths
per browser, with modal focus/scroll, canonical route, SSR text, keyboard,
expanded-content bounds, minimum 15px body text, Back and print assertions.
The final focused browser run reused the immediately preceding optimized build;
no application code changed between that build and the final run.

No Terms of Service legal content, section meaning, effective date, last-updated
date, or legal responsibility language was rewritten or removed.

## Files in this first pass

- `app/terms/page.tsx`
- `app/globals.css` (scoped legal focus/print only)
- `components/legal/terms-content.tsx`
- `components/legal/legal-section.tsx`
- `components/legal/legal-back-link.tsx`
- `tests/integration/legal-content.test.tsx`
- `tests/profile-ui/legal.spec.ts`
- `tests/e2e/preproduction-stability.spec.ts`
- `docs/TERMS_UI_REDESIGN.md`, `docs/DESIGN_SYSTEM.md`, `docs/RESPONSIVE_QA.md`,
  `docs/TESTING.md`, `docs/CHANGELOG.md`

## Screenshot inventory

Root: `/Users/frankenstein/Desktop/MyKustomers/MyKustomers-legal-reschedule-whatsapp/`.
Both browsers also have viewport captures for visual review.
- `output/playwright/legal/chromium/terms-320-first.png`
- `output/playwright/legal/chromium/terms-320-later.png`
- `output/playwright/legal/chromium/terms-390-first.png`
- `output/playwright/legal/chromium/terms-390-later.png`
- `output/playwright/legal/chromium/terms-430-first.png`
- `output/playwright/legal/chromium/terms-430-later.png`
- `output/playwright/legal/chromium/terms-768-first.png`
- `output/playwright/legal/chromium/terms-768-later.png`
- `output/playwright/legal/chromium/terms-1024-first.png`
- `output/playwright/legal/chromium/terms-1024-later.png`
- `output/playwright/legal/chromium/terms-1440-first.png`
- `output/playwright/legal/chromium/terms-1440-later.png`
- `output/playwright/legal/webkit/terms-320-first.png`
- `output/playwright/legal/webkit/terms-320-later.png`
- `output/playwright/legal/webkit/terms-390-first.png`
- `output/playwright/legal/webkit/terms-390-later.png`
- `output/playwright/legal/webkit/terms-430-first.png`
- `output/playwright/legal/webkit/terms-430-later.png`
- `output/playwright/legal/webkit/terms-768-first.png`
- `output/playwright/legal/webkit/terms-768-later.png`
- `output/playwright/legal/webkit/terms-1024-first.png`
- `output/playwright/legal/webkit/terms-1024-later.png`
- `output/playwright/legal/webkit/terms-1440-first.png`
- `output/playwright/legal/webkit/terms-1440-later.png`
