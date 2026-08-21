# Design System

STATUS: PLANNED AND PARTIALLY IMPLEMENTED

Phase 1 implemented foundational UI primitives and responsive shells. Full brand and product UI are still planned.
Phases 3 through 9 add verified product workflows for onboarding, customers,
bookings, customer confirmation links, operational booking lifecycle, private
feedback, operational issues, and business insights.

## Design Philosophy

My Customers should feel:

- Modern.
- Premium.
- Simple.
- Trustworthy.
- Friendly.
- Professional.
- Calm.
- Mobile-first.

Avoid:

- Generic admin-dashboard appearance.
- Excessive gradients.
- Excessive glass effects.
- Unnecessary decorative charts.
- Overloaded cards.
- Tiny touch targets.
- Dense enterprise UI.

## Responsive Behavior

The vendor application is mobile-first. Mobile authenticated navigation is expected to use a bottom-navigation concept. Desktop may use sidebar navigation.

Customer-facing booking experiences should be significantly simpler than the vendor dashboard. They should open directly in the browser, require no account by default, and expose only the booking-specific information required for the action.

Current structural rules:

- Page content must not create horizontal document overflow at 320px or wider.
- Flex and grid children containing user data must shrink with `min-width: 0`;
  long identifiers and contact values wrap or truncate intentionally.
- Multi-field and mode controls stack on narrow screens without resetting form
  state or hiding primary actions.
- Dialogs and sheets fit the dynamic viewport and allow vertical scrolling.
- Mobile navigation preserves reachable content and safe-area padding.

Required viewport and route evidence is recorded in `docs/RESPONSIVE_QA.md`.
These rules stabilize the current design and do not start the broad redesign.

## Current Implementation Evidence

Implemented in Phase 1:

- Shared UI primitives in `components/ui`.
- Layout components in `components/layout`.
- Mobile bottom-navigation concept in the dashboard shell.
- Desktop sidebar concept in the dashboard shell.
- Basic PWA metadata and manifest.
- Business onboarding, customer management, booking management, customer
  confirmation, operational booking lifecycle, private feedback, and internal
  issue screens built on the shared primitives.
- Authenticated business insights screen with mobile-first metric cards,
  currency-separated value lists, text-backed comparisons, accessible simple
  bars, and native date-range controls.

Not yet implemented:

- Final branding.
- Full component coverage.
- Billing and staff-management interfaces.
