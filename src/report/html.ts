import type { Analysis } from "../types.js";
import { newRules } from "../rules.js";

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const day = (ms: number) => new Date(ms).toISOString().slice(0, 10);

export function renderHtml(a: Analysis): string {
  const rules = newRules(a);
  const fixes = a.fixes
    .map(
      (
        f,
      ) => `<div class="card"><div class="bad">✗ ${esc(f.failCmd)}</div><div class="good">✓ ${esc(f.fixCmd)}</div>
<div class="meta">${f.count}× in ${f.sessions} sessions · last ${day(f.lastSeen)} · ${esc(f.error)}</div><span class="tag ${f.status}">${f.status}</span></div>`,
    )
    .join("");
  const says = a.corrections
    .map(
      (c) =>
        `<div class="card"><div>“${esc(c.text)}”</div><div class="meta">${c.count}× in ${c.sessions} sessions</div><span class="tag ${c.status}">${c.status}</span></div>`,
    )
    .join("");
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>chafe report</title>
<style>
:root{--bg:#fff;--fg:#1a1a1a;--mut:#6b6b6b;--card:#f5f5f4;--bad:#b3261e;--good:#1b7a3d;--warn:#9a6700;--line:#e2e2df}
@media(prefers-color-scheme:dark){:root{--bg:#161616;--fg:#ececec;--mut:#9a9a9a;--card:#222;--bad:#ff8a80;--good:#6fd58f;--warn:#e3b341;--line:#333}}
body{font:15px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace;background:var(--bg);color:var(--fg);max-width:820px;margin:0 auto;padding:24px 16px}
h1{font-size:20px}h2{font-size:13px;letter-spacing:.08em;text-transform:uppercase;color:var(--mut);margin-top:32px}
.card{background:var(--card);border:1px solid var(--line);border-radius:8px;padding:12px 14px;margin:10px 0;overflow-wrap:anywhere}
.bad{color:var(--bad)}.good{color:var(--good)}.meta{color:var(--mut);font-size:13px;margin-top:4px}
.tag{display:inline-block;font-size:12px;margin-top:6px;padding:1px 8px;border-radius:99px;border:1px solid var(--line)}
.tag.new{color:var(--good)}.tag.ignored{color:var(--warn)}.tag.documented{color:var(--mut)}
li{margin:6px 0;overflow-wrap:anywhere}
</style></head><body>
<h1>chafe</h1>
<p class="meta">${a.sessions} sessions · ${a.toolCalls} tool calls · ${a.failedCalls} failed · ${day(a.from)} → ${day(a.to)}</p>
${fixes ? `<h2>Failed, then fixed</h2>${fixes}` : ""}
${says ? `<h2>You kept saying</h2>${says}` : ""}
${a.loops.length ? `<h2>Retry loops</h2><ul>${a.loops.map((l) => `<li>${esc(l.label)} — ${l.runs} loops, longest ${l.maxRun}</li>`).join("")}</ul>` : ""}
${a.permissions.length ? `<h2>Safe to allow</h2><ul>${a.permissions.map((p) => `<li>${esc(p.rule)} — ${p.uses} uses</li>`).join("")}</ul>` : ""}
<h2>Suggested rules</h2><ul>${rules.map((r) => `<li>${esc(r)}</li>`).join("") || "<li>Nothing new.</li>"}</ul>
</body></html>
`;
}
