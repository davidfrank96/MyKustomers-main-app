# Communication and About verification — 12 October 2026

STATUS: IMPLEMENTED — VERIFICATION PENDING

## Scope and release boundary

Started from `main` / `1aa41cc200c60aac8c7d4e3ef172c21b0fdf4b50`, using isolated branch `polish/legal-reschedule-whatsapp`. Terms-only commit `8dc25fb` completed first. The user will merge manually. The branch will be pushed for PR checks and preview; production application release awaits the user’s manual merge.

## Rescheduling

New `reschedule_booking_update` and `reschedule_booking_update_with_channels` RPCs classify and lock the tenant booking before mutation. CONFIRMED, IN_PROGRESS and READY with current confirmation fields and historical confirmation evidence retain status, operational timestamps and immutable original confirmation. A schedule change creates history/audit and the selected channel intents; it creates no confirmation link or encrypted WhatsApp capability. Other material changes still require the existing amendment workflow. DRAFT/AWAITING and legacy READY without confirmation evidence retain the secure confirmation behavior.

Email uses the latest valid immutable booking-confirmation contact, never the customer profile. Missing evidence with Email selected aborts the entire update. WhatsApp-only remains independent. Each change has a distinct idempotency source, including repeated later changes against the same original confirmation. Informational templates show previous/new schedule and say no action is required; legacy secure-link messages remain supported. Existing conservative retry policy and ambiguous-outcome handling remain unchanged (admin retry remains unavailable for BOOKING_RESCHEDULED).

The additive `20261012003112_operational_reschedule_updates.sql` migration introduces a nullable `email_events.reschedule_confirmation_id`, bound by a composite foreign key to the same business and booking. This avoids changing the uniqueness of original confirmation events. New RPCs alone enable the controlled operational flag; the currently deployed app's legacy RPC semantics remain unchanged until manual merge. No RLS policies or broader grants were added. Anonymous invocation and vendor access to dispatch context remain denied.

## WhatsApp diagnosis — read-only

Production Vercel target was READY at main `1aa41cc`. Production enable switch ENABLED, provider expected WA-AKG, exact single pilot allowlist, expected HTTPS gateway URL; API/session/control secrets exist in Production and were not printed. Preview switch DISABLED. Frankenstein (`9475fe63-5b03-4682-a159-a7d3a0ef7c10`) entitlement and private rollout enabled; one enabled pilot; control not paused. Scheduler active every minute and 1,440 successful scheduler invocations in the sampled 24 hours. Scheduler success alone does not prove a send.

Two recent October 8 pilot bookings had persisted Both preferences, valid consent, and one generated confirmation link each, but no email or WhatsApp event. Audit records show BOOKING_CREATED followed only by CONFIRMATION_LINK_CREATED. The first missing boundary was an explicit send/domain event: generating a manually shared link does not enqueue provider delivery. The deployed confirmation-request RPC still contains channel fanout. UI copy now explicitly distinguishes manual link generation from sending through selected channels.

Gateway and MySQL active; HTTPS health healthy; WhatsApp CONNECTED and restricted to one recipient. A healthy session was not restarted. The recipient guard was not removed or widened. No evidence established a recipient-guard failure for the two bookings because neither reached dispatch. No new paid resources, infrastructure changes or rollout changes were made.

The user explicitly chose **Leave the live send pending**. This task has sent **0 messages**. No provider acceptance, delivery or live end-to-end recovery is claimed. Existing two ACCEPTED September events remain historical evidence only.

## About / Terms

About uses the final Terms `LegalPage`, `LegalSection` and shared `LegalDocumentDialog`, with a server-rendered Profile row and document children. `/about` is canonical/public and present in the sitemap. The modal includes the full-page link, bounded scrolling, focus trap, Escape and focus restoration. Six capability sections follow the supplied product copy without payment-processing or delivery guarantees. Terms legal text, date and metadata remain protected by the original byte-for-byte test.

## Database preparation

User explicitly approved additive preparation after reviewing the tested migration scope. Applied only after four exact function-body drift guards matched the fresh schema-only backup. Migration SHA-256: `2f661ca09741ecf46af1ee3334c0bdfd687b8c5fd41b7a04f02898409449d89d`. Application succeeded; read-only verification confirms both new RPCs, validated tenant-bound proof FK, vendor/anonymous ACLs, exactly one enabled pilot, zero new informational notices and unchanged two pilot WhatsApp events. No booking row migration, message send, environment change, gateway change or dependency change.

## Verification evidence

- Native disposable full production-schema copy: complete original lifecycle with amendments/add-ons; 24 status/channel combinations; immutable proof; no new capability; duplicate same schedule denied; later distinct schedules allowed; controlled flags reset; direct material edits denied; cross-tenant/anonymous/terminal denied; READY delivery; missing-contact atomic failure; WhatsApp-only independence; legacy READY and old deployed RPC compatibility.
- CI's isolated native fixture now additionally applies the actual migration and executes new RPCs/integrity trigger across nine operational state/channel combinations, repeated distinct updates, capability-free dispatch and RPC ACL checks.
- Unit/integration: 1,210 passed, 24 pre-existing guarded skips at final completed run.
- Runtime Security: 21 guarded tests skipped because no dedicated authorized test target is configured. Not a pass.
- Dependency policy: existing development-only GHSA-vfj7-8cjw-p6xm exception, expiry 2026-10-21; not broadened.
- Profile/Social: 59 passed in Chromium/WebKit. Final legal/About rerun after heading polish: 6 passed, covering all ten widths. WhatsApp UI: 70 passed. Notification browser: 24 passed on clean rerun after one initial WebKit page-setup timeout. E2E: 82 passed and 19 existing skips in the full run; the three initially failing cases passed on targeted rerun after updating the sitemap assertion for About. The admin navigation timeout passed unchanged. Total 85 unique passing cases.
- Lint: 0 errors, 1 pre-existing unused-import warning in control-fixture.mjs. Typecheck passed. Production build passed as the prerequisite of the final optimized browser run.
- Production dependencies: npm audit --omit=dev reports 0 vulnerabilities.

Screenshots and logs are ignored under `output/playwright/communication/` and `output/playwright/legal/`. Synthetic browser fixtures only. Canonical Terms evidence is documented in [TERMS_UI_REDESIGN.md](TERMS_UI_REDESIGN.md).

Alignment/polish: PASS for the inspected Terms/About desktop and mobile pages/modals. Shared component review preserves server rendering, minimal client state, semantic headings, keyboard disclosures and canonical links. Admin already shows separate Channel and Session states with Restricted visibly distinct from Connected; no redundant redesign.

## Requested acceptance record (A–BL)

| Item | Result |
| --- | --- |
| A. Starting branch/SHA | main / 1aa41cc; isolated polish/legal-reschedule-whatsapp |
| B. Terms prerequisite | Completed first in 8dc25fb; legal text/date unchanged |
| C. Previous behavior | Reschedule invalidated confirmation and required a new secure confirmation |
| D. Root architecture | New controlled/versioned RPCs, integrity flag, immutable proof and channel fanout |
| E. Final behavior | Schedule changes immediately; operational state/evidence preserved; informational channel notices |
| F. Customer reconfirmation | NO for confirmed operational reschedules |
| G. New email entry | NO for confirmed operational reschedules |
| H. New reschedule capability | NO for post-confirmation updates |
| I. Confirmation evidence | Immutable row and current fields preserved in real SQL matrix |
| J. Booking change | One immutable change/audit per distinct schedule |
| K. CONFIRMED | Preserved; disposable DB verified |
| L. IN_PROGRESS | Preserved; disposable DB and browser lifecycle verified |
| M. READY | Preserved; disposable DB verified |
| N. READY → DELIVERED | Valid with existing proof; disposable full lifecycle verified |
| O. Unconfirmed/legacy | Secure existing confirmation behavior retained |
| P. Email | Informational render/dispatch, recipient evidence and channel isolation tested |
| Q. WhatsApp reschedule | Capability-free dispatch/schema/template tested; live send deferred |
| R. Failure reproduction | Two recent pilot bookings have links but no send events |
| S. First missing boundary | Explicit confirmation send/domain event; manual link generation does not send |
| T. Global switch | Production enabled; preview disabled |
| U. Frankenstein entitlement | Enabled |
| V. DB rollout | Exactly one enabled pilot, Frankenstein |
| W. Scheduler | Active every minute; sampled 1,440/1,440 successful scheduler runs |
| X. Gateway | Healthy; MySQL active; WhatsApp connected |
| Y. Guard | Restricted, one recipient; unchanged; not reached by the reported bookings |
| Z. WhatsApp change | Clarified manual-link/send UI; no speculative gateway restart or guard removal |
| AA. Controlled send | Deferred at explicit user request; no acceptance claim |
| AB. Task messages | 0 |
| AC. About framework | Final LegalPage, LegalSection and LegalDocumentDialog |
| AD. About modal | Implemented, keyboard/focus/scroll verified |
| AE. /about | Public canonical page plus sitemap |
| AF. Profile row | Existing row opens modal; canonical link works without JavaScript |
| AG. Content | Supplied positioning and six current capabilities, no overclaims |
| AH. Terms preserved | Original source hash test passes |
| AI. Responsive matrix | All ten required widths tested |
| AJ. Safari/WebKit | Legal/About and Profile suite passed |
| AK. Alignment/polish | PASS on inspected responsive screenshots |
| AL. Migration | Approved additive preparation applied with drift guard; SHA above |
| AM. RLS/security | No new RLS policy; tenant proof FK; controlled RPC/dispatch ACLs tested |
| AN. Environment | No values changed |
| AO. Gateway | No changes or restarts |
| AP. Dependencies | No package/lock changes; scoped existing audit exception retained |
| AQ. Changed files | See PR diff; scoped application, SQL, regression tests and governance docs |
| AR. Tests | Real SQL lifecycle/CI contracts, action/dispatch/recipient and responsive modal tests |
| AS. Lint | PASS; one pre-existing warning |
| AT. Typecheck | PASS |
| AU. Unit/integration | 1,210 passed, 24 guarded skips |
| AV. Runtime Security | 21 guarded skips, not a runtime-security pass |
| AW. E2E | 85 unique passes across full run (82) and targeted rerun (3); 19 existing skips |
| AX. Profile/Social | 59 passed; final legal/About polish rerun 6 passed |
| AY. Notification Contracts | Native DB passed; 24 browser tests passed on clean rerun |
| AZ. WhatsApp UI | 70 passed |
| BA. Build | Optimized production builds passed |
| BB. Dependency audit | Production 0; full audit retains exact development-only exception |
| BC. Diff check | PASS |
| BD. PR | Local gates complete; branch prepared for PR to main and manual merge |
| BE. CI | Current-head GitHub checks are recorded on the PR; no gate bypass authorized |
| BF. Merge SHA | None; user merges manually |
| BG. Production deployment | Existing 1aa41cc READY; new application deployment pending manual merge |
| BH. Production reschedule smoke | Pending release; local app/production-backed synthetic E2E is separate evidence |
| BI. Production WhatsApp smoke | Explicitly deferred; zero task messages |
| BJ. Production About/Terms smoke | Pending manual merge/deployment |
| BK. Limitations | Deferred live send, guarded runtime security, existing conservative schedule-email retry policy |
| BL. Final status | IMPLEMENTED — VERIFICATION PENDING |

## Remaining release checks

Local gates complete; current-head CI must pass on the PR before manual merge. Manual merge, new production deployment, operational reschedule UI smoke and production About/Terms smoke pending. Controlled WhatsApp send explicitly deferred. Migration application alone is not application release.

MY KUSTOMERS COMMUNICATION + ABOUT PASS — IMPLEMENTED — VERIFICATION PENDING
