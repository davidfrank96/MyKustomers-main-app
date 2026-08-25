# Domain And Email Infrastructure

Status: IMPLEMENTED - PRODUCTION DELIVERY VERIFICATION PENDING

## Public Application Domain

- Canonical URL: `https://mykustomers.com`
- `https://www.mykustomers.com` permanently redirects to the canonical apex URL.
- `https://my-kustomers-main-app.vercel.app` remains a functioning alternate
  deployment hostname and retained Auth callback target.
- Cloudflare owns authoritative DNS. The Vercel apex and `www` records are
  DNS-only; existing mail records were inventoried and left intact.
- Vercel issued valid TLS for both custom hostnames.

Supabase Auth uses `https://mykustomers.com` as Site URL. The allowlist contains
exact apex callback URLs for dashboard and password recovery while preserving
the exact Vercel and legitimate local callbacks. Google continues to redirect
to the Supabase-owned OAuth callback.

## Inbound Email

`hello@mykustomers.com` is an active Cloudflare Email Routing alias to an
operator-controlled destination. Catch-all routing remains disabled. The
destination address and credentials are not repository configuration.

## Outbound Application Email

Application workflows create durable `email_events`, then the server-only
delivery boundary selects exactly one provider:

- Primary: Brevo direct transactional API.
- Standby: Resend direct transactional API.
- Automatic failover: not implemented.
- Development: no-network adapter unless explicitly configured otherwise.

The authenticated root domain and `My Kustomers
<notifications@mykustomers.com>` sender are verified in Brevo. Resend reports
the domain and its isolated return-path records verified. Provider credentials
exist only as Production-scoped Vercel secrets. A provider-accepted `SENT` event
is not proof of inbox delivery.

## Supabase Auth Email

Supabase Auth email is independent from the application outbox. Production
custom SMTP is enabled with a dedicated Brevo SMTP credential and the verified
My Kustomers sender. Signup confirmation and password recovery remain
verification-pending until controlled inbox delivery and callback completion
are reverified.

## Operational Rules

- Never replay historical outbox events during provider activation.
- One event is claimed once and submitted to one configured provider.
- Do not copy provider credentials into Preview or Development.
- Do not add `NEXT_PUBLIC_` to provider credentials.
- Do not create marketing contacts, campaigns, or customer-list synchronization.
- Delivery/bounce webhooks, scheduled retry, Admin Retry, MFA for privileged
  retry, quota monitoring, and deliberate provider failover remain future work.

No database migration or new infrastructure is part of this activation.
