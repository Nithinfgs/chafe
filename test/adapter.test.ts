import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import {
  discoverLogFiles,
  encodeProjectDir,
  parseSessionFile,
} from "../src/adapters/claudeCode.js";

function tmp(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "chafe-"));
}

test("parses tool calls, results and human messages; skips junk lines", async () => {
  const dir = tmp();
  const file = path.join(dir, "s.jsonl");
  const lines = [
    {
      type: "user",
      timestamp: "2026-01-01T00:00:00Z",
      cwd: "/p",
      message: { role: "user", content: "hello there" },
    },
    {
      type: "user",
      timestamp: "2026-01-01T00:00:01Z",
      message: { role: "user", content: "<system-reminder>x</system-reminder>" },
    },
    {
      type: "assistant",
      timestamp: "2026-01-01T00:00:02Z",
      message: {
        role: "assistant",
        content: [{ type: "tool_use", id: "a1", name: "Bash", input: { command: "ls" } }],
      },
    },
    {
      type: "user",
      timestamp: "2026-01-01T00:00:03Z",
      message: {
        role: "user",
        content: [
          {
            type: "tool_result",
            tool_use_id: "a1",
            content: [{ type: "text", text: "boom" }],
            is_error: true,
          },
        ],
      },
    },
  ].map((l) => JSON.stringify(l));
  fs.writeFileSync(file, [lines[0], "{not json", ...lines.slice(1)].join("\n"));
  const s = await parseSessionFile(file);
  assert.ok(s);
  assert.equal(s.cwd, "/p");
  assert.equal(s.messages.length, 1);
  assert.equal(s.calls[0]?.result?.isError, true);
  assert.equal(s.calls[0]?.result?.text, "boom");
  fs.rmSync(dir, { recursive: true });
});

test("returns null for logs without calls or messages", async () => {
  const dir = tmp();
  const file = path.join(dir, "e.jsonl");
  fs.writeFileSync(file, JSON.stringify({ type: "mode", mode: "x" }) + "\n");
  assert.equal(await parseSessionFile(file), null);
  fs.rmSync(dir, { recursive: true });
});

test("discovers only the requested project's folders", () => {
  const dir = tmp();
  const proj = "/work/app";
  for (const name of [encodeProjectDir(proj), `${encodeProjectDir(proj)}-sub`, "-work-other"]) {
    fs.mkdirSync(path.join(dir, name));
    fs.writeFileSync(path.join(dir, name, "x.jsonl"), "");
  }
  assert.equal(discoverLogFiles(dir, proj).length, 2);
  assert.equal(discoverLogFiles(dir).length, 3);
  fs.rmSync(dir, { recursive: true });
});
