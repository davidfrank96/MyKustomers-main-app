# Auth session, routing and confirmation integrity

Status: IMPLEMENTED — VERIFICATION PENDING. The native 24-hour session policy is
**PROVIDER CAPABILITY BLOCKED** on the project's verified Free plan; it is not
configured or verified.

## Scope and baseline

Started from clean currency branch `9498e925bcd8e1717fdb15ddbd1298da6655582a`.
Preserved its draft PR #86. A separate `auth-session-routing-confirmation`
worktree starts from fetched `origin/main` `cea7ad4b50e40daedfce3031a39c8fee68c7fb8e`.
Production initially reports that same SHA, deployment
`dpl_SX7HRb5pbBrbkKKVzgmW8mcjuTqH`, READY/production. Currency architecture is
unchanged; this branch does not silently merge PR #86.

## Session architecture and configuration boundary

Supabase owns password/Google PKCE sign-in, short-lived JWTs, refresh rotation,
logout and recovery. `@supabase/ssr` 0.12.4 stores browser-readable Auth cookies
for browser/server refresh; the separate one-year current-business preference
is HTTP-only, SameSite=Lax, Secure in production and membership-validated.
`proxy.ts` calls `getClaims()` through `updateSession`; refreshed cookies reach
both the forwarded request and response. Server identity/AAL reads use verified
claims with request-scoped React memoization. There is no session-age localStorage,
unsigned age cookie, browser timer or application session table.

The desired provider-native maximum lifetime is 24 hours. After the user signed
in on 2026-09-18, the dashboard confirmed MyKustomers project
`xtwzdgxbnlplsvcnmeje` is on the Free plan. Its Sessions page explicitly says
configuration requires Pro or above; the session controls and Save are disabled.
This replaces the earlier management-access uncertainty with a verified provider
capability blocker. No setting or subscription has been changed.

| Dashboard setting | Before | After read-only audit |
| --- | --- | --- |
| Time-box user sessions | 0 hours (never) | 0 hours (never) |
| Access token expiry | 3600 seconds | 3600 seconds |
| Inactivity timeout | 0 hours (never) | 0 hours (never) |
| Enforce single session | Off | Off |
| Detect/revoke compromised refresh tokens | On | On |
| Refresh token reuse interval | 10 seconds | 10 seconds |
| Enable Passkey authentication | Off | Off |

The safest native route is a user-approved upgrade to Pro or above, then applying
only the already-authorized 24-hour time-box and testing controlled refreshes on
both sides of the boundary. No paid upgrade is authorized by this audit. A custom
server-owned enforcement design would require separate review and implementation;
it is not a drop-in workaround. The PR remains draft while this policy is blocked.

[Supabase sessions](https://supabase.com/docs/guides/auth/sessions) documents
native time-boxing on Pro and above and enforcement at refresh. Existing access
tokens can remain valid until expiry, so effective lifetime can include the JWT
interval (currently one hour). The change does not instantly delete old sessions.
After the project has a supported plan: record exact settings, change only the
maximum lifetime to 24h if supported, reread it, and verify controlled sessions
before/after the boundary without changing legitimate sessions or JWT expiry.
If the plan lacks support, report a provider capability blocker and propose a
supported plan or a separately reviewed server-owned enforcement design. Do not
silently enable a paid upgrade or invent a client timer.

## Routing findings and corrections

The general report “opening `/` sends a laptop to onboarding” is NOT reproduced.
The marketing page does not resolve identity/membership. Existing code already
throws on failed/null membership responses and unresolved business joins, and
stale business selection already falls back to an allowed business.

Executable server tests reproduced two narrower defects before the fix:

- An active admin-only account logging in with the default vendor destination
  was routed to vendor onboarding. The shared entry resolver now chooses
  `/admin`, which retains its independent active-admin role and AAL2 rules.
- A member of a pending business who cannot finish the owner's required-logo
  step was treated as needing to create a business. This now fails safely.

Onboarding independently runs the same decision. Existing pending-owner logo
recovery remains available, including an owner's deliberately unfinished extra
business; this is completion of an existing business, not proof of zero memberships.
Only verified ordinary zero-membership accounts receive a fresh creation form.
Admin lookup uncertainty on this decision fails safely rather than becoming
ordinary onboarding. Normal completed-business requests do not add an admin RPC.

The dashboard layout also hard-coded `/dashboard` as the login return path.
The proxy now overwrites an internal path header from the actual request URL;
the server layout sanitizes it before requiring the workspace. A client-supplied
header cannot select an external return URL. Notification resolvers already
retain their internal destination across login and remain unchanged.

| State | Result |
| --- | --- |
| Anonymous/invalid/expired identity on protected vendor path | Login with sanitized internal return path |
| Verified identity + completed allowed business | Requested workspace |
| Stale selected business + another allowed business | Deterministic allowed selection |
| Membership lookup failed/null/unresolved join | Error/retry; no creation form |
| Active memberships but no usable workspace or owned setup | Safe failure |
| Owner of an unfinished required-logo setup | Resume that setup |
| Verified zero memberships + active platform admin | Separate `/admin` gate |
| Verified zero memberships + no active platform admin | Onboarding creation |
| Public home or customer capability | No vendor-onboarding decision |

Normal logout and recovery already clear current-business and pending-setup
cookies. A stale preference is never authority after expiry. Service-worker
network-only private navigation and PWA lifecycle behavior are unchanged.
Browser/provider refresh before 24h and expiry after 24h require live provider
verification; fixture routing tests do not prove a configured lifetime.

## Passkeys: audit only

Application status: **NOT ENABLED**. No passkey/WebAuthn opt-in, enrollment or
sign-in path exists. The dashboard's **Enable Passkey authentication** switch was
verified Off on 2026-09-18 and left unchanged. The lockfile resolves
`@supabase/supabase-js` 2.112.3.
[Supabase passkey docs](https://supabase.com/docs/guides/auth/passkeys) require
2.105.0+ and still label the opt-in API experimental; the May 28 changelog calls
it Beta. No SDK upgrade or experimental activation was performed.

A separate follow-up should use RP ID `mykustomers.com`, display name
`My Kustomers`, and exact HTTPS canonical origins (add `https://www.mykustomers.com`
only if it serves a supported sign-in surface). Do not use arbitrary Preview
origins or change an RP ID after registration. Offer enrollment only after a
confirmed authenticated account, clear device-credential management/removal,
Google/email coexistence and an authenticated recovery path. Keep responses
neutral against enumeration, minimize credential metadata, and never store
biometric data. An expired session must obtain a new Supabase session through
WebAuthn rather than unlock stale cookies. Verify cancellation, missing/lost
passkeys, multiple credentials, recovery, AAL policy, cross-device credentials,
and real iOS/Android installed-PWA behavior before rollout. Desktop WebKit is not
physical Face ID evidence.

## Confirmation and customer text

Form `title`/`description`, validation (160/5000 characters), create/edit actions,
RPC parameters and public resolver use separate fields. No mapping defect was
found; no persistence or RPC change was made. Native form submission may convert
LF to CRLF without losing paragraphs. The permanent canonical E2E fixture now
checks distinct title/description in the saved row and customer DOM.

The proven confirmation rendering defect was right-aligned description text in
a narrow value column with collapsed newlines. Details now use a full text area
below their label, left alignment, pre-wrap, normal word breaking, anywhere
wrapping and comfortable line height. Title remains a separate row. Empty
confirmation descriptions omit the Details row. React continues escaping text.
Amendment current/proposed text and add-on descriptions had the same newline
collapse and receive only bounded typography changes. Feedback has no booking
description surface; its escaped booking title already wraps and is unchanged.

The local production-build fixture checks 320×568, 360×800, 375×812, 390×844,
414×896, 430×932, 768×1024, 1024×768, 1280×800, 1440×900 in Chromium and WebKit:
login/signup, zero-business onboarding, long title, 1500+ characters, paragraphs,
bullet-like lines, URL, unbroken text, title/detail separation, exact newline
retention, absent details and NGN/USD/GBP/EUR. No global overflow hiding is added.

## Evidence and release gate

Permanent coverage lives in `auth-routing-state`, `auth-return-path`,
`onboarding-entry`, `public-confirmation-content`, the Profile browser auth/text
matrix and the canonical booking journey. Before-fix routing evidence: 18 pass,
2 fail; after-fix focused routing/return/onboarding/text: 45 pass.

Full run results, PR/head, CI and release evidence are recorded in the final
A–BG report under `output/playwright/auth-integrity/FINAL_REPORT.md`.
Do not mark Production verified without native setting readback, controlled
session-age verification, green required CI and exact deployed merge SHA.
Physical PWA/biometrics, interactive Google consent and real inbox delivery are
not established by synthetic fixtures. SENTRY — NOT VERIFIED unless checked
against the exact release. Scheduler configuration remains untouched and active
as requested; no migration, dependency, environment, provider or DNS change.
