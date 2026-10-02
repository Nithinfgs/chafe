import fs from "node:fs";
import path from "node:path";
import type { InstructionFile } from "./types.js";
import { jaccard, wordSet } from "./normalize.js";

const CANDIDATES = [
  "AGENTS.md",
  "CLAUDE.md",
  "CLAUDE.local.md",
  ".github/copilot-instructions.md",
  ".cursorrules",
];

export function loadInstructionFiles(root: string): InstructionFile[] {
  const found: string[] = CANDIDATES.map((c) => path.join(root, c));
  const rulesDir = path.join(root, ".cursor", "rules");
  if (fs.existsSync(rulesDir)) {
    for (const f of fs.readdirSync(rulesDir)) {
      if (/\.mdc?$/.test(f)) found.push(path.join(rulesDir, f));
    }
  }
  const out: InstructionFile[] = [];
  for (const p of found) {
    try {
      const st = fs.statSync(p);
      if (st.isFile()) out.push({ path: p, text: fs.readFileSync(p, "utf8"), mtime: st.mtimeMs });
    } catch {
      /* missing file */
    }
  }
  return out;
}

/** Text outside chafe's own managed block, so applying rules never counts as "documented". */
export function stripManagedBlock(text: string): string {
  return text.replace(/<!-- chafe:start[\s\S]*?<!-- chafe:end -->/g, "");
}

export function mentionsCommand(
  files: InstructionFile[],
  command: string,
): InstructionFile | undefined {
  const needle = command.trim().toLowerCase();
  return files.find((f) => stripManagedBlock(f.text).toLowerCase().includes(needle));
}

/** True when some line of an instruction file covers most of the words in `text`. */
export function mentionsGuidance(
  files: InstructionFile[],
  text: string,
): InstructionFile | undefined {
  const target = wordSet(text);
  if (target.size === 0) return undefined;
  return files.find((f) =>
    stripManagedBlock(f.text)
      .split("\n")
      .some((line) => {
        const w = wordSet(line);
        let hit = 0;
        for (const x of target) if (w.has(x)) hit++;
        return hit / target.size >= 0.6 || jaccard(target, w) >= 0.5;
      }),
  );
}
