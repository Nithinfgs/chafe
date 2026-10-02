import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { discoverLogFiles, parseSessionFile } from "./adapters/claudeCode.js";
import { analyze } from "./analyze.js";
import { loadInstructionFiles } from "./instructions.js";
import type { Analysis, AnalyzeOptions, Session } from "./types.js";

export interface RunOptions {
  logsDir: string;
  /** Project directory to analyze; undefined means every project in logsDir. */
  project?: string;
  sinceMs: number;
  minOccurrences: number;
  instructionsUpdatedAt?: number;
  /** Read every log in logsDir but attribute them all to `project` (used by the bundled demo). */
  allLogs?: boolean;
}

export function parseSince(v: string, now = Date.now()): number {
  const m = /^(\d+)([dwm])$/.exec(v);
  if (m) {
    const n = Number(m[1]);
    const unit = { d: 1, w: 7, m: 30 }[m[2] as "d" | "w" | "m"];
    return now - n * unit * 86_400_000;
  }
  const t = Date.parse(v);
  if (Number.isNaN(t))
    throw new Error(`Cannot parse --since "${v}". Use 30d, 2w, 1m or a date like 2026-09-01.`);
  return t;
}

function projectRoot(cwd: string): string {
  let dir = cwd;
  for (let i = 0; i < 12; i++) {
    if (fs.existsSync(path.join(dir, ".git"))) return dir;
    const up = path.dirname(dir);
    if (up === dir) break;
    dir = up;
  }
  return cwd;
}

function readAllowedRules(root: string): string[] {
  const files = [
    path.join(root, ".claude", "settings.json"),
    path.join(root, ".claude", "settings.local.json"),
    path.join(os.homedir(), ".claude", "settings.json"),
  ];
  const rules: string[] = [];
  for (const f of files) {
    try {
      const j = JSON.parse(fs.readFileSync(f, "utf8")) as { permissions?: { allow?: unknown } };
      const allow = j.permissions?.allow;
      if (Array.isArray(allow))
        rules.push(...allow.filter((x): x is string => typeof x === "string"));
    } catch {
      /* no settings file */
    }
  }
  return rules;
}

export async function loadSessions(opts: RunOptions): Promise<Session[]> {
  const files = discoverLogFiles(opts.logsDir, opts.allLogs ? undefined : opts.project);
  const sessions: Session[] = [];
  for (const f of files) {
    if (fs.statSync(f).mtimeMs < opts.sinceMs) continue;
    const s = await parseSessionFile(f);
    if (s && s.end >= opts.sinceMs) sessions.push(s);
  }
  return sessions;
}

/** One Analysis per project root found in the loaded sessions. */
export async function run(opts: RunOptions): Promise<Analysis[]> {
  const sessions = await loadSessions(opts);
  const byRoot = new Map<string, Session[]>();
  for (const s of sessions) {
    const root = opts.project ? path.resolve(opts.project) : projectRoot(s.cwd || "unknown");
    byRoot.set(root, [...(byRoot.get(root) ?? []), s]);
  }
  const results: Analysis[] = [];
  for (const [root, list] of byRoot) {
    const analyzeOpts: AnalyzeOptions = {
      minOccurrences: opts.minOccurrences,
      ...(opts.instructionsUpdatedAt !== undefined && {
        instructionsUpdatedAt: opts.instructionsUpdatedAt,
      }),
      allowedRules: readAllowedRules(root),
    };
    results.push(analyze(root, list, loadInstructionFiles(root), analyzeOpts));
  }
  return results.sort((a, b) => b.failedCalls - a.failedCalls);
}
