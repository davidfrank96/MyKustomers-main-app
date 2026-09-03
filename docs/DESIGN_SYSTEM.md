# Design System

STATUS: IMPLEMENTED, WITH APPROVED MOBILE REDESIGN UNDER BRANCH REVIEW

Phase 1 implemented foundational UI primitives and responsive shells. The
current brand and approved mobile workspace system are implemented; future work
may refine them without changing the product name or domain contract.
Phases 3 through 9.5 add verified product workflows for onboarding, customers,
bookings, customer confirmation links, operational booking lifecycle, private
feedback, operational issues, business insights, and product UX refinement.

## Design Philosophy

My Kustomers should feel:

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

## Brand And Domain

- The product name rendered to users is `My Kustomers`.
- The public domain attribution is `MyKustomers.com`; `MyCustomers.com` must not
  appear in product UI, public pages, email copy, metadata, or screenshots.
- Compact application marks use `MK`. Business-logo fallbacks continue to use
  the business name's own initials.
- Internal package names, database identifiers, migration history, and protocol
  header names are implementation details and must not leak into user-facing copy.

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
- Primary authenticated navigation acknowledges the selected destination
  immediately with text-accessible pending state. The loading surface names the
  destination without changing the icon footprint, while important rows and
  bounded secondary detail may stream without shifting the shell. Pending state
  is framework-owned per Link and ends with that destination navigation;
  semantic browser and modifier-click behavior remains native. Primary
  navigation pending state represents navigation to a destination, not
  completion of all streamed data for the current route. Ordinary authenticated
  route streaming must not unnecessarily disable unrelated primary navigation
  destinations.
- A business switch hides the previous workspace with an opaque pending layer;
  stale tenant data must never remain visually presented as the selected tenant.

Required viewport and route evidence is recorded in `docs/RESPONSIVE_QA.md`.

## Approved Mobile Workspace System

The `ui/mobile-redesign` branch applies the approved mobile redesign package to
the existing product without changing domain behavior. The repository remains
the functional source of truth; generated references cannot introduce fields,
actions, routes, lifecycle states, or analytics that the product does not
support.

The mobile workspace uses:

- one compact authenticated shell with exactly five primary destinations;
- `WorkspacePage`, `WorkspacePageHeader`, and `WorkspaceSectionHeader` for
  consistent page rhythm and hierarchy;
- compact linked dashboard metrics and one grouped needs-attention surface;
- grouped, scan-oriented customer and booking rows rather than nested cards;
- a bounded quick-filter set with less-common booking states disclosed under
  More statuses;
- an action-first booking journey with secondary operational detail in existing
  accessible disclosures;
- restrained neutral surfaces, dark-green primary actions, subtle borders and
  shadows, and zero negative letter spacing;
- structural loading states that retain the redesigned page geometry.

Approved visual references guide presentation only. Existing confirmation,
payment, lifecycle, add-on, feedback, search, pagination, multi-business, logo,
authorization, and tenant-isolation behavior is unchanged.

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
- Approved mobile redesign of Dashboard, Bookings, Booking detail, Customers,
  Insights, Business, and Add another business, using the shared workspace
  components and preserving existing product contracts.
- Operational timeline presentation uses the shared Booking-detail disclosure,
  a compact semantic vertical event list, restrained type-specific Lucide icons,
  an adaptive connector, real timestamps, and naturally wrapping event detail.
  Its count, ordering, labels, and mixed status/change/amendment/add-on content
  remain derived from the existing authoritative server data.

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
stacked mobile actions. The visible Choose image control is a semantic label for
a unique, visually hidden but focusable native input; browser picker activation
must never wait for asynchronous work or synthetic `.click()`. Pending state is
announced with `aria-busy`; failures
use an in-app alert, restore the controls, and provide an explicit retry. The
UI distinguishes bounded client preparation from the 120-second network request
without exposing compression internals. Users may select supported sources up
to 5 MiB; large sources are reduced to a <=3 MiB transport intermediate before
upload. This lowers mobile transfer cost and avoids Vercel's request ceiling.
Image validation, final quality, 512px output, and 200 KiB storage policy remain
authoritative in the shared server processor, not viewport-specific browser
code.

Booking-completion success uses one compact application-owned dialog with a
success icon, concise title/description, and one Done action. It is
presentational feedback for a newly observed authoritative transition into
`COMPLETED`; an already-completed initial render or refresh never opens it. The
existing dialog primitive supplies focus containment, Escape, outside
dismissal, and focus return. Motion is optional and must have a reduced-motion
equivalent.
