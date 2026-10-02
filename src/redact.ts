import os from "node:os";

const PATTERNS: RegExp[] = [
  /\b(?:sk|pk|rk)-[A-Za-z0-9_-]{16,}\b/g,
  /\bgh[pousr]_[A-Za-z0-9]{20,}\b/g,
  /\bgithub_pat_[A-Za-z0-9_]{20,}\b/g,
  /\bAKIA[0-9A-Z]{16}\b/g,
  /\bxox[abprs]-[A-Za-z0-9-]{10,}\b/g,
  /\bBearer\s+[A-Za-z0-9._~+/=-]{12,}/gi,
  /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{5,}\b/g,
  /(\b[A-Z0-9_]*(?:KEY|TOKEN|SECRET|PASSWORD|PASSWD|PWD)[A-Z0-9_]*=)\S+/g,
  /(--(?:password|token|secret|api-key)[= ])\S+/gi,
  /(:\/\/[^\s:@/]+:)[^\s@/]+(@)/g,
];

/** Strip obvious secrets and the home directory from any text chafe surfaces. */
export function redact(input: string): string {
  let out = input;
  for (const re of PATTERNS) {
    out = out.replace(re, (...m: string[]) => {
      const groups = m.slice(1, -2).filter((g) => typeof g === "string");
      return groups.length === 2
        ? `${groups[0]}‹redacted›${groups[1]}`
        : groups.length === 1
          ? `${groups[0]}‹redacted›`
          : "‹redacted›";
    });
  }
  const home = os.homedir();
  if (home && home.length > 1) out = out.split(home).join("~");
  return out;
}
