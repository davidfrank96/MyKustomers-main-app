# Reschedule lifecycle and Safari input stability

Status: **IMPLEMENTED — DEVICE / PRODUCTION VERIFICATION PENDING**.
Branch: `fix/reschedule-and-safari-input-stability`.
This report describes local evidence. It does not declare Production released.

## A–AZ acceptance report

| Item | Evidence / result |
| --- | --- |
| A. Starting SHA | `84971b283a59851ef243b37fbfd203da74a37982`; refreshed origin/main again before PR preparation and unchanged. Existing worktrees preserved. |
| B. Reschedule reproduction | Read the deployed RPC/schema using a read-only Production connection, with no row export. Loaded schema into disposable native PostgreSQL, created synthetic overdue bookings, and exercised original RPCs before patching. |
| C. Actual failing status | **READY** in the controlled reproduction. The reporter's original booking status was not provided or inferred. |
| D. Frontend root cause | READY omitted from eligibility; stale “before operational work” copy contradicted IN_PROGRESS support. `isBookingReschedulable` now centralizes all five allowed application states. |
| E. Database root cause | Deployed `reschedule_booking` rejected READY; integrity trigger also locked its material terms. Simply extending the allowed list would fail. Confirmation read/write functions accepted only AWAITING_CUSTOMER. |
| F. IN_PROGRESS before fix | Overdue IN_PROGRESS accepted a new future schedule, returning AWAITING_CUSTOMER under existing reconfirmation semantics. No extra IN_PROGRESS defect was reproduced. |
| G. READY before fix | Rejected with `booking_not_eligible_for_reschedule`. |
| H. Allowed | DRAFT, AWAITING_CUSTOMER, CONFIRMED, IN_PROGRESS, READY. |
| I. Blocked | DELIVERED, COMPLETED, CANCELLED. Direct and channel-wrapper RPC attempts rejected. UI controls disabled; cancellation copy is distinct. |
| J. READY afterward | READY, including after secure reconfirmation; ready timestamp retained. Delivery is blocked while current confirmation is invalidated. |
| K. Notifications | Real database matrix: 24 status/channel combinations. Previously confirmed reschedules create one BOOKING_RESCHEDULED intent per selected channel and a replacement capability; same-schedule duplicate rejected. No external send performed. |
| L. Email | Email-only/Both enqueue one email; WhatsApp-only enqueues none. Existing nine-event lifecycle/channel regression passes. |
| M. WhatsApp | WhatsApp-only/Both enqueue one WhatsApp event; Email-only enqueues none. Existing provider adapter, consent, entitlement and dispatcher paths unchanged. |
| N. Audit/history | One BOOKING_RESCHEDULED audit and reschedule booking_changes record; original confirmation evidence retained. Pending IN_PROGRESS amendment revocation explicitly tested. Existing add-on lifecycle regression passes. |
| O. Safari reproduction | Deterministically held a real server-validation response while typing in a different input. Baseline stole focus; with focus preserved alone, WebKit still reverted each typed character while the same DOM node remained connected. |
| P. Exact root cause | Two shared-hook defects: delayed error navigation stole active editing focus; capture-phase error-clearing state updates preceded the controlled field's change handler, reverting input in WebKit. Moving clearing to bubbling change fixed the reproduced input reversion. This does not prove the reporter's physical keyboard symptom is fully resolved. |
| Q. Error navigation | Preserves an active editable control; otherwise scrolls instantly and focuses the first invalid field. Error clearing bubbles after field handlers and avoids repeated no-op updates. Accessible errors and server validation remain. No UA sniff or arbitrary timeout. |
| R. Currency input | Unchanged. Grouping, canonical hidden decimals, mid-string caret edits, Backspace, formatted insertion/paste simulation, and blur normalization pass. Selection restoration was not the reproduced cause. |
| S. Datetime | Unchanged controlled datetime-local/hidden ISO contract. Invalid past value retained; future correction preserves input identity and correct ISO. Physical native picker not verified. |
| T. Remount/focus audit | No changing-key remount defect reproduced. Input handles remain connected through validation/correction. Intentional customer-switch WhatsApp reset preserved. Payment duplicate-submit disabling unchanged; inputs become editable after failure. |
| U. Final Safari behavior | WebKit retains focus and continuous typing through delayed validation; correction, deletion, insertion, repeated submit, payment dialog reentry and viewport restoration pass. |
| V. Physical iOS | **PHYSICAL IOS SAFARI — NOT VERIFIED**. No physical device evidence available. |
| W. Chromium | Desktop browser and seven mobile/tablet viewports covered in the fixture suite, plus existing mobile Chromium E2E. |
| X. WebKit repetition | Exact delayed-validation regression passed three independent repetitions with zero retries. |
| Y. Responsive matrix | 320×568, 360×800, 375×812, 390×844, 414×896, 430×932, 768×1024 in both engines. Booking validation, reschedule field bounds, payment dialog, input identity and no horizontal overflow checked. Representative screenshots visually reviewed; existing design retained. |
| Z. Navigation/keyboard | Mobile nav remains inside viewport after contraction/restoration; focused field retained. Notification/PWA regressions pass. This is browser layout evidence, not a physical software-keyboard test. |
| AA. Migration | `20260924210343_reschedule_through_ready.sql`: four CREATE OR REPLACE functions in one transaction; no table, RLS, ACL or signature change. Locally applied/tested only. Production not applied. |
| AB. Environment | NONE. |
| AC. Dependencies | NONE. |
| AD. Files | Application changes: booking detail page, booking/customer/reschedule forms, shared error-navigation hook, booking status helper and journey projection. Database: one additive migration. Tests/runner/fixture and relevant documentation updated; detailed list below. |
| AE. Tests | Eight-state unit/UI/RPC matrices; overdue active schedules; READY reconfirmation/capability replay/unguarded confirmation denial; history/outbox counts; pending amendment revocation; tenant/anonymous/terminal denial; action rate limits; 34 Chromium/WebKit form cases. |
| AF. Lint | PASS. |
| AG. Typecheck | PASS. |
| AH. Unit/integration | 183 files passed / 21 skipped; 1,185 tests passed / 24 skipped. Skips remain guarded; no tests weakened. |
| AI. Runtime Security | **SKIPPED** — 21 protected runtime tests; no approved protected non-production target configured in this checkout. |
| AJ. E2E | Local: 40 passed / 62 credential-dependent or optional cases skipped. Not a complete authenticated-cloud E2E pass. CI uses its existing configured fixture credentials separately. |
| AK. Profile/Social | 49 passed in Chromium/WebKit. |
| AL. Notification Contracts | Native disposable database checks passed; browser suite 24 passed. |
| AM. WhatsApp UI/Admin | 62 passed, including all 34 form cases and existing channel, summary and Admin regressions. Default native WhatsApp contracts passed; optional full-schema lifecycle and 24-combination matrix passed. |
| AN. Build | PASS, production Next build. |
| AO. Dependency audit | PASS, zero vulnerabilities at moderate threshold. |
| AP. Diff check | PASS before commit. |
| AQ. PR | Opened from this branch; see task's attached PR and final response. |
| AR. CI | GitHub checks are reported on the PR for its current head. Local results above are separate evidence. |
| AS. Merge SHA | NOT MERGED; user requested manual merge after green CI. |
| AT. Production deployment | NOT PERFORMED. Deploy and apply the reviewed migration together before Production acceptance. |
| AU. Production IN_PROGRESS | NOT RUN; requires merged deployment and safe controlled fixture. |
| AV. Production READY | NOT RUN; requires migration, merged deployment, and safe controlled fixture. |
| AW. Production DELIVERED | NOT RUN; local UI/RPC denial verified. |
| AX. Production Safari | NOT RUN; no Production release occurred. |
| AY. Limitations | Physical iOS keyboard/picker, production release/smoke, and protected Runtime Security remain unverified. Full-schema SQL matrix is local caller-supplied-schema mode, not the default CI lightweight database fixture. Existing CI cloud-target caveat is documented in CI.md. No real customer sends authorized or performed for this task. |
| AZ. Final status | **RESCHEDULE + SAFARI INPUT STABILITY — IMPLEMENTED — DEVICE VERIFICATION PENDING** |

## Changed source and verification files

- `app/(dashboard)/bookings/[bookingId]/page.tsx`
- `components/forms/{booking-form,customer-form,booking-reschedule-form}.tsx`
- `hooks/use-form-error-navigation.ts`
- `features/bookings/{status,journey}.ts`
- `supabase/migrations/20260924210343_reschedule_through_ready.sql`
- `scripts/test-whatsapp-database.mjs`
- `tests/database/whatsapp/reschedule.sql`
- `tests/whatsapp-ui/form-stability.spec.ts`
- `tests/profile-ui/fixture-server.mjs`
- `tests/unit/{booking-reschedule-status,booking-journey,whatsapp-booking-action}.test.ts`
- `tests/integration/booking-reschedule-form.test.tsx`

Documentation updated: PRODUCT_SPEC, DATA_MODEL, MIGRATIONS, DECISIONS, security,
TESTING, RESPONSIVE_QA, CHANGELOG, bookings feature README, and this report.
Existing historical decisions remain as history and are explicitly superseded.

## Local evidence and safe release order

Ignored `output/playwright/reschedule-safari/` contains browser screenshots and
`evidence/` logs, baseline reproduction and schema-only snapshot. It contains no
customer rows and is not committed. No controlled recipient from earlier phases
was copied into source, fixtures, docs, or this report.

Keep PR unmerged for manual review. After green required checks, release the
migration and application in a coordinated window; do not expose READY support
against the old database functions. Use only safe controlled fixtures/recipients
for Production acceptance. Verify overdue IN_PROGRESS, overdue READY preserving
READY, DELIVERED denial, secure reconfirmation and Safari correction. Verify on a
physical iPhone before declaring its keyboard/picker behavior resolved.
