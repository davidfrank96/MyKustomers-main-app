# Product positioning

Status: IMPLEMENTED locally; release verification pending. Updated 2026-09-12.

Canonical audience statement:

> Built for service businesses — from independent operators to growing teams.

Where geographic context is useful:

> Built for service businesses in Nigeria and beyond.

Short contexts may use “For growing service businesses.” Describe the actual
workflow: “Manage customers, bookings, confirmations, payments, delivery and
feedback in one clear workspace.” Keep the brand **My Kustomers**.

Do not imply enterprise SLA, SSO/SAML, SCIM, procurement, dedicated account
management or enterprise compliance. Current functionality must support any
feature claim. Nigeria remains a product strength, without limiting the audience
to one geography. Transactional copy should usually say “business” or “booking”.

> My Kustomers is positioned for service businesses and growing teams without
> artificially limiting the product to “small businesses” or making unsupported
> enterprise claims.

## 2026-09-12 string audit

The initial case-insensitive search included singular/plural, hyphenated forms,
Nigerian variants, SME/SMEs and micro-business terms. It found 17 matching lines
across source, tests, documentation and one generated HTML preview.

| Location | Classification | Result |
| --- | --- | --- |
| Homepage (2 trust items) | FIXED | Service businesses; canonical audience and Nigeria statement added to hero |
| SEO title | FIXED | Booking & Customer Management for Service Businesses |
| Manifest description | FIXED | Service businesses and growing teams; identity, icons, start URL and display unchanged |
| Email footer text/HTML (2 lines) | FIXED | Service businesses; template structure unchanged |
| README and package description | FIXED | Current service-business positioning |
| Master Plan (2 lines), Product Spec | FIXED | Current positioning and canonical audience |
| Existing homepage/SEO E2E title assertions (2 lines) | FIXED | Match the current title |
| `docs/DECISIONS.md`, ADR-002 | INTENTIONAL | Historical 2026-08-18 audience research; append-only ADR history |
| `docs/PHASES.md`, Phase 9.5 acceptance criterion | INTENTIONAL | Historical usability example, not master positioning |
| `docs/PERFORMANCE_NIGERIA.md` tested SME profile | INTENTIONAL | Names the measured test profile, not an audience limit |
| `output/playwright/transactional-email-previews/booking-confirmation.html` | INTERNAL/NON-COPY | Historical generated preview, not served by the application; preserved |
| Audit wording and negative regression patterns in this change | INTERNAL/NON-COPY | Explain and enforce the copy rule, not customer-facing copy |

Shipped source (`app`, `components`, `features`, `lib`, `public`) now has zero
restrictive audience matches. Component sizes, payload limits and viewport
wording are unchanged. Structured data and Open Graph already shared the broader
SEO description; schema types remain unchanged. Signup, onboarding, dashboard,
public capability pages and admin copy contained no restrictive audience phrase.

`tests/unit/product-positioning.test.ts` scans shipped source and verifies
canonical copy/SEO/manifest consistency. Existing public-homepage E2E covers
320, 360, 375, 390, 430, 768, 1024 and 1440 pixels (and three additional widths).
