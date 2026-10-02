import path from "node:path";
import type {
  Analysis,
  AnalyzeOptions,
  CorrectionCluster,
  FixPair,
  HotFile,
  InstructionFile,
  LoopFinding,
  RuleStatus,
  Session,
} from "./types.js";
import { findFixPairs, diffTokens, type RawFix } from "./detectors/fixes.js";
import { clusterCorrections, findCorrections } from "./detectors/corrections.js";
import { findLoops } from "./detectors/loops.js";
import { readCounts } from "./detectors/hotfiles.js";
import { countPermissionRules } from "./detectors/permissions.js";
import { mentionsCommand, mentionsGuidance } from "./instructions.js";
import { redact } from "./redact.js";

interface Doc {
  file: InstructionFile | undefined;
}

function statusFor(
  doc: Doc,
  times: number[],
  override?: number,
): { status: RuleStatus; after: number } {
  if (!doc.file) return { status: "new", after: 0 };
  const since = override ?? doc.file.mtime;
  const after = times.filter((t) => t > since).length;
  return { status: after > 0 ? "ignored" : "documented", after };
}

function groupFixes(raw: RawFix[], files: InstructionFile[], opts: AnalyzeOptions): FixPair[] {
  const groups = new Map<string, RawFix[]>();
  for (const r of raw) {
    const k = `${r.failNorm} => ${r.fixNorm}`;
    groups.set(k, [...(groups.get(k) ?? []), r]);
  }
  const out: FixPair[] = [];
  for (const items of groups.values()) {
    const sessions = new Set(items.map((i) => i.sessionId)).size;
    if (sessions < opts.minOccurrences) continue;
    const first = items[items.length - 1] as RawFix;
    const times = items.map((i) => i.ts);
    const { status, after } = statusFor(
      { file: mentionsCommand(files, first.fixCmd.trim()) },
      times,
      opts.instructionsUpdatedAt,
    );
    out.push({
      kind: "fix",
      failCmd: redact(first.failCmd.trim()),
      fixCmd: redact(first.fixCmd.trim()),
      diff: diffTokens(first.failNorm, first.fixNorm),
      substitute: first.substitute,
      error: redact(first.error),
      count: items.length,
      sessions,
      lastSeen: Math.max(...times),
      times,
      status,
      recurrencesAfterDoc: after,
    });
  }
  return out.sort((a, b) => b.count - a.count || b.lastSeen - a.lastSeen);
}

function groupCorrections(
  sessions: Session[],
  files: InstructionFile[],
  opts: AnalyzeOptions,
): CorrectionCluster[] {
  const clusters = clusterCorrections(sessions.flatMap(findCorrections));
  const out: CorrectionCluster[] = [];
  for (const c of clusters) {
    const n = new Set(c.items.map((i) => i.sessionId)).size;
    if (n < opts.minOccurrences) continue;
    const times = c.items.map((i) => i.ts);
    const { status, after } = statusFor(
      { file: mentionsGuidance(files, c.text) },
      times,
      opts.instructionsUpdatedAt,
    );
    out.push({
      kind: "correction",
      text: redact(c.text),
      count: c.items.length,
      sessions: n,
      lastSeen: Math.max(...times),
      times,
      status,
      recurrencesAfterDoc: after,
    });
  }
  return out.sort((a, b) => b.sessions - a.sessions || b.count - a.count);
}

function loopFindings(sessions: Session[], root: string): LoopFinding[] {
  const groups = new Map<string, { runs: number; max: number; sessions: Set<string> }>();
  for (const s of sessions) {
    for (const l of findLoops(s)) {
      const g = groups.get(l.label) ?? { runs: 0, max: 0, sessions: new Set<string>() };
      g.runs++;
      g.max = Math.max(g.max, l.length);
      g.sessions.add(l.sessionId);
      groups.set(l.label, g);
    }
  }
  return [...groups.entries()]
    .map(([label, g]) => ({
      label: redact(label.split(`${root}/`).join("")),
      runs: g.runs,
      maxRun: g.max,
      sessions: g.sessions.size,
    }))
    .sort((a, b) => b.runs - a.runs)
    .slice(0, 5);
}

function hotFiles(sessions: Session[], root: string, files: InstructionFile[]): HotFile[] {
  const agg = new Map<string, HotFile>();
  for (const s of sessions) {
    for (const [p, n] of readCounts(s, root)) {
      const h = agg.get(p) ?? { path: p, sessions: 0, reads: 0 };
      h.sessions++;
      h.reads += n;
      agg.set(p, h);
    }
  }
  const mentioned = (p: string) =>
    files.some((f) => f.text.includes(p) || f.text.includes(path.basename(p)));
  const minSessions = Math.max(3, Math.ceil(sessions.length * 0.4));
  return [...agg.values()]
    .filter((h) => h.sessions >= minSessions && !mentioned(h.path))
    .sort((a, b) => b.sessions - a.sessions || b.reads - a.reads)
    .slice(0, 5);
}

export function analyze(
  project: string,
  sessions: Session[],
  files: InstructionFile[],
  opts: AnalyzeOptions,
): Analysis {
  const calls = sessions.flatMap((s) => s.calls);
  const allowed = new Set(opts.allowedRules ?? []);
  const permissions = [...countPermissionRules(sessions)]
    .filter(([rule, uses]) => uses >= 5 && !allowed.has(rule))
    .map(([rule, uses]) => ({ rule, uses }))
    .sort((a, b) => b.uses - a.uses)
    .slice(0, 12);

  return {
    project,
    sessions: sessions.length,
    toolCalls: calls.length,
    failedCalls: calls.filter((c) => c.result?.isError).length,
    from: Math.min(...sessions.map((s) => s.start)),
    to: Math.max(...sessions.map((s) => s.end)),
    instructionFiles: files.map((f) => path.relative(project, f.path) || f.path),
    fixes: groupFixes(sessions.flatMap(findFixPairs), files, opts),
    corrections: groupCorrections(sessions, files, opts),
    loops: loopFindings(sessions, project),
    hotFiles: hotFiles(sessions, project, files),
    permissions,
  };
}
