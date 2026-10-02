export interface ToolResult {
  isError: boolean;
  text: string;
}

export interface ToolCall {
  id: string;
  name: string;
  input: Record<string, unknown>;
  ts: number;
  sidechain: boolean;
  result?: ToolResult;
}

export interface UserMessage {
  text: string;
  ts: number;
}

/** Agent-agnostic view of one session. Adapters produce this; detectors consume it. */
export interface Session {
  id: string;
  file: string;
  cwd: string;
  start: number;
  end: number;
  calls: ToolCall[];
  messages: UserMessage[];
}

export type RuleStatus = "new" | "documented" | "ignored";

export interface InstructionFile {
  path: string;
  text: string;
  mtime: number;
}

export interface FixPair {
  kind: "fix";
  failCmd: string;
  fixCmd: string;
  diff: { added: string[]; removed: string[] };
  substitute: boolean;
  error: string;
  count: number;
  sessions: number;
  lastSeen: number;
  times: number[];
  status: RuleStatus;
  recurrencesAfterDoc: number;
}

export interface CorrectionCluster {
  kind: "correction";
  text: string;
  count: number;
  sessions: number;
  lastSeen: number;
  times: number[];
  status: RuleStatus;
  recurrencesAfterDoc: number;
}

export interface LoopFinding {
  label: string;
  runs: number;
  maxRun: number;
  sessions: number;
}

export interface HotFile {
  path: string;
  sessions: number;
  reads: number;
}

export interface PermissionSuggestion {
  rule: string;
  uses: number;
}

export interface Analysis {
  project: string;
  sessions: number;
  toolCalls: number;
  failedCalls: number;
  from: number;
  to: number;
  instructionFiles: string[];
  fixes: FixPair[];
  corrections: CorrectionCluster[];
  loops: LoopFinding[];
  hotFiles: HotFile[];
  permissions: PermissionSuggestion[];
}

export interface AnalyzeOptions {
  minOccurrences: number;
  /** Override the "instructions last edited" time (tests and the bundled demo). */
  instructionsUpdatedAt?: number;
  /** Existing permission rules (already allowed) to skip when suggesting an allowlist. */
  allowedRules?: string[];
}
