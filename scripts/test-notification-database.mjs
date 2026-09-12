// Always creates its own disposable PostgreSQL cluster. No database URL/env secret is read.
import { spawnSync, spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import path from "node:path";
const bin =
  process.env.PG_BIN ||
  spawnSync("pg_config", ["--bindir"], { encoding: "utf8" }).stdout.trim();
if (!bin)
  throw new Error(
    "Install native PostgreSQL, or set PG_BIN to its bin directory. Docker is not used.",
  );
const directory = mkdtempSync("/tmp/myk-notification-db-");
const data = path.join(directory, "data");
const run = (command, args) => {
  const result = spawnSync(path.join(bin, command), args, {
    encoding: "utf8",
    timeout: 60000,
  });
  if (result.status !== 0) throw new Error(result.stderr || `${command} failed`);
  return result.stdout + result.stderr;
};
const psql = [
  "-X",
  "-q",
  "-A",
  "-t",
  "-h",
  directory,
  "-p",
  "55439",
  "-U",
  "postgres",
  "-v",
  "ON_ERROR_STOP=1",
];
let started = false;
try {
  run("initdb", ["-D", data, "-U", "postgres", "-A", "trust"]);
  run("pg_ctl", [
    "-D",
    data,
    "-l",
    path.join(directory, "postgres.log"),
    "-o",
    `-k ${directory} -p 55439 -h ''`,
    "start",
  ]);
  started = true;
  run("psql", [
    ...psql,
    "-f",
    "tests/database/notifications/bootstrap.sql",
    "-f",
    "supabase/migrations/20260912001130_pwa_notifications_foundation.sql",
  ]);
  console.log(run("psql", [...psql, "-f", "tests/database/notifications/verify.sql"]));
  run("psql", [...psql, "-f", "tests/database/notifications/concurrency.sql"]);
  const claim = () =>
    new Promise((resolve, reject) => {
      const proc = spawn(path.join(bin, "psql"), [...psql, "-f", "-"]);
      // Older psql versions only print the last result of a multi-statement -c.
      // stdin preserves the lease SELECT result on both PostgreSQL 16 and 18.
      proc.stdin.end(
        "begin;\nselect delivery_id from public.claim_notification_push(1);\nselect pg_sleep(1);\ncommit;\n",
      );
      let output = "";
      let error = "";
      proc.stdout.on("data", (chunk) => {
        output += chunk;
      });
      proc.stderr.on("data", (chunk) => {
        error += chunk;
      });
      proc.on("error", reject);
      proc.on("exit", (code) =>
        code === 0
          ? resolve(output.match(/[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}/)?.[0])
          : reject(new Error(error)),
      );
    });
  const ids = await Promise.all([claim(), claim()]);
  if (!ids[0] || !ids[1] || ids[0] === ids[1])
    throw new Error("Concurrent workers did not receive distinct leases");
  console.log(
    "PASS: concurrent PostgreSQL sessions claim different devices without duplicate handoff",
  );
} finally {
  if (started) run("pg_ctl", ["-D", data, "-m", "fast", "stop"]);
  rmSync(directory, { recursive: true, force: true });
}
