/** Helpers that turn raw shell commands and error text into stable comparison keys. */

export function tokenize(cmd: string): string[] {
  const tokens: string[] = [];
  const re = /"((?:\\.|[^"\\])*)"|'([^']*)'|(\S+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(cmd)) !== null) {
    if (m[1] !== undefined || m[2] !== undefined) tokens.push('"…"');
    else if (m[3] !== undefined) tokens.push(m[3]);
  }
  return tokens;
}

const ENV_ASSIGN = /^[A-Za-z_][A-Za-z0-9_]*=/;
const FILE_EXT =
  /\.(?:[cm]?[jt]sx?|py|rs|go|rb|java|kt|swift|json|ya?ml|toml|md|txt|sh|css|html|sql|lock)$/;

/** First meaningful shell segment: drops `cd x &&` prefixes and leading env assignments. */
export function primarySegment(cmd: string): string {
  const segments = cmd
    .split(/&&|;|\|\||\n/)
    .map((s) => s.trim())
    .filter(Boolean);
  const real = segments.filter((s) => !/^cd\s/.test(s));
  const first = (real[0] ?? segments[0] ?? "").split("|")[0]?.trim() ?? "";
  return first;
}

export function stripEnv(seg: string): string {
  const toks = seg.split(/\s+/);
  while (toks.length > 1 && ENV_ASSIGN.test(toks[0] ?? "")) toks.shift();
  return toks.join(" ");
}

function envPlaceholder(tok: string): string {
  return ENV_ASSIGN.test(tok) ? `${tok.slice(0, tok.indexOf("="))}=<v>` : tok;
}

function placeholder(tok: string): string {
  if (tok.startsWith("-")) return tok;
  if (/^https?:\/\//.test(tok)) return "<url>";
  if (/^\d+$/.test(tok)) return "N";
  if (/^[0-9a-f]{7,40}$/.test(tok)) return "<hash>";
  if (tok.includes("/") || FILE_EXT.test(tok) || tok.startsWith("~")) return "<file>";
  return tok;
}

/** Normalized form of a command: values collapsed to placeholders, flags kept. */
export function normalizeCommand(cmd: string): string {
  const toks = tokenize(primarySegment(cmd));
  let i = 0;
  while (i < toks.length - 1 && ENV_ASSIGN.test(toks[i] ?? "")) i++;
  return [...toks.slice(0, i).map(envPlaceholder), ...toks.slice(i).map(placeholder)].join(" ");
}

const RUNNERS = new Set(["npm", "pnpm", "yarn", "bun", "npx"]);

/** Program plus subcommand, e.g. "git status", "npm run lint", "pytest". */
export function commandSig(cmd: string): string {
  const toks = tokenize(stripEnv(primarySegment(cmd))).map(placeholder);
  const prog = (toks[0] ?? "").split("/").pop() ?? "";
  const sub = toks[1];
  if (!sub || sub.startsWith("-") || sub.startsWith("<") || sub === "N" || sub === '"…"')
    return prog;
  if (RUNNERS.has(prog) && sub === "run" && toks[2] && !toks[2].startsWith("-")) {
    return `${prog} run ${toks[2]}`;
  }
  return `${prog} ${sub}`;
}

export function program(cmd: string): string {
  return (tokenize(stripEnv(primarySegment(cmd)))[0] ?? "").split("/").pop() ?? "";
}

const ERROR_HINT =
  /error|fail|not found|cannot|can't|denied|invalid|unknown|unrecognized|no such|missing|traceback|exception|unexpected/i;

/** One representative, normalized line from a command's error output. */
export function errorLine(text: string): string {
  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && !/^exit code\b/i.test(l));
  const pick = lines.find((l) => ERROR_HINT.test(l)) ?? lines[0] ?? "";
  return pick
    .replace(/\x1b\[[0-9;]*m/g, "")
    .replace(/(?:\/[\w.@~-]+){2,}/g, "<path>")
    .replace(/\b\d+\b/g, "N")
    .slice(0, 160);
}

export function isNotFound(error: string): boolean {
  return /command not found|not found: |: not found|is not recognized|no such file or directory: ?[\w.-]+$/i.test(
    error,
  );
}

export function diffTokens(
  failNorm: string,
  fixNorm: string,
): { added: string[]; removed: string[] } {
  const a = failNorm.split(" ");
  const b = fixNorm.split(" ");
  return { added: b.filter((t) => !a.includes(t)), removed: a.filter((t) => !b.includes(t)) };
}

const STOP = new Set(
  "the and for you that with this not are but have has was use using from your just into then than them they what when will can its it's don't dont please about also only some more make sure should would could".split(
    " ",
  ),
);

export function wordSet(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9_\s./-]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length >= 3 && !STOP.has(w)),
  );
}

/** Word-overlap similarity in 0..1. */
export function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  for (const x of a) if (b.has(x)) inter++;
  const union = inter / (a.size + b.size - inter);
  const smaller = Math.min(a.size, b.size);
  // Overlap coefficient catches a short reminder that is a subset of a longer one.
  return smaller >= 3 ? Math.max(union, (inter / smaller) * 0.9) : union;
}
