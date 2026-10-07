// Disposable UI data only. No cloud credentials, external requests or persistence.
import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import sharp from "sharp";

const whatsappFixture = process.env.WHATSAPP_UI_FIXTURE === "1";
let whatsappStopped = false;
let whatsappEntitled = true;
let whatsappControlPaused = false;
let whatsappSummaryPreferences = {};
let whatsappSummaryHasEvent = true;
let paymentFixture = false;
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
  aal: whatsappFixture ? "aal2" : "aal1",
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
let membershipScenario = "normal";
let publicBookingOverrides = {};
let writes = [];
let platformAdmin = false;
let sessionRevoked = false;
let requestCounts = {};
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
    first_viewed_at: null,
    last_shared_at: null,
    share_count: 0,
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
let feedbackLinks = brandCapabilities.feedback.map((link) => ({ ...link }));
let lifecycleEvents = [];
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
  if (url.pathname === "/fixture/metrics") return send(requestCounts);
  if (url.pathname === "/fixture/metrics/reset") {
    requestCounts = {};
    return send({ ok: true });
  }
  if (!url.pathname.startsWith("/fixture/"))
    requestCounts[url.pathname] = (requestCounts[url.pathname] ?? 0) + 1;
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
    return send({
      writes,
      sessionRevoked,
      business,
      otherBusiness,
      preferences,
      lifecycleEvents,
      // Evidence snapshots intentionally omit even the synthetic tokens/hashes.
      capabilityState: Object.fromEntries(
        Object.entries({ confirmation: links, feedback: feedbackLinks }).map(
          ([kind, records]) => [
            kind,
            records.map((record) => ({
              id: record.id,
              first_viewed_at: record.first_viewed_at ?? null,
              used_at: record.used_at,
              revoked_at: record.revoked_at,
              expires_at: record.expires_at,
              last_shared_at: record.last_shared_at ?? null,
              share_count: record.share_count ?? 0,
            })),
          ],
        ),
      ),
    });
  if (url.pathname === "/fixture/reset") {
    whatsappSummaryPreferences = {};
    whatsappSummaryHasEvent = true;
    paymentFixture = false;
    whatsappStopped = false;
    whatsappControlPaused = false;
    whatsappEntitled = true;
    business = { ...originalBusiness };
    otherBusiness = { ...originalOtherBusiness };
    logoFailure = false;
    capabilityOverrides = {};
    feedbackLinks = brandCapabilities.feedback.map((link) => ({ ...link }));
    lifecycleEvents = [];
    bookingOverrides = {};
    logoShape = null;
    memberRole = "owner";
    failWrites = false;
    membershipScenario = "normal";
    publicBookingOverrides = {};
    writes = [];
    platformAdmin = false;
    sessionRevoked = false;
    requestCounts = {};
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
    if (whatsappFixture && scenario.whatsappSummaryPreferences)
      whatsappSummaryPreferences = scenario.whatsappSummaryPreferences;
    if (whatsappFixture && scenario.whatsappSummaryHasEvent !== undefined)
      whatsappSummaryHasEvent = scenario.whatsappSummaryHasEvent;
    if (scenario.whatsappEntitled !== undefined)
      whatsappEntitled = scenario.whatsappEntitled;
    if (scenario.kind) capabilityOverrides[scenario.kind] = scenario.record ?? {};
    if (scenario.booking) bookingOverrides = scenario.booking;
    if (whatsappFixture && scenario.paymentFixture) paymentFixture = true;
    if (scenario.publicBooking) publicBookingOverrides = scenario.publicBooking;
    if (scenario.memberships) membershipScenario = scenario.memberships;
    if (scenario.logoShape) logoShape = scenario.logoShape;
    if (scenario.role) memberRole = scenario.role;
    if (scenario.platformAdmin !== undefined) platformAdmin = scenario.platformAdmin;
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
    return !sessionRevoked && req.headers.authorization === `Bearer ${accessToken}`
      ? send(user)
      : send({ message: "Invalid local fixture session" }, 401);
  if (url.pathname === "/auth/v1/logout") {
    sessionRevoked = true;
    res.writeHead(204);
    return res.end();
  }
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
    const rpc = url.pathname.split("/").at(-1);
    if (paymentFixture && rpc === "get_booking_payment_summary")
      return send([
        {
          currency: "EUR",
          effective_total_amount_minor: 10000,
          initial_deposit_amount_minor: 0,
          confirmed_addon_deposit_amount_minor: 0,
          subsequent_payment_amount_minor: 0,
          recorded_paid_amount_minor: 0,
          outstanding_amount_minor: 10000,
        },
      ]);
    if (whatsappFixture && rpc === "get_whatsapp_operations")
      return send({
        paused: whatsappControlPaused,
        summary: {
          pending: 2,
          processing: 0,
          accepted: 1,
          unknown: 1,
          failed_recently: 0,
        },
        recent: [
          {
            id: "40000000-0000-4000-8000-000000000001",
            created_at: "2026-09-23T10:00:00Z",
            business_id: business.id,
            business_name: business.name,
            booking_id: "30000000-0000-4000-8000-000000000001",
            event_type: "BOOKING_CONFIRMED",
            status: "ACCEPTED",
            attempt_count: 1,
          },
        ],
        businesses: [{ id: business.id, name: business.name }],
      });
    if (whatsappFixture && rpc === "begin_whatsapp_control") {
      whatsappControlPaused = true;
      writes.push({ rpc });
      return send("50000000-0000-4000-8000-000000000001");
    }
    if (whatsappFixture && rpc === "finish_whatsapp_control") {
      writes.push({ rpc });
      return send(true);
    }
    if (whatsappFixture && rpc === "get_whatsapp_rollout_access")
      return send(body.p_business_id === businessId);
    if (whatsappFixture && rpc === "set_business_feature_entitlement") {
      if (!platformAdmin || body.p_business_id !== businessId) return send({}, 403);
      whatsappEntitled = body.p_enabled;
      return send(true);
    }
    if (whatsappFixture && rpc === "get_platform_admin_business") {
      const b = body.p_business_id === businessId ? business : otherBusiness;
      const {
        id,
        name,
        slug,
        category,
        website,
        instagram,
        email,
        phone,
        logo_path,
        created_at,
        onboarding_completed_at,
      } = b;
      return send({
        id,
        name,
        slug,
        category,
        website,
        instagram,
        email,
        phone,
        logo_path,
        created_at,
        onboarding_completed_at,
        memberships: [],
        metrics: {
          customers: 3,
          bookings: 1,
          active_bookings: 1,
          completed_bookings: 0,
          open_issues: 0,
          failed_emails: 0,
          pending_emails: 0,
        },
      });
    }
    if (whatsappFixture && rpc === "disable_booking_whatsapp") {
      whatsappStopped = true;
      return send(true);
    }
    if (rpc === "get_my_platform_admin")
      return send(
        platformAdmin && !sessionRevoked
          ? [{ user_id: userId, role: "SUPER_ADMIN", status: "ACTIVE" }]
          : [],
      );
    if (rpc === "get_platform_admin_overview")
      return send({
        businesses: 2,
        platform_users: 1,
        customers: 2,
        bookings: 2,
        active_bookings: 2,
        due_today: 0,
        overdue: 0,
        completed: 0,
        open_issues: 0,
        email_pending: 0,
        email_sending: 0,
        email_sent: 0,
        email_failed: 0,
        refreshed_at: new Date().toISOString(),
      });
    if (
      [
        "get_confirmation_public_view",
        "get_feedback_public_view",
        "record_confirmation_link_open",
        "record_feedback_link_open",
      ].includes(rpc)
    ) {
      const feedback = rpc.includes("feedback");
      const record = (feedback ? feedbackLinks : links).find(
        (link) => link.token_hash === body?.p_token_hash,
      );
      if (!record || record.revoked_at || Date.parse(record.expires_at) <= Date.now())
        return send({ status: "unavailable" });
      if (rpc.startsWith("record_")) {
        record.first_viewed_at ??= new Date().toISOString();
        return send(null);
      }
      const owner = record.business_id === businessId ? business : otherBusiness;
      return send({
        status: "valid",
        booking: {
          business_name: owner.name,
          business_logo_path: owner.logo_path,
          business_website: null,
          business_instagram: null,
          business_phone: null,
          business_email: null,
          customer_name: "Private Customer",
          booking_reference: "PRIVATE-REFERENCE",
          booking_title: "Private booking details",
          booking_description: "Private description",
          scheduled_for: null,
          completed_at: "2026-01-15T12:00:00Z",
          currency: "EUR",
          total_amount_minor: 45900,
          deposit_amount_minor: 5900,
          balance_amount_minor: 40000,
          status: feedback ? "DELIVERED" : "AWAITING_CUSTOMER",
          expires_at: record.expires_at,
          confirmed_at: null,
          terms_hash: "fixture-terms",
          ...publicBookingOverrides,
        },
      });
    }
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
      rows = (kind === "feedback" ? feedbackLinks : brandCapabilities[kind]).map(
        (row, i) => ({
          ...row,
          ...(i === 0 ? capabilityOverrides[kind] : {}),
        }),
      );
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
  if (whatsappFixture) {
    if (table === "business_feature_entitlements")
      rows = [
        {
          business_id: businessId,
          feature_key: "WHATSAPP_CUSTOMER_UPDATES",
          enabled: whatsappEntitled,
          source: "PILOT",
        },
      ];
    if (table === "customers")
      rows = [
        {
          id: "90000000-0000-4000-8000-000000000001",
          name: "International fixture",
          phone: "+1 (555) 555-0123",
        },
        {
          id: "90000000-0000-4000-8000-000000000003",
          name: "Local fixture",
          phone: "05555550124",
        },
        {
          id: "90000000-0000-4000-8000-000000000004",
          name: "Empty fixture",
          phone: null,
        },
      ].map((customer) => ({
        ...customer,
        business_id: businessId,
        email: "fixture@example.invalid",
        archived_at: null,
        created_at: "2026-01-15T12:00:00Z",
      }));
    if (
      [
        "confirmation_links",
        "booking_amendments",
        "booking_addons",
        "feedback_links",
        "booking_addon_confirmation_links",
      ].includes(table)
    )
      rows = [];
    if (table === "bookings")
      rows = [
        {
          id: bookingA,
          business_id: businessId,
          customer_id: "90000000-0000-4000-8000-000000000001",
          reference: "SYNTHETIC-001",
          title: "Synthetic pilot booking",
          description: null,
          internal_notes: null,
          status: "DRAFT",
          currency: "EUR",
          total_amount_minor: 10000,
          deposit_amount_minor: 0,
          balance_amount_minor: 10000,
          scheduled_for: null,
          created_at: "2026-01-15T12:00:00Z",
          updated_at: "2026-01-15T12:00:00Z",
          customer_confirmed_at: null,
          confirmed_at: null,
          started_at: null,
          ready_at: null,
          delivered_at: null,
          completed_at: null,
          cancelled_at: null,
          cancellation_reason: null,
          confirmation_terms_hash: null,
          ...bookingOverrides,
          customers: {
            id: "90000000-0000-4000-8000-000000000001",
            name: "Synthetic Customer",
            email: "customer@example.invalid",
            phone: null,
          },
        },
      ];
    if (table === "booking_communication_preferences")
      rows = [
        {
          booking_id: bookingA,
          business_id: businessId,
          email_enabled: true,
          whatsapp_enabled: !whatsappStopped,
          disabled_at: whatsappStopped ? new Date().toISOString() : null,
          ...whatsappSummaryPreferences,
        },
      ];
    if (table === "whatsapp_events")
      rows = [
        {
          id: "90000000-0000-4000-8000-000000000002",
          booking_id: bookingA,
          business_id: businessId,
          status: "UNKNOWN",
          event_type: "booking_confirmation_requested",
          created_at: "2026-01-15T12:00:00Z",
        },
      ];
    if (table === "whatsapp_events" && !whatsappSummaryHasEvent) rows = [];
  }
  if (table === "notification_preferences") {
    if (body) preferences = { ...preferences, ...body };
    rows = [preferences];
  }
  if (table === "business_members") {
    if (membershipScenario === "failed")
      return send({ message: "Fixture membership failure" }, 500);
    if (membershipScenario === "zero") return send([]);
    rows = businesses.map((b) => ({
      business_id: b.id,
      user_id: userId,
      status: "active",
      role: memberRole,
      businesses: b,
    }));
  }
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
