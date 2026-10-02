import type { Session, ToolCall } from "../types.js";
import {
  commandSig,
  tokenize,
  primarySegment,
  diffTokens,
  errorLine,
  isNotFound,
  normalizeCommand,
  program,
} from "../normalize.js";

export interface RawFix {
  failCmd: string;
  fixCmd: string;
  failNorm: string;
  fixNorm: string;
  error: string;
  substitute: boolean;
  sessionId: string;
  ts: number;
}

const WINDOW = 6;

/** One-off scripts, heredocs and long pipelines are not conventions worth writing down. */
function reusable(cmd: string): boolean {
  return cmd.length <= 140 && !cmd.includes("\n") && !cmd.includes("<<") && !/[;|]/.test(cmd);
}

function fileArgs(cmd: string): Set<string> {
  return new Set(
    tokenize(primarySegment(cmd)).filter(
      (t) => !t.startsWith("-") && t !== '"…"' && (t.includes("/") || /\.[a-z]{1,4}$/.test(t)),
    ),
  );
}

function sharesFileArg(a: string, b: string): boolean {
  const fa = fileArgs(a);
  return [...fileArgs(b)].some((t) => fa.has(t));
}

function bashCalls(s: Session): ToolCall[] {
  return s.calls.filter(
    (c) => c.name === "Bash" && typeof c.input["command"] === "string" && c.result !== undefined,
  );
}

/** Find "this command failed, then a changed version of it worked" pairs. */
export function findFixPairs(s: Session): RawFix[] {
  const calls = bashCalls(s);
  const out: RawFix[] = [];
  for (let i = 0; i < calls.length; i++) {
    const f = calls[i];
    if (!f?.result?.isError) continue;
    const failCmd = String(f.input["command"]);
    if (!reusable(failCmd)) continue;
    const failSig = commandSig(failCmd);
    const failNorm = normalizeCommand(failCmd);
    const error = errorLine(f.result.text);
    const notFound = isNotFound(error);

    for (let j = i + 1; j < Math.min(calls.length, i + 1 + WINDOW); j++) {
      const g = calls[j];
      if (!g?.result || g.result.isError) continue;
      const fixCmd = String(g.input["command"]);
      if (!reusable(fixCmd)) continue;
      const fixNorm = normalizeCommand(fixCmd);
      const sameSig = commandSig(fixCmd) === failSig;
      if (sameSig && fixNorm === failNorm) break; // same command later passed: flaky, not a convention
      const substitute = notFound && program(fixCmd) !== program(failCmd) && j <= i + 3;
      const sameTarget = j <= i + 3 && sharesFileArg(failCmd, fixCmd); // e.g. `node x.ts` -> `npx tsx x.ts`
      if (sameSig || substitute || sameTarget) {
        out.push({
          failCmd,
          fixCmd,
          failNorm,
          fixNorm,
          error,
          substitute,
          sessionId: s.id,
          ts: f.ts,
        });
        i = j; // consume the failures in between
        break;
      }
    }
  }
  return out;
}

export { diffTokens };
