// Renders real CLI output (ANSI) into an SVG "terminal screenshot" for the README.
// usage: node scripts/render-svg.mjs out.svg [--lines N] [--cols N] -- <chafe args...>
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const argv = process.argv.slice(2);
const out = argv[0];
const sep = argv.indexOf("--");
const opt = (name, d) => (argv.includes(name) ? Number(argv[argv.indexOf(name) + 1]) : d);
const maxLines = opt("--lines", 999);
const cols = opt("--cols", 104);
const chafeArgs = argv.slice(sep + 1);
const cli = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "dist",
  "src",
  "cli.js",
);
const raw = execFileSync("node", [cli, ...chafeArgs], {
  encoding: "utf8",
  env: { ...process.env, FORCE_COLOR: "1" },
});

const PALETTE = { 31: "#ff7b72", 32: "#7ee787", 33: "#e3b341", 36: "#79c0ff" };
const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const visible = (s) => s.replace(/\x1b\[[0-9;]*m/g, "");

// Wrap long lines (rule text) the way a terminal at `cols` would, with a hanging indent.
function wrap(line) {
  if (visible(line).length <= cols) return [line];
  const words = line.split(" ");
  const rows = [];
  let cur = "";
  for (const w of words) {
    if (visible(cur + " " + w).length > cols && cur) {
      rows.push(cur);
      cur = "    " + w;
    } else cur = cur ? cur + " " + w : w;
  }
  rows.push(cur);
  return rows;
}

const lines = raw.split("\n").flatMap(wrap).slice(0, maxLines);
while (lines.length && !visible(lines[lines.length - 1]).trim()) lines.pop();

const CW = 8.6,
  LH = 19,
  PADX = 22,
  TOP = 54;
const width = Math.ceil(cols * CW + PADX * 2);
const height = TOP + lines.length * LH + 22;

function spans(line) {
  let fill = null,
    bold = false,
    dim = false,
    buf = "";
  const parts = [];
  const flush = () => {
    if (!buf) return;
    const color = dim ? "#6e7681" : (fill ?? "#c9d1d9");
    parts.push(`<tspan fill="${color}"${bold ? ' font-weight="700"' : ""}>${esc(buf)}</tspan>`);
    buf = "";
  };
  for (const piece of line.split(/(\x1b\[[0-9;]*m)/)) {
    const m = /^\x1b\[([0-9;]*)m$/.exec(piece);
    if (!m) {
      buf += piece;
      continue;
    }
    flush();
    const c = Number(m[1]);
    if (c === 1) bold = true;
    else if (c === 22) {
      bold = false;
      dim = false;
    } else if (c === 2) dim = true;
    else if (c === 39) fill = null;
    else if (PALETTE[c]) fill = PALETTE[c];
  }
  flush();
  return parts.join("");
}

const body = lines
  .map((l, i) => `<text x="${PADX}" y="${TOP + i * LH}" xml:space="preserve">${spans(l)}</text>`)
  .join("\n");
const title = ["chafe", ...chafeArgs].join(" ");
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="Terminal output of ${esc(title)}">
<rect width="${width}" height="${height}" rx="10" fill="#0d1117"/>
<rect width="${width}" height="34" rx="10" fill="#161b22"/><rect y="24" width="${width}" height="10" fill="#161b22"/>
<circle cx="20" cy="17" r="5.5" fill="#ff5f56"/><circle cx="40" cy="17" r="5.5" fill="#ffbd2e"/><circle cx="60" cy="17" r="5.5" fill="#27c93f"/>
<text x="${width / 2}" y="21" text-anchor="middle" font-family="ui-monospace,SFMono-Regular,Menlo,monospace" font-size="12" fill="#8b949e">$ ${esc(title)}</text>
<g font-family="ui-monospace,SFMono-Regular,Menlo,Consolas,monospace" font-size="13">
${body}
</g></svg>
`;
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, svg);
console.log(`${out}: ${lines.length} lines, ${(svg.length / 1024).toFixed(1)} KB`);
