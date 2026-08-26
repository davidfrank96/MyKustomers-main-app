# Design System

STATUS: PLANNED AND PARTIALLY IMPLEMENTED

Phase 1 implemented foundational UI primitives and responsive shells. Full brand and product UI are still planned.
Phases 3 through 9.5 add verified product workflows for onboarding, customers,
bookings, customer confirmation links, operational booking lifecycle, private
feedback, operational issues, business insights, and product UX refinement.

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

The authenticated product navigation is Home, Bookings, Customers, Insights,
and Business. Active navigation state must be visible and exposed with
`aria-current` on both mobile and desktop. Settings can remain secondary until a
future settings phase expands it into a first-class workflow.

Customer-facing booking experiences should be significantly simpler than the vendor dashboard. They should open directly in the browser, require no account by default, and expose only the booking-specific information required for the action.

Current structural rules:

- Page content must not create horizontal document overflow at 320px or wider.
- Flex and grid children containing user data must shrink with `min-width: 0`;
  long identifiers and contact values wrap or truncate intentionally.
- Multi-field and mode controls stack on narrow screens without resetting form
  state or hiding primary actions.
- Dialogs and sheets fit the dynamic viewport and allow vertical scrolling.
- Mobile navigation preserves reachable content and safe-area padding.
- Searchable lists and entity pickers update after a short shared debounce rather
  than requiring an explicit Search action. URL-backed list search uses replace
  history, preserves compatible filters, resets pagination, and exposes compact
  labeled clear and pending controls without shifting the layout.
- Major asynchronous route transitions use neutral structural placeholders with
  stable responsive dimensions. Placeholder controls are not focusable,
  animation respects reduced motion, and one accessible status names the load.
- A business switch hides the previous workspace with an opaque pending layer;
  stale tenant data must never remain visually presented as the selected tenant.

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
- Phase 9.5 active navigation, owner/customer copy cleanup, booking detail
  next-step hierarchy, natural NGN currency rendering, and responsive visual
  audit across 375px, 390px, 430px, 768px, and desktop widths.
- Reusable dashboard/list/detail/form loading structures for Dashboard,
  Bookings, Customers, Insights, Business, and creation/detail transitions,
  plus tenant-switch pending protection.

Current copy rules:

- Avoid internal implementation language in visible product copy, including
  token internals, database/security acronyms, and tenancy implementation
  details.
- Use booking consistently for the primary work record in the vendor product.
- Use recorded value, recorded deposit, balance, and completed booking value
  rather than payment-verified, revenue, profit, cash received, tax, or
  accounting claims.
- Public customer pages should be shorter and simpler than authenticated vendor
  pages and should always provide safe next steps for unavailable links.
- Booking detail uses a vertical semantic ordered-list stepper at mobile and
  desktop widths. Completed, current, upcoming, waiting, and cancelled states
  include text as well as color/icon treatment.
- The journey action area keeps the valid lifecycle action prominent and
  full-width on narrow screens. Cancellation and related booking operations are
  grouped under secondary actions.
- Booking Journey remains visible on booking detail. Secondary sections use
  button-based disclosures with `aria-expanded`, controlled regions, visible
  focus, concise status summaries, and at least 56px header height.
- A fresh booking-detail load opens the one contextually relevant section. Users
  may close it and open multiple secondary sections independently; ordinary
  rerenders must not fight their choice.
- User-facing delivery timing uses `Scheduled delivery date`; new money fields
  start empty with `Enter amount` and `Optional` placeholders.

Not yet implemented:

- Final branding.
- Full component coverage.
- Billing and staff-management interfaces.

## Critical Confirmations

Lifecycle-critical confirmations must use accessible application-owned
confirmation UI rather than browser-native confirm/alert/prompt dialogs. Use the
existing Radix dialog primitives for title/description semantics, focus
trapping, Escape, outside interaction, and trigger focus return. Keep the final
terminal action explicit, disable competing actions while pending, and render
recoverable errors inside the dialog.

At mobile widths, dialog actions stack to full width inside the viewport-height
scroll boundary. File-upload previews and controls must also remain contained at
320 pixels.

Business-logo controls use the shared bounded preview, native file input, and
stacked mobile actions. Pending state is announced with `aria-busy`; failures
use an in-app alert, restore the controls, and provide an explicit retry. The
120-second request bound accommodates slower mobile uploads without allowing an
indefinite `Saving...` state. Image quality and storage policy belong to the
shared server processor, not viewport-specific browser code.
