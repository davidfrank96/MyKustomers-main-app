// Always creates its own disposable PostgreSQL cluster. No database URL/env secret is read.
import { spawnSync, spawn } from "node:child_process";
import { mkdtempSync, rmSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
const bin =
  process.env.PG_BIN ||
  spawnSync("pg_config", ["--bindir"], { encoding: "utf8" }).stdout.trim();
if (!bin)
  throw new Error(
    "Install native PostgreSQL, or set PG_BIN to its bin directory. Docker is not used.",
  );
const directory = mkdtempSync("/tmp/myk-whatsapp-db-");
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
  "55441",
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
    `-k ${directory} -p 55441 -h ''`,
    "start",
  ]);
  started = true;
  const schemaExport = process.argv[2];
  if (schemaExport) {
    // A caller-supplied schema-only pg_dump is loaded only into this new cluster.
    // No production URL or credentials are ever read by this runner.
    const snapshot = readFileSync(schemaExport, "utf8").replace(
      /^CREATE SCHEMA public;$/m,
      "",
    );
    const localSchema = path.join(directory, "schema.sql");
    writeFileSync(localSchema, snapshot);
    run("psql", [
      ...psql,
      "-f",
      "tests/database/whatsapp/full-schema-bootstrap.sql",
      "-f",
      localSchema,
    ]);
    if (!snapshot.includes("CREATE TABLE private.whatsapp_pilot_businesses")) {
      run("psql", [
        ...psql,
        "-f",
        "supabase/migrations/20260923001137_whatsapp_pilot_channel.sql",
        "-f",
        "supabase/migrations/20260923022729_business_feature_entitlements.sql",
        "-f",
        "supabase/migrations/20260923111854_whatsapp_admin_control_plane.sql",
      ]);
    }
    run("psql", [
      ...psql,
      "-f",
      "supabase/migrations/20260924210343_reschedule_through_ready.sql",
    ]);
    console.log(run("psql", [...psql, "-f", "tests/database/whatsapp/lifecycle.sql"]));
    console.log(run("psql", [...psql, "-f", "tests/database/whatsapp/reschedule.sql"]));
  } else {
    run("psql", [
      ...psql,
      "-f",
      "tests/database/whatsapp/bootstrap.sql",
      "-f",
      "supabase/migrations/20260923001137_whatsapp_pilot_channel.sql",
      "-f",
      "supabase/migrations/20260923022729_business_feature_entitlements.sql",
      "-f",
      "supabase/migrations/20260923111854_whatsapp_admin_control_plane.sql",
    ]);
    console.log(run("psql", [...psql, "-f", "tests/database/whatsapp/verify.sql"]));
    console.log(run("psql", [...psql, "-f", "tests/database/whatsapp/control.sql"]));
    const claim = () =>
      new Promise((resolve, reject) => {
        const proc = spawn(path.join(bin, "psql"), [...psql, "-f", "-"]);
        proc.stdin.end(
          "begin;\nselect id from public.claim_whatsapp_event(array['10000000-0000-4000-8000-000000000001']::uuid[]);\nselect pg_sleep(1);\ncommit;\n",
        );
        let out = "",
          err = "";
        proc.stdout.on("data", (chunk) => {
          out += chunk;
        });
        proc.stderr.on("data", (chunk) => {
          err += chunk;
        });
        proc.on("error", reject);
        proc.on("exit", (code) =>
          code === 0
            ? resolve(out.match(/[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}/)?.[0])
            : reject(new Error(err)),
        );
      });
    const ids = await Promise.all([claim(), claim()]);
    if (!ids[0] || !ids[1] || ids[0] === ids[1])
      throw new Error("Concurrent claims must be distinct");
    console.log(
      "PASS: concurrent workers claim distinct events without duplicate handoff",
    );
    console.log(run("psql", [...psql, "-f", "tests/database/whatsapp/entitlements.sql"]));
  }
} finally {
  if (started) run("pg_ctl", ["-D", data, "-m", "fast", "stop"]);
  rmSync(directory, { recursive: true, force: true });
}
