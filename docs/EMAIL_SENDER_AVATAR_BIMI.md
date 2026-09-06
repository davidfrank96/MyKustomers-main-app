# Email Sender Avatar / BIMI Readiness

Status: APPROVAL REQUIRED

Date: 2026-09-06

## Objective And Boundary

The goal is the My Kustomers platform logo beside authenticated messages in
supporting inboxes. It is not another image inside the email body. The shared
transactional shell already renders exactly one approved body logo and remains
unchanged.

No DNS, DMARC, Brevo, sender, Supabase Auth SMTP, certificate, billing,
environment, database, or provider change was made during this audit.

## Current Evidence

| Check | Read-only result | Assessment |
| --- | --- | --- |
| Last verified application From | `My Kustomers <notifications@mykustomers.com>` | Visible From domain is the apex. Confirm again in Brevo before any rollout. |
| Authenticated sending domain | `mykustomers.com` | Previously verified in Brevo with two DKIM records and the Brevo domain code. |
| Supabase Auth | Custom Brevo SMTP using the verified My Kustomers sender | Same apex identity is intended; configuration must be rechecked during enforcement planning. |
| Apex SPF TXT | `v=spf1 include:_spf.mx.cloudflare.net ~all` | Present. This root record describes Cloudflare mail routing; application DMARC may rely on aligned DKIM. Do not add a second SPF record. |
| Brevo domain code | Present at apex | Value intentionally omitted from this report. |
| DKIM | Last verified by Brevo; exact selectors not re-read in this repository-only audit | Must be revalidated for application and Auth streams before enforcement. |
| DMARC TXT | `v=DMARC1; p=none; rua=mailto:rua@dmarc.brevo.com` | Blocking: BIMI requires `quarantine` or `reject`; `p=none` is insufficient. |
| BIMI TXT | No record at `default._bimi.mykustomers.com` | Not configured. |
| Body logo | Canonical email PNG occurs once in the shared wrapper | Correct and regression-tested. |

`SENT` remains provider acceptance rather than proof of inbox delivery or sender-
avatar display.

## Current Requirements

The [BIMI Group implementation guide](https://bimigroup.org/implementation-guide/)
requires aligned SPF/DKIM/DMARC, enforcement at `p=quarantine` or `p=reject` with
100 percent coverage, an SVG Tiny P/S logo, and a BIMI DNS record. Its
[SVG guidance](https://bimigroup.org/creating-bimi-svg-logo-files/) requires a
square, self-contained SVG with `version="1.2"`, `baseProfile="tiny-ps"`, a
title, no scripts/external references/embedded rasters, and a maximum 32 KB size.

[Google Workspace BIMI guidance](https://support.google.com/a/answer/10911320)
requires DMARC enforcement and a VMC or CMC/PEM for Gmail support. A standalone
self-asserted SVG does not provide equivalent Gmail coverage.

[Brevo's BIMI guidance](https://help.brevo.com/hc/en-us/articles/27769318543506-Implement-BIMI-to-display-your-logo-next-to-your-emails)
states that its account supports only one static BIMI header and that mailbox
providers retain final display discretion.

## Logo Asset Blocker

The approved source archive contains PNG masters only. The repository's files
named `.svg` are lossless wrappers around embedded PNG data, including metadata,
and exceed the BIMI size limit. SVG Tiny P/S forbids embedded rasters. Automatic
tracing would redraw the mark and cannot prove pixel-faithful geometry, gradients,
or legal mark identity.

Therefore no fake or approximate BIMI asset was added. The smallest safe next
step is for the operator or original designer to provide an authentic vector
master of the exact approved icon, or explicitly approve professional vector
reconstruction and mark review.

## Approval-Ready Rollout Sequence

1. Inventory every legitimate apex sender, including application Brevo API,
   Supabase Auth Brevo SMTP, Resend standby, and any human/forwarding workflow.
2. Revalidate exact DKIM selectors and relaxed/strict From alignment for every
   stream; review DMARC aggregate reports before enforcement.
3. Approve a staged DMARC plan ending at `p=quarantine` or `p=reject` with full
   coverage. This is a Production email-security change.
4. Supply and validate an authentic SVG Tiny P/S asset at a stable canonical
   HTTPS path with `Content-Type: image/svg+xml`.
5. Decide whether to purchase a CMC/VMC for Gmail support and verify mark rights.
6. Only then publish a default BIMI record conceptually shaped as:

   ```text
   default._bimi.mykustomers.com TXT "v=BIMI1; l=https://mykustomers.com/brand/mykustomers/v1/email-identity/mykustomers-bimi.svg; a=https://mykustomers.com/brand/mykustomers/v1/email-identity/mykustomers-mark.pem;"
   ```

   The `a=` value must be omitted for a deliberately self-asserted rollout; no
   certificate URL may be invented.
7. Confirm Brevo's account-wide static header will not affect another domain,
   validate DNS/HTTPS/MIME/profile, and send at most one controlled message to an
   operator-owned inbox.

Even after successful configuration, no mailbox-provider avatar display is
guaranteed.
