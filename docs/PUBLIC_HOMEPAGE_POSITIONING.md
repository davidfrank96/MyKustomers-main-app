# Public homepage positioning — 2026-09-15

Status: IMPLEMENTED — VERIFIED LOCALLY — MANUAL REVIEW PENDING.

Local branch: `chore/public-homepage-positioning`, based on main merge `a2b1605a5e15c4f49e3d9ae5a70663bdbcd923f5`. No push, merge or Production deployment was performed.

## Result and references

The public homepage follows the supplied desktop and mobile references: a simplified branded header, outcome-first hero, existing product animation inside responsive device framing, one five-step journey, a green final CTA and a compact footer. It uses the requested MyKustomers copy verbatim and preserves the supplied brand assets. Desktop uses a split hero with laptop framing from 1024px; smaller widths use centered copy and phone framing. No static replacement screenshot, new brand image, stock photo or extra product section was introduced.

The previous feature/audience/explainer blocks are consolidated into the requested short marketing story. Existing authenticated product features are unchanged. Header anchors remain functional: Features points to the demo, How it works to the journey, and For businesses to the final CTA. Get started still opens `/signup`; Log in still opens `/login`. The existing mobile secondary CTA uses `#features`; its desktop equivalent retains `#how-it-works`.

## Preserved animation

There is still one `HomepageProductDemo` instance with the existing booking → confirmation email → work → private feedback → insights sequence and timings. Pause, resume, replay, offscreen pausing, hidden-document pausing, observer cleanup and timer cleanup remain. The fixture greeting is Alex, matching the reference direction; no live customer or booking data is fetched.

A stricter browser check reproduced a reduced-motion timing race: the Pause control was correctly hidden, but a queued playback update could leave the preview at its initial Created state. The rendered step now follows the active reduced-motion preference directly. The sequence and timing for normal playback are unchanged. Eight component tests cover existing behavior and switching reduced motion on during playback.

## Scope and metadata

Runtime changes are limited to the homepage, its demo, two scoped CSS modules and homepage-specific SEO. `HOMEPAGE_SEO` supplies the requested title and description to page metadata, Open Graph, X and WebApplication JSON-LD. Homepage schema names use MyKustomers. The canonical origin, brand/social image assets, shared `SEO_SITE` app defaults, root layout, private/capability metadata, Auth, backend, database, notifications and scheduler are unchanged. No dependency or environment file was changed.

## Verification

| Check | Result |
| --- | --- |
| Optimized `npm run build`, including TypeScript | PASS; homepage remains statically prerendered |
| ESLint on every changed TypeScript/TSX file | PASS |
| Focused demo, positioning and SEO unit/component tests | 15 PASS |
| Homepage + anonymous app/Auth entry E2E against optimized local build | 5 PASS |
| Permanent Chromium homepage matrix | 320, 360, 375, 390, 414, 430, 768, 1024, 1280, 1440, 1600px PASS |
| Additional optimized-build Chromium and WebKit matrix | All eight requested widths PASS in both engines |
| Real browser demo replay, pause and resume | PASS in Chromium and WebKit |
| Page errors during the final two-engine walkthrough | 0 |
| Strict document width and hero/demo geometry | PASS |
| Final diff integrity and public-surface scope | PASS |

The initial 320px overflow came from a rotated decorative background shape. Removing that rotation fixed the source; no page-level overflow hiding was added. A new metadata test initially expected a trailing slash that Next.js omits from the existing canonical serialization; the test now checks the actual unchanged canonical URL.

Visual review covered the optimized-build screenshots, including 320/390/430 mobile, 768 tablet and 1024/1440 desktop. CSS framing adapts without duplicating the demo. Illustrative activity rows retain their compact preview typography and existing truncation of secondary text. Mobile footer and CTA layouts wrap within their available width.

No full unrelated product suite or live backend fixture was run for this homepage-only pass. Existing anonymous dashboard protection and login/signup rendering were checked; authenticated app behavior is supported by unchanged source and the successful application build, not a new live authenticated audit. Physical devices were not used.

## Review artifacts

- Local optimized preview: [http://127.0.0.1:3421](http://127.0.0.1:3421).
- [Mobile, 390px](../output/playwright/homepage-positioning/chromium-390.png).
- [Desktop, 1440px](../output/playwright/homepage-positioning/chromium-1440.png).
- All eight screenshots for each engine: `output/playwright/homepage-positioning/{chromium,webkit}-{width}.png`.
- Geometry/control/error evidence: `output/playwright/homepage-positioning/review-results.json`.
- Additional permanent-test screenshots: `test-results/public-homepage/homepage-{width}.png`.

These are local review artifacts and are not served as homepage assets.

## Files changed

Application and homepage presentation:

- `app/page.tsx`
- `app/homepage.module.css` (new)
- `components/homepage/homepage-product-demo.tsx`
- `components/homepage/homepage-product-demo.module.css` (new)
- `lib/seo/site.ts` (homepage constant and homepage JSON-LD only)

Affected tests:

- `tests/e2e/public-homepage.spec.ts`
- `tests/e2e/app-loads.spec.ts`
- `tests/e2e/brand-rollout.spec.ts` (homepage headline assertions only)
- `tests/integration/homepage-product-demo.test.tsx`
- `tests/unit/product-positioning.test.ts`

Documentation:

- `README.md`
- `docs/MASTER_PLAN.md`
- `docs/PRODUCT_SPEC.md`
- `docs/PHASES.md`
- `docs/CHANGELOG.md`
- `docs/TESTING.md`
- `docs/RESPONSIVE_QA.md`
- `docs/PRODUCT_POSITIONING.md`
- `docs/SEO.md`
- `docs/PUBLIC_HOMEPAGE_POSITIONING.md` (this report)

## Open items

Manual visual approval is pending. No known blocking homepage issue remains in the tested browser/viewport matrix. Production publication is intentionally outside this task.
