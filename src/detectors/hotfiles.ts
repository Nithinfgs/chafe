import path from "node:path";
import type { Session } from "../types.js";

/** Files the agent opens (Read) per session, relative to the project root when possible. */
export function readCounts(s: Session, root: string): Map<string, number> {
  const counts = new Map<string, number>();
  for (const c of s.calls) {
    if (c.name !== "Read" || c.sidechain) continue;
    const p = c.input["file_path"];
    if (typeof p !== "string") continue;
    const rel = path.isAbsolute(p) ? path.relative(root, p) : p;
    if (rel.startsWith("..")) continue;
    counts.set(rel, (counts.get(rel) ?? 0) + 1);
  }
  return counts;
}
