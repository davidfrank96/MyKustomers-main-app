# PWA Reliability

Status: IMPLEMENTED - REAL IOS VERIFICATION PENDING

## Scope

My Kustomers remains an installable responsive web application with a manifest
and standalone display mode. It has no service worker, background sync, push
subscription, or private offline cache. This maintenance pass addresses restored
authenticated UI after background suspension, BFCache restoration, and network
reconnection without creating a second source of truth.

Admin Phase 7 remains independently `VERIFIED - PRODUCTION`. Admin Phase 6B
remains `IMPLEMENTED - VERIFICATION PENDING`. This work does not alter either
admin phase or begin another roadmap phase.

## Freshness Policy

Authenticated routes use one shell-level lifecycle coordinator. A visible tab
that was hidden for at least 30 seconds, a persisted `pageshow`, or a network
reconnection reconciles with the server. Short suspensions do not refresh.
Repeated signals on the same route are collapsed by a two-second cooldown.

Ordinary authenticated routes perform one Next.js server refresh. Booking detail
dispatches one purpose-specific reconciliation event: the existing private,
tenant-scoped, no-store minimized snapshot runs once and then performs one
authoritative server refresh even when confirmation/feedback revision evidence
is unchanged. This covers payment, amendment, add-on, cancellation, and other
server-rendered booking state without adding another polling channel.

Booking polling remains visible-tab only and changes from every 5 seconds to
every 10 seconds. Visibility/focus reconciliation is owned by the shell-level
coordinator, so one lifecycle event does not produce independent refresh bursts.

## Interaction Safety

Automatic reconciliation is deferred while the current route contains a changed
form control or an open application dialog. Restored form values are compared
with their default values in addition to listening for input/change events,
which covers browser-restored snapshots whose original events are unavailable.
The user sees an accessible notice and retains the unsaved state. A normal
submit/reset or closing the dialog allows a later safe reconciliation.

Offline same-origin navigation is held in memory and attempted once after the
browser reports reconnection. Offline form submissions are stopped and never
queued or replayed. No route, identity, tenant, form, or mutation state is
persisted in browser storage by this coordinator.

## Platform Evidence

The automated matrix covers desktop Chromium, Pixel 5 mobile Chromium emulation,
and Playwright's desktop WebKit engine with iPhone 13 viewport/device emulation.
It covers cold login, authenticated navigation, real browser Back, meaningful
resume, payment and customer state reconciliation, dirty-form preservation,
offline/reconnect navigation, current-business isolation, expired sessions,
safe-area containment, fixed bottom navigation, and unsupported HEIC rejection.

WebKit emulation is not Safari on a physical iPhone. A real iOS device was not
available, so iOS process eviction, homescreen snapshot restoration, lock/unlock,
software-keyboard viewport behavior, native photo-library selection, and real
network handoff remain unverified. A physical Android device was also
unavailable; Android evidence is Chromium device emulation plus a Chromium
standalone app-window smoke.

## Service Worker And Push Decision

Decision: **NO NEW SERVICE WORKER**. Private authenticated booking, customer,
payment, admin, or capability-route content is not cached for offline use.
Application reliability comes from bounded server reconciliation.

Push notifications remain a **SEPARATE FUTURE PHASE**. They require their own
permission UX, subscription/revocation model, tenant privacy analysis, service
worker scope, and delivery semantics.

## File And Media Handling

The existing logo path remains PNG/JPEG/WebP only, up to 5 MiB source size, with
bounded client preprocessing and authoritative server validation. HEIC/HEIF is
rejected immediately with a safe supported-format message and no upload. Native
HEIC support is a future product decision because browser decode support is not
portable enough to promise today.

## Permanent Invariants

> An installed PWA must treat restored client UI as potentially stale after
> suspension or reconnection. High-integrity authenticated state must reconcile
> with the authoritative server before relying on restored state.

> PWA reliability and responsiveness must not be achieved by caching private
> authenticated booking, customer, payment, admin, or capability-route content.

> Lifecycle and financial mutations are not queued for offline replay. They
> require authoritative online execution.

## Architecture Impact

- Database changes: none.
- Environment changes: none.
- Vercel/Supabase infrastructure changes: none.
- Service worker changes: none.
- Docker/local Supabase: not used.
