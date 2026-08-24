# Auth Feature

Phase 2 implements the platform-user authentication foundation with Supabase
Auth, server actions, and App Router auth routes.

This feature must not store passwords or session tokens in application tables.
Business onboarding is implemented separately in the businesses feature. Staff
invitations and role management remain future work. Public signup confirmation
and reset-password completion remain verification-pending because they require
a controlled inbox and successful Supabase Auth email delivery; login, logout,
session handling, route protection, redirect safety, and tenant/RLS boundaries
have runtime evidence.

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
Email/password signup, login, recovery, and reset remain unchanged.

Provider availability comes from Supabase's public Auth settings and fails
closed. The current development project reports Google enabled. Provider
credentials belong only in Supabase Auth provider configuration; there is no
Vercel Google variable. The OAuth callback target stays on the exact configured
dashboard callback, while a short-lived HTTP-only callback cookie carries only a
sanitized local destination.

A real Google authorization completed through the normal local callback,
established a Google session, provisioned its profile, routed zero memberships
to onboarding, persisted after refresh, and logged out cleanly. The same account
then exercised one and multiple-business routing and switching. Production OAuth
and same-email identity behavior remain release checks. Application code does
not perform email-based linking or duplication.
