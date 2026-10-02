// Generates the synthetic demo sessions in examples/demo-project/sessions.
// Everything here is invented: no real project, person or log is involved.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "examples",
  "demo-project",
);
const outDir = path.join(root, "sessions", "-home-dev-shop-api");
const CWD = "/home/dev/shop-api";
fs.rmSync(path.join(root, "sessions"), { recursive: true, force: true });
fs.mkdirSync(outDir, { recursive: true });

const OK = (t = "ok") => ({ out: t, err: false });
const BAD = (t) => ({ out: `Exit code 1\n${t}`, err: true });
const bash = (command, r) => ({ tool: "Bash", input: { command, description: "run" }, r });
const read = (f) => ({ tool: "Read", input: { file_path: `${CWD}/${f}` }, r: OK("…") });
const say = (text) => ({ say: text });

const testFail = bash(
  "npm test",
  BAD("ERROR  vitest is running in watch mode but stdin is not a TTY\nTest run aborted"),
);
const testOk = bash("npm test -- --run", OK("Tests  42 passed"));
const pnpmFail = bash("pnpm install", BAD("zsh: command not found: pnpm"));
const pnpmOk = bash("npm install", OK("added 312 packages"));
const dockerFail = bash("docker-compose up -d db", BAD("zsh: command not found: docker-compose"));
const dockerOk = bash("docker compose up -d db", OK("Container db  Started"));
const seedFail = bash(
  "node scripts/seed.ts",
  BAD(
    'TypeError [ERR_UNKNOWN_FILE_EXTENSION]: Unknown file extension ".ts" for /home/dev/shop-api/scripts/seed.ts',
  ),
);
const seedOk = bash("npx tsx scripts/seed.ts", OK("seeded 120 rows"));
const prismaFail = bash(
  "npx prisma migrate dev",
  BAD("Error: Environment variable not found: DATABASE_URL."),
);
const prismaOk = bash(
  "DATABASE_URL=file:./dev.db npx prisma migrate dev",
  OK("Applied 3 migrations"),
);
const status = bash("git status", OK("On branch main"));
const diff = bash("git diff", OK("diff --git a/src/app.ts b/src/app.ts"));
const lint = bash("npm run lint", OK("0 problems"));
const curlBad = bash(
  "curl -s localhost:3000/health",
  BAD("curl: (7) Failed to connect to localhost port 3000: Connection refused"),
);
const editBad = {
  tool: "Edit",
  input: {
    file_path: `${CWD}/src/routes/orders.ts`,
    old_string: "const total = sum(items)",
    new_string: "const total = sumItems(items)",
  },
  r: BAD("String to replace not found in file."),
};
const dist = say("No, don't edit files in dist/, change the source in src/ instead");
const dist2 = say("Don't touch dist/ - it's generated, edit the source in src/");
const dist3 = say("You edited dist/ again, change the source in src/ instead");
const cmt1 = say("Please don't add a comment to every function");
const cmt2 = say("Stop adding a comment to every function, keep it minimal");

const sessions = [
  [
    "2026-09-02",
    "add order totals",
    [read("src/db/schema.ts"), read("src/config.ts"), status, pnpmFail, pnpmOk, testFail, testOk],
  ],
  [
    "2026-09-04",
    "fix cart rounding",
    [dist, read("src/db/schema.ts"), dockerFail, dockerOk, testFail, testOk, diff, diff],
  ],
  [
    "2026-09-07",
    "seed the dev db",
    [read("src/db/schema.ts"), status, status, status, pnpmFail, pnpmOk, seedFail, seedOk, cmt1],
  ],
  [
    "2026-09-10",
    "add health route",
    [
      read("src/config.ts"),
      prismaFail,
      prismaOk,
      curlBad,
      curlBad,
      curlBad,
      curlBad,
      testFail,
      testOk,
    ],
  ],
  [
    "2026-09-13",
    "refactor pricing",
    [dist2, read("src/db/schema.ts"), dockerFail, dockerOk, diff, lint, status],
  ],
  [
    "2026-09-16",
    "coupon codes",
    [
      read("src/db/schema.ts"),
      read("src/config.ts"),
      pnpmFail,
      pnpmOk,
      seedFail,
      seedOk,
      editBad,
      editBad,
      editBad,
      cmt2,
    ],
  ],
  [
    "2026-09-18",
    "pagination",
    [read("src/db/schema.ts"), prismaFail, prismaOk, testFail, testOk, status, diff],
  ],
  [
    "2026-09-22",
    "inventory sync",
    [dist3, read("src/db/schema.ts"), seedFail, seedOk, status, lint],
  ],
  [
    "2026-09-24",
    "refund endpoint",
    [
      read("src/db/schema.ts"),
      read("src/config.ts"),
      seedFail,
      seedOk,
      testFail,
      testOk,
      curlBad,
      curlBad,
      curlBad,
      diff,
    ],
  ],
  [
    "2026-09-26",
    "audit log",
    [read("src/db/schema.ts"), pnpmFail, pnpmOk, prismaFail, prismaOk, diff, lint, status],
  ],
  ["2026-09-28", "rate limiting", [read("src/config.ts"), cmt1, testFail, testOk, status, diff]],
];

let n = 0;
const uid = () => `00000000-0000-4000-8000-${String(++n).padStart(12, "0")}`;

sessions.forEach(([date, title, steps], i) => {
  const sessionId = `demo-session-${String(i + 1).padStart(2, "0")}`;
  let t = Date.parse(`${date}T09:00:00Z`);
  const lines = [];
  const base = (type) => ({
    type,
    isSidechain: false,
    uuid: uid(),
    timestamp: new Date((t += 20_000)).toISOString(),
    cwd: CWD,
    sessionId,
    version: "demo",
  });
  lines.push({ ...base("user"), message: { role: "user", content: title } });
  for (const s of steps) {
    if (s.say) {
      lines.push({ ...base("user"), message: { role: "user", content: s.say } });
      continue;
    }
    const id = `toolu_${String(++n).padStart(6, "0")}`;
    lines.push({
      ...base("assistant"),
      message: {
        role: "assistant",
        content: [{ type: "tool_use", id, name: s.tool, input: s.input }],
      },
    });
    lines.push({
      ...base("user"),
      message: {
        role: "user",
        content: [{ type: "tool_result", tool_use_id: id, content: s.r.out, is_error: s.r.err }],
      },
    });
  }
  fs.writeFileSync(
    path.join(outDir, `${sessionId}.jsonl`),
    lines.map((l) => JSON.stringify(l)).join("\n") + "\n",
  );
});
console.log(`wrote ${sessions.length} synthetic sessions`);
