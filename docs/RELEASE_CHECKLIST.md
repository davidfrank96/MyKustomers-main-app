# Release Checklist

Most items are unchecked because Phase 1.5 is not a production-readiness phase.

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

- [x] Phase 2 migration definitions created.
- [x] Phase 3 migration definitions created.
- [x] Phase 4 migration definitions created.
- [x] Phase 5 migration definitions created.
- [x] Phase 6 migration definitions created.
- [x] Phase 7 migration definitions created.
- [x] Phase 8 migration definitions created.
- [x] Application schema implemented.
- [x] Migrations verified.
- [ ] Backup and restore plan documented.

## RLS

- [x] Phase 2 RLS policy definitions created.
- [x] Phase 4 customer RLS policy definitions created.
- [x] Phase 5 booking RLS policy definitions created.
- [x] Phase 6 confirmation-link table access and RPC grants reviewed.
- [x] Phase 7 booking-change RLS and lifecycle RPC grants reviewed.
- [x] Phase 8 feedback and issue RLS/RPC grants reviewed.
- [x] Tenant-owned tables have RLS enabled.
- [x] RLS policies reviewed.
- [x] Cross-tenant tests pass.

## Authentication

- [x] Signup implemented.
- [x] Login implemented.
- [x] Logout implemented.
- [x] Password recovery implemented.
- [x] Session handling reviewed.

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
- [x] Operational booking lifecycle, rescheduling, anonymous denial,
  customer-token privilege denial, terminal locks, and change-history integrity
  covered by runtime tests.
- [x] Private feedback and operational issue tenant isolation, public token
  purpose separation, immutable feedback, and issue resolution integrity covered
  by runtime tests.

## Abuse Protection

- [x] Sensitive public confirmation endpoints rate limited.
- [x] Sensitive public feedback endpoints rate limited.
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
- [ ] Cookie settings reviewed.

## Dependency Audit

- [x] `npm audit --audit-level=moderate` passes locally.
- [ ] Production dependency review completed.

## Privacy And Compliance

- [ ] Privacy policy prepared.
- [ ] Data retention policy prepared.
- [x] Phase 4 customer PII tenant isolation reviewed.
- [x] Phase 5 private booking notes remain vendor-only tenant data.
- [x] Phase 6 public confirmation view minimizes customer and booking data.
- [x] Phase 7 customer confirmation tokens cannot perform vendor operational
  lifecycle actions.
- [x] Phase 8 public feedback view minimizes booking data and keeps submitted
  feedback private to the owning business.

## Accessibility And UX

- [ ] Accessibility review completed.
- [x] Phase 3 onboarding responsive E2E reviewed on desktop and mobile projects.
- [x] Customer-facing confirmation flow reviewed on desktop and mobile E2E.
- [x] Phase 7 vendor booking lifecycle flow reviewed on desktop and mobile E2E.
- [x] Phase 8 public feedback and vendor issue lifecycle flow reviewed in E2E.

## Email

- [ ] Resend configured.
- [ ] Email templates reviewed.
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
