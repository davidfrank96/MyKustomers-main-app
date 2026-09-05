# Release Checklist

## Email Reliability Phase 3 Release Gate

- [x] Existing Phase 2B provider model, booking projection, and reconciliation reused.
- [x] Accepted, delivered, deferred, bounce/invalid, blocked/complaint, provider-error,
      development-adapter, no-email, and confirmed presentations are distinct.
- [x] Customer confirmation outranks historical email transport concern.
- [x] Manual secure sharing remains available while confirmation is outstanding.
- [x] Permanent/suppressed outcomes do not expose ordinary unchanged-address resend.
- [x] Booking-specific correction preserves the customer profile and uses the existing
      prior-capability revocation/fresh-capability transaction.
- [x] No second outbox/webhook, automatic provider failover, migration, environment
      change, provider configuration change, dependency, or Production fixture added.
- [x] Focused deterministic recovery and reconciliation tests pass.
- [ ] One final full local verification pass, PR CI, exact-commit Production deployment,
      read-only smoke, and Sentry review are recorded before VERIFIED status.

Phase 2B remains: **PRODUCTION ACTIVE — CONTROLLED PROVIDER VERIFICATION PENDING**.

## Email Reliability Stage 2 Release Gate

- [x] Explicit migration approval recorded before schema application.
- [x] Exact additive migration applied transactionally and live catalog verified.
- [x] Existing outbox/attempt counts and full-row digests unchanged; zero backfill.
- [x] Rollback-only ingestion/idempotency/order/append-only runtime smoke passed.
- [x] Webhook endpoint, correlation header, Admin/vendor UI, and focused tests implemented.
- [x] Full local quality/unit/build/audit verification passes; protected skips and
      the unrelated baseline Playwright drift are reported accurately.
- [x] Final Production-only `BREVO_WEBHOOK_SECRET` configured as a Vercel Secret;
      the pre-activation value was rotated and never configured in Brevo.
- [x] PR #67 executable checks pass and exact merge `0fff7ce` deploys Ready to
      Vercel Production as `k4scVd8GPQpYejpqM9HsWEvstvpZ`.
- [x] Exactly one authenticated Brevo transactional webhook is active for the eight
      dashboard-supported delivery/suppression subscriptions; no engagement events.
- [x] Canonical unsigned endpoint denial and Admin 320–1440 responsive matrix are
      verified without contacting legitimate customers or fabricating evidence.
- [ ] Controlled provider callback/inbox outcomes and a Production vendor responsive
      matrix remain pending because no authorized controlled inbox/vendor tenant was available.

## Email Reliability Stage 1 Release Gate

- [x] Focused and full local quality, build, and dependency checks recorded.
- [x] Protected runtime/E2E outcomes reported accurately, including skips.
- [x] Focused PR #66 required checks green before merge.
- [x] Exact merged Vercel Production commit `de0dc495` verified Ready.
- [x] Read-only production development-adapter labeling verified.
- [x] Public normalization and ambiguous-copy artifact/synthetic evidence recorded;
      no real customer submission or email is allowed for smoke.
- [x] At the Stage 1 release boundary, the Stage 2 migration remained unapplied
      pending explicit approval; it was applied only after that approval.

This checklist separates verified development evidence from remaining
production-readiness work.

## MyKustomers.com Master Brand Asset Rollout

- [x] Approved source ZIP/package checksum, inventory, dimensions, SVG validity,
      PDF/EPS masters, brand guide, and favicon sheet are recorded and valid.
- [x] Runtime assets are copied byte-identically into one versioned public path.
- [x] Platform placeholders are replaced without touching vendor business logos,
      avatars, initials fallbacks, uploaded media, or booking references.
- [x] Root metadata uses supplied favicon, Apple touch, Open Graph, and Twitter
      assets; the old generated card and hand-built icon overrides are removed.
- [x] Existing manifest behavior is preserved while standard, maskable, and
      monochrome supplied icons receive exact purposes.
- [x] Shared email presentation uses the supplied PNG from a stable canonical
      HTTPS URL with proportional dimensions and accessible fallback text.
- [x] Focused component, metadata, manifest, public-route, auth, and email tests
      cover the new paths and accessible behavior.
- [x] Full lint, typecheck, test, production build, relevant E2E, asset HTTP,
      byte-integrity, responsive overflow, screenshot, and diff gates pass.
- [ ] Manual browser review covers favicon, homepage, auth, vendor shell, public
      confirmation/feedback, manifest/install assets, Open Graph, and email.
      Local screenshots and runtime previews are reviewed; authenticated-shell
      and fresh OS-level install review remain for the user because no safe
      non-Production fixture target is configured.
- [x] User approves the uncommitted local review result before any commit, push,
      pull request, merge, or deployment.

## Image Picker + Booking Completion UX

- [x] Choose image opens through a native file chooser on desktop Chromium.
- [x] Choose image opens through a native file chooser on mobile Chromium.
- [x] Desktop and mobile WebKit automated picker journeys pass.
- [x] Desktop, Pixel-class, and iPhone-class PWA picker journeys pass.
- [x] Valid, cancel, same-file, invalid-content, HEIC, >5 MiB, exact-5 MiB,
      upload, replacement, removal, preview, processing, and cleanup paths are
      covered by focused component/browser tests.
- [x] First-business onboarding reuses the staged business and completes only
      after an authorized persisted logo re-read.
- [ ] Physical iOS Safari/homescreen photo picker verified.
- [ ] Physical Android Chrome/standalone photo picker verified.
- [x] One observed transition into `COMPLETED` opens one accessible modal.
- [x] Historical completed load, refresh, repeated reconciliation, delivered,
      outstanding-balance, and cancelled states do not open the modal.
- [x] Feedback-triggered and fresh server-action completion paths use the same
      transition detector and the existing poll/RSC reconciliation mechanisms.
- [x] Manual completion shows the modal only after authoritative server success.
- [x] No database, Storage policy, environment, dependency, email, audit event,
      lifecycle rule, or additional poller was added.
- [x] Full local release gate passes with zero controlled fixture residue.
- [x] Required PR checks pass and exact merge deploys to Production (PR #62,
      merge `99f7f383`, deployment `dpl_DN2GnoSvhJ8E6w1zMUBSrV58XT9L`).
- [x] Controlled Production image and completion smoke passes with zero residue.

## Customer Email Source-Of-Truth Hotfix

- [x] No fake/default `amah@tcd.ie` exists in repository history or Production.
- [x] Empty saved profile and empty booking communication fields remain empty.
- [x] Saved profile email is optional and is not silently copied to a booking.
- [x] **Use saved email** is an explicit accessible button.
- [x] Public confirmation writes booking evidence only; profile stays unchanged.
- [x] Confirmation, amendment, add-on, reschedule, cancellation, delivery, and
      feedback delivery use booking-scoped email only.
- [x] Missing booking email creates no event and manual share remains available.
- [x] Domain-only normalization and non-provider-specific validation remain.
- [x] Production provenance/count/provider/capability audit is complete and no
      data cleanup is required.
- [x] Exact approved migration hash, rollback compile, transactional apply,
      catalog/grant/search-path checks, and rollback-only controlled DB smoke pass.
- [ ] Final lint, typecheck, full tests, guarded runtime, E2E, build, dependency
      audit, and diff hygiene pass on the final documented tree.
- [ ] Responsive 320/360/390/430/768/1024/1440 and standalone/PWA UX pass.
- [ ] Required PR CI passes and the exact reviewed commit merges conflict-free.
- [ ] Vercel Production is Ready on the exact merge commit.
- [ ] Controlled Production app/inbox smoke proves booking recipient selection,
      profile non-mutation, delivery/feedback behavior, and zero fixture residue.

## Auth Verification And Application Rate Limits

- [x] Password signup interprets a successful no-session result as confirmation
      required and never invokes onboarding/workspace resolution from that state.
- [x] Accessible check-email dialog shows the exact normalized submitted email;
      dismissal leaves a persistent verification/resend state and removes the
      password form from the current page state.
- [x] Verification resend uses Supabase Auth, neutral account-existence copy,
      provider-aware throttling, and a UI countdown sourced from server retry
      evidence.
- [x] Login, signup, recovery, and resend use persistent account/source layers;
      successful login clears only its account bucket.
- [x] Customer confirmation email, amendment, add-on, reschedule, and privileged
      email retry fail closed before durable/provider work when protection is
      unavailable or limited.
- [x] Public confirmation, amendment, add-on, and feedback operations use
      capability/source layers; best-effort first-open evidence cannot block the
      customer page.
- [x] Exact approved migration SHA, transactional apply, catalog/grant/search-
      path checks, retry metadata, unchanged baseline, legacy compatibility,
      bounded cleanup, and 5-of-20 concurrency proof pass.
- [x] No process-memory limiter, Redis/Upstash, CAPTCHA, dependency, environment,
      provider configuration, WAF, RLS, or tenant-authority change exists.
- [x] Full lint, typecheck, Vitest, guarded runtime, E2E, build, dependency audit,
      and diff hygiene are green on the final commit.
- [x] Required PR CI passes and the reviewed branch merges conflict-free.
- [x] Vercel Production is Ready on the exact merge commit.
- [x] Controlled canonical password signup proves modal, real email, callback,
      zero-business onboarding, first-business creation, and protected-route
      denial before verification.
- [x] Controlled resend/login/recovery/customer-message bounded smoke confirms
      safe retry UX without aggressive Production traffic or legitimate-user spam.
- [x] Google OAuth, password recovery, PWA, multi-business, RLS, outbox, and
      320/360/390/430/768/1024/1440 alignment regressions are green.
- [x] Controlled Auth, tenant, customer, booking, outbox, audit, and limiter
      fixtures are removed and independent residue queries return zero.

## Delivery-To-Feedback Automation

- [x] Exact approved migration hash and repository bytes match.
- [x] Production Vault secret exists once with shape-only verification and was
      never printed, returned to application code, or added to Vercel.
- [x] Migration applied transactionally; catalog, ownership, grants, empty
      search paths, constraints, indexes, triggers, historical counts, v0
      preservation, and deterministic v1 derivation passed.
- [x] Delivery, manual same-link recovery, feedback eligibility, exact outbox
      association, 48-hour dispatch, CTA suppression, and paid-plus-feedback
      completion are implemented with focused automated coverage.
- [x] Lint, typecheck, Vitest, guarded-runtime skip evidence, production build,
      audit, migration hash, secret-name scan, and diff hygiene pass.
- [x] Temporary forward compatibility migration is applied and rollback-verified
      for legacy and new delivery, forged-v1 and cross-tenant denial, immediate
      deferred constraints, and zero fixture residue.
- [x] Playwright canonical delivery journey passes on desktop and mobile; the
      complete matrix passes 51 with 16 intentional project skips and zero
      failures.
- [x] Required PR checks pass and the reviewed commit merges conflict-free.
- [x] Vercel Production is Ready on the merged commit.
- [x] Controlled real-provider delivery and both completion orderings pass.
- [x] Manual recovery returns the same link and cleanup/residue checks return
      zero before the release status becomes VERIFIED - PRODUCTION.
- [x] Post-convergence delivery/null-association counts support review of the
      prepared tightening migration.
- [x] Explicit approval was granted before applying
      `20260901230527_delivery_feedback_require_v1_association.sql`; the exact
      hash-locked migration, strict catalog/grant checks, and rollback-only
      negative/positive verification passed.

## Auth Lifecycle, Password Recovery, and Progressive Lists

- [x] Google login and signup share one provider action and request the supported
      `prompt=select_account` chooser without forcing repeated consent.
- [x] Provider callback, profile provisioning, current-business resolution, and
      the server-side zero-business onboarding gate remain provider-independent.
- [x] Password recovery uses the existing Supabase Auth/Brevo SMTP lifecycle,
      an exact canonical callback, a short-lived HTTP-only recovery intent, an
      authoritative password update, and an explicit sign-out-to-login success
      state.
- [x] Neutral request responses, invalid/reused-link handling, external redirect
      rejection, old/new password behavior, logout, and protected-route denial
      have automated coverage.
- [x] Bookings and Customers server-render 25 current-business rows and append
      bounded 25-row batches through authenticated, no-store routes.
- [x] Deterministic keyset cursors, rapid-click suppression, ID deduplication,
      query/filter remounting, tenant-derived requests, localized retry, and
      accessible announcements have automated coverage.
- [x] Desktop, 390/430 mobile, Nigeria typical/constrained profiles, 55-row
      completion, and 125-row DOM checks support the 25-row decision without a
      load-all query or virtualization dependency.
- [x] Local lint, typecheck, unit/integration, serial full-browser,
      production-build, dependency-audit, formatting, and diff-hygiene gates
      pass.
- [x] Required CI and the Vercel Production deployment are green.
- [x] Controlled Production Google, password-recovery, Bookings, and Customers
      smoke checks pass with zero fixture residue.

Release evidence: PR #51 passed every required executable check, retained the
protected Runtime Security skip, and merged as `49dbd51`. Vercel deployment
`A9YGEEK3nBXnPW1M3vS81s5mHmXf` reported `Ready` for `main`/Production and served
the canonical domain. Controlled Production checks covered the live Google
account-selection boundary and cancellation, email signup/confirmation,
provider-independent onboarding, real recovery-email delivery, password
replacement, one-time-link rejection, Bookings/Customers 25 -> 50 -> 55 loading,
and the 320-1440 responsive matrix. An independent residue audit returned zero
generated Auth users, businesses, customers, and bookings. No database
migration, Supabase configuration, SMTP, Vercel environment, dependency, or
infrastructure change was part of this release.

## Dashboard Home Navigation Pending-State Hotfix

- [x] Pre-fix component and real-browser evidence reproduces the stale Home
      pending state and its 15-second blocking window.
- [x] Desktop and mobile primary navigation use framework-owned, per-Link
      destination status without a timer, custom push, or prefetch override.
- [x] Semantic links, browser Back, modifier/middle clicks, five mobile
      destinations, responsive geometry, and reduced-motion behavior are
      preserved.
- [x] Controlled Chromium and WebKit-emulation journeys pass at 1440x1000 and
      390x844 across Dashboard cards, lists, details, Insights, Business, and
      return-to-Home.
- [x] Responsive checks pass at 390, 768, 1024, and 1440 pixels without stale
      pending state or horizontal overflow.
- [x] Full lint, typecheck, unit/integration, runtime-security, browser,
      production-build, dependency, and diff-hygiene gates pass.
- [x] Required CI, Vercel production deployment, and controlled production
      navigation smoke pass.
- [x] Controlled local navigation fixtures are removed and the residue audit
      returns zero.
- [x] Controlled production navigation fixtures are removed and the production
      residue audit returns zero.

Release evidence: PR #48 passed six executable CI/deployment checks with the
protected Runtime Security job explicitly skipped, merged as `37cf872`, and was
deployed by Vercel deployment `dpl_FUmoNCREPDP3nTi9jjFCYyFCnabM`. Production
smoke passed at 1440x1000 and 390x844; deployment logs showed zero warning,
error, or fatal entries in the checked window; the independent residue audit
returned zero matching businesses and Auth users.

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

## Sentry Observability

- [x] Current Next.js browser/server/request instrumentation is implemented.
- [x] Central privacy sanitizer and focused regression coverage pass.
- [x] Replay, feedback, profiling, logs, metrics, and local/CI transmission are
      disabled.
- [x] Sentry server-side scrubbing, IP prevention, exact Production origins,
      spike protection, and default high-priority alert were inspected.
- [ ] Least-privilege `SENTRY_AUTH_TOKEN` is stored as a Production-only Vercel
      build secret.
- [ ] Production DSNs, org, and project are configured with minimum scope.
- [ ] Production release/source maps and controlled client/server events are
      verified in Sentry with no private data.

## Booking Journey UX

- [x] Every persisted booking status has centralized current-step guidance.
- [x] Every non-terminal state has a valid next action or explicit waiting reason.
- [x] Customer confirmation evidence remains distinct while new confirmations
      atomically activate work without a Start work action.
- [x] Cancellation remains available as a secondary terminal action.
- [x] Feedback is derived after completion and does not alter booking status.
- [x] New total/deposit empty-state and persisted edit-value regressions pass.
- [x] Desktop/mobile canonical, reconfirmation, cancellation, and 320-1440
      responsive journey checks pass locally.
- [x] Required CI, production deployment, and controlled production smoke pass.

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
- [x] Password and Google post-auth destinations share one sanitized,
      provider-independent membership resolver.
- [x] Zero-business users reach shell-free onboarding from every vendor route,
      including forged-cookie and vendor `next` attempts.

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
- [x] The vendor route-group layout verifies a completed active membership before
      rendering `DashboardShell`; leaf pages/actions and RLS remain in force.
- [x] Empty membership results are distinct from query failures, and
      last-membership revocation blocks both the next vendor request and a stale
      representative Server Action.
- [x] Active zero-business platform admins retain separate `/admin` access;
      ordinary zero-business users and disabled admins remain denied.

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

- [x] Development, Brevo, and Resend resolve behind one server-only provider boundary.
- [x] Brevo success, auth, rate-limit, provider, network, timeout, malformed-response,
      sender-validation, idempotency, and privacy boundaries have regression coverage.
- [x] Brevo account and professional sender/domain authentication verified.
- [x] Production-only `TRANSACTIONAL_EMAIL_PROVIDER`, `BREVO_API_KEY`,
      `TRANSACTIONAL_EMAIL_FROM`, and `RESEND_API_KEY` configured without
      exposing values.
- [x] One new controlled event accepted by Brevo, provider evidence stored, inbox
      receipt checked, and Admin Email Operations verified after deployment.
- [x] Historical events, including the never-claimed reserved-domain pending event,
      are excluded from activation replay.
- [x] Resend verified and configured as standby without automatic failover.
- [x] Canonical apex/www TLS, retained Vercel hostname, exact Supabase callbacks,
      and Cloudflare inbound alias configured.
- [x] Supabase custom SMTP configuration persisted with the verified sender.
- [x] Controlled signup/reset email delivery and callbacks verified.
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
- [x] Delivery/bounce webhook ingestion implemented and active through Email
      Reliability Stage 2B; controlled callback/inbox evidence remains tracked above.

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

- [x] Production rollout has explicit user authorization and an identified
      migration/version record.
- [x] `platform_admins` RLS and grants match `docs/ADMIN_SECURITY.md`.
- [x] Ordinary, business-owner, multi-business-owner, disabled, anonymous, and
      forged-client runtime denials pass.
- [x] Every production bootstrap target UUID and identity was independently
      reviewed; no email is embedded in authorization logic.
- [x] Admin role/status change audit evidence was verified without secrets.
- [x] Phase 2 overview uses an aggregate-only active-admin RPC and contains no
      PII, financial totals, record browser, or mutation.
- [x] Exact metric deltas, current-business independence, disablement, and
      390/768/1024/1440 responsive behavior pass locally and against the live DB.
- [x] Phase 2 production UI deployment and authenticated smoke test pass.
- [x] Phase 3 business/user routes are read-only and have no mutation controls.
- [x] Phase 3 Auth projections exclude raw metadata, identity payloads, sessions,
      password fields, and tokens.
- [x] Phase 3 search is bounded/literal, pagination is server-side, and business
      directory aggregation uses one RPC rather than per-row queries.
- [x] Phase 3 static/unit coverage and route/RPC denial cases are implemented.
- [x] Phase 3 database lint, production-safe count reconciliation, direct caller
      denial, and temporary zero-business admin browser verification pass.
- [x] Phase 3 required CI, Vercel deployment, and production read-only smoke pass.
- [x] Admin Phase 4 Bookings/Issues routes, strict DTOs, RPC migration, unit,
      static security, and E2E route coverage are implemented.
- [x] Admin Phase 4 privacy review excludes internal notes, raw confirmation
      terms/hashes, private feedback comments, and email delivery payloads.
- [x] Admin Phase 4 RPC migration explicitly approved and applied to the
      production-backed Supabase project.
- [x] Admin Phase 4 safe runtime denial/positive checks, CI, Vercel deployment,
      and production read-only smoke pass.
- [x] MFA is enforced before the Phase 6B failed-email retry capability.
- [x] No generic privileged database browser, impersonation, destructive
      mutation, membership-management UI, or hard deletion shipped implicitly.
- [x] Admin Phase 5 read-only email operations migration definition created.
- [x] Admin Phase 5 migration explicitly approved and applied to the configured
      production-backed project.
- [x] Email Operations uses acceptance terminology and exposes no message body,
      full recipient, provider identifier, or raw failure. Retry is detail-only
      and available only from server-derived safe eligibility.
- [x] Admin Phase 5 PR/CI, Vercel deployment, and production route smoke pass.
- [x] Admin Phase 6A uses native Supabase TOTP and adds no custom OTP storage.
- [x] Existing admin reads retain active-admin authorization; future writes use
      the centralized active-role plus signature-verified AAL2 gate.
- [x] Ordinary/owner AAL2, disabled-admin AAL2, active-admin AAL1, active-admin
      AAL2, and client-forgery policy cases have regression coverage.
- [x] MFA QR/secret/code are transient, private/no-store, and excluded from logs,
      audit evidence, storage, repository files, and screenshots.
- [x] Privileged confirmation, bounded optional reason, allowlisted audit
      evidence, and controlled sole-admin recovery are documented.
- [x] Failed-email retry requires active `SUPER_ADMIN`, AAL2, bounded reason,
      atomic evidence recheck, original-provider pinning, and preserved history.
- [x] `SENT`, `PENDING`, `SENDING`, ambiguous, recipient/configuration, and
      permanent failures cannot be retried; bulk/force retry and failover remain
      absent.
- [ ] Admin Phase 6B PR/CI, Vercel deployment, controlled Brevo smoke, and final
      zero-fixture cleanup pass.
- [x] Controlled temporary-admin TOTP enrollment/challenge/AAL2, invalid-code,
      logout/login, cleanup, PR/CI, deployment, and production smoke pass.

## Customer Communication Detour

- [x] Approved migrations applied without Docker or production domain fixtures.
- [x] Live snapshot is authenticated, current-business-scoped, minimized, and
      private/no-store.
- [x] Reschedule/delivery events stay inside the durable provider-neutral outbox.
- [x] Brevo primary, Resend standby, and no failover/double-send remain intact.
- [x] PWA push remains assessment-only; no service worker or subscription added.
- [ ] Full runtime security, E2E, build, audit, PR/CI, production deployment, and
      controlled production smoke pass.
- [ ] Admin Phase 6B remains explicitly verification-pending.

## Booking Completion And Required Business Logo

- [x] First and additional business setup cannot submit without a selected logo.
- [x] Setup becomes complete/current only after the optimized object and
      `businesses.logo_path` are persisted through the existing owner/RLS route.
- [x] Failed logo upload remains resumable and does not repeat business creation.
- [x] Existing legacy no-logo businesses remain usable; Business settings retain
      upload, replace, remove, and fallback behavior.
- [x] Booking completion and cancellation use application-owned accessible
      confirmation dialogs with no browser-native blocking prompt dependency.
- [x] PR #23 required CI, conflict-free merge `9dae103`, exact Vercel deployment,
      controlled production completion/onboarding smoke, and zero-fixture cleanup
      pass.

## Booking Lifecycle And Payment Recording Detour

- [x] Approved enum then schema migrations applied unchanged; catalog, frozen
      hashes, zero row rewrite, zero payment backfill, and four legacy
      `CONFIRMED` rows verified.
- [x] New confirmation records deterministic `CONFIRMED -> IN_PROGRESS` evidence
      atomically and normal UI has no Start work action.
- [x] Payment table/RPC is tenant-scoped, append-only, integer-minor-unit,
      idempotent, locked, and denies anonymous/direct/cross-tenant/overpayment.
- [x] Initial deposit and confirmed add-on deposits are counted exactly once;
      pending add-ons contribute zero and currencies remain separate.
- [x] Outstanding completion denial is database-enforced and no force-complete,
      refund, credit, waiver, correction, or fabricated historical payment path
      exists.
- [x] Payment dialog/history is labeled, responsive by construction, and fails
      closed when authoritative summary is unavailable.
- [x] Controlled runtime suite, full E2E responsive matrix, build, audit, and
      zero-fixture cleanup pass locally without Docker.
- [x] PR #31 passed all required CI, merged conflict-free as `c497d2e`, and the
      exact Vercel Production deployment passed controlled desktop/mobile smoke
      with real provider acceptance and zero-fixture cleanup.
- [x] Admin Phase 6B remains `IMPLEMENTED - VERIFICATION PENDING` with its
      documented external Supabase Auth Admin `createUser` HTTP 500 blocker;
      Admin Phase 7 remains not started.

## Booking Detail Clarity And Contact Email UX Detour

- [x] Public confirmation email is explicitly labeled and explained without an
      ownership-verification claim; optional phone remains secondary.
- [x] Empty-profile, same-email, different-email, and repeat-booking contact
      behavior preserve booking-specific evidence and notification authority.
- [x] Booking Journey remains visible; all ten secondary sections are accessible
      disclosures with contextual default-open logic and truthful summaries.
- [x] Manual collapse, independent expansion, anchor opening, keyboard/ARIA
      semantics, live-update behavior, and 320-1440 containment are covered.
- [x] No migration, multi-email schema, lifecycle rewrite, Docker, environment
      change, broad redesign, or Admin Phase 7 scope was introduced.
- [x] PR #33 passed all required CI and merged conflict-free as `84aa736`; Vercel
      deployed that exact merge successfully.
- [x] Controlled production desktop/mobile canonical journeys and the desktop
      repeat-booking/different-contact path passed with real Brevo acceptance;
      cleanup confirmed zero controlled fixture records or Auth users.

## Business Logo Upload Hotfix

- [x] Onboarding and Business settings use one shared client, route, owner gate,
      Sharp processor, deterministic Storage path, and database reference flow.
- [x] PNG/JPEG/WebP, spoofing, malformed bytes, source limits, EXIF orientation,
      metadata stripping, transparency, no upscaling, output dimensions, and
      persisted byte limits have regression coverage.
- [x] Timeout, malformed response, failure reset, same-file retry, unmount abort,
      and immediate duplicate-submit prevention are covered.
- [x] Storage RLS, owner/member/cross-tenant/anonymous boundaries, public read,
      deterministic replacement, removal ordering, and no-raw-original policy
      remain unchanged.
- [x] Full local gates, required CI, exact Vercel deployment, controlled
      desktop/mobile/onboarding production smoke, and zero-fixture cleanup pass.
- [x] No migration, environment change, Docker, broad redesign, detour rollback,
      or Admin Phase 7 work is included.

## Business Logo 5 MiB Source Support

- [x] Shared onboarding, first upload, and replacement accept supported source
      files up to exactly 5 MiB and reject larger selections before upload.
- [x] Sources above 3 MiB use one browser-native preprocessor with bounded
      lifecycle, stale cancellation, transparency and orientation handling.
- [x] Actual multipart payload remains below the 3 MiB file boundary plus 64 KiB
      overhead; direct raw 5 MiB upload is not attempted.
- [x] Server Sharp validation, 6000px/25 MP received-input defense, metadata
      stripping, 512px/200 KiB WebP output, owner authorization, and Storage RLS
      remain authoritative.
- [x] No raw/intermediate Storage, database migration, bucket, environment,
      dependency, Docker, or Admin Phase 7 change is included.
- [x] Full gates, CI, exact production deployment, controlled >4 MiB/exact-5 MiB
      production UI smoke, >5 MiB no-request proof, and fixture cleanup pass.
- [x] PR #37 passed seven executable checks with one expected protected Runtime
      Security skip, merged conflict-free as `dd0fe2c`, and Vercel deployed that
      exact commit to Production.
- [x] Exact 5 MiB and 4.8 MiB sources produced 2,146,239-byte and
      2,147,355-byte multipart requests; final metadata-free 384x512 WebP files
      were 58,946 and 58,838 bytes. The constrained replacement settled in
      15.049 seconds, >5 MiB sent no request, and cleanup left zero fixtures.

## Authenticated Navigation Performance V2

- [x] Desktop 1440x1000 and mobile 390x844 production click, destination-shell,
      useful-content, usable-control, and settled milestones compared with the
      recorded baseline using medians rather than a selected best run.
- [x] Dashboard to Bookings, booking detail, Customers, Insights, Business,
      browser Back, search, and business switching pass without stale tenant data.
- [x] Framework-owned per-Link state identifies only the latest pending
      destination; modifier/new-tab behavior and unrelated navigation remain
      native.
- [x] RSC request count/payload and vendor route gzip stay within documented
      budgets; admin and logo-preprocessor code remain route-isolated.
- [x] Focused typical/constrained Nigeria profiles and standalone/PWA smoke show
      no material bandwidth, CPU, overflow, or private-cache regression.
- [x] Auth/RLS/current-business, payment freshness, confirmation/live sync, and
      public capability `no-store` protections remain green.
- [x] No Redis, persistent tenant cache, service worker, speculative index/RPC,
      Edge migration, direct database bypass, environment change, or broad mobile
      prefetch was introduced.
- [x] PR #41 passed seven executable checks with one expected protected Runtime
      Security skip, merged conflict-free as `d2f55fd`, and Vercel deployed that
      exact commit to Production.
- [x] Controlled Auth and tenant fixtures, the temporary PWA profile, and the
      detached baseline worktree were removed after production verification.

## Admin Phase 7 Security & Health

- [x] Approved read-only RPC migration contains no table, row, index, enum, RLS,
      or existing-data mutation.
- [x] Both RPCs are postgres-owned `SECURITY DEFINER`, use empty search paths,
      repeat active-admin authorization, and deny PUBLIC/anonymous execution.
- [x] Active-admin production reads, ordinary-user direct-RPC denial, and
      anonymous grant denial are verified without fixtures.
- [x] Strict DTOs exclude customer/contact/content/provider-failure/token/session/
      TOTP/secret material.
- [x] State definitions and precedence are deterministic; unavailable evidence
      is `UNKNOWN`, not green.
- [x] AAL1 reads remain allowed; Phase 6B remains the sole AAL2-gated write and
      retains verification-pending status.
- [x] No provider probe, automatic polling, service-worker cache, page-view audit,
      remediation, provider switch, or infrastructure action exists.
- [x] The 15-minute stale-outbox threshold is documented; the historical pending
      event is not replayed or mutated.
- [x] Full local gates pass: lint, typecheck, 436-test Vitest suite, guarded
      runtime-security command, 34-pass/10-skip E2E, build, zero-vulnerability
      moderate audit, and whitespace/secret-value checks.
- [x] PR #39 was conflict-free and every required executable CI check passed;
      Runtime Security retained its expected protected-target skip.
- [x] Vercel deployed exact merge `d5bfb8f` to Production.
- [x] Authenticated canonical production smoke and an independent authoritative
      aggregate comparison passed with no write side effects; the exact deployed
      code passed E2E containment at 390, 768, 1024, and 1440 pixels.
- [x] The planned foundational admin roadmap is closed without beginning Admin
      Phase 8.

## PWA Resume Reliability

- [x] One authenticated-shell coordinator handles meaningful resume, persisted
      page restoration, offline/reconnect, and bounded request collapse.
- [x] Booking detail uses one minimized sync plus authoritative refresh; visible
      polling is 10 seconds and hidden tabs remain paused.
- [x] Changed forms and open dialogs are preserved; lifecycle and financial
      writes are never queued or replayed offline.
- [x] Current authentication, tenant membership/current-business selection, RLS,
      and private no-store capability behavior remain server-authoritative.
- [x] No service worker, private cache, push, background sync, database,
      environment, dependency, Docker, or infrastructure change was added.
- [x] Desktop Chromium, Pixel-class Chromium, and iPhone-class WebKit automated
      coverage passes without horizontal overflow or fixed-nav obstruction.
- [ ] Physical iOS homescreen/lock/snapshot/keyboard/photo-picker acceptance.
- [ ] Physical Android browser/standalone/network-handoff acceptance.
- [x] Exact merge `b0bd805` deployed to Production; desktop Chromium,
      Pixel-class Chromium, iPhone-class WebKit, and Chromium app-window smoke
      passed, with independent zero-fixture cleanup.

## Customer Contact, Validation, And Customer Lifecycle

- [x] Gmail, Outlook/Hotmail, Yahoo, iCloud, `.ie`, `.co.uk`, and custom-domain
      syntax coverage uses no provider allowlist and preserves mailbox case.
- [x] Customer recipient review/edit, malformed-address rejection, exact-link
      outbox association, correction reissue, old-link revocation invariant,
      and rapid duplicate no-send behavior have focused coverage.
- [x] Booking required-field failures are visible, first-invalid focused and
      scrolled, field-local when corrected, and still server-authoritative.
- [x] Customer Archive/Restore, owner-only zero-booking Delete, booking-history
      denial, booking preservation, race-safe database eligibility, member and
      cross-tenant denial are implemented and statically/integration tested.
- [x] Mobile swipe reveals but never executes actions; vertical scrolling,
      left-edge navigation, desktop menu, keyboard, and accessible labels are
      preserved in component coverage.
- [ ] Guarded mutation runtime suite executed on an explicitly safe dev/test
      target. It must remain skipped on the configured production-backed target.
- [x] Complete local formatting/lint/typecheck/test/runtime/E2E/build/audit/diff
      gate passes: 707 Vitest checks, 21 guarded Production-safe runtime skips,
      51 Playwright checks with 16 intentional project skips, and zero audit
      vulnerabilities.
- [ ] Required PR checks pass and the exact merge deploys to Production.
- [ ] Read-only production responsive, validation-presentation, navigation,
      auth, list, and Sentry smoke passes without creating customer/email data.
- [ ] Controlled provider/inbox, wrong-recipient, archive/restore, and delete
      mutation smoke runs only if a separately safe target and controlled
      recipients are available; otherwise record the limitation, not a pass.
