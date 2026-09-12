// Local UI fixtures, never an authentication or RLS substitute. Database contracts
// run independently in PostgreSQL; this server binds only to loopback.
import { createServer } from "node:http";
const userId = "10000000-0000-4000-8000-000000000001";
const businessId = "20000000-0000-4000-8000-000000000001";
const otherBusinessId = "20000000-0000-4000-8000-000000000002";
const bookingId = "30000000-0000-4000-8000-000000000001";
const user = {
  id: userId,
  email: "fixture@example.invalid",
  aud: "authenticated",
  role: "authenticated",
  user_metadata: { display_name: "Notification fixture" },
  app_metadata: {},
  created_at: "2026-01-01T00:00:00Z",
};
const base64 = (value) => Buffer.from(JSON.stringify(value)).toString("base64url");
const accessToken =
  base64({ alg: "HS256", typ: "JWT" }) +
  "." +
  base64({
    sub: userId,
    email: user.email,
    role: "authenticated",
    aud: "authenticated",
    exp: Math.floor(Date.now() / 1000) + 86400,
    iat: Math.floor(Date.now() / 1000),
    user_metadata: user.user_metadata,
    aal: "aal1",
  }) +
  "." +
  Buffer.from("local-fixture-signature-only").toString("base64url");
const session = {
  access_token: accessToken,
  refresh_token: "local-fixture-refresh",
  token_type: "bearer",
  expires_in: 86400,
  expires_at: Math.floor(Date.now() / 1000) + 86400,
  user,
};
const businesses = [
  {
    id: businessId,
    name: "Lagos Creative Studio",
    slug: "fixture-studio",
    category: "Design",
    logo_path: null,
    onboarding_completed_at: "2026-01-01T00:00:00Z",
  },
  {
    id: otherBusinessId,
    name: "Long Business Name for Event Planning and Creative Services Across Growing Teams",
    slug: "fixture-events",
    category: "Events",
    logo_path: null,
    onboarding_completed_at: "2026-01-01T00:00:00Z",
  },
];
let notifications = [];
let failPreferences = false;
let preferences;
let subscribed = false;
function reset() {
  failPreferences = false;
  subscribed = false;
  preferences = {
    user_id: userId,
    customer_confirmations: true,
    customer_feedback: true,
    overdue_bookings: true,
  };
  notifications = Array.from({ length: 28 }, (_, i) => ({
    id: `40000000-0000-4000-8000-${String(i + 1).padStart(12, "0")}`,
    user_id: userId,
    business_id: i % 2 ? businessId : otherBusinessId,
    booking_id: bookingId,
    notification_type: [
      "CUSTOMER_CONFIRMED",
      "CUSTOMER_FEEDBACK_RECEIVED",
      "BOOKING_OVERDUE",
      "AMENDMENT_RESPONDED",
      "ADD_ON_RESPONDED",
    ][i % 5],
    read_at: null,
    created_at: new Date(Date.now() - 60000 * (i + 1)).toISOString(),
  }));
}
reset();
createServer(async (req, res) => {
  const url = new URL(req.url, "http://127.0.0.1:55440");
  const path = url.pathname;
  const params = url.searchParams;
  const send = (data, status = 200, headers = {}) => {
    res.writeHead(status, { "Content-Type": "application/json", ...headers });
    res.end(req.method === "HEAD" ? "" : JSON.stringify(data));
  };
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const body = chunks.length ? JSON.parse(Buffer.concat(chunks)) : null;
  if (path === "/health") return send({ ok: true });
  if (path === "/fixture/reset") {
    reset();
    return send({ ok: true });
  }
  if (path === "/fixture/preferences-fail") {
    failPreferences = true;
    return send({ ok: true });
  }
  if (path === "/fixture/empty") {
    notifications = [];
    return send({ ok: true });
  }
  if (path === "/fixture/session")
    return send({
      cookie: "base64-" + base64(session),
      userId,
      businessId,
      otherBusinessId,
      bookingId,
      notificationId: notifications[0].id,
    });
  if (path === "/auth/v1/user")
    return req.headers.authorization === `Bearer ${accessToken}`
      ? send(user)
      : send({ message: "Invalid fixture session" }, 401);
  if (path === "/auth/v1/logout") return send({});
  if (path.startsWith("/rest/v1/rpc/")) {
    const rpc = path.split("/").at(-1);
    if (rpc === "consume_application_rate_limit")
      return send([
        { allowed: true, remaining_requests: 89, retry_after_seconds: 0, reset_at: null },
      ]);
    if (rpc === "register_push_subscription") {
      subscribed = true;
      return send("50000000-0000-4000-8000-000000000001");
    }
    if (rpc === "remove_push_subscription") {
      subscribed = false;
      return send(null);
    }
    return send(null);
  }
  const table = path.split("/").at(-1);
  let rows = [];
  if (table === "business_members")
    rows = businesses.map((b) => ({
      business_id: b.id,
      user_id: userId,
      status: "active",
      role: "owner",
      businesses: b,
    }));
  if (table === "businesses") rows = businesses;
  if (table === "bookings")
    rows = [{ id: bookingId, business_id: otherBusinessId, reference: "MK-2026-0001" }];
  if (table === "notification_preferences") {
    if (failPreferences && req.method !== "GET")
      return send({ message: "fixture storage unavailable" }, 503);
    if (req.method === "PATCH" || req.method === "POST")
      preferences = { ...preferences, ...body };
    rows = [preferences];
  }
  if (table === "push_subscriptions")
    rows = subscribed
      ? [
          {
            id: "50000000-0000-4000-8000-000000000001",
            user_id: userId,
            revoked_at: null,
            last_seen_at: new Date().toISOString(),
          },
        ]
      : [];
  if (table === "notifications") {
    rows = notifications;
    if (params.get("read_at") === "is.null")
      rows = rows.filter((n) => n.read_at === null);
    if (params.get("created_at")?.startsWith("lte."))
      rows = rows.filter((n) => n.created_at <= params.get("created_at").slice(4));
    if (params.get("or")) {
      const cursor = params.get("or").match(/created_at\.lt\.([^,]+)/)?.[1];
      if (cursor) rows = rows.filter((n) => n.created_at < cursor);
    }
  }
  for (const key of ["id", "user_id", "business_id"])
    if (params.get(key)?.startsWith("eq."))
      rows = rows.filter((row) => row[key] === params.get(key).slice(3));
  if (table === "notifications" && req.method === "PATCH")
    rows.forEach((n) => Object.assign(n, body));
  const count = rows.length;
  rows = rows.slice(0, Number(params.get("limit") || 100));
  const columns = params.get("select")?.split(",");
  if (columns?.every((column) => /^[a-z_]+$/.test(column)))
    rows = rows.map((row) =>
      Object.fromEntries(columns.map((column) => [column, row[column]])),
    );
  const single = req.headers.accept?.includes("vnd.pgrst.object");
  return send(single ? (rows[0] ?? null) : rows, 200, {
    "Content-Range": `0-${Math.max(0, rows.length - 1)}/${count}`,
  });
}).listen(55440, "127.0.0.1", () =>
  console.log("Local notification UI fixtures listening on 55440"),
);
