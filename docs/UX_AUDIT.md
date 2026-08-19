# Phase 9.5 UX Audit

Status: VERIFIED

Date: 2026-08-19

Scope: Product UX, design consistency, mobile responsiveness, and end-to-end
experience across authentication, onboarding, dashboard, customers, bookings,
customer confirmation, fulfilment, private feedback, operational issues, and
insights.

Explicit exclusions: Phase 10 subscription billing, customer-to-vendor payment
processing, messaging automation, exports, staff management, native mobile, and
public review publishing.

## Findings

| ID | Severity | Area | Finding | Evidence | Resolution | Status |
| --- | --- | --- | --- | --- | --- | --- |
| UX-001 | High | Navigation | Authenticated mobile and desktop navigation did not expose the current location to the user or assistive technology. | Source review of `DashboardShell`; visual audit of authenticated pages. | Added canonical dashboard navigation with Home, Bookings, Customers, Insights, and Business, plus active visual state and `aria-current="page"`. | Fixed |
| UX-002 | High | Booking detail | Booking detail stacked important sections evenly, making the current state and next operational action harder to identify. | Source review and booking detail screenshots across DRAFT, AWAITING_CUSTOMER, CONFIRMED, IN_PROGRESS, READY, DELIVERED, COMPLETED, and CANCELLED states. | Added a state-specific Next step panel near the booking header and moved lifecycle actions into that decision area. | Fixed |
| UX-003 | Medium | Link generation | Vendor confirmation and feedback link panels used implementation language about raw tokens. | Source review of confirmation and feedback link panels. | Replaced technical copy with customer-link language and preserved the one-time visibility warning. | Fixed |
| UX-004 | Medium | Money display | Nigerian Naira values could render with the `NGN` code rather than `₦`, which is less natural for local currency review. | Money formatter test expectations and visual audit of booking/insights screens. | Switched money formatting to currency-specific locales while preserving integer minor-unit storage. | Fixed |
| UX-005 | Medium | Product language | Several visible dashboard, search, and insights strings used internal tenancy terms. | Source scan for `tenant`, `tenant-scoped`, and related terms in app-facing code. | Replaced internal terms with owner-facing copy such as saved customers, saved bookings, and bookings that need attention now. | Fixed |
| UX-006 | Medium | Public feedback | Unavailable feedback-link messaging did not tell customers what to do next. | Source review of public feedback messages. | Added a safe recovery instruction asking the customer to contact the business for a new link. | Fixed |
| UX-007 | Low | Onboarding | Onboarding completion copy implied customer and booking tools were still future-only even though they are implemented. | Source review of `/onboarding`. | Updated the copy to direct owners toward adding customers and bookings next. | Fixed |
| UX-008 | Low | Canonical journey | Existing E2E coverage tested important paths but did not clearly express one complete business-to-customer-to-insights product journey. | Review of Playwright booking, feedback, issue, and insights tests. | Strengthened the booking E2E to create a customer, create a booking, confirm it, complete fulfilment, collect feedback, resolve an issue, and verify insights. | Fixed |

## Visual Review

The Phase 9.5 visual audit inspected the core workflow at mobile widths
375px, 390px, and 430px, tablet width 768px, and desktop width 1365px.

Reviewed areas:

- Login and signup.
- Business onboarding.
- Dashboard empty and populated operational states.
- Customer list, creation, and detail.
- Booking list, creation, detail, confirmation-link, lifecycle, feedback, and
  issue states.
- Public confirmation and feedback pages.
- Insights.
- Business profile.

Result: No horizontal overflow was detected in the audited viewports. No
blocking UX issue remains in Phase 9.5 scope.
