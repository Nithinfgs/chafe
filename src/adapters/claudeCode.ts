import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import readline from "node:readline";
import type { Session, ToolCall } from "../types.js";

export function defaultLogsDir(): string {
  const base = process.env["CLAUDE_CONFIG_DIR"] ?? path.join(os.homedir(), ".claude");
  return path.join(base, "projects");
}

/** Claude Code names a project's log folder after its path with non-alphanumerics replaced by "-". */
export function encodeProjectDir(projectPath: string): string {
  return projectPath.replace(/[^a-zA-Z0-9]/g, "-");
}

export function discoverLogFiles(logsDir: string, projectPath?: string): string[] {
  if (!fs.existsSync(logsDir)) return [];
  const prefix = projectPath ? encodeProjectDir(path.resolve(projectPath)) : undefined;
  const files: string[] = [];
  for (const entry of fs.readdirSync(logsDir, { withFileTypes: true })) {
    if (entry.isFile() && entry.name.endsWith(".jsonl") && !prefix) {
      files.push(path.join(logsDir, entry.name));
      continue;
    }
    if (!entry.isDirectory()) continue;
    if (prefix && entry.name !== prefix && !entry.name.startsWith(`${prefix}-`)) continue;
    const dir = path.join(logsDir, entry.name);
    for (const f of fs.readdirSync(dir)) {
      if (f.endsWith(".jsonl")) files.push(path.join(dir, f));
    }
  }
  return files.sort();
}

type Json = Record<string, unknown>;

function asObj(v: unknown): Json | undefined {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Json) : undefined;
}

function blocksOf(content: unknown): Json[] {
  return Array.isArray(content) ? content.map(asObj).filter((b): b is Json => !!b) : [];
}

function textOf(content: unknown): string {
  if (typeof content === "string") return content;
  return blocksOf(content)
    .filter((b) => b["type"] === "text" && typeof b["text"] === "string")
    .map((b) => b["text"] as string)
    .join("\n");
}

const NOT_HUMAN = /^(<|\[Request interrupted|Caveat:)/;

export async function parseSessionFile(file: string): Promise<Session | null> {
  const session: Session = {
    id: path.basename(file, ".jsonl"),
    file,
    cwd: "",
    start: Infinity,
    end: 0,
    calls: [],
    messages: [],
  };
  const byId = new Map<string, ToolCall>();
  const rl = readline.createInterface({
    input: fs.createReadStream(file, "utf8"),
    crlfDelay: Infinity,
  });

  for await (const line of rl) {
    if (!line.trim()) continue;
    let o: Json | undefined;
    try {
      o = asObj(JSON.parse(line));
    } catch {
      continue; // truncated or corrupt line: skip rather than fail the whole session
    }
    if (!o) continue;
    const type = o["type"];
    if (type !== "assistant" && type !== "user") continue;

    const ts = typeof o["timestamp"] === "string" ? Date.parse(o["timestamp"]) : NaN;
    if (Number.isFinite(ts)) {
      session.start = Math.min(session.start, ts);
      session.end = Math.max(session.end, ts);
    }
    if (!session.cwd && typeof o["cwd"] === "string") session.cwd = o["cwd"];
    const sidechain = o["isSidechain"] === true;
    const message = asObj(o["message"]);
    if (!message) continue;
    const blocks = blocksOf(message["content"]);

    if (type === "assistant") {
      for (const b of blocks) {
        if (b["type"] !== "tool_use" || typeof b["id"] !== "string") continue;
        const call: ToolCall = {
          id: b["id"],
          name: String(b["name"] ?? ""),
          input: asObj(b["input"]) ?? {},
          ts: Number.isFinite(ts) ? ts : 0,
          sidechain,
        };
        byId.set(call.id, call);
        session.calls.push(call);
      }
      continue;
    }

    const results = blocks.filter((b) => b["type"] === "tool_result");
    for (const r of results) {
      const call = typeof r["tool_use_id"] === "string" ? byId.get(r["tool_use_id"]) : undefined;
      if (call) call.result = { isError: r["is_error"] === true, text: textOf(r["content"]) };
    }
    if (results.length === 0 && !sidechain && o["isMeta"] !== true) {
      const text = textOf(message["content"]).trim();
      if (text && !NOT_HUMAN.test(text) && Number.isFinite(ts)) session.messages.push({ text, ts });
    }
  }

  if (session.calls.length === 0 && session.messages.length === 0) return null;
  if (!Number.isFinite(session.start)) session.start = 0;
  return session;
}
