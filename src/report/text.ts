import type { Analysis, RuleStatus } from "../types.js";
import { correctionRule, fixRule, newRules } from "../rules.js";

export interface Style {
  bold(s: string): string;
  dim(s: string): string;
  red(s: string): string;
  green(s: string): string;
  yellow(s: string): string;
  cyan(s: string): string;
}

const wrap = (open: number, close: number, on: boolean) => (s: string) =>
  on ? `\x1b[${open}m${s}\x1b[${close}m` : s;

export function makeStyle(color: boolean): Style {
  return {
    bold: wrap(1, 22, color),
    dim: wrap(2, 22, color),
    red: wrap(31, 39, color),
    green: wrap(32, 39, color),
    yellow: wrap(33, 39, color),
    cyan: wrap(36, 39, color),
  };
}

const trunc = (s: string, n = 64) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);
const day = (ms: number) => new Date(ms).toISOString().slice(0, 10);

function badge(st: Style, status: RuleStatus, after: number): string {
  if (status === "new") return st.green("● not in your instructions yet");
  if (status === "documented") return st.dim("✓ documented, no repeats since");
  return st.yellow(`⚠ documented, but happened ${after}× since the file changed`);
}

function section(st: Style, title: string, hint: string): string {
  return `\n${st.bold(title)}  ${st.dim(hint)}\n`;
}

export function renderText(a: Analysis, st: Style): string {
  const out: string[] = [];
  const failPct = a.toolCalls ? Math.round((a.failedCalls / a.toolCalls) * 100) : 0;
  out.push(
    `${st.bold("chafe")} ${st.dim("·")} ${a.sessions} sessions ${st.dim("·")} ${a.toolCalls} tool calls ${st.dim("·")} ${a.failedCalls} failed (${failPct}%) ${st.dim("·")} ${day(a.from)} → ${day(a.to)}`,
  );
  out.push(
    st.dim(
      a.instructionFiles.length
        ? `instruction files: ${a.instructionFiles.join(", ")}`
        : "instruction files: none found (AGENTS.md / CLAUDE.md)",
    ),
  );

  if (a.fixes.length) {
    out.push(section(st, "FAILED, THEN FIXED", "commands your agent got wrong, then corrected"));
    for (const f of a.fixes.slice(0, 6)) {
      out.push(`  ${st.red("✗")} ${f.failCmd}`);
      out.push(`  ${st.green("✓")} ${f.fixCmd}`);
      out.push(
        st.dim(
          `    ${f.count}× in ${f.sessions} sessions · last ${day(f.lastSeen)} · ${trunc(f.error) || "no error text"}`,
        ),
      );
      out.push(`    ${badge(st, f.status, f.recurrencesAfterDoc)}\n`);
    }
  }

  if (a.corrections.length) {
    out.push(
      section(
        st,
        "YOU KEPT SAYING",
        "corrections repeated across sessions (heuristic, your words)",
      ),
    );
    for (const c of a.corrections.slice(0, 6)) {
      out.push(`  “${c.text}”`);
      out.push(st.dim(`    ${c.count}× in ${c.sessions} sessions · last ${day(c.lastSeen)}`));
      out.push(`    ${badge(st, c.status, c.recurrencesAfterDoc)}\n`);
    }
  }

  if (a.loops.length) {
    out.push(section(st, "RETRY LOOPS", "the same failing call repeated 3+ times in a row"));
    for (const l of a.loops) {
      out.push(
        `  ${st.yellow("↻")} ${l.label} ${st.dim(`— ${l.runs} loops, longest ${l.maxRun}, ${l.sessions} sessions`)}`,
      );
    }
  }

  if (a.hotFiles.length) {
    out.push(
      section(
        st,
        "ALWAYS RE-READ",
        "opened in most sessions, never mentioned in your instructions",
      ),
    );
    for (const h of a.hotFiles) {
      out.push(
        `  ${st.cyan("◆")} ${h.path} ${st.dim(`— ${h.sessions} sessions, ${h.reads} reads`)}`,
      );
    }
  }

  if (a.permissions.length) {
    out.push(
      section(st, "SAFE TO ALLOW", "read-only commands you keep approving · chafe --permissions"),
    );
    for (const p of a.permissions.slice(0, 6)) {
      out.push(`  ${p.rule} ${st.dim(`— ${p.uses} uses`)}`);
    }
  }

  const rules = newRules(a);
  out.push(
    section(
      st,
      "SUGGESTED RULES",
      `${rules.length} new · chafe --apply to preview, --write to save`,
    ),
  );
  if (rules.length === 0) out.push(st.dim("  no new rules to suggest."));
  for (const r of rules) out.push(`  - ${r}`);
  if (!a.fixes.length && !a.corrections.length && !a.loops.length) {
    out.push(st.dim("\n  No recurring friction found. Try --min 1 or a longer --since window."));
  }
  return `${out.join("\n")}\n`;
}

export { fixRule, correctionRule };
