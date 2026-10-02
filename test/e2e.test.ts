import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import type { Analysis } from "../src/types.js";

const cli = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "src", "cli.js");
const chafe = (...args: string[]) => execFileSync("node", [cli, ...args], { encoding: "utf8" });

test("demo JSON finds the planted patterns", () => {
  const a = JSON.parse(chafe("--demo", "--format", "json")) as Analysis;
  assert.equal(a.sessions, 11);
  const byFix = new Map(a.fixes.map((f) => [f.fixCmd, f]));
  assert.equal(byFix.get("npm test -- --run")?.sessions, 6);
  assert.equal(byFix.get("npx tsx scripts/seed.ts")?.status, "ignored");
  assert.equal(byFix.get("docker compose up -d db")?.status, "documented");
  assert.equal(a.corrections.length, 2);
  assert.ok(a.permissions.some((p) => p.rule === "Bash(git status:*)"));
});

test("--permissions prints valid settings JSON", () => {
  const j = JSON.parse(chafe("--demo", "--permissions")) as { permissions: { allow: string[] } };
  assert.ok(j.permissions.allow.length > 0);
});

test("--apply previews without writing", () => {
  const out = chafe("--demo", "--apply");
  assert.match(out, /Would add to/);
  assert.match(out, /npm test -- --run/);
});

test("bad flags fail with a message", () => {
  assert.throws(() => execFileSync("node", [cli, "--min", "0"], { stdio: "pipe" }));
  assert.throws(() =>
    execFileSync("node", [cli, "--logs", path.join(os.tmpdir(), "nope-chafe")], { stdio: "pipe" }),
  );
});

test("--apply --write is idempotent and leaves other content alone", () => {
  const demo = path.resolve(path.dirname(cli), "..", "..", "examples", "demo-project");
  const base = fs.mkdtempSync(path.join(os.tmpdir(), "chafe-e2e-"));
  const proj = path.join(base, "proj");
  const logs = path.join(base, "logs");
  fs.mkdirSync(proj);
  fs.writeFileSync(path.join(proj, "AGENTS.md"), "# Mine\n\nKeep this.\n");
  const logDir = path.join(logs, proj.replace(/[^a-zA-Z0-9]/g, "-"));
  fs.cpSync(path.join(demo, "sessions", "-home-dev-shop-api"), logDir, { recursive: true });

  const apply = () => chafe("--logs", logs, "--since", "2020-01-01", "--apply", "--write", proj);
  apply();
  const once = fs.readFileSync(path.join(proj, "AGENTS.md"), "utf8");
  assert.ok(once.startsWith("# Mine\n\nKeep this.\n"));
  assert.match(once, /Run `npm test -- --run`/);
  // Rules now live inside the managed block, which chafe ignores when judging "documented".
  apply();
  assert.equal(fs.readFileSync(path.join(proj, "AGENTS.md"), "utf8"), once);
  fs.rmSync(base, { recursive: true });
});
