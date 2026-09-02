# Auth Feature

Phase 2 implements the platform-user authentication foundation with Supabase
Auth, server actions, and App Router auth routes.

This feature must not store passwords or session tokens in application tables.
Business onboarding is implemented separately in the businesses feature. Staff
invitations and role management remain future work. Public signup confirmation,
reset-password completion, old/new password behavior, login, logout, session
handling, route protection, redirect safety, and tenant/RLS boundaries have
runtime evidence.

Production Site URL is `https://mykustomers.com`. Exact apex callback entries
for dashboard and password recovery coexist with the retained Vercel and local
callbacks. Supabase Auth email is separate from the application Brevo API
adapter. Production custom SMTP is enabled with the verified My Kustomers sender
through Brevo. Controlled signup and recovery emails reached the inbox and
completed through the canonical callbacks.

The authenticated shell exposes a compact account menu at mobile and desktop
widths. It links to the real Settings surface and existing `/logout` route;
that route and Settings both reuse `logoutAction`, so session clearing, audit,
safe redirect, and protected-route denial remain centralized. Settings is not a
sixth primary mobile navigation item.

Business selection is not part of Supabase Auth identity or session tokens. A
separate HTTP-only preference cookie is cleared on logout and accepted only
after active `business_members` validation. Authentication proves the user;
membership and RLS authorize each selected tenant.

Login and signup also share an optional `Continue with Google` control backed by
Supabase `signInWithOAuth`. Google returns through the existing PKCE callback and
therefore uses the same profile trigger, zero-business onboarding, valid current
preference/deterministic fallback, and logout behavior as password sessions.
Email/password login, recovery, and reset retain their provider-owned lifecycle.
Confirmation-required password signup is now explicit: `signUp` with no session
returns a verification action state, opens the accessible check-email dialog,
and leaves an exact-address notice after dismissal. It does not call the
membership/onboarding resolver until the canonical callback establishes a
session. Immediate-session signup still uses the normal resolver. Google OAuth
never receives the password verification dialog.

Verification resend uses `supabase.auth.resend({ type: "signup" })` with the
canonical callback. Its UI countdown mirrors the server retry result and the
response remains account-enumeration neutral. Login, signup, recovery, and
resend consume HMAC-derived account/source buckets before provider invocation;
successful password login clears only its account bucket while source attempts
remain counted. Application limiter unavailability fails open to Supabase Auth's
own protections so a storage incident does not become a total Auth outage.

Every Google start passes `prompt=select_account`, which deliberately shows the
account chooser without forcing a new consent grant. Password recovery remains
separate from OAuth destination state: the exact `/reset-password` callback
takes precedence over any stale OAuth-next cookie, exchanges the PKCE code, and
sets a ten-minute HTTP-only intent scoped to the reset route. Password update
requires that intent, consumes it, signs out, and clears workspace/onboarding
preferences before returning to login. Recovery requests and failures remain
account-enumeration neutral.

Provider availability comes from Supabase's public Auth settings and fails
closed. The current development project reports Google enabled. Provider
credentials belong only in Supabase Auth provider configuration; there is no
Vercel Google variable. The OAuth callback target stays on the exact configured
dashboard callback, while a short-lived HTTP-only callback cookie carries only a
sanitized local destination.

A real Google authorization completed through the normal local callback,
established a Google session, provisioned its profile, routed zero memberships
to onboarding, persisted after refresh, and logged out cleanly. The same account
then exercised one and multiple-business routing and switching locally and on
the merged production deployment. Same-email identity behavior remains a
separate lifecycle check. Application code does not perform email-based linking
or duplication.

Regardless of password or Google authentication, a zero-business user enters
the same staged onboarding flow. New workspace setup does not complete or select
the workspace until the businesses feature verifies a persisted optimized logo;
this does not change Auth sessions, callback routing, or provider behavior.
The same-browser pending-setup marker is cleared by the existing logout action
alongside the current-business preference; durable pending status remains on the
business until its owner completes the logo step.

## Authentication To Workspace Resolution

Supabase Auth establishes platform identity only. After password login, Google
OAuth callback, signup with an immediate session, password reset, or an already
authenticated visit to an Auth page, a shared server resolver sanitizes `next`
and resolves active `business_members` before entering a vendor destination.
An ordinary authenticated user without a completed active workspace is sent to
`/onboarding`; a vendor `next` value, selected-business cookie, profile row,
provider metadata, or client state cannot bypass that decision.

The `(dashboard)` layout repeats the authoritative current-business check before
rendering `DashboardShell`, and feature pages/actions retain their narrower
authorization checks. Onboarding is outside that route group, so a zero-business
account never receives vendor navigation or a misleading empty workspace shell.
Successful empty membership results and membership-query failures are distinct:
empty means onboarding, while query/data-integrity failures fail closed. Platform
Admin keeps its separate active-role gate and does not weaken the vendor rule.

Admin Phase 6A uses the same Supabase session for native TOTP assurance. Password
and Google OAuth establish AAL1 unless Supabase reports otherwise; neither is
treated as an application-owned second factor. Challenge/verify elevates the
Supabase session to AAL2, and logout removes that session without preserving a
client MFA flag. This policy applies only to future platform-admin writes and
does not require ordinary vendors to enroll MFA.
