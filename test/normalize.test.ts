import assert from "node:assert/strict";
import { test } from "node:test";
import { commandSig, errorLine, normalizeCommand, jaccard, wordSet } from "../src/normalize.js";

test("commandSig keeps program and subcommand", () => {
  assert.equal(commandSig("git status"), "git status");
  assert.equal(commandSig("npm run lint -- --fix"), "npm run lint");
  assert.equal(commandSig("cd app && pytest tests/a.py -x"), "pytest");
  assert.equal(commandSig("FOO=1 npx tsx scripts/x.ts"), "npx tsx");
});

test("normalizeCommand collapses values but keeps flags and env names", () => {
  assert.equal(normalizeCommand("pytest tests/a.py -x"), "pytest <file> -x");
  assert.equal(normalizeCommand('git commit -m "fix: thing"'), 'git commit -m "…"');
  assert.equal(
    normalizeCommand("DATABASE_URL=file:./a.db npx prisma migrate dev"),
    "DATABASE_URL=<v> npx prisma migrate dev",
  );
});

test("errorLine prefers the line that looks like an error", () => {
  const t = "Exit code 1\nrunning...\nError: Cannot find module '/a/b/c' at line 12";
  assert.equal(errorLine(t), "Error: Cannot find module '<path>' at line N");
});

test("jaccard treats a reworded reminder as similar", () => {
  const a = wordSet("Please don't add a comment to every function");
  const b = wordSet("Stop adding a comment to every function, keep it minimal");
  assert.ok(jaccard(a, b) >= 0.45);
  assert.ok(jaccard(a, wordSet("use pnpm for installs")) < 0.2);
});
