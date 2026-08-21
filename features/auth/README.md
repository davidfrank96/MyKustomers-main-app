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
