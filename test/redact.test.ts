import assert from "node:assert/strict";
import os from "node:os";
import { test } from "node:test";
import { redact } from "../src/redact.js";

test("redacts common secret shapes", () => {
  assert.equal(redact("API_KEY=abc123xyz run"), "API_KEY=‹redacted› run");
  assert.ok(!redact("token ghp_abcdefghijklmnopqrstuvwxyz0123456789").includes("ghp_abc"));
  assert.ok(
    !redact("curl -H 'Authorization: Bearer abcdefghijklmnop1234'").includes(
      "abcdefghijklmnop1234",
    ),
  );
  assert.equal(redact("postgres://user:hunter2@host/db"), "postgres://user:‹redacted›@host/db");
  assert.ok(!redact("--password hunter2").includes("hunter2"));
});

test("shortens the home directory", () => {
  assert.equal(redact(`${os.homedir()}/proj`), "~/proj");
});
