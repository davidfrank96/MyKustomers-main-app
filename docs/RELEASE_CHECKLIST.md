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
- [ ] Production environment variables configured.
- [ ] Secret rotation process documented.

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
- [ ] Production secrets configured outside source control.
- [x] Service-role key exposure audit completed.

## Logging And Monitoring

- [ ] Sensitive logging review completed.
- [ ] Monitoring configured.
- [ ] Error reporting configured.
- [ ] Incident response procedure documented.

## Security Headers

- [ ] CSP reviewed.
- [ ] Security headers configured.
- [x] Public confirmation route no-store/noindex/referrer headers configured.
- [x] Public feedback route no-store/noindex/referrer headers configured.
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
- [x] Public amendment Current/Proposed diff passes the required 320-1440px matrix.
- [x] Public add-on review passes the required 320-1440px matrix.
- [ ] Production browser/device acceptance completed for the release candidate.

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

- [ ] Vercel project configured.
- [ ] Domain configured.
- [ ] Production deployment smoke-tested.
- [ ] Rollback process documented.

## Repository Integration And CI

- [x] Current verified functionality and all applied migration artifacts
      preserved during main reconciliation.
- [x] No unmerged paths or conflict markers remain locally.
- [x] GitHub Actions defines Quality, Tests, Build, E2E, Dependency Security,
      and guarded Runtime Security jobs.
- [x] Workflow permissions are read-only and no production migration/deployment
      step exists.
- [x] Required E2E GitHub secrets configured for a dedicated non-production
      Supabase project.
- [ ] Protected runtime-security environment and enable variable configured.
- [x] GitHub Actions core checks pass on the reconciliation branch.
- [x] Pull request reports mergeable with required checks green.
- [ ] `main` branch protection requires the documented core checks.
