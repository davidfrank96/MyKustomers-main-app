# SEO Phase 1

## Canonical identity

The public brand is **My Kustomers**. `MyKustomers` is reserved for compact
technical identifiers. The one Production SEO origin is
`https://mykustomers.com`; `https://www.mykustomers.com` permanently redirects
to the apex. Preview, Vercel, `www`, local, and query-string URLs must never
become canonical. `mycustomers.com` is not a product domain and must not be
configured.

## Route matrix

| Actual route or group | Classification | Index | Sitemap | Canonical | Robots policy |
| --- | --- | ---: | ---: | --- | --- |
| `/` | Public marketing | Yes, Production only | Yes | Self | Index/follow in Production |
| `/login`, `/signup`, `/logout`, `/forgot-password`, `/reset-password`, `/auth/*` | Auth | No | No | None | Noindex/nofollow/noarchive |
| `/onboarding` | Private onboarding | No | No | None | Noindex/nofollow/noarchive |
| `/dashboard`, `/bookings/*`, `/customers/*`, `/insights`, `/business/*`, `/settings` | Private vendor workspace | No | No | None | Noindex/nofollow/noarchive |
| `/admin/*` | Private administration | No | No | None | Noindex/nofollow/noarchive |
| `/c/[token]`, `/a/[token]`, `/x/[token]`, `/f/[token]` | Private capability | No | No | None | Noindex/nofollow/noarchive/nosnippet/noimageindex |
| `/api/*` | API | No | No | None | Excluded from the Production crawl surface |
| `/api/health` | Operational API | No | No | None | Not applicable |
| `/_next/*`, `/brand/*`, `/manifest.webmanifest` | Static/runtime asset | No page | No | None | Crawlable when needed to render public content |

There are no separate About, Features, How It Works, Contact, Privacy, or Terms
routes in Phase 1. The homepage contains real Features, How It Works, and target-
audience sections. New informational pages remain a controlled later-phase
decision rather than empty SEO inventory.

## Metadata architecture

`lib/seo/site.ts` is the sole source for the canonical SEO origin, public site
name, default positioning, crawler policies, and homepage structured data. The
root layout uses the canonical origin as `metadataBase`; the homepage owns its
self-canonical and complete Open Graph/X card. Auth, onboarding, vendor, admin,
and capability boundaries set explicit noindex metadata and response headers.

Vercel Preview and local responses receive `X-Robots-Tag: noindex, nofollow,
noarchive, nosnippet, noimageindex`. Preview/local `robots.txt` disallows all.
Production `robots.txt` permits the public page and identifies the canonical
sitemap while excluding APIs. Private HTML remains fetchable so a crawler can
observe its page/header noindex; `robots.txt` is not an authorization mechanism.

Capability metadata is deliberately generic. It contains no token URL, tenant
name, customer/booking value, tenant logo, canonical, or Open Graph URL. Existing
`Cache-Control: no-store` and `Referrer-Policy: no-referrer` controls remain.

## Sitemap

`app/sitemap.ts` is an explicit allowlist. Phase 1 contains exactly one URL:
`https://mykustomers.com/`. It omits `lastModified` rather than manufacturing a
fresh timestamp. Auth, private, admin, capability, API, Preview, and tenant data
can never enter the generated list through discovery.

## Structured data

The homepage emits server-rendered JSON-LD with `Organization`, `WebSite`, and
truthful `WebApplication` objects. The application category is
`BusinessApplication` and operating system is `Web`. There is no Offer, price,
rating, review, founder, address, user count, social profile, or site-search
action. My Kustomers is not marked as a `LocalBusiness`. Breadcrumbs are omitted
because the only indexable route is the homepage. JSON serialization escapes
`<` to prevent a script-closing injection boundary.

These types describe the page but do not guarantee a Google rich result.

## Public positioning

The concise product position is **booking and customer management for growing
service businesses**. Nigeria context appears naturally in visible homepage
copy. The lifecycle remains customer request, confirmation, payment and
fulfilment tracking, delivery, and private feedback. The product is not described
as a payment processor, accounting system, or full CRM.

The homepage has one H1 and server-rendered text. Its feature, workflow, target-
audience, CTA, and footer links use normal anchors or Next links. The approved
1200x630 Open Graph asset, favicon set, Apple touch icon, and PWA assets remain
the official identity sources.

## Search Console

Use a Google Search Console Domain property for `mykustomers.com`. Never create
the main property for the Vercel hostname, `www`, or `mycustomers.com`. If DNS
verification is needed, add only the exact Google-generated TXT value after
confirming the apex; do not alter MX, SPF, DKIM, DMARC, BIMI, or other records.
Submit only `https://mykustomers.com/sitemap.xml`, inspect the homepage, and
request homepage indexing. Search Console—not the `site:` operator—is the owned
indexing authority. Indexing and rich-result appearance are never guaranteed.

## Performance and content growth

SEO changes must preserve Performance V2, mobile stability, reduced motion, and
the existing PWA. No SEO dependency is required. Phase 2 defers blogs, location
or industry page expansion, comparisons, case studies, testimonials, public
vendor profiles, internationalization, paid search, backlinks, and outreach
until Search Console provides real query evidence and the product team approves
the content scope.

## Permanent invariants

> Only useful public marketing and information pages may be indexed.
> Authentication, private workspace, administrative and capability-token routes
> must remain excluded from search engines.

> All Production public SEO signals use `https://mykustomers.com` as the
> canonical origin. Preview, `www`, Vercel and local URLs must not become
> canonical.

> SEO metadata and structured data must describe visible, truthful product
> content. Ratings, reviews, prices, customer counts, locations and claims must
> not be invented for search visibility.
