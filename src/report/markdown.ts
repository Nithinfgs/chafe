import type { Analysis } from "../types.js";
import { newRules } from "../rules.js";

const day = (ms: number) => new Date(ms).toISOString().slice(0, 10);
const cell = (s: string) => s.replace(/\|/g, "\\|").replace(/\n/g, " ");

export function renderMarkdown(a: Analysis): string {
  const o: string[] = [];
  o.push(`# chafe report`, "");
  o.push(
    `${a.sessions} sessions, ${a.toolCalls} tool calls, ${a.failedCalls} failed, ${day(a.from)} → ${day(a.to)}.`,
    "",
  );
  if (a.fixes.length) {
    o.push("## Failed, then fixed", "", "| Failed | Worked | Seen | Status |", "|---|---|---|---|");
    for (const f of a.fixes) {
      o.push(
        `| \`${cell(f.failCmd)}\` | \`${cell(f.fixCmd)}\` | ${f.count}× / ${f.sessions} sessions | ${f.status} |`,
      );
    }
    o.push("");
  }
  if (a.corrections.length) {
    o.push("## You kept saying", "");
    for (const c of a.corrections)
      o.push(`- “${c.text}” — ${c.count}× / ${c.sessions} sessions (${c.status})`);
    o.push("");
  }
  if (a.loops.length) {
    o.push("## Retry loops", "");
    for (const l of a.loops) o.push(`- ${l.label}: ${l.runs} loops, longest ${l.maxRun}`);
    o.push("");
  }
  if (a.permissions.length) {
    o.push("## Safe to allow", "");
    for (const p of a.permissions) o.push(`- \`${p.rule}\` (${p.uses} uses)`);
    o.push("");
  }
  o.push("## Suggested rules", "");
  const rules = newRules(a);
  o.push(...(rules.length ? rules.map((r) => `- ${r}`) : ["Nothing new."]), "");
  return o.join("\n");
}
