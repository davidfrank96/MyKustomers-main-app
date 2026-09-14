// Local production-mode verification only. Never install the generated
// certificate into an OS/browser trust store or use it outside loopback.
import { createServer } from "node:https";
import { request } from "node:http";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";

const directory = mkdtempSync(join(tmpdir(), "myk-golden-tls-"));
const key = join(directory, "key.pem");
const cert = join(directory, "cert.pem");
const config = join(directory, "openssl.cnf");
writeFileSync(
  config,
  "[req]\ndistinguished_name=dn\nx509_extensions=ext\nprompt=no\n[dn]\nCN=localhost\n[ext]\nsubjectAltName=DNS:localhost,IP:127.0.0.1\n",
);
execFileSync(
  "openssl",
  [
    "req",
    "-x509",
    "-newkey",
    "rsa:2048",
    "-nodes",
    "-days",
    "1",
    "-keyout",
    key,
    "-out",
    cert,
    "-config",
    config,
  ],
  { stdio: "ignore" },
);
const server = createServer(
  { key: readFileSync(key), cert: readFileSync(cert) },
  (req, res) => {
    const upstream = request(
      {
        hostname: "127.0.0.1",
        port: 3418,
        path: req.url,
        method: req.method,
        headers: {
          ...req.headers,
          "x-forwarded-proto": "https",
          "x-forwarded-host": req.headers.host,
        },
      },
      (response) => {
        res.writeHead(response.statusCode ?? 502, response.headers);
        response.pipe(res);
      },
    );
    upstream.on("error", () => {
      if (!res.headersSent) res.writeHead(502);
      res.end();
    });
    req.pipe(upstream);
  },
);
server.listen(3419, "127.0.0.1", () =>
  console.log("Local verification TLS ready on 3419"),
);
function cleanup() {
  server.close();
  rmSync(directory, { recursive: true, force: true });
}
process.on("SIGTERM", () => {
  cleanup();
  process.exit(0);
});
process.on("SIGINT", () => {
  cleanup();
  process.exit(0);
});
process.on("exit", cleanup);
