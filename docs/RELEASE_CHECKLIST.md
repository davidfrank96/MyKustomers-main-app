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
- [ ] Delivery/bounce webhook ingestion implemented.

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
- [ ] PR is conflict-free and every required executable CI check passes.
- [ ] Vercel deploys the exact merge commit to Production.
- [ ] Authenticated production smoke and authoritative aggregate comparison pass
      at 390, 768, 1024, and 1440 pixels with no write side effects.
- [ ] The planned foundational admin roadmap is closed without beginning Admin
      Phase 8.
