import assert from "node:assert/strict";
import { test } from "node:test";
import { applyBlock, renderBlock } from "../src/rules.js";

test("applyBlock appends once and then replaces in place", () => {
  const first = applyBlock("# Project\n", renderBlock(["rule one"]));
  assert.match(first, /# Project\n\n<!-- chafe:start/);
  const second = applyBlock(first, renderBlock(["rule two"]));
  assert.equal(second.match(/chafe:start/g)?.length, 1);
  assert.ok(second.includes("rule two") && !second.includes("rule one"));
  assert.ok(second.startsWith("# Project"));
});

test("applyBlock works on an empty file", () => {
  assert.ok(applyBlock("", renderBlock(["x"])).startsWith("<!-- chafe:start"));
});
