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
const logo = readFileSync("public/brand/mykustomers/v1/pwa/mykustomers-icon-192x192.png");
const otherLogo = await sharp({
  create: { width: 512, height: 256, channels: 3, background: "#3464bf" },
})
  .webp()
  .toBuffer();
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
    });
  if (url.pathname === "/fixture/state")
    return send({ writes, business, otherBusiness, preferences });
  if (url.pathname === "/fixture/reset") {
    business = { ...originalBusiness };
    otherBusiness = { ...originalOtherBusiness };
    logoFailure = false;
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
    res.writeHead(200, { "Content-Type": second ? "image/webp" : "image/png" });
    return res.end(second ? otherLogo : logo);
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
  if (table === "bookings")
    rows = [
      { id: bookingA, business_id: businessId, status: "AWAITING_CUSTOMER" },
      { id: bookingB, business_id: otherBusinessId, status: "AWAITING_CUSTOMER" },
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
  for (const key of ["id", "user_id", "business_id", "token_hash"])
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
