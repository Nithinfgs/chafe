import fs from "node:fs";
import path from "node:path";
import type { Analysis, CorrectionCluster, FixPair } from "./types.js";

export const START =
  "<!-- chafe:start (generated from session logs; refresh with chafe --apply --write) -->";
export const END = "<!-- chafe:end -->";

export function fixRule(f: FixPair): string {
  const why = f.error
    ? ` (failed ${f.count}× in ${f.sessions} sessions: \`${f.error.slice(0, 70)}\`)`
    : "";
  if (f.substitute) {
    return `\`${f.failCmd.split(/\s+/)[0]}\` is not available here; use \`${f.fixCmd}\` instead${why}.`;
  }
  return `Run \`${f.fixCmd}\`, not \`${f.failCmd}\`${why}.`;
}

export function correctionRule(c: CorrectionCluster): string {
  return `Reminder (said ${c.count}× across ${c.sessions} sessions): ${c.text}`;
}

/** Rules worth writing into an instruction file: recurring, with evidence, not already documented. */
export function newRules(a: Analysis, max = 10): string[] {
  const fixes = a.fixes.filter((f) => f.status === "new").map(fixRule);
  const says = a.corrections.filter((c) => c.status === "new").map(correctionRule);
  return [...fixes, ...says].slice(0, max);
}

export function renderBlock(rules: string[]): string {
  return [START, "## Learned from past sessions", "", ...rules.map((r) => `- ${r}`), END, ""].join(
    "\n",
  );
}

export function pickTarget(root: string): string {
  for (const name of ["AGENTS.md", "CLAUDE.md"]) {
    const p = path.join(root, name);
    if (fs.existsSync(p)) return p;
  }
  return path.join(root, "AGENTS.md");
}

/** Replace the managed block if present, otherwise append one. Content outside it is untouched. */
export function applyBlock(existing: string, block: string): string {
  const re = /<!-- chafe:start[\s\S]*?<!-- chafe:end -->\n?/;
  if (re.test(existing)) return existing.replace(re, block);
  const sep =
    existing.length === 0 || existing.endsWith("\n\n")
      ? ""
      : existing.endsWith("\n")
        ? "\n"
        : "\n\n";
  return `${existing}${sep}${block}`;
}
