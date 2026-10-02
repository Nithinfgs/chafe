import type { Session, ToolCall } from "../src/types.js";

let n = 0;
export function bash(command: string, ok: boolean, text = "", ts = 0): ToolCall {
  return {
    id: `t${++n}`,
    name: "Bash",
    input: { command },
    ts: ts || n * 1000,
    sidechain: false,
    result: { isError: !ok, text: ok ? text || "ok" : `Exit code 1\n${text || "Error: failed"}` },
  };
}

export function session(
  id: string,
  calls: ToolCall[],
  messages: string[] = [],
  start = 1_000,
): Session {
  return {
    id,
    file: `${id}.jsonl`,
    cwd: "/p",
    start,
    end: start + 1000,
    calls,
    messages: messages.map((text, i) => ({ text, ts: start + i })),
  };
}
