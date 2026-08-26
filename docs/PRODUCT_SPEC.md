# Product Specification

## Status

STATUS: PLANNED

This document describes product intent and domain concepts. It is not implementation evidence.

## Product Summary

My Customers helps small businesses turn informal customer conversations into organised business records.

The platform is not replacing WhatsApp, Instagram, phone calls, or direct messages. It captures the structured agreement after the vendor and customer have reached an agreement externally.

## Core Actors

### Platform User

An authenticated My Customers user.

Platform users may authenticate with email/password or, when the Supabase Google
provider is configured, Google OAuth. Both methods resolve to the same
`auth.users.id`, profile provisioning, memberships, onboarding, tenant routing,
and logout behavior. Google is a convenience method, not a replacement for
email/password.

Examples:

- Business owner.
- Staff member.
- Future platform administrator.

### Business

A tenant within My Customers.

A platform user may eventually belong to one or more businesses. Do not assume one-user-one-business unless a later accepted decision explicitly does so.

The authenticated Business page is the discoverable management surface for
active memberships: it shows identity, owner/member role, the current business,
switch actions for other memberships, and the existing additional-business
flow. The authenticated header remains the quick-switch surface.

### Customer

A customer belongs to a business.

A customer is not normally an authenticated My Customers user. Customer records may contain name, phone, email, customer history, and related bookings.

### Booking

The booking/order is the central business domain object.

Permanent product rule:

> Every booking belongs to a customer. A vendor may select an existing customer
> or create a new customer inline during booking creation.

New Booking offers an explicit choice between an active existing customer and a
minimal new customer. A new customer requires a name; email and phone remain
optional. Potential exact active-customer matches are warnings, not automatic
merges, and the vendor must choose whether to reuse or create separately.

Both modes use one authenticated database transaction. New-customer mode
atomically creates the customer, booking, trigger-owned status history, and
required audits; any booking failure rolls back all effects. Tenant authority is
derived server-side, existing customers must be active and belong to the current
business, and archived customers cannot be selected or supplied to the RPC.

Conceptual relationship:

```text
Customer
    |
    v
Booking
    |
    v
Confirmation
    |
    v
Fulfilment
    |
    v
Completion
    |
    v
Feedback
    |
    v
Analytics
```

## Booking Philosophy

The vendor creates the booking. The customer does not independently define the agreed booking terms inside My Customers.

Conceptual workflow:

```text
Vendor and customer agree externally
        |
        v
Vendor selects or creates the customer and creates booking
        |
        v
Vendor sends confirmation link
        |
        v
Customer reviews
        |
        v
Customer confirms
        |
        v
Booking becomes operational
```

Material booking changes after customer confirmation must be handled explicitly and must not silently replace the terms originally confirmed.

Phase 6 implements the first customer confirmation workflow. Vendors generate a
secure link for an eligible booking, the customer reviews a minimized public
booking view without an account, and confirmation moves the booking from
`AWAITING_CUSTOMER` to `CONFIRMED`. Material changes after confirmation require
a new customer confirmation; internal notes are private vendor data and do not
affect confirmed terms.

Confirmation requires a normalized customer-provided contact email and accepts
an optional phone number. These values are booking confirmation evidence, not
proof of email or phone ownership. Empty customer contact fields may be enriched
from the submission, but an existing different value is never silently
overwritten. A booking-confirmed email event is committed atomically and
delivered after commit; delivery failure does not change the confirmed booking.
Customers still do not create accounts or complete OTP verification.

The submitted email is authoritative for that booking and remains the first
recipient source for later booking communications. It is separate from the
vendor-managed customer profile contact: a different submission is shown as
booking-specific evidence but does not promote itself to the canonical profile.
No preferred-contact, multi-email, ownership-verification, merge, or hidden
contact-history model is implied.

Once customer-confirmed, material booking terms cannot be silently edited.
Customer, title, customer-facing description, currency, total, deposit, and
schedule are agreement fields. Internal notes remain internal and editable
until the booking becomes terminal. Explicit rescheduling is a controlled
workflow that invalidates current confirmation and requires reconfirmation; it
is not an ordinary edit.

Cancelling a customer-confirmed booking is a lifecycle transaction with a
required bounded plain-text reason. It preserves the original confirmation
evidence and atomically queues one `BOOKING_CANCELLED` email to the immutable
confirmation contact, falling back to current customer email only for legacy
evidence without contact. Delivery failure changes only outbox state. Email
wording never claims that My Customers issued or controls a refund.

Phase B implements explicit amendments for `CONFIRMED` and `IN_PROGRESS`
bookings. The vendor submits a structured proposed title, customer-facing
description, currency, agreed total, deposit recorded, and/or schedule with a
reason. The canonical booking and current agreement remain unchanged while the
request is pending. The customer sees labeled Current and Proposed values through
a separate secure link; atomic confirmation applies the proposal only if its base
agreement hash still matches. Customer reassignment and internal notes are not
amendment terms.

At most one amendment may be pending per booking. Replacement, vendor revoke,
booking cancellation, advancement to `READY`, and explicit reschedule invalidate
the pending request. `READY`, `DELIVERED`, `COMPLETED`, and `CANCELLED` bookings
cannot accept amendments. V1 has no rejection/chat flow; a vendor may revoke and
replace a proposal. Analytics use the resulting current booking values once.

Phase C implements linked add-ons for new scope on `CONFIRMED` and
`IN_PROGRESS` bookings. Add-ons do not rewrite the parent booking or amendment
evidence. They inherit the parent currency and current delivery schedule, use
integer minor-unit amounts, and remain excluded from effective totals until a
customer confirms their separate secure request. Confirmed add-ons are
immutable and contribute to current value, recorded deposit, balance, and
currency-grouped analytics without increasing booking count.

Only one add-on may await customer confirmation per booking, and a pending
amendment and pending add-on cannot coexist. Rescheduling, cancellation, or
advancement to `READY` cancels pending add-ons and revokes their links. An item
needing a separate delivery or fulfilment lifecycle is a new booking. Confirmed
add-on correction/cancellation, catalog/inventory, and payment handling are not
part of Phase C.

The vendor shares a newly generated link through a contextual message rather
than a naked URL. The message is editable while the secure URL remains
application-controlled; supported destinations are native system share,
WhatsApp, Telegram, copy message, and copy link. Social previews identify only
the public business name/logo and confirmation purpose. A selected share method
is not a delivery/read receipt, and first viewed means the customer-facing page
hydrated and recorded its first valid open.

Phase 7 implements the first operational fulfilment workflow. After customer
confirmation, the vendor can start work, mark the booking ready, mark it
delivered, and complete it. Vendors can cancel active operational bookings with
a reason. Vendors can reschedule before fulfilment begins; rescheduling a
confirmed booking requires customer reconfirmation.

Phase 8 implements the first private feedback and operational issue workflow.
After a booking is completed, the vendor can generate a secure feedback link.
The customer can submit private feedback without an account, and that feedback
is visible only to the owning business. Vendors can also record and resolve
internal operational issues on bookings. Feedback is not public review content,
and issues are not customer-facing support tickets.

Phase 9 implements private business insights derived from stored customer,
booking, feedback, and issue records. Insights are deterministic,
tenant-scoped, and intended to help the vendor understand operational activity.
Financially-related metrics use recorded booking value and completed booking
value terminology, not revenue, cash, profit, tax, or accounting claims.
Currency values are grouped by currency and never converted or summed across
currencies.

Phase 9.5 verifies and tightens the implemented product experience before
billing begins. The authenticated vendor workflow should read as one coherent
loop: set up the business, save a customer, create a booking, send a customer
confirmation link, fulfil the booking, complete it, request private feedback,
record operational issues when needed, and review private insights. Visible
product copy should use owner/customer language and avoid implementation terms.
When a vendor enters a whole local-currency amount such as `45000`, the
interface should display it naturally, for example `₦45,000`, without implying
payment verification or accounting revenue.

## Business Identity And Account Access

Implemented and verified cross-phase maintenance gives authenticated users a
compact account menu for mobile-accessible Settings and the existing logout
flow without adding a sixth primary bottom-navigation item. Settings exposes
only implemented account/session and business-profile destinations.

A business may optionally store a normalized HTTP/HTTPS website, its existing
Instagram handle, and one current logo. Logo input is raster-only and is
selectable up to 5 MiB. Sources above the 3 MiB transport boundary are reduced
in the browser before upload to stay below Vercel's request ceiling. The server
independently validates received content, resizes without distortion, converts
to metadata-free WebP no larger than 512px/200 KiB, and stores one public
business asset with owner-only mutations. Client preprocessing is not an
authorization or image-validation boundary. Secure booking
confirmation pages may display business name, logo/fallback initials, website,
and Instagram as secondary trust links; booking review and confirmation remain
the primary customer task. WhatsApp remains a business contact field and is not
added as a new public confirmation link in this pass.

## Customer Experience Principle

Customer-facing flows should generally:

- Require no My Customers account.
- Open directly in the browser.
- Be mobile optimized.
- Expose only data required for the specific booking.
- Use secure temporary or scoped access mechanisms.

The customer should not be forced to install an application.

## Current Exclusions

V1 does not process payment between a vendor and their customer. Vendor subscription billing is separate and belongs to a later phase.

PDF confirmations, progress/ready/completion emails, feedback email, and actual
contact ownership verification or OTP are not part of the current foundation.

## Multi-Business Account Rule

An authenticated account may operate more than one independent business. The
application restores the last selected active membership, chooses the sole
membership automatically, and uses deterministic fallback for a missing or
revoked preference. The header switcher is available on mobile and desktop and
shows each business identity and membership-specific role. Creating another
business produces a separate owner workspace and never copies tenant data.

The selected-business cookie is convenience state, not authority. Server
membership checks and database RLS decide access. Staff invitations, membership
administration, business deletion, cross-business analytics, and billing remain
outside this feature.

## Platform Administrator

A platform administrator operates My Customers itself and is not a tenant
business role. Admin authorization recognizes only an `ACTIVE SUPER_ADMIN` record in
`platform_admins`. Owning or belonging to any number of businesses grants no
platform authority, and an administrator may have zero business memberships.
The verified Phase 2 surface is a protected, read-only operations overview.
Admin Phase 3 adds read-only, searchable, server-paginated Businesses and Users
support views. Business views expose business identity, active memberships, and
aggregate operations only. User views expose an explicit safe projection of
profile name, email, account timestamps, provider names, membership relations,
and the viewed user's own platform-admin badge where applicable. Raw Auth rows,
identity payloads, sessions, tokens, customer lists, booking terms, financial
totals, impersonation, editing, suspension, and deletion are not product
capabilities. The Phase 3 read-only data contract and browser journey are
verified in production from PR #15 and merge `4437a161`.

Admin Phase 4 adds read-only Bookings and Issues support views. Platform admins
can search and filter booking lifecycle records, inspect confirmation,
amendment, add-on, change, status, cancellation, structured feedback, issue, and
email-state summaries, and follow business/booking/user context links. Effective
value is the canonical booking total plus confirmed add-ons. Customer identity
is name-only; there is no customer admin directory. Directories exclude contacts
and private descriptions, while authorized detail responses omit internal
notes, raw terms, tokens/hashes, feedback comments, email recipients/provider
identifiers, and failure payloads. This scope and its production-backed RPCs are
verified in production: database/grant and authenticated local UI verification
pass, PR #17 passed all eight checks and merged as `edbef26`, and Vercel deployed
that exact commit before the four-route production smoke passed. It adds no
write capability.

Admin Phase 5 adds read-only Email Operations. The default last-seven-days view
shows the four authoritative outbox states, actual implemented event types,
literal bounded search, server pagination, event-type distribution, and safe
business/booking links. Directory responses omit recipients entirely; event
detail may expose only the existing masked recipient plus a controlled failure
category. `SENT` is adapter/provider acceptance because the product does not
ingest delivery, bounce, open, or read evidence. Retry/resend and every outbox
mutation remain Admin Phase 6 work after MFA, authorization, idempotency, reason,
and audit review. The Phase 5 migration and product deployment are verified.
The read-only surface now derives its provider label from the same server-only
selection as delivery. Brevo support is implemented, but Production activation
still requires verified sender/domain configuration and a controlled live send.

Admin Phase 6A adds account protection and a privileged-write security
framework, not a write capability. Active platform admins can configure a
Supabase-native TOTP authenticator at `/admin/security`. Existing read-only
admin pages remain available at normal authenticated assurance. Every future
platform-admin mutation must additionally pass server-verified AAL2, current
active admin authorization, action-specific validation, explicit confirmation,
policy-required reason capture, audit evidence, and regression coverage.

Google OAuth and password authentication remain first-factor methods unless
Supabase reports an AAL2 session. MFA does not apply to ordinary vendors and
does not grant platform authority to a business owner. Failed-email retry is
the single Admin Phase 6B write. It appears only on email-event detail after a
server-derived `RETRYABLE` decision and requires active `SUPER_ADMIN` authority,
AAL2, explicit confirmation, and a non-empty reason of at most 500 characters.
The action retries the same logical event through its original provider and
preserves every prior attempt. Ambiguous/permanent failures and non-`FAILED`
states remain read-only. Suspension, membership mutation, impersonation,
override, deletion, bulk retry, recipient/content editing, and provider
switching are not present.

## Vendor Booking Journey

Booking detail uses these vendor-facing stages without renaming persisted
statuses: Booking created, Customer confirmation, Work in progress, Ready for
delivery, Delivered, Payment & completion, and Feedback. Waiting confirmation, pending
amendments, pending add-ons, and reschedule reconfirmation are contextual states,
not additional booking statuses. Cancellation is terminal and must not imply
future fulfilment.

Every non-terminal booking must show its current lifecycle position and either
the next valid vendor action or a clear reason it is waiting. A new customer
confirmation preserves immutable agreement evidence and atomically activates
`IN_PROGRESS`; there is no normal Start work action. Delivered bookings require
authoritative outstanding payment to be zero before completion. Feedback is the
post-completion journey close and remains separate from booking status.

The Booking Journey remains visible on booking detail. Secondary operational
sections use independent accessible disclosures with concise summaries. A fresh
page load opens only the section derived from authoritative current context:
confirmation while waiting, operational progress during fulfilment, payment and
completion after delivery, feedback after completion, or a blocking pending
amendment/add-on. The vendor may close that panel and open any other section;
disclosure state never changes booking data.

When an authenticated vendor keeps booking detail open, customer confirmation
and private feedback may become visible without manual reload. The client checks
a minimized tenant-authorized state only while visible, deduplicates each
revision, refreshes the authoritative server page, and announces the change in
an in-app toast. This does not provide OS notifications or offline behavior.

A previously customer-confirmed booking reschedule sends a new secure
confirmation request through the durable outbox. Marking a confirmed booking
delivered sends a status notice. Neither email changes booking state after the
domain transaction, edits the recipient/content, switches provider, or claims
recipient delivery.

## Lifecycle Confirmation And New-Business Branding

Lifecycle-critical confirmations must use accessible application-owned
confirmation UI rather than browser-native confirm/alert/prompt dialogs.
Completing a delivered booking requires an in-app confirmation and only its
final action may invoke the controlled transition. Cancellation follows the
same application-owned interaction rule.

Every newly created business must complete a valid optimized business-logo
upload before business setup is considered complete. Existing legacy businesses
remain supported. This applies to first-business onboarding and
additional-business creation. A selected local file is insufficient: the
optimized object and the business `logo_path` must be persisted before the new
workspace becomes current.

## Admin Security & Health

An active platform administrator can open `/admin/security` for current,
read-only situational awareness. The surface prioritizes overall state and
conditions needing attention, then shows core service evidence, transactional
email aggregates, booking/issue integrity signals, recent allowlisted security
activity, MFA/account posture, and safe deployment context.

The product uses `OPERATIONAL`, `ATTENTION`, `DEGRADED`, and `UNKNOWN`. A missing
signal is never shown as healthy. Email `SENT` means provider acceptance, not
recipient delivery. Health is platform-wide and does not depend on the selected
business. Refresh re-reads data but does not create an audit event or mutate
state. Detection never authorizes repair, provider switching, admin creation,
or any other write.
