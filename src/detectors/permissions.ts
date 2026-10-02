import type { Session } from "../types.js";
import { primarySegment, stripEnv } from "../normalize.js";

// Read-only or check-only commands. Anything not matching stays a prompt: chafe never guesses.
const SAFE: RegExp[] = [
  /^git (status|diff|log|show|branch|rev-parse|remote|blame|ls-files|stash list)\b/,
  /^(ls|pwd|wc|head|tail|which|file|stat|du|df|tree)\b/,
  /^(rg|grep|cat)\s/,
  /^npm (test|ls)\b/,
  /^(npm|pnpm|yarn|bun) run (test|lint|typecheck|check)\b/,
  /^(pnpm|yarn|bun) (test|lint|typecheck)\b/,
  /^(pytest|ruff check|mypy|tsc --noEmit|prettier --check)\b/,
  /^cargo (check|test|clippy|fmt --check|tree)\b/,
  /^go (test|vet|list)\b/,
  /^gh (pr|issue|run|repo) (view|list|status|checks)\b/,
];
const SHELL_META = /[;&|<>`$()\\]/;

/** Returns a Claude Code permission rule for a plainly safe command, or undefined. */
export function permissionRule(command: string): string | undefined {
  const stripped = command.replace(/^cd [^;&|]+&&\s*/, "").replace(/"[^"]*"|'[^']*'/g, "");
  if (SHELL_META.test(stripped)) return undefined;
  const seg = stripEnv(primarySegment(command));
  for (const re of SAFE) {
    const m = re.exec(seg);
    if (m) return `Bash(${m[0].trim()}:*)`;
  }
  return undefined;
}

export function countPermissionRules(sessions: Session[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const s of sessions) {
    for (const c of s.calls) {
      if (c.name !== "Bash" || c.sidechain || typeof c.input["command"] !== "string") continue;
      const rule = permissionRule(c.input["command"]);
      if (rule) counts.set(rule, (counts.get(rule) ?? 0) + 1);
    }
  }
  return counts;
}
