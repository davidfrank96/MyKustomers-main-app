import { publicEnv } from "@/lib/config/public-env";

const VERIFIED_MY_KUSTOMERS_URL = "https://mykustomers.com";

export function getTransactionalEmailPlatformUrl() {
  try {
    const configuredUrl = new URL(publicEnv.NEXT_PUBLIC_APP_URL);
    if (
      configuredUrl.protocol === "https:" &&
      (configuredUrl.hostname === "mykustomers.com" ||
        configuredUrl.hostname === "www.mykustomers.com")
    ) {
      return configuredUrl.origin;
    }
  } catch {
    // Production email attribution must never fall back to a local or preview URL.
  }

  return VERIFIED_MY_KUSTOMERS_URL;
}

export function withMyKustomersAttribution(text: string) {
  return [
    text,
    "",
    "Want to know more about My Kustomers?",
    "Discover how My Kustomers helps small businesses manage bookings and customers.",
    `Visit My Kustomers: ${getTransactionalEmailPlatformUrl()}`,
  ].join("\n");
}

export function escapeEmailHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function formatEmailDateTime(value: string | null) {
  if (!value) {
    return "Not scheduled";
  }

  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  }).format(new Date(value));
}

export type EmailDetailRow = {
  label: string;
  value: string;
  emphasis?: boolean;
};

export type TransactionalEmailSection = {
  title: string;
  rows: EmailDetailRow[];
};

type TransactionalEmailHtmlInput = {
  contextLabel: string;
  businessName: string;
  heading: string;
  introduction: string[];
  sections: TransactionalEmailSection[];
  footer: string;
  cta?: {
    label: string;
    url: string;
  };
  notice?: string;
  tone?: "success" | "neutral" | "warning";
};

function emailBusinessInitial(name: string) {
  return name.trim().charAt(0).toLocaleUpperCase() || "M";
}

function emailLineBreaks(value: string) {
  return escapeEmailHtml(value).replaceAll("\n", "<br>");
}

function renderEmailSection(section: TransactionalEmailSection) {
  const rows = section.rows
    .map(
      (row) => `<tr>
        <td class="detail-label${row.emphasis ? " detail-emphasis" : ""}" style="width:42%;padding:13px 18px;border-top:1px solid #dfe7e2;color:${row.emphasis ? "#145c49" : "#5d6a64"};font-size:14px;font-weight:${row.emphasis ? "700" : "400"};vertical-align:top;word-break:break-word;">
          ${escapeEmailHtml(row.label)}
        </td>
        <td class="detail-value${row.emphasis ? " detail-emphasis" : ""}" style="width:58%;padding:13px 18px;border-top:1px solid #dfe7e2;color:${row.emphasis ? "#145c49" : "#17201c"};font-size:${row.emphasis ? "18px" : "14px"};font-weight:${row.emphasis ? "700" : "600"};line-height:1.45;text-align:right;vertical-align:top;overflow-wrap:anywhere;word-break:break-word;">
          ${emailLineBreaks(row.value)}
        </td>
      </tr>`,
    )
    .join("");

  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;margin:0 0 18px;border:1px solid #d7e1db;border-collapse:separate;border-spacing:0;border-radius:8px;overflow:hidden;background:#ffffff;">
    <tr>
      <td colspan="2" style="padding:15px 18px;background:#f3f8f5;color:#176c56;font-size:15px;font-weight:700;line-height:1.4;">
        ${escapeEmailHtml(section.title)}
      </td>
    </tr>
    ${rows}
  </table>`;
}

export function renderTransactionalEmailHtml(input: TransactionalEmailHtmlInput) {
  const platformUrl = getTransactionalEmailPlatformUrl();
  const tone = input.tone ?? "neutral";
  const heroBackground =
    tone === "success" ? "#f0f8f3" : tone === "warning" ? "#fff8ed" : "#f4f7f5";
  const heroBorder =
    tone === "success" ? "#b9dbc9" : tone === "warning" ? "#ead2a9" : "#d7e1db";
  const heroAccent = tone === "warning" ? "#925f16" : "#176c56";
  const introduction = input.introduction
    .map(
      (paragraph) =>
        `<p style="margin:8px 0 0;color:#52605a;font-size:15px;line-height:1.55;">${escapeEmailHtml(paragraph)}</p>`,
    )
    .join("");
  const sections = input.sections.map(renderEmailSection).join("");
  const cta = input.cta
    ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:22px 0 4px;">
        <tr>
          <td bgcolor="#176c56" style="border-radius:7px;background:#176c56;">
            <a href="${escapeEmailHtml(input.cta.url)}" style="display:inline-block;padding:13px 20px;color:#ffffff;text-decoration:none;font-size:15px;font-weight:700;line-height:1.2;">${escapeEmailHtml(input.cta.label)}</a>
          </td>
        </tr>
      </table>`
    : "";
  const notice = input.notice
    ? `<p style="margin:20px 0 0;padding:13px 15px;border:1px solid #d7e1db;border-radius:7px;background:#f7faf8;color:#52605a;font-size:13px;line-height:1.55;">${escapeEmailHtml(input.notice)}</p>`
    : "";

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <meta name="color-scheme" content="light dark">
    <meta name="supported-color-schemes" content="light dark">
    <title>${escapeEmailHtml(input.heading)}</title>
    <style>
      @media only screen and (max-width: 480px) {
        .email-gutter { padding: 12px !important; }
        .email-card { width: 100% !important; }
        .email-content { padding: 20px 16px !important; }
        .brand-context { display: block !important; width: 100% !important; padding-top: 8px !important; text-align: left !important; }
        .detail-label, .detail-value { display: block !important; width: auto !important; text-align: left !important; }
        .detail-label { padding-bottom: 3px !important; }
        .detail-value { padding-top: 3px !important; }
      }
      @media (prefers-color-scheme: dark) {
        .email-page { background: #111714 !important; }
        .email-card, .email-surface { background: #18201c !important; }
        .email-copy { color: #edf3ef !important; }
        .email-muted { color: #b7c2bc !important; }
      }
    </style>
  </head>
  <body class="email-page" style="margin:0;padding:0;background:#f1f5f2;color:#17201c;font-family:Arial,Helvetica,sans-serif;-webkit-text-size-adjust:100%;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;background:#f1f5f2;">
      <tr>
        <td class="email-gutter" align="center" style="padding:24px 12px;">
          <table role="presentation" width="600" cellpadding="0" cellspacing="0" class="email-card" style="width:100%;max-width:600px;border:1px solid #d7e1db;border-collapse:separate;border-spacing:0;border-radius:10px;overflow:hidden;background:#ffffff;">
            <tr><td style="height:4px;background:#176c56;font-size:0;line-height:0;">&nbsp;</td></tr>
            <tr>
              <td class="email-content" style="padding:22px 24px 0;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="color:#145c49;font-size:15px;font-weight:800;letter-spacing:.3px;">MK&nbsp;&nbsp;MY KUSTOMERS</td>
                    <td class="brand-context" align="right" style="color:#69756f;font-size:13px;">${escapeEmailHtml(input.contextLabel)}</td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td class="email-content" style="padding:18px 24px 0;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #dfe7e2;">
                  <tr>
                    <td style="padding:18px 0 0;vertical-align:middle;">
                      <span style="display:inline-block;width:42px;height:42px;border-radius:8px;background:#145c49;color:#ffffff;font-size:20px;font-weight:700;line-height:42px;text-align:center;vertical-align:middle;">${escapeEmailHtml(emailBusinessInitial(input.businessName))}</span>
                      <span class="email-copy" style="display:inline-block;max-width:475px;margin-left:12px;color:#17201c;font-size:16px;font-weight:700;line-height:1.4;vertical-align:middle;overflow-wrap:anywhere;">${escapeEmailHtml(input.businessName)}</span>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td class="email-content" style="padding:20px 24px 24px;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px;border:1px solid ${heroBorder};border-collapse:separate;border-spacing:0;border-radius:9px;background:${heroBackground};">
                  <tr>
                    <td style="padding:20px;">
                      <h1 class="email-copy" style="margin:0;color:${heroAccent};font-size:24px;line-height:1.25;letter-spacing:0;">${escapeEmailHtml(input.heading)}</h1>
                      ${introduction}
                    </td>
                  </tr>
                </table>
                ${sections}
                ${cta}
                ${notice}
              </td>
            </tr>
            <tr>
              <td style="padding:18px 24px;border-top:1px solid #dfe7e2;background:#f7faf8;color:#69756f;font-size:12px;line-height:1.55;">
                ${escapeEmailHtml(input.footer)}
              </td>
            </tr>
            <tr>
              <td style="padding:18px 24px;border-top:1px solid #dfe7e2;background:#ffffff;color:#52605a;font-size:13px;line-height:1.55;">
                <p style="margin:0;color:#17201c;font-weight:700;">Want to know more about My Kustomers?</p>
                <p style="margin:5px 0 8px;">Discover how My Kustomers helps small businesses manage bookings and customers.</p>
                <a href="${escapeEmailHtml(platformUrl)}" style="color:#176c56;font-weight:700;text-decoration:underline;">Visit My Kustomers</a>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}
