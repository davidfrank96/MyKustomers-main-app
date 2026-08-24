import { redirect } from "next/navigation";
import type { NextRequest } from "next/server";
import {
  getPublicFeedbackMetadata,
  getPublicFeedbackView,
  submitPublicFeedback,
} from "@/features/feedback/public";
import {
  buildFeedbackMetadata,
  type FeedbackMetadata,
} from "@/features/feedback/metadata";
import { safePublicFeedbackMessage } from "@/features/feedback/messages";
import type { PublicFeedbackBooking } from "@/features/feedback/public-types";
import { isSocialPreviewCrawler } from "@/features/confirmation-links/crawlers";

export const dynamic = "force-dynamic";

type FeedbackRouteContext = {
  params: Promise<{ token: string }>;
};

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
  if (!value) {
    return "Not available";
  }

  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
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
  <meta property="og:site_name" content="My Customers">
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
      --background: #fbfaf8;
      --foreground: #1d2521;
      --muted: #65706a;
      --border: #ded8cf;
      --card: #ffffff;
      --primary: #214f45;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      min-height: 100dvh;
      background: var(--background);
      color: var(--foreground);
      font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }
    main {
      width: min(100%, 40rem);
      margin: 0 auto;
      padding: 2rem 1.25rem;
    }
    h1 {
      margin: 1.25rem 0 0;
      font-size: clamp(1.875rem, 8vw, 2.25rem);
      line-height: 1.1;
    }
    p { line-height: 1.65; }
    p, dd, legend, label, button { overflow-wrap: anywhere; }
    .brand, .muted, .powered { color: var(--muted); }
    .brand { font-size: .875rem; font-weight: 600; }
    .context, .notice {
      margin-top: 1.25rem;
      border: 1px solid var(--border);
      border-radius: .5rem;
      background: var(--card);
    }
    .context div {
      padding: .875rem 1rem;
      border-bottom: 1px solid var(--border);
    }
    .context div:last-child { border-bottom: 0; }
    dt {
      color: var(--muted);
      font-size: .75rem;
      font-weight: 700;
    }
    dd {
      margin: .25rem 0 0;
      font-size: 1rem;
      font-weight: 650;
    }
    form {
      margin-top: 1.5rem;
      display: grid;
      gap: 1.25rem;
    }
    fieldset {
      margin: 0;
      padding: 0;
      border: 0;
      display: grid;
      gap: .75rem;
    }
    legend, label { font-size: .875rem; font-weight: 650; }
    .choice-grid {
      display: grid;
      grid-template-columns: repeat(5, minmax(0, 1fr));
      gap: .5rem;
    }
    .choice-grid.two { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .choice {
      min-width: 0;
      min-height: 3rem;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: .5rem;
      border: 1px solid var(--border);
      border-radius: .5rem;
      background: var(--card);
      cursor: pointer;
    }
    input[type="radio"] { width: 1rem; height: 1rem; accent-color: var(--primary); }
    textarea {
      width: 100%;
      min-height: 8rem;
      margin-top: .5rem;
      border: 1px solid var(--border);
      border-radius: .5rem;
      background: var(--card);
      color: var(--foreground);
      padding: .75rem;
      font: inherit;
      resize: vertical;
    }
    button {
      width: 100%;
      min-height: 3rem;
      border: 0;
      border-radius: .5rem;
      background: var(--primary);
      color: #fff;
      font: inherit;
      font-weight: 700;
      cursor: pointer;
    }
    .notice {
      padding: 1rem;
      background: #fff;
    }
    .powered {
      margin-top: 2rem;
      text-align: center;
      font-size: .75rem;
    }
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
  </style>
</head>
<body>
  <main>
    <p class="brand">My Customers</p>
    ${body}
    <p class="powered">Powered by My Customers</p>
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

function bookingContext(booking: PublicFeedbackBooking) {
  return `<dl class="context">
    <div>
      <dt>Business</dt>
      <dd>${escapeHtml(booking.business_name)}</dd>
    </div>
    <div>
      <dt>Booking</dt>
      <dd>${escapeHtml(booking.booking_title)}</dd>
    </div>
    <div>
      <dt>Reference</dt>
      <dd>${escapeHtml(booking.booking_reference)}</dd>
    </div>
    <div>
      <dt>Completed</dt>
      <dd>${escapeHtml(formatDateTime(booking.completed_at))}</dd>
    </div>
  </dl>`;
}

function feedbackForm(token: string) {
  const action = `/f/${encodeURIComponent(token)}`;

  return `<form action="${action}" method="post">
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
    </fieldset>
    <fieldset>
      <legend>Was everything completed on time?</legend>
      <div class="choice-grid two">
        <label class="choice"><input required type="radio" name="onTime" value="yes">Yes</label>
        <label class="choice"><input required type="radio" name="onTime" value="no">No</label>
      </div>
    </fieldset>
    <fieldset>
      <legend>Was the result what you expected?</legend>
      <div class="choice-grid two">
        <label class="choice"><input required type="radio" name="metExpectations" value="yes">Yes</label>
        <label class="choice"><input required type="radio" name="metExpectations" value="no">No</label>
      </div>
    </fieldset>
    <div>
      <label for="comment">What could we do better?</label>
      <textarea id="comment" name="comment" maxlength="2000" placeholder="Optional private comment"></textarea>
    </div>
    <button type="submit">Submit private feedback</button>
  </form>`;
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
      <p class="muted">Open this secure link in your browser to share private feedback. No account is required.</p>
    </div>`;

    return new Response(pageShell({ metadata, body }), {
      headers: securityHeaders,
    });
  }

  const view = await getPublicFeedbackView(token);
  const booking = view.booking;
  const submitted =
    request.nextUrl.searchParams.get("submitted") === "1" || view.status === "submitted";
  const metadata = buildFeedbackMetadata({
    token,
    businessName: booking?.business_name,
  });

  if (booking) {
    const body = submitted
      ? `<h1>Thank you for your feedback</h1>
        <p class="muted">Your feedback has been shared privately with ${escapeHtml(booking.business_name)}.</p>
        ${bookingContext(booking)}
        <div class="notice">
          <p><strong>Feedback submitted</strong></p>
          <p class="muted">It is not posted publicly.</p>
        </div>`
      : `<h1>Private feedback</h1>
        <p class="muted">Share private feedback with ${escapeHtml(booking.business_name)}. No account is required.</p>
        ${bookingContext(booking)}
        ${
          view.status === "valid"
            ? feedbackForm(token)
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
    <p class="muted">${escapeHtml(safePublicFeedbackMessage(view.status))}</p>
  </div>`;

  return new Response(pageShell({ metadata, body }), {
    headers: securityHeaders,
  });
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
