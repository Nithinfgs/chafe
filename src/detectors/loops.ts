import type { Session, ToolCall } from "../types.js";
import { commandSig } from "../normalize.js";

export interface RawLoop {
  label: string;
  length: number;
  sessionId: string;
}

function key(c: ToolCall): string {
  return `${c.name}:${JSON.stringify(c.input)}`;
}

export function label(c: ToolCall): string {
  if (c.name === "Bash") return `Bash: ${commandSig(String(c.input["command"] ?? ""))}`;
  const file = c.input["file_path"] ?? c.input["path"] ?? c.input["pattern"];
  return typeof file === "string" ? `${c.name}: ${file}` : c.name;
}

/** Runs of 3+ identical tool calls in a row where the repeats did not make progress. */
export function findLoops(s: Session): RawLoop[] {
  const out: RawLoop[] = [];
  let i = 0;
  while (i < s.calls.length) {
    const start = s.calls[i];
    if (!start) break;
    let j = i + 1;
    while (j < s.calls.length && s.calls[j] && key(s.calls[j] as ToolCall) === key(start)) j++;
    const run = s.calls.slice(i, j);
    const failing = run.filter((c) => c.result?.isError).length;
    if (run.length >= 3 && failing >= run.length - 1) {
      out.push({ label: label(start), length: run.length, sessionId: s.id });
    }
    i = j;
  }
  return out;
}
