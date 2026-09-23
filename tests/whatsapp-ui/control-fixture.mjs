// Loopback-only synthetic gateway. Never imports production configuration.
import { createServer } from "node:https";
import { mkdtempSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
import path from "node:path";
const directory = path.resolve("output/playwright/control-tls");
mkdirSync(directory, { recursive: true });
const temp = mkdtempSync("/tmp/myk-wa-control-cert-");
execFileSync(
  "openssl",
  [
    "req",
    "-x509",
    "-newkey",
    "rsa:2048",
    "-nodes",
    "-keyout",
    temp + "/key.pem",
    "-out",
    directory + "/cert.pem",
    "-days",
    "1",
    "-subj",
    "/CN=localhost",
    "-addext",
    "subjectAltName=DNS:localhost,IP:127.0.0.1",
  ],
  { stdio: "ignore" },
);
let state = "CONNECTED",
  paused = false,
  linked = true;
let mutations = [];
const server = createServer(
  { key: readFileSync(temp + "/key.pem"), cert: readFileSync(directory + "/cert.pem") },
  async (req, res) => {
    const send = (body, status = 200) => {
      res.writeHead(status, {
        "content-type": "application/json",
        "cache-control": "no-store",
      });
      res.end(JSON.stringify(body));
    };
    const url = new URL(req.url, "https://localhost");
    if (url.pathname === "/health") return send({ ok: true });
    if (url.pathname === "/fixture") {
      const chunks = [];
      for await (const chunk of req) chunks.push(chunk);
      const body = JSON.parse(Buffer.concat(chunks).toString() || "{}");
      state = body.status ?? "CONNECTED";
      paused = body.paused ?? false;
      linked = body.linked ?? true;
      mutations = [];
      return send({ ok: true });
    }
    if (url.pathname === "/fixture/mutations") return send(mutations);
    if (req.headers["x-control-key"] !== "c".repeat(64))
      return send({ error: "Unauthorized" }, 401);
    if (url.pathname === "/internal/v1/control/session/qr")
      return state === "PAIRING"
        ? send({
            image:
              "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aE3cAAAAASUVORK5CYII=",
            expiresInSeconds: 20,
          })
        : send({ error: "Unavailable" }, 409);
    if (url.pathname !== "/internal/v1/control/session") return send({}, 404);
    if (req.method === "POST") {
      const chunks = [];
      for await (const chunk of req) chunks.push(chunk);
      const body = JSON.parse(Buffer.concat(chunks));
      mutations.push(body.action);
      paused = body.action !== "resume";
      if (["pair", "replace"].includes(body.action)) {
        state = "PAIRING";
        linked = false;
      } else if (body.action === "unlink") {
        state = "LOGGED_OUT";
        linked = false;
      } else state = "CONNECTED";
      return send({ status: "requested" });
    }
    return send({
      status: state,
      gateway: "healthy",
      database: "healthy",
      linked,
      account: linked ? { last4: "0123" } : null,
      connectedSince: state === "CONNECTED" ? new Date().toISOString() : null,
      uptimeSeconds: 1234,
      processUptimeSeconds: 2345,
      reconnectAttempts: 0,
      paused,
      restricted: true,
      memory: {
        availableBytes: 440 * 1048576,
        totalBytes: 1024 * 1048576,
        rssBytes: 130 * 1048576,
      },
    });
  },
);
server.listen(55443, "127.0.0.1");
