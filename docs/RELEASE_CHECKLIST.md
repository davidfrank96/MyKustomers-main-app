# Release Checklist

This checklist separates verified development evidence from remaining
production-readiness work.

## Build

- [x] Local production build passes.
- [x] Lint passes.
- [x] Typecheck passes.
- [x] Unit/integration tests pass.
- [x] E2E smoke tests pass.

## Environment

- [x] `.env.example` exists.
- [x] Production environment variables configured with minimum Production-only
      scope in Vercel.
- [x] Secret rotation and environment rollback boundaries documented.

## Database

- [x] Repository migrations accounted for in `docs/MIGRATIONS.md`.
- [ ] Target deployment migration history reconciled before production apply.

- [x] Phase 2 migration definitions created.
- [x] Phase 3 migration definitions created.
- [x] Phase 4 migration definitions created.
- [x] Phase 5 migration definitions created.
- [x] Phase 6 migration definitions created.
- [x] Phase 7 migration definitions created.
- [x] Phase 8 migration definitions created.
- [x] Phase 9 analytics migration definitions created.
- [x] Customer contact and booking-confirmation email outbox migration created
      and applied to development.
- [x] Inline customer booking transaction migration created, applied to
      development, and runtime-verified.
- [x] Business identity/storage migrations created, applied to development, and
      runtime-verified, including the forward RPC/contact regression fix.
- [x] Trusted confirmation sharing migration created, applied to development,
      and runtime-verified with service-only first-open execution.
- [x] Trusted feedback sharing migration created, applied to development, and
      runtime-verified with service-only idempotent first-open execution.
- [x] Confirmed booking integrity and cancellation notification migrations
      created, applied to development, and runtime-verified, including the forward
      RPC qualification fix found by the first live race attempt.
- [x] Booking amendment migrations created, applied to development, and runtime-
      verified, including forward revocation-parameter and email-idempotency fixes.
- [x] Application schema implemented.
- [x] Migrations verified.
- [ ] Backup and restore plan documented.

## RLS

- [x] Opt-in live runtime security suite passes against development.

- [x] Phase 2 RLS policy definitions created.
- [x] Phase 4 customer RLS policy definitions created.
- [x] Phase 5 booking RLS policy definitions created.
- [x] Phase 6 confirmation-link table access and RPC grants reviewed.
- [x] Phase 7 booking-change RLS and lifecycle RPC grants reviewed.
- [x] Phase 8 feedback and issue RLS/RPC grants reviewed.
- [x] Phase 9 aggregate RPC grants and tenant membership checks reviewed.
- [x] Confirmation contact evidence and email event grants/service-role boundary
      reviewed.
- [x] Tenant-owned tables have RLS enabled.
- [x] RLS policies reviewed.
- [x] Cross-tenant tests pass.

## Authentication

- [x] Signup implemented.
- [x] Login implemented.
- [x] Logout implemented.
- [x] Password recovery implemented.
- [x] Session handling reviewed.
- [x] Mobile account menu and Settings expose the existing logout flow and
      protected access is removed after logout.
- [x] Login and signup expose one reusable Supabase Google OAuth control while
      preserving email/password and password recovery.
- [x] OAuth callback errors and external `next` values fail safely without
      rendering raw provider details.
- [x] Next.js development request logging excludes the exact OAuth callback so
      transient authorization-code query strings are not printed.
- [x] Supabase public Auth settings report the Google provider enabled; provider
      credentials remain only in Supabase.
- [x] Real Google authorization reached Supabase, and controlled downstream
      verification covered profile provisioning, zero-business onboarding,
      session persistence, logout, and protected-route denial.
- [x] Exact local Supabase redirect is allowlisted and an unassisted
      Google -> Supabase -> application callback completes.
- [x] Existing-business and multi-business/switcher Google journeys are verified
      locally through a real authenticated session.
- [x] Required CI and production Google OAuth are verified after merge and Vercel
      deployment.
- [ ] Same-email identity behavior is verified as a separate lifecycle check.

## Authorization

- [x] Server-side authorization helpers implemented.
- [x] Protected routes verified.
- [x] Cross-tenant mutations blocked.
- [x] Atomic owner onboarding verified.
- [x] Customer unauthorized create and business reassignment denial verified.
- [x] Booking unauthorized create, cross-tenant mutation denial, ownership
      immutability, status transition validation, and history fabrication denial
      covered by runtime tests.
- [x] Confirmation token lifecycle, public minimization, material-change
      invalidation, and cross-tenant denial covered by runtime tests.
- [x] Share-method audits are tenant-validated; safe social metadata and
      idempotent crawler-resistant first-open evidence are covered by tests.
- [x] Operational booking lifecycle, rescheduling, anonymous denial,
      customer-token privilege denial, terminal locks, and change-history integrity
      covered by runtime tests.
- [x] Confirmed material mutation denial, awaiting-link invalidation,
      internal-note exception, cancellation race/idempotency, evidence preservation,
      confirmation-contact recipient priority, and delivery-failure persistence
      covered by live runtime tests.
- [x] Amendment no-preapproval mutation, purpose separation, one-active rule,
      tenant isolation, stale/race/revoke/expiry behavior, cancellation/lifecycle
      interaction, original evidence, and analytics behavior covered live.
- [x] Private feedback and operational issue tenant isolation, public token
      purpose separation, immutable feedback, and issue resolution integrity covered
      by runtime tests.
- [x] Tenant-private analytics aggregate isolation, cross-tenant denial, and
      currency separation covered by runtime tests.
- [x] Inline booking customer modes, atomic rollback, archived/cross-tenant
      denial, injected tenant authority rejection, and least-privilege RPC grants
      covered by static and runtime tests.
- [x] Business-logo object listing/writes require active owner role; anonymous,
      member, and cross-tenant mutation paths are runtime-covered.

## Abuse Protection

- [x] Sensitive public confirmation endpoints rate limited.
- [x] Sensitive public feedback endpoints rate limited.
- [x] Sensitive public amendment endpoints rate limited.
- [x] Customer token endpoints abuse-tested in runtime security tests.
- [ ] CSRF/origin strategy reviewed where applicable.

## Secrets

- [x] Server-only environment boundary exists.
- [x] Production secrets configured outside source control.
- [x] Service-role key exposure audit completed.

## Logging And Monitoring

- [x] Sensitive logging review completed for the initial verification window.
- [ ] Monitoring configured.
- [ ] Error reporting configured.
- [ ] Incident response procedure documented.

## Security Headers

- [ ] CSP reviewed.
- [ ] Security headers configured.
- [x] Public confirmation route no-store/noindex/referrer headers configured.
- [x] Public feedback route no-store/noindex/referrer headers configured.
- [x] Public confirmation, amendment, add-on, and feedback capability route
      families have explicit non-cacheable response rules.
- [x] Public amendment metadata is noindex and excludes customer/term details.
- [x] Public add-on metadata is noindex and excludes customer/add-on terms.
- [ ] Cookie settings reviewed.

## Dependency Audit

- [x] `npm audit --audit-level=moderate` passes locally.
- [ ] Production dependency review completed.

## Product And Documentation

- [x] Core documentation reflects current implementation evidence.
- [x] Material changes are covered by the documentation definition of done.
- [x] Full E2E suite passes against the configured development environment.
- [x] Responsive smoke matrix includes 320, 360, 375, 390, 430, 768, 834,
      1024, 1280, and 1440 pixel widths.
- [x] Major routes have no unintended horizontal document overflow.
- [x] Account menu, Settings, business logo/website form, dashboard tiles, and
      confirmation identity pass the required 320-1440px matrix.
- [x] Public confirmation and feedback states have mobile visual checks.
- [x] Major authenticated routes have accessible reduced-motion-safe structural
      loading, and business switching obscures stale workspace content.
- [x] Public amendment Current/Proposed diff passes the required 320-1440px matrix.
- [x] Public add-on review passes the required 320-1440px matrix.
- [x] Production browser acceptance completed at 390px and 1440px for the
      release candidate.

## Privacy And Compliance

- [ ] Privacy policy prepared.
- [ ] Data retention policy prepared.
- [x] Phase 4 customer PII tenant isolation reviewed.
- [x] Phase 5 private booking notes remain vendor-only tenant data.
- [x] Phase 6 public confirmation view minimizes customer and booking data.
- [x] Confirmation contact is tenant-private; consumed public views expose only
      a masked email and audit metadata omits contact values.
- [x] Phase 7 customer confirmation tokens cannot perform vendor operational
      lifecycle actions.
- [x] Phase 8 public feedback view minimizes booking data and keeps submitted
      feedback private to the owning business.
- [x] Phase 9 insights avoid public reports, exports, cross-tenant aggregates,
      mixed-currency totals, and revenue/cash/profit/accounting claims.
- [x] Public logo storage contains only bounded business branding; no raw source
      image, private contact, service credential, or general document is stored.
- [x] Amendment tokens are hash-only, metadata is business-only, internal notes
      stay private, and original/effective agreement evidence remains distinct.
- [x] Add-on tokens are hash-only and purpose-separated; metadata is
      business-only, pending terms do not affect totals, and original/amendment
      evidence remains unchanged.

## Accessibility And UX

- [ ] Accessibility review completed.
- [x] Phase 3 onboarding responsive E2E reviewed on desktop and mobile projects.
- [x] Customer-facing confirmation flow reviewed on desktop and mobile E2E.
- [x] Phase 7 vendor booking lifecycle flow reviewed on desktop and mobile E2E.
- [x] Phase 8 public feedback and vendor issue lifecycle flow reviewed in E2E.
- [x] Phase 9 insights reviewed in E2E.
- [x] Existing and inline-new-customer booking creation reviewed in desktop and
      mobile E2E, including explicit duplicate continuation and confirmation.
- [x] Phase 9.5 product UX audit completed across mobile, tablet, and desktop.
- [x] Authenticated navigation active state reviewed for Home, Bookings,
      Customers, Insights, and Business.
- [x] Canonical customer-to-booking-to-confirmation-to-fulfilment-to-feedback-to-insights
      journey covered in E2E.
- [x] Public confirmation and feedback pages reviewed for simple customer copy
      and safe unavailable states.
- [x] Public amendment page uses human labels, explicit Current/Proposed values,
      keyboard-accessible confirmation, and no dashboard shell.
- [x] Public add-on page identifies new scope, inherited delivery, recorded
      amounts, and confirmation action without a dashboard shell or overflow.
- [x] Money and terminology reviewed to avoid payment verification, accounting,
      and internal implementation claims.

## Email

- [ ] Resend configured.
- [x] Provider-neutral booking-confirmed HTML/plain-text templates reviewed.
- [x] Durable booking-confirmed event and post-commit failure behavior verified.
- [x] Provider-neutral booking-cancelled HTML/plain-text template reviewed.
- [x] Confirmed cancellation atomically creates one durable event using
      confirmation contact first; provider failure does not roll back cancellation.
- [x] Amendment request/confirmation events use the same provider boundary and
      frozen confirmation contact; provider failure does not roll back state.
- [x] Add-on request/confirmation events use frozen confirmation contact;
      request content omits add-on terms, confirmation shows recorded effective
      totals, and provider failure does not roll back state.
- [ ] Failed-event retry worker/schedule configured.
- [ ] Bounce/error handling planned.

## Billing

- [ ] Subscription provider selected.
- [ ] Billing abstraction implemented.
- [ ] Webhook validation implemented.

## Deployment

- [x] Vercel project configured.
- [x] Stable Vercel production domain configured.
- [x] Production deployment smoke-tested with controlled, cleaned fixtures.
- [x] Application, environment, Auth, and database rollback boundaries documented.

## Repository Integration And CI

- [x] Current verified functionality and all applied migration artifacts
      preserved during main reconciliation.
- [x] No unmerged paths or conflict markers remain locally.
- [x] GitHub Actions defines Quality, Tests, Build, E2E, Dependency Security,
      and guarded Runtime Security jobs.
- [x] Workflow permissions are read-only and no production migration/deployment
      step exists.
- [x] E2E failures retain sanitized JSON/error-context diagnostics without raw
      capability URLs, secrets, browser storage, traces, screenshots, or videos.
- [x] Required E2E GitHub secrets configured for a dedicated non-production
      Supabase project.
- [ ] Protected runtime-security environment and enable variable configured.
- [x] GitHub Actions core checks pass on the reconciliation branch.
- [x] Pull request reports mergeable with required checks green.
- [ ] `main` branch protection requires the documented core checks.

## Multi-Business Account Support

- [x] Active `business_members` remains tenant and role authority; no
      `profiles.business_id` was introduced.
- [x] Current-business cookie is HTTP-only, server-validated, and cleared at
      logout; stale/revoked preferences fall back safely.
- [x] Forged switch submissions and cross-tenant booking RPC business IDs are
      denied without changing current authority or creating rows.
- [x] Additional business creation reuses atomic onboarding and selects the new
      owner workspace immediately.
- [x] Owner/member roles, customer and booking isolation, responsive switching,
      and five-item mobile navigation are covered on desktop and mobile.
- [x] Business page lists active memberships with textual current state and uses
      the same validated switch action as the header.
- [x] Forward booking-selection migration is applied to development and
      runtime-verified.
- [x] Shared-database deployment ordering is protected by a single-membership
      legacy wrapper that fails closed for multi-business callers.

## Platform Administration

- [ ] Production rollout has explicit user authorization and an identified
      migration/version record.
- [ ] `platform_admins` RLS and grants match `docs/ADMIN_SECURITY.md`.
- [ ] Ordinary, business-owner, multi-business-owner, disabled, anonymous, and
      forged-client runtime denials pass.
- [ ] Every production bootstrap target UUID and identity was independently
      reviewed; no email is embedded in authorization logic.
- [ ] Admin role/status change audit evidence was verified without secrets.
- [ ] MFA is enforced before any high-risk platform write capability is enabled.
- [ ] No generic privileged database browser, impersonation, destructive
      mutation, membership-management UI, or hard deletion shipped implicitly.
