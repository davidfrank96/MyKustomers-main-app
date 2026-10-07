import assert from "node:assert/strict";
import { test } from "node:test";
import {
  ADVISORY,
  blockingFindings,
  evaluateAudit,
  readAuditResult,
  runAudit,
} from "./audit-dependencies.mjs";

const now = new Date("2026-10-07T12:00:00Z");
function fixture() {
  const packages = [
    ["braces", "3.0.3"],
    ["micromatch", "4.0.8"],
    ["fast-glob", "3.3.1"],
    ["@next/eslint-plugin-next", "16.3.1"],
    ["eslint-config-next", "16.3.1"],
  ];
  const lock = {
    lockfileVersion: 3,
    packages: { "": { devDependencies: { "eslint-config-next": "^16.0.0" } } },
  };
  const report = {
    auditReportVersion: 2,
    vulnerabilities: {},
    metadata: {
      vulnerabilities: { info: 0, low: 0, moderate: 0, high: 5, critical: 0, total: 5 },
    },
  };
  packages.forEach(([name, version], i) => {
    const node = `node_modules/${name}`;
    lock.packages[node] = { version, dev: true };
    report.vulnerabilities[name] = {
      name,
      isDirect: name === "eslint-config-next",
      severity: "high",
      nodes: [node],
      via: i
        ? [packages[i - 1][0]]
        : [{ url: ADVISORY, name, dependency: name, severity: "high", source: 1240992 }],
    };
  });
  return { report, lock };
}
const clean = {
  auditReportVersion: 2,
  vulnerabilities: {},
  metadata: {
    vulnerabilities: { info: 0, low: 0, moderate: 0, high: 0, critical: 0, total: 0 },
  },
};

test("accepts only the reviewed development chain before expiry and reports the risk", () => {
  const { report, lock } = fixture();
  assert.match(
    evaluateAudit(report, lock, now),
    /TEMPORARY RISK ACCEPTANCE.*remains unpatched/,
  );
});
test("clean reports remain valid after the exception expires", () => {
  assert.match(evaluateAudit(clean, {}, new Date("2027-01-01")), /No moderate/);
});
test("preserves the existing moderate threshold for low findings", () => {
  const report = structuredClone(clean);
  report.vulnerabilities.example = {
    name: "example",
    severity: "low",
    nodes: ["node_modules/example"],
    via: ["other"],
  };
  report.metadata.vulnerabilities.low = report.metadata.vulnerabilities.total = 1;
  assert.equal(blockingFindings(report).length, 0);
});
for (const [label, mutate] of [
  [
    "new advisory on the same package",
    (r) =>
      r.vulnerabilities.braces.via.push({ url: "https://github.com/advisories/another" }),
  ],
  [
    "replacement root advisory",
    (r) =>
      (r.vulnerabilities.braces.via[0].url = "https://github.com/advisories/another"),
  ],
  [
    "different affected installation",
    (r) => r.vulnerabilities.braces.nodes.push("node_modules/other/node_modules/braces"),
  ],
  [
    "cycle in the advisory path",
    (r) => (r.vulnerabilities.micromatch.via = ["fast-glob"]),
  ],
  [
    "additional affected package",
    (r) => {
      r.vulnerabilities.other = { ...r.vulnerabilities.braces, name: "other" };
      r.metadata.vulnerabilities.high++;
      r.metadata.vulnerabilities.total++;
    },
  ],
  ["production reachability", (_r, l) => (l.packages["node_modules/braces"].dev = false)],
  [
    "missing development-only marker",
    (_r, l) => delete l.packages["node_modules/micromatch"].dev,
  ],
  [
    "changed package version",
    (_r, l) => (l.packages["node_modules/braces"].version = "3.0.4"),
  ],
  ["unsupported lockfile", (_r, l) => (l.lockfileVersion = 2)],
  ["inconsistent totals", (r) => (r.metadata.vulnerabilities.total = 0)],
  ["registry error", (r) => (r.error = { code: "EAUDIT" })],
  ["missing vulnerability details", (r) => (r.vulnerabilities.braces.via = [])],
]) {
  test(`blocks ${label}`, () => {
    const { report, lock } = fixture();
    mutate(report, lock);
    assert.throws(() => evaluateAudit(report, lock, now));
  });
}
test("rejects direct development use even at the reviewed version", () => {
  const { report, lock } = fixture();
  lock.packages[""].devDependencies.braces = "3.0.3";
  report.vulnerabilities.braces.isDirect = true;
  assert.throws(() => evaluateAudit(report, lock, now), /direct dependency/);
});
test("root declarations cannot contradict audit directness", () => {
  const { report, lock } = fixture();
  lock.packages[""].devDependencies.braces = "3.0.3";
  assert.throws(() => evaluateAudit(report, lock, now), /direct use/);
});
test("requires the expected root ESLint declaration", () => {
  const { report, lock } = fixture();
  delete lock.packages[""].devDependencies["eslint-config-next"];
  assert.throws(() => evaluateAudit(report, lock, now), /ESLint development dependency/);
});
for (const date of ["2026-10-21T00:00:00.000Z", "2026-10-22", "invalid"]) {
  test(`blocks expired or invalid clock: ${date}`, () => {
    const { report, lock } = fixture();
    assert.throws(() => evaluateAudit(report, lock, new Date(date)), /expired/);
  });
}
test("fails closed on process, JSON, schema and exit-status errors", () => {
  for (const result of [
    { status: 2, stdout: JSON.stringify(clean) },
    { status: null, signal: "SIGTERM", stdout: "" },
    { status: 0, error: new Error("spawn failure"), stdout: JSON.stringify(clean) },
    { status: 0, stdout: "not json" },
    { status: 0, stdout: "{}" },
    { status: 1, stdout: JSON.stringify(clean) },
    { status: 0, stdout: JSON.stringify(fixture().report) },
  ])
    assert.throws(() => readAuditResult(result));
});
test("production audit rejects even the otherwise exempt advisory before full audit", () => {
  const calls = [];
  assert.throws(
    () =>
      runAudit((command, args) => {
        calls.push([command, ...args]);
        return { status: 1, stdout: JSON.stringify(fixture().report) };
      }),
    /Production dependencies/,
  );
  assert.deepEqual(calls, [
    ["npm", "audit", "--json", "--audit-level=moderate", "--omit=dev"],
  ]);
});
test("both production and full audit must complete", () => {
  let calls = 0;
  assert.throws(
    () =>
      runAudit(() =>
        ++calls === 1
          ? { status: 0, stdout: JSON.stringify(clean) }
          : { status: 2, stdout: "registry unavailable" },
      ),
    /could not complete/,
  );
  assert.equal(calls, 2);
});
