// Disposable UI data only. No cloud credentials, external requests or persistence.
import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import sharp from "sharp";

const businessId = "20000000-0000-4000-8000-000000000001";
const otherBusinessId = "20000000-0000-4000-8000-000000000002";
const userId = "10000000-0000-4000-8000-000000000001";
const user = {
  id: userId,
  email: "profile-preview@example.invalid",
  aud: "authenticated",
  role: "authenticated",
  user_metadata: { display_name: "Profile Preview" },
  app_metadata: {},
  created_at: "2026-01-01T00:00:00Z",
};
const encode = (value) => Buffer.from(JSON.stringify(value)).toString("base64url");
const accessToken = `${encode({ alg: "HS256", typ: "JWT" })}.${encode({
  sub: userId,
  email: user.email,
  role: "authenticated",
  aud: "authenticated",
  exp: Math.floor(Date.now() / 1000) + 86400,
  iat: Math.floor(Date.now() / 1000),
  user_metadata: user.user_metadata,
  aal: "aal1",
})}.${Buffer.from("local-profile-fixture-only").toString("base64url")}`;
const session = {
  access_token: accessToken,
  refresh_token: "local-profile-fixture-refresh",
  token_type: "bearer",
  expires_in: 86400,
  expires_at: Math.floor(Date.now() / 1000) + 86400,
  user,
};
const originalBusiness = {
  id: businessId,
  name: "Harbour Studio",
  slug: "profile-preview-studio",
  category: "Professional Services",
  description: null,
  phone: null,
  email: null,
  whatsapp: null,
  instagram: null,
  website: null,
  address_text: null,
  logo_path: `${businessId}/logo.webp`,
  onboarding_completed_at: "2026-01-15T00:00:00Z",
  created_at: "2026-01-12T12:00:00Z",
};
let business = { ...originalBusiness };
let memberRole = "owner";
let failWrites = false;
let writes = [];
let preferences = {
  user_id: userId,
  customer_confirmations: true,
  customer_feedback: true,
  overdue_bookings: true,
};
const tokenA = "A".repeat(43);
const tokenB = "B".repeat(43);
const previewA = "40000000-0000-4000-8000-000000000001";
const previewB = "40000000-0000-4000-8000-000000000002";
const bookingA = "30000000-0000-4000-8000-000000000001";
const bookingB = "30000000-0000-4000-8000-000000000002";
const tokenHash = (token) => createHash("sha256").update(token).digest("hex");
const originalLinks = [
  {
    id: previewA,
    token_hash: tokenHash(tokenA),
    business_id: businessId,
    booking_id: bookingA,
    expires_at: "2099-01-01T00:00:00Z",
    used_at: null,
    revoked_at: null,
  },
  {
    id: previewB,
    token_hash: tokenHash(tokenB),
    business_id: otherBusinessId,
    booking_id: bookingB,
    expires_at: "2099-01-01T00:00:00Z",
    used_at: null,
    revoked_at: null,
  },
];
let links = originalLinks.map((link) => ({ ...link }));
const originalOtherBusiness = {
  ...originalBusiness,
  id: otherBusinessId,
  name: "Northside Events",
  slug: "profile-preview-events",
  logo_path: `${otherBusinessId}/logo.webp`,
};
let otherBusiness = { ...originalOtherBusiness };
let logoFailure = false;
// Existing asset is served only as a recognizable local test image.
const logo = await sharp(
  readFileSync("public/brand/mykustomers/v1/pwa/mykustomers-icon-192x192.png"),
)
  .webp()
  .toBuffer();
const otherLogo = await sharp({
  create: { width: 512, height: 256, channels: 3, background: "#3464bf" },
})
  .webp()
  .toBuffer();
const families = {
  feedback: {
    table: "feedback_links",
    prefix: "5",
    purpose: "booking_feedback",
    status: "DELIVERED",
  },
  amendment: {
    table: "booking_amendments",
    prefix: "6",
    purpose: null,
    status: "IN_PROGRESS",
  },
  addon: {
    table: "booking_addon_confirmation_links",
    prefix: "7",
    purpose: "booking_addon_confirmation",
    status: "IN_PROGRESS",
  },
};
const brandCapabilities = Object.fromEntries(
  Object.entries(families).map(([kind, value]) => [
    kind,
    originalLinks.map((link, i) => ({
      ...link,
      id: link.id.replace(/^4/, value.prefix),
      token: (value.prefix + String(i + 1)).padEnd(43, "Q"),
      token_hash: tokenHash((value.prefix + String(i + 1)).padEnd(43, "Q")),
      booking_id: link.booking_id.replace(/^3/, value.prefix),
      booking_addon_id: link.booking_id.replace(/^3/, "8"),
      purpose: value.purpose,
      status: "PENDING_CUSTOMER",
      base_terms_hash: "fixture-terms",
    })),
  ]),
);
let capabilityOverrides = {};
let bookingOverrides = {};
let logoShape = null;
async function fixtureLogo(shape) {
  const shapes = {
    square:
      '<rect x="40" y="40" width="240" height="240" rx="28" fill="#176b58"/><path d="M95 220V100h35l30 55 30-55h35v120h-35v-63l-30 48-30-48v63z" fill="white"/>',
    circular:
      '<circle cx="160" cy="160" r="125" fill="#ba7138"/><path d="M110 225V95h50q70 0 70 60t-70 60h-15v10z M145 130v50h15q35 0 35-25t-35-25z" fill="white"/>',
    wide: '<rect x="10" y="90" width="300" height="140" rx="15" fill="#3464bf"/><text x="160" y="180" text-anchor="middle" font-family="sans-serif" font-size="60" fill="white">CEDAR</text>',
    wordmark:
      '<rect x="10" y="110" width="300" height="100" rx="12" fill="#175c4d"/><text x="160" y="177" text-anchor="middle" font-family="sans-serif" font-size="46" fill="white">HARBOUR</text>',
    tall: '<rect x="110" y="10" width="100" height="300" rx="20" fill="#754dac"/><path d="M135 80h50v35h-15v125h-20V115h-15z" fill="white"/>',
    transparent:
      '<path d="M160 20 300 270H20z" fill="#176b58"/><circle cx="160" cy="178" r="40" fill="white"/>',
    whitespace:
      '<rect x="135" y="135" width="50" height="50" rx="8" fill="#176b58"/><path d="m145 160 10 10 20-20" stroke="white" stroke-width="6" fill="none"/>',
  };
  return sharp(
    Buffer.from(
      `<svg width="320" height="320" xmlns="http://www.w3.org/2000/svg">${shapes[shape] ?? shapes.square}</svg>`,
    ),
  )
    .webp({ lossless: true })
    .toBuffer();
}
createServer(async (req, res) => {
  const url = new URL(req.url, "http://127.0.0.1:55441");
  const send = (data, status = 200, headers = {}) => {
    res.writeHead(status, { "Content-Type": "application/json", ...headers });
    res.end(req.method === "HEAD" ? "" : JSON.stringify(data));
  };
  if (url.pathname === "/health") return send({ ok: true });
  if (url.pathname === "/fixture/session")
    return send({
      cookie: `base64-${encode(session)}`,
      businessId,
      otherBusinessId,
      previewA,
      previewB,
      tokenA,
      tokenB,
      capabilities: brandCapabilities,
    });
  if (url.pathname === "/fixture/state")
    return send({ writes, business, otherBusiness, preferences });
  if (url.pathname === "/fixture/reset") {
    business = { ...originalBusiness };
    otherBusiness = { ...originalOtherBusiness };
    logoFailure = false;
    capabilityOverrides = {};
    bookingOverrides = {};
    logoShape = null;
    memberRole = "owner";
    failWrites = false;
    writes = [];
    links = originalLinks.map((link) => ({ ...link }));
    preferences = {
      user_id: userId,
      customer_confirmations: true,
      customer_feedback: true,
      overdue_bookings: true,
    };
    return send({ ok: true });
  }
  if (url.pathname === "/fixture/scenario") {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const scenario = JSON.parse(Buffer.concat(chunks));
    if (scenario.kind) capabilityOverrides[scenario.kind] = scenario.record ?? {};
    if (scenario.booking) bookingOverrides = scenario.booking;
    if (scenario.logoShape) logoShape = scenario.logoShape;
    if (scenario.role) memberRole = scenario.role;
    if (scenario.failWrites !== undefined) failWrites = scenario.failWrites;
    if (scenario.link) Object.assign(links[0], scenario.link);
    if (scenario.logoFailure !== undefined) logoFailure = scenario.logoFailure;
    return send({ ok: true });
  }
  if (url.pathname === "/fixture/profile") {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    business = { ...originalBusiness, ...JSON.parse(Buffer.concat(chunks)) };
    return send({ ok: true });
  }
  if (url.pathname.startsWith("/storage/v1/object/public/business-logos/")) {
    if (logoFailure) return send({}, 404);
    const second = url.pathname.includes(otherBusinessId);
    res.writeHead(200, { "Content-Type": "image/webp" });
    return res.end(second ? otherLogo : logoShape ? await fixtureLogo(logoShape) : logo);
  }
  if (url.pathname === "/auth/v1/user")
    return req.headers.authorization === `Bearer ${accessToken}`
      ? send(user)
      : send({ message: "Invalid local fixture session" }, 401);
  if (!url.pathname.startsWith("/rest/v1/")) return send({}, 404);
  let body = null;
  if (!["GET", "HEAD"].includes(req.method)) {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    body = chunks.length ? JSON.parse(Buffer.concat(chunks)) : null;
    writes.push({ table: url.pathname.split("/").at(-1), method: req.method });
    if (url.pathname.endsWith("/rpc/consume_application_rate_limit"))
      return send([
        { allowed: true, remaining_requests: 89, retry_after_seconds: 0, reset_at: null },
      ]);
    if (url.pathname.endsWith("/rpc/record_audit_event")) return send(null);
    if (failWrites) return send({ message: "Local fixture write unavailable" }, 503);
  }
  const businesses = [business, otherBusiness];
  const table = url.pathname.split("/").at(-1);
  let rows = [];
  if (table === "businesses") {
    rows = businesses;
    if (req.method === "PATCH") {
      if (url.searchParams.get("id") === `eq.${businessId}`)
        Object.assign(business, body);
      else if (url.searchParams.get("id") === `eq.${otherBusinessId}`)
        Object.assign(otherBusiness, body);
      else return send({}, 403);
    }
  }
  if (table === "confirmation_links") rows = links;
  for (const [kind, config] of Object.entries(families)) {
    if (table === config.table)
      rows = brandCapabilities[kind].map((row, i) => ({
        ...row,
        ...(i === 0 ? capabilityOverrides[kind] : {}),
      }));
  }
  if (table === "booking_addons")
    rows = brandCapabilities.addon.map((row) => ({
      id: row.booking_addon_id,
      booking_id: row.booking_id,
      business_id: row.business_id,
      status: "AWAITING_CUSTOMER",
    }));
  if (table === "bookings")
    rows = [
      { id: bookingA, business_id: businessId, status: "AWAITING_CUSTOMER" },
      { id: bookingB, business_id: otherBusinessId, status: "AWAITING_CUSTOMER" },
      ...Object.entries(families).flatMap(([kind, config]) =>
        brandCapabilities[kind].map((row) => ({
          id: row.booking_id,
          business_id: row.business_id,
          status: config.status,
          confirmation_terms_hash: "fixture-terms",
          ...bookingOverrides,
        })),
      ),
    ];
  if (table === "notification_preferences") {
    if (body) preferences = { ...preferences, ...body };
    rows = [preferences];
  }
  if (table === "business_members")
    rows = businesses.map((b) => ({
      business_id: b.id,
      user_id: userId,
      status: "active",
      role: memberRole,
      businesses: b,
    }));
  for (const key of ["id", "user_id", "business_id", "booking_id", "token_hash"])
    if (url.searchParams.get(key)?.startsWith("eq."))
      rows = rows.filter((row) => row[key] === url.searchParams.get(key).slice(3));
  const columns = url.searchParams.get("select")?.split(",");
  if (columns?.every((column) => /^[a-z_]+$/.test(column)))
    rows = rows.map((row) =>
      Object.fromEntries(columns.map((column) => [column, row[column]])),
    );
  return send(
    req.headers.accept?.includes("vnd.pgrst.object") ? (rows[0] ?? null) : rows,
    200,
    { "Content-Range": `0-${Math.max(0, rows.length - 1)}/${rows.length}` },
  );
}).listen(55441, "127.0.0.1", () => console.log("Local Profile UI fixtures ready"));
