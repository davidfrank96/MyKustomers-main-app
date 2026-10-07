import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

// Owner-approved, temporary risk acceptance; this is NOT a braces fix.
// See docs/security.md. Never extend this date automatically.
export const EXPIRES_AT = "2026-10-21T00:00:00.000Z";
export const ADVISORY = "https://github.com/advisories/GHSA-vfj7-8cjw-p6xm";
const chain = [
  ["braces", "3.0.3"],
  ["micromatch", "4.0.8"],
  ["fast-glob", "3.3.1"],
  ["@next/eslint-plugin-next", "16.3.1"],
  ["eslint-config-next", "16.3.1"],
];
const severities = ["info", "low", "moderate", "high", "critical"];

function requireCondition(condition, message) {
  if (!condition) throw new Error(message);
}

export function blockingFindings(report) {
  requireCondition(
    report?.auditReportVersion === 2 &&
      !report.error &&
      report.vulnerabilities &&
      typeof report.vulnerabilities === "object" &&
      !Array.isArray(report.vulnerabilities),
    "Invalid npm audit report",
  );
  const entries = Object.entries(report.vulnerabilities);
  for (const [name, finding] of entries) {
    requireCondition(
      finding?.name === name &&
        severities.includes(finding.severity) &&
        Array.isArray(finding.via) &&
        finding.via.length > 0 &&
        Array.isArray(finding.nodes) &&
        finding.nodes.length > 0,
      "Malformed vulnerability entry",
    );
  }
  const counts = report.metadata?.vulnerabilities;
  requireCondition(
    counts?.total === entries.length &&
      severities.every(
        (severity) =>
          counts[severity] ===
          entries.filter(([, finding]) => finding.severity === severity).length,
      ),
    "Inconsistent npm audit totals",
  );
  return entries.filter(([, finding]) => severities.indexOf(finding.severity) >= 2);
}

export function evaluateAudit(report, lock, now = new Date()) {
  const blocking = blockingFindings(report);
  if (blocking.length === 0) return "No moderate or higher vulnerabilities.";
  requireCondition(
    Number.isFinite(now.getTime()) && now < new Date(EXPIRES_AT),
    "Dependency advisory exception expired; upgrade or explicitly review risk again",
  );
  requireCondition(
    lock?.lockfileVersion === 3 && lock.packages,
    "Expected npm lockfile v3",
  );
  requireCondition(
    blocking.length === chain.length,
    "Unexpected moderate or higher vulnerability count",
  );

  const root = lock.packages[""];
  requireCondition(
    root?.devDependencies?.["eslint-config-next"],
    "Exception requires the reviewed ESLint development dependency",
  );
  for (const [index, [name, version]] of chain.entries()) {
    const node = `node_modules/${name}`;
    const entry = blocking.find(([key]) => key === name)?.[1];
    const installed = lock.packages[node];
    requireCondition(
      installed?.version === version && installed.dev === true,
      `Exception requires the exact development-only version of ${name}`,
    );
    requireCondition(
      entry?.severity === "high" && entry.nodes.length === 1 && entry.nodes[0] === node,
      `Unexpected affected package or installation: ${name}`,
    );
    requireCondition(
      entry.isDirect === (name === "eslint-config-next"),
      `Unexpected direct dependency: ${name}`,
    );
    if (name !== "eslint-config-next") {
      requireCondition(
        [
          "dependencies",
          "devDependencies",
          "optionalDependencies",
          "peerDependencies",
        ].every((kind) => !Object.hasOwn(root[kind] ?? {}, name)),
        `Exception does not cover direct use of ${name}`,
      );
    }
    requireCondition(entry.via.length === 1, `Additional advisory on ${name}`);
    if (index === 0) {
      const advisory = entry.via[0];
      requireCondition(
        advisory?.url === ADVISORY &&
          advisory.name === name &&
          advisory.dependency === name &&
          advisory.severity === "high" &&
          advisory.source === 1240992,
        "Unapproved root advisory",
      );
    } else {
      requireCondition(
        entry.via[0] === chain[index - 1][0],
        `Unexpected advisory dependency path for ${name}`,
      );
    }
  }
  return `TEMPORARY RISK ACCEPTANCE: ${ADVISORY}; five development-only package entries; expires ${EXPIRES_AT}. Vulnerability remains unpatched.`;
}

export function readAuditResult(result) {
  requireCondition(
    !result.error && !result.signal && [0, 1].includes(result.status),
    "npm audit could not complete",
  );
  let report;
  try {
    report = JSON.parse(result.stdout);
  } catch {
    throw new Error("npm audit returned invalid JSON");
  }
  const blocking = blockingFindings(report);
  requireCondition(
    result.status === (blocking.length > 0 ? 1 : 0),
    "npm audit status disagrees with its report",
  );
  return report;
}

export function runAudit(run = spawnSync) {
  const audit = (extra = []) =>
    readAuditResult(
      run("npm", ["audit", "--json", "--audit-level=moderate", ...extra], {
        encoding: "utf8",
        timeout: 120_000,
        maxBuffer: 10 * 1024 * 1024,
      }),
    );
  // No exceptions at all for production dependencies.
  requireCondition(
    blockingFindings(audit(["--omit=dev"])).length === 0,
    "Production dependencies contain moderate or higher vulnerabilities",
  );
  const report = audit();
  return evaluateAudit(report, JSON.parse(readFileSync("package-lock.json", "utf8")));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    console.log(runAudit());
  } catch (error) {
    console.error(`Dependency Security FAILED: ${error.message}`);
    process.exitCode = 1;
  }
}
