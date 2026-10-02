import assert from "node:assert/strict";
import { test } from "node:test";
import { findFixPairs } from "../src/detectors/fixes.js";
import { findLoops } from "../src/detectors/loops.js";
import { permissionRule } from "../src/detectors/permissions.js";
import { clusterCorrections, findCorrections } from "../src/detectors/corrections.js";
import { bash, session } from "./helpers.js";

test("finds a failure followed by a changed command", () => {
  const s = session("a", [
    bash("npm test", false, "vitest is in watch mode"),
    bash("npm test -- --run", true),
  ]);
  const [p] = findFixPairs(s);
  assert.equal(p?.failCmd, "npm test");
  assert.equal(p?.fixCmd, "npm test -- --run");
});

test("ignores a command that simply passed on retry", () => {
  const s = session("a", [bash("npm test", false), bash("npm test", true)]);
  assert.equal(findFixPairs(s).length, 0);
});

test("ignores failures followed only by unrelated successes", () => {
  const s = session("a", [bash("npm test", false), bash("git status", true), bash("ls", true)]);
  assert.equal(findFixPairs(s).length, 0);
});

test("detects a missing program replaced by another", () => {
  const s = session("a", [
    bash("pnpm install", false, "zsh: command not found: pnpm"),
    bash("npm install", true),
  ]);
  assert.equal(findFixPairs(s)[0]?.substitute, true);
});

test("pairs `node x.ts` with `npx tsx x.ts` via the shared file", () => {
  const s = session("a", [bash("node scripts/s.ts", false), bash("npx tsx scripts/s.ts", true)]);
  assert.equal(findFixPairs(s).length, 1);
});

test("corrections cluster across rewordings", () => {
  const items = [
    ...findCorrections(session("a", [], ["Don't edit dist/, change src/ instead"])),
    ...findCorrections(session("b", [], ["no, don't edit files in dist/ - change src/ instead"])),
    ...findCorrections(session("c", [], ["looks good, thanks"])),
  ];
  const clusters = clusterCorrections(items);
  assert.equal(clusters.length, 1);
  assert.equal(clusters[0]?.items.length, 2);
});

test("loops need 3+ identical failing calls", () => {
  const curl = () => bash("curl localhost:3000", false);
  assert.equal(findLoops(session("a", [curl(), curl()])).length, 0);
  assert.equal(findLoops(session("a", [curl(), curl(), curl()]))[0]?.length, 3);
});

test("permission rules only cover plainly safe commands", () => {
  assert.equal(permissionRule("git status"), "Bash(git status:*)");
  assert.equal(permissionRule("npm run lint"), "Bash(npm run lint:*)");
  assert.equal(permissionRule("cd app && git diff"), "Bash(git diff:*)");
  assert.equal(permissionRule("git status && rm -rf x"), undefined);
  assert.equal(permissionRule("git push"), undefined);
  assert.equal(permissionRule("cat a > b"), undefined);
  assert.equal(permissionRule("ls $(whoami)"), undefined);
});
