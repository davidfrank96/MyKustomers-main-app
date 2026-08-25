# Domain And Email Infrastructure

Status: VERIFIED - PRODUCTION

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
destination address and credentials are not repository configuration. A
controlled message was recorded as received and delivered/forwarded by
Cloudflare.

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
is not proof of inbox delivery. Separate controlled evidence proved Brevo
acceptance, provider delivery, inbox receipt, and truthful Admin visibility for
one new booking-confirmation event.

Brevo reports the root domain authenticated with its exact domain code, two DKIM
records, and DMARC record matched. Its current shared-IP configuration did not
present an additional account-specific SPF record to add. Resend reports its
isolated return-path SPF, DKIM, and DMARC checks verified. DNS records are copied
only from provider-issued values; documentation never invents record contents.

## Supabase Auth Email

Supabase Auth email is independent from the application outbox. Production
custom SMTP is enabled with a dedicated Brevo SMTP credential and the verified
My Kustomers sender. Controlled signup confirmation and password-recovery
emails reached the inbox; canonical callbacks, password update, old-password
rejection, new-password login, session establishment, and logout passed.

Google OAuth also completed through the canonical callback after the Production
`NEXT_PUBLIC_APP_URL` value was recreated as public Config and the current
`main` deployment was redeployed.

## Operational Rules

- Never replay historical outbox events during provider activation.
- One event is claimed once and submitted to one configured provider.
- Do not copy provider credentials into Preview or Development.
- Do not add `NEXT_PUBLIC_` to provider credentials.
- Do not create marketing contacts, campaigns, or customer-list synchronization.
- Delivery/bounce webhooks, scheduled retry, Admin Retry, MFA for privileged
  retry, quota monitoring, and deliberate provider failover remain future work.

No database migration or new infrastructure is part of this activation.
