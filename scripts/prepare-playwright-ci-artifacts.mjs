import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DEFAULT_INPUT_DIR = "test-results";
const DEFAULT_OUTPUT_DIR = "ci-artifacts/playwright";

function collectEnvironmentSecrets() {
  return Object.entries(process.env)
    .filter(([name, value]) => {
      if (!value || value.length < 8) return false;
      return /(?:KEY|TOKEN|SECRET|PASSWORD|COOKIE|AUTHORIZATION)/i.test(name);
    })
    .map(([, value]) => value);
}

export function redactDiagnosticText(value, secrets = []) {
  let redacted = value;

  for (const secret of secrets) {
    redacted = redacted.split(secret).join("[REDACTED_ENV]");
  }

  return redacted
    .replace(/\/(c|a|x|f)\/[A-Za-z0-9_-]{20,}/g, "/$1/[REDACTED_TOKEN]")
    .replace(
      /([?&](?:code|token|access_token|refresh_token|authorization_code)=)[^&#\s"']+/gi,
      "$1[REDACTED]",
    )
    .replace(/\bBearer\s+[A-Za-z0-9._~-]+/gi, "Bearer [REDACTED]")
    .replace(/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g, "[REDACTED_JWT]")
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "[REDACTED_EMAIL]");
}

function redactStructuredValue(value, secrets) {
  if (typeof value === "string") return redactDiagnosticText(value, secrets);
  if (Array.isArray(value)) {
    return value.map((item) => redactStructuredValue(item, secrets));
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        key,
        redactStructuredValue(item, secrets),
      ]),
    );
  }
  return value;
}

function findErrorContexts(directory) {
  if (!fs.existsSync(directory)) return [];

  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) return findErrorContexts(entryPath);
    return entry.name === "error-context.md" ? [entryPath] : [];
  });
}

export function preparePlaywrightArtifacts({
  inputDir = DEFAULT_INPUT_DIR,
  outputDir = DEFAULT_OUTPUT_DIR,
  secrets = collectEnvironmentSecrets(),
} = {}) {
  fs.rmSync(outputDir, { recursive: true, force: true });
  fs.mkdirSync(outputDir, { recursive: true });

  const reportPath = path.join(inputDir, "results.json");
  if (fs.existsSync(reportPath)) {
    const report = JSON.parse(fs.readFileSync(reportPath, "utf8"));
    const sanitizedReport = redactStructuredValue(report, secrets);
    fs.writeFileSync(
      path.join(outputDir, "results.json"),
      `${JSON.stringify(sanitizedReport, null, 2)}\n`,
    );
  }

  for (const contextPath of findErrorContexts(inputDir)) {
    const relativePath = path.relative(inputDir, contextPath);
    const destination = path.join(outputDir, relativePath);
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.writeFileSync(
      destination,
      redactDiagnosticText(fs.readFileSync(contextPath, "utf8"), secrets),
    );
  }

  fs.writeFileSync(
    path.join(outputDir, "README.txt"),
    [
      "Sanitized Playwright failure diagnostics.",
      "Raw traces, screenshots, videos, environment files, and browser storage are excluded.",
      "Capability URLs, OAuth values, JWTs, configured secrets, and email addresses are redacted.",
      "",
    ].join("\n"),
  );
}

const currentFile = fileURLToPath(import.meta.url);
if (process.argv[1] && path.resolve(process.argv[1]) === currentFile) {
  preparePlaywrightArtifacts();
}
