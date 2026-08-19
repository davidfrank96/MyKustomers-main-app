# Design System

STATUS: PLANNED AND PARTIALLY IMPLEMENTED

Phase 1 implemented foundational UI primitives and responsive shells. Full brand and product UI are still planned.
Phases 3 through 8 add verified product workflows for onboarding, customers,
bookings, customer confirmation links, operational booking lifecycle, private
feedback, and operational issues.

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

Not yet implemented:

- Final branding.
- Full component coverage.
- Analytics, billing, and staff-management interfaces.
