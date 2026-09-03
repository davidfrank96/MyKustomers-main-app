import { redirect } from "next/navigation";
import type { NextRequest } from "next/server";
import { isSocialPreviewCrawler } from "@/features/confirmation-links/crawlers";
import { getBusinessLogoPublicUrl } from "@/features/businesses/logo-public";
import {
  buildFeedbackMetadata,
  type FeedbackMetadata,
} from "@/features/feedback/metadata";
import { safePublicFeedbackMessage } from "@/features/feedback/messages";
import {
  getPublicFeedbackMetadata,
  getPublicFeedbackView,
  submitPublicFeedback,
} from "@/features/feedback/public";
import type { PublicFeedbackBooking } from "@/features/feedback/public-types";
import { MYKUSTOMERS_BRAND_ASSETS } from "@/lib/brand/assets";

export const dynamic = "force-dynamic";

type FeedbackRouteContext = {
  params: Promise<{ token: string }>;
};

const MY_KUSTOMERS_URL = "https://mykustomers.com";

const securityHeaders = {
  "Content-Type": "text/html; charset=utf-8",
  "Cache-Control": "no-store, max-age=0",
  "Referrer-Policy": "no-referrer",
  "X-Robots-Tag": "noindex, nofollow",
};

function escapeHtml(value: string | number | null | undefined) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatDateTime(value: string | null) {
  if (!value) return "Not available";

  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

// Generated from the project's Lucide icon set for this raw HTML route handler.
const iconShapes = {
  calendarCheck:
    '<path d="M8 2v4"></path><path d="M16 2v4"></path><path d="M21 14V6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h8"></path><path d="M3 10h18"></path><path d="m16 20 2 2 4-4"></path>',
  externalLink:
    '<path d="M15 3h6v6"></path><path d="M10 14 21 3"></path><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>',
  lock: '<circle cx="12" cy="16" r="1"></circle><rect x="3" y="10" width="18" height="12" rx="2"></rect><path d="M7 10V7a5 5 0 0 1 10 0v3"></path>',
  send: '<path d="M14.536 21.686a.5.5 0 0 0 .937-.024l6.5-19a.496.496 0 0 0-.635-.635l-19 6.5a.5.5 0 0 0-.024.937l7.93 3.18a2 2 0 0 1 1.112 1.11z"></path><path d="m21.854 2.147-10.94 10.939"></path>',
  shieldCheck:
    '<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"></path><path d="m9 12 2 2 4-4"></path>',
  store:
    '<path d="m2 7 4.41-4.41A2 2 0 0 1 7.83 2h8.34a2 2 0 0 1 1.42.59L22 7"></path><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"></path><path d="M15 22v-4a2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2v4"></path><path d="M2 7h20"></path><path d="M22 7v3a2 2 0 0 1-2 2a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 16 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 12 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 8 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 4 12a2 2 0 0 1-2-2V7"></path>',
  tag: '<path d="M12.586 2.586A2 2 0 0 0 11.172 2H4a2 2 0 0 0-2 2v7.172a2 2 0 0 0 .586 1.414l8.704 8.704a2.426 2.426 0 0 0 3.42 0l6.58-6.58a2.426 2.426 0 0 0 0-3.42z"></path><circle cx="7.5" cy="7.5" r=".5" fill="currentColor"></circle>',
} as const;

function icon(name: keyof typeof iconShapes, className = "icon") {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" class="${className}" aria-hidden="true" focusable="false">${iconShapes[name]}</svg>`;
}

function businessInitials(name: string) {
  return (
    name
      .trim()
      .split(/\s+/)
      .filter((part) => /[a-z0-9]/i.test(part))
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || "BK"
  );
}

function pageShell({ metadata, body }: { metadata: FeedbackMetadata; body: string }) {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex,nofollow">
  <title>${escapeHtml(metadata.title)}</title>
  <link rel="canonical" href="${escapeHtml(metadata.canonicalUrl)}">
  <meta name="description" content="${escapeHtml(metadata.description)}">
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="My Kustomers">
  <meta property="og:title" content="${escapeHtml(metadata.title)}">
  <meta property="og:description" content="${escapeHtml(metadata.description)}">
  <meta property="og:url" content="${escapeHtml(metadata.canonicalUrl)}">
  <meta property="og:image" content="${escapeHtml(metadata.imageUrl)}">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${escapeHtml(metadata.title)}">
  <meta name="twitter:description" content="${escapeHtml(metadata.description)}">
  <meta name="twitter:image" content="${escapeHtml(metadata.imageUrl)}">
  <style>
    :root {
      color-scheme: light;
      --background: #f7f8f6;
      --foreground: #17211d;
      --muted: #66716c;
      --border: #d9dfdb;
      --card: #ffffff;
      --primary: #176b58;
      --primary-dark: #125646;
      --primary-soft: #edf5f1;
      --danger: #a72d23;
    }
    * { box-sizing: border-box; }
    html { background: var(--background); }
    body {
      margin: 0;
      min-width: 0;
      min-height: 100dvh;
      background: var(--background);
      color: var(--foreground);
      font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      letter-spacing: 0;
    }
    a { color: inherit; }
    img { display: block; max-width: 100%; }
    button, input, textarea { font: inherit; }
    button, label, input[type="radio"] { -webkit-tap-highlight-color: transparent; }
    main {
      width: min(100%, 64rem);
      margin: 0 auto;
      padding: 1.25rem 1rem 2rem;
    }
    .platform-bar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 1rem;
    }
    .platform-brand, .platform-security {
      display: flex;
      align-items: center;
      gap: .625rem;
      min-width: 0;
    }
    .platform-brand {
      color: var(--primary-dark);
      text-decoration: none;
      font-size: .875rem;
      font-weight: 700;
    }
    .platform-brand > span:last-child { white-space: nowrap; }
    .platform-mark, .promo-mark {
      display: block;
      flex: 0 0 auto;
      object-fit: contain;
    }
    .platform-mark { width: 2.5rem; height: 2.5rem; }
    .platform-security {
      color: var(--muted);
      font-size: .75rem;
      line-height: 1.4;
      text-align: right;
    }
    .icon { width: 1.125rem; height: 1.125rem; flex: 0 0 auto; }
    .icon-small { width: 1rem; height: 1rem; flex: 0 0 auto; }
    h1 {
      margin: 2rem 0 0;
      font-size: 1.875rem;
      line-height: 1.15;
      font-weight: 700;
    }
    h2, p { margin: 0; }
    p, dd, legend, label, button, a { overflow-wrap: anywhere; }
    .lede {
      margin-top: .75rem;
      max-width: 44rem;
      color: var(--muted);
      font-size: .9375rem;
      line-height: 1.6;
    }
    .privacy-note, .notice, .form-error {
      border: 1px solid #cfddd5;
      border-radius: .5rem;
      background: #f1f7f4;
    }
    .privacy-note {
      display: flex;
      align-items: flex-start;
      gap: .75rem;
      margin-top: 1.5rem;
      padding: .875rem 1rem;
      color: var(--primary-dark);
      font-size: .875rem;
      font-weight: 600;
      line-height: 1.5;
    }
    .summary-card {
      display: grid;
      gap: 1rem;
      margin-top: 1.25rem;
      padding: 1rem;
      border: 1px solid var(--border);
      border-radius: .5rem;
      background: var(--card);
      box-shadow: 0 1px 3px rgba(23, 33, 29, .05);
    }
    .business-identity {
      display: flex;
      align-items: center;
      gap: .875rem;
      min-width: 0;
    }
    .business-logo {
      width: 4rem;
      height: 4rem;
      flex: 0 0 auto;
      border: 1px solid var(--border);
      border-radius: .5rem;
      background: var(--primary-soft);
      object-fit: cover;
    }
    .business-fallback {
      display: grid;
      place-items: center;
      color: var(--primary-dark);
      font-size: 1.125rem;
      font-weight: 800;
    }
    .eyebrow, dt {
      color: var(--muted);
      font-size: .75rem;
      font-weight: 650;
      line-height: 1.4;
    }
    .business-name {
      margin-top: .25rem;
      font-size: 1.25rem;
      font-weight: 700;
      line-height: 1.25;
      overflow-wrap: anywhere;
    }
    .business-copy {
      margin-top: .25rem;
      color: var(--muted);
      font-size: .8125rem;
      line-height: 1.45;
    }
    .booking-context { margin: 0; }
    .context-row {
      display: grid;
      grid-template-columns: 2rem minmax(0, 1fr);
      gap: .25rem .75rem;
      padding: .75rem 0;
      border-bottom: 1px solid var(--border);
    }
    .context-row:first-child { padding-top: 0; }
    .context-row:last-child { padding-bottom: 0; border-bottom: 0; }
    .context-icon {
      grid-row: span 2;
      display: grid;
      place-items: center;
      width: 2rem;
      height: 2rem;
      color: var(--primary);
      border-radius: .5rem;
      background: var(--primary-soft);
    }
    dd {
      margin: .125rem 0 0;
      min-width: 0;
      color: var(--foreground);
      font-size: .875rem;
      font-weight: 650;
      line-height: 1.45;
      overflow-wrap: anywhere;
    }
    form {
      margin-top: 1.5rem;
      display: grid;
      gap: 1.375rem;
    }
    fieldset { margin: 0; padding: 0; border: 0; min-width: 0; }
    legend, .field-label {
      margin-bottom: .625rem;
      color: var(--foreground);
      font-size: .9375rem;
      font-weight: 650;
      line-height: 1.45;
    }
    .choice-grid {
      display: grid;
      grid-template-columns: repeat(5, minmax(0, 1fr));
      gap: .375rem;
    }
    .choice-grid.two { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: .5rem; }
    .choice {
      min-width: 0;
      min-height: 3.25rem;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: .375rem;
      padding: .5rem .375rem;
      border: 1px solid var(--border);
      border-radius: .5rem;
      background: var(--card);
      color: var(--foreground);
      cursor: pointer;
      font-size: .875rem;
      font-weight: 600;
      transition: border-color .15s ease, background-color .15s ease, box-shadow .15s ease;
    }
    .choice:hover { border-color: #a9beb4; background: #fbfdfc; }
    .choice:has(input:checked) {
      border-color: var(--primary);
      background: var(--primary-soft);
      box-shadow: inset 0 0 0 1px var(--primary);
    }
    .choice:focus-within { outline: 2px solid var(--primary); outline-offset: 2px; }
    input[type="radio"] {
      width: 1rem;
      height: 1rem;
      flex: 0 0 auto;
      margin: 0;
      accent-color: var(--primary);
    }
    .rating-scale {
      display: flex;
      justify-content: space-between;
      gap: 1rem;
      margin-top: .5rem;
      color: var(--muted);
      font-size: .75rem;
      line-height: 1.4;
    }
    .binary-questions { display: grid; gap: 1.375rem; }
    .textarea-wrap { position: relative; }
    textarea {
      display: block;
      width: 100%;
      min-height: 8.5rem;
      border: 1px solid var(--border);
      border-radius: .5rem;
      background: var(--card);
      color: var(--foreground);
      padding: .75rem .875rem 2rem;
      resize: vertical;
      line-height: 1.55;
      transition: border-color .15s ease, box-shadow .15s ease;
    }
    textarea:focus {
      outline: 0;
      border-color: var(--primary);
      box-shadow: 0 0 0 2px rgba(23, 107, 88, .14);
    }
    .character-count {
      position: absolute;
      right: .75rem;
      bottom: .625rem;
      color: var(--muted);
      font-size: .75rem;
      line-height: 1;
    }
    .submit-button {
      width: 100%;
      min-height: 3rem;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: .625rem;
      border: 0;
      border-radius: .5rem;
      background: var(--primary);
      color: #fff;
      font-weight: 700;
      cursor: pointer;
      transition: background-color .15s ease, opacity .15s ease;
    }
    .submit-button:hover { background: var(--primary-dark); }
    .submit-button:focus-visible { outline: 2px solid var(--primary); outline-offset: 2px; }
    .submit-button:disabled { cursor: wait; opacity: .72; }
    .form-error {
      padding: .75rem .875rem;
      border-color: #e6c8c4;
      background: #fff6f4;
      color: var(--danger);
      font-size: .875rem;
      line-height: 1.5;
    }
    .notice {
      margin-top: 1.5rem;
      padding: 1rem;
      color: var(--foreground);
      font-size: .875rem;
      line-height: 1.55;
    }
    .notice p + p { margin-top: .25rem; color: var(--muted); }
    .promo {
      display: grid;
      gap: 1rem;
      margin-top: 1.75rem;
      padding: 1rem;
      border: 1px solid #d6e2dc;
      border-radius: .5rem;
      background: #f4f8f6;
    }
    .promo-intro {
      display: flex;
      align-items: flex-start;
      gap: .875rem;
      min-width: 0;
    }
    .promo-mark { width: 3rem; height: 3rem; font-size: 1rem; }
    .promo h2 { font-size: .9375rem; line-height: 1.4; }
    .promo p { margin-top: .25rem; color: var(--muted); font-size: .8125rem; line-height: 1.5; }
    .promo-action { padding-top: .875rem; border-top: 1px solid #d6e2dc; }
    .promo-link {
      display: inline-flex;
      align-items: center;
      gap: .375rem;
      margin-top: .5rem;
      color: var(--primary-dark);
      font-size: .875rem;
      font-weight: 700;
      text-decoration: none;
    }
    .promo-link:hover { text-decoration: underline; }
    .powered {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: .5rem;
      margin-top: 1.5rem;
      color: var(--muted);
      font-size: .75rem;
      line-height: 1.4;
      text-align: center;
    }
    .powered a { color: var(--primary-dark); font-weight: 700; text-decoration: none; }
    .powered a:hover { text-decoration: underline; }
    .sr-only {
      position: absolute;
      width: 1px;
      height: 1px;
      padding: 0;
      margin: -1px;
      overflow: hidden;
      clip: rect(0, 0, 0, 0);
      white-space: nowrap;
      border: 0;
    }
    @media (min-width: 48rem) {
      main { padding: 2rem 1.5rem 2.5rem; }
      h1 { margin-top: 2.5rem; font-size: 2.25rem; }
      .summary-card { grid-template-columns: minmax(0, .9fr) minmax(0, 1.1fr); gap: 1.5rem; padding: 1.25rem; }
      .booking-context { padding-left: 1.5rem; border-left: 1px solid var(--border); }
      .binary-questions { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 1.5rem; }
      .promo { grid-template-columns: minmax(0, 1.35fr) minmax(14rem, .65fr); align-items: center; gap: 1.5rem; padding: 1.25rem; }
      .promo-action { padding: 0 0 0 1.5rem; border-top: 0; border-left: 1px solid #d6e2dc; }
    }
    @media (max-width: 22.5rem) {
      .platform-bar { align-items: flex-start; gap: .5rem; }
      .platform-brand { gap: .5rem; }
      .platform-brand > span:last-child { font-size: .8125rem; }
      .platform-security { max-width: 7rem; gap: .375rem; font-size: .6875rem; }
      .choice { min-height: 3rem; padding-inline: .25rem; }
    }
    @media (max-width: 30rem) {
      .platform-security .icon-small { display: none; }
    }
    @media (prefers-reduced-motion: reduce) {
      *, *::before, *::after { scroll-behavior: auto !important; transition: none !important; }
    }
  </style>
</head>
<body>
  <main>
    <header class="platform-bar">
      <a class="platform-brand" href="${MY_KUSTOMERS_URL}" rel="noopener noreferrer">
        <img class="platform-mark" src="${MYKUSTOMERS_BRAND_ASSETS.logo.icon}" width="40" height="40" alt="">
        <span>MyKustomers.com</span>
      </a>
      <p class="platform-security">${icon("lock", "icon-small")}<span>Secure · Private · No account required</span></p>
    </header>
    ${body}
    <section class="promo" aria-labelledby="my-kustomers-promo-title">
      <div class="promo-intro">
        <img class="promo-mark" src="${MYKUSTOMERS_BRAND_ASSETS.logo.icon}" width="48" height="48" alt="">
        <div>
          <h2 id="my-kustomers-promo-title">Built for businesses. Loved by customers.</h2>
          <p>MyKustomers.com helps businesses deliver better experiences, stay organized, and build lasting customer trust.</p>
        </div>
      </div>
      <div class="promo-action">
        <p>Want to know more about MyKustomers.com?</p>
        <a class="promo-link" href="${MY_KUSTOMERS_URL}" rel="noopener noreferrer">Learn more ${icon("externalLink", "icon-small")}</a>
      </div>
    </section>
    <p class="powered">${icon("shieldCheck", "icon-small")}<span>Powered by <a href="${MY_KUSTOMERS_URL}" rel="noopener noreferrer">MyKustomers.com</a></span></p>
  </main>
</body>
</html>`;
}

function feedbackOpenTracker(token: string) {
  const safeToken = JSON.stringify(token).replace(/</g, "\\u003c");

  return `<script>
    fetch("/api/feedback/open", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: ${safeToken} }),
      cache: "no-store",
      keepalive: true
    }).catch(function () {});
  </script>`;
}

function feedbackFormBehavior() {
  return `<script>
    (function () {
      var form = document.querySelector("[data-feedback-form]");
      var comment = document.getElementById("comment");
      var count = document.querySelector("[data-comment-count]");
      var submit = document.querySelector("[data-submit-feedback]");
      var submitLabel = document.querySelector("[data-submit-label]");

      if (comment && count) {
        var updateCount = function () { count.textContent = String(comment.value.length); };
        comment.addEventListener("input", updateCount);
        updateCount();
      }

      if (form && submit && submitLabel) {
        form.addEventListener("submit", function () {
          submit.disabled = true;
          submit.setAttribute("aria-disabled", "true");
          form.setAttribute("aria-busy", "true");
          submitLabel.textContent = "Submitting feedback...";
        });
      }
    })();
  </script>`;
}

function bookingContext(booking: PublicFeedbackBooking, businessLogoUrl: string | null) {
  const businessIdentity = businessLogoUrl
    ? `<img class="business-logo" src="${escapeHtml(businessLogoUrl)}" alt="${escapeHtml(booking.business_name)} logo" width="64" height="64" decoding="async" referrerpolicy="no-referrer">`
    : `<span class="business-logo business-fallback" aria-hidden="true">${escapeHtml(businessInitials(booking.business_name))}</span>`;

  return `<section class="summary-card" aria-label="Feedback request details">
    <div class="business-identity">
      ${businessIdentity}
      <div>
        <p class="eyebrow">Business</p>
        <p class="business-name">${escapeHtml(booking.business_name)}</p>
        <p class="business-copy">We appreciate your private feedback.</p>
      </div>
    </div>
    <dl class="booking-context">
      <div class="context-row">
        <span class="context-icon">${icon("store")}</span>
        <dt>Booking</dt>
        <dd>${escapeHtml(booking.booking_title)}</dd>
      </div>
      <div class="context-row">
        <span class="context-icon">${icon("tag")}</span>
        <dt>Reference</dt>
        <dd>${escapeHtml(booking.booking_reference)}</dd>
      </div>
      <div class="context-row">
        <span class="context-icon">${icon("calendarCheck")}</span>
        <dt>Completed</dt>
        <dd>${escapeHtml(formatDateTime(booking.completed_at))}</dd>
      </div>
    </dl>
  </section>`;
}

function feedbackForm(token: string, attemptFailed: boolean) {
  const action = `/f/${encodeURIComponent(token)}`;

  return `${attemptFailed ? `<p class="form-error" role="alert">Your feedback could not be submitted. Check each required response and try again.</p>` : ""}
  <form action="${action}" method="post" data-feedback-form>
    <fieldset>
      <legend>Overall experience</legend>
      <div class="choice-grid">
        ${[1, 2, 3, 4, 5]
          .map(
            (rating) => `<label class="choice">
              <input required type="radio" name="overallRating" value="${rating}">
              <span>${rating}<span class="sr-only"> out of 5</span></span>
            </label>`,
          )
          .join("")}
      </div>
      <div class="rating-scale" aria-hidden="true"><span>Very poor</span><span>Excellent</span></div>
    </fieldset>
    <div class="binary-questions">
      <fieldset>
        <legend>Was everything completed on time?</legend>
        <div class="choice-grid two">
          <label class="choice"><input required type="radio" name="onTime" value="yes"><span>Yes</span></label>
          <label class="choice"><input required type="radio" name="onTime" value="no"><span>No</span></label>
        </div>
      </fieldset>
      <fieldset>
        <legend>Was the result what you expected?</legend>
        <div class="choice-grid two">
          <label class="choice"><input required type="radio" name="metExpectations" value="yes"><span>Yes</span></label>
          <label class="choice"><input required type="radio" name="metExpectations" value="no"><span>No</span></label>
        </div>
      </fieldset>
    </div>
    <div>
      <label class="field-label" for="comment">What could we do better?</label>
      <div class="textarea-wrap">
        <textarea id="comment" name="comment" maxlength="2000" aria-describedby="comment-count" placeholder="Optional private comment"></textarea>
        <span class="character-count" id="comment-count"><span data-comment-count>0</span>/2000</span>
      </div>
    </div>
    <button class="submit-button" type="submit" data-submit-feedback>${icon("send")}<span data-submit-label>Submit private feedback</span></button>
  </form>
  ${feedbackFormBehavior()}`;
}

function privacyNote() {
  return `<p class="privacy-note">${icon("shieldCheck")}<span>Your feedback is completely private and shared only with the business.</span></p>`;
}

export async function GET(request: NextRequest, context: FeedbackRouteContext) {
  const { token } = await context.params;
  const userAgent = request.headers.get("user-agent");

  if (isSocialPreviewCrawler(userAgent)) {
    const publicMetadata = await getPublicFeedbackMetadata(token);
    const metadata = buildFeedbackMetadata({
      token,
      businessName: publicMetadata?.businessName,
      businessLogoPath: publicMetadata?.businessLogoPath,
    });
    const body = `<div class="notice">
      <h1>Private feedback request</h1>
      <p>Open this secure link in your browser to share private feedback. No account is required.</p>
    </div>`;

    return new Response(pageShell({ metadata, body }), { headers: securityHeaders });
  }

  const [view, publicMetadata] = await Promise.all([
    getPublicFeedbackView(token),
    getPublicFeedbackMetadata(token),
  ]);
  const booking = view.booking;
  const submitted =
    request.nextUrl.searchParams.get("submitted") === "1" || view.status === "submitted";
  const metadata = buildFeedbackMetadata({
    token,
    businessName: booking?.business_name,
    businessLogoPath: publicMetadata?.businessLogoPath,
  });
  const businessLogoUrl = getBusinessLogoPublicUrl(publicMetadata?.businessLogoPath);

  if (booking) {
    const body = submitted
      ? `<h1>Thank you for your feedback</h1>
        <p class="lede">Your feedback has been shared privately with ${escapeHtml(booking.business_name)}.</p>
        ${privacyNote()}
        ${bookingContext(booking, businessLogoUrl)}
        <div class="notice">
          <p><strong>Feedback submitted</strong></p>
          <p>It is not posted publicly.</p>
        </div>`
      : `<h1>Private feedback</h1>
        <p class="lede">Share private feedback with ${escapeHtml(booking.business_name)}. No account is required.</p>
        ${privacyNote()}
        ${bookingContext(booking, businessLogoUrl)}
        ${
          view.status === "valid"
            ? feedbackForm(
                token,
                request.nextUrl.searchParams.get("attempt") === "failed",
              )
            : `<p class="notice">${escapeHtml(safePublicFeedbackMessage(view.status))}</p>`
        }`;

    const trackedBody =
      view.status === "valid" ? `${body}${feedbackOpenTracker(token)}` : body;

    return new Response(pageShell({ metadata, body: trackedBody }), {
      headers: securityHeaders,
    });
  }

  const body = `<div class="notice">
    <h1>Feedback unavailable</h1>
    <p>${escapeHtml(safePublicFeedbackMessage(view.status))}</p>
  </div>`;

  return new Response(pageShell({ metadata, body }), { headers: securityHeaders });
}

export async function POST(request: NextRequest, context: FeedbackRouteContext) {
  const { token } = await context.params;
  const formData = await request.formData();
  const result = await submitPublicFeedback(token, formData);

  if (result.status === "submitted" || result.status === "already_submitted") {
    redirect(`/f/${token}?submitted=1`);
  }

  redirect(`/f/${token}?attempt=failed`);
}
