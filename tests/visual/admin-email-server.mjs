// Loopback-only synthetic review. No environment, authentication, or backend access.
import { createServer } from "node:http";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
const root = process.cwd();
const fixtures = path.resolve(root, "../output/playwright/admin-email");
const states = [
  "healthy",
  "attention",
  "backlog",
  "active",
  "empty",
  "loading",
  "searching",
  "stress",
];
function styles() {
  const css = readdirSync(path.join(root, ".next/static/css"))
    .filter((file) => file.endsWith(".css"))
    .map((file) => readFileSync(path.join(root, ".next/static/css", file), "utf8"))
    .join("\n");
  return (
    css +
    "\n:root{" +
    (css.match(/--font-inter:[^;}]+/)?.[0] ?? "--font-inter:Inter,system-ui,sans-serif") +
    "}"
  );
}
createServer((request, response) => {
  const pathname = new URL(request.url, "http://127.0.0.1").pathname;
  response.setHeader("Cache-Control", "no-store");
  response.setHeader("X-Robots-Tag", "noindex");
  try {
    if (pathname === "/styles.css") {
      response.setHeader("Content-Type", "text/css");
      response.end(styles());
      return;
    }
    if (pathname === "/") {
      response.setHeader("Content-Type", "text/html");
      response.end(
        "<h1>Email Operations — synthetic local review</h1><p>Actual components, mocked evidence. Search, filters, pagination, and detail navigation require the real app; this preview is not hydrated.</p>" +
          states
            .map((state) => '<p><a href="/' + state + '.html">' + state + "</a></p>")
            .join(""),
      );
      return;
    }
    let file;
    if (states.some((state) => pathname === "/" + state + ".html"))
      file = path.join(fixtures, pathname);
    else if (/^\/_next\/static\/media\/[\w.-]+\.woff2$/.test(pathname))
      file = path.join(root, ".next/static/media", path.basename(pathname));
    else if (
      pathname === "/brand/mykustomers/v1/logo/mykustomers-logo-horizontal-512w.png"
    )
      file = path.join(root, "public", pathname);
    if (!file) {
      response.writeHead(404);
      response.end("Static fixture only; use the real application for navigation.");
      return;
    }
    response.setHeader(
      "Content-Type",
      file.endsWith(".png")
        ? "image/png"
        : file.endsWith(".woff2")
          ? "font/woff2"
          : "text/html",
    );
    response.end(readFileSync(file));
  } catch {
    response.writeHead(404);
    response.end("Build the app and generate synthetic fixtures first.");
  }
}).listen(4176, "127.0.0.1", () => console.log("Email review: http://127.0.0.1:4176"));
