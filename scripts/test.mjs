// Runs the compiled tests. Explicit file paths work on Node 20 through 24
// (globs need Node 21+, and bare `node --test` also picks up the .ts sources on newer Node).
import { spawnSync } from "node:child_process";
import fs from "node:fs";

const files = fs
  .readdirSync("dist/test")
  .filter((f) => f.endsWith(".test.js"))
  .map((f) => `dist/test/${f}`);
const r = spawnSync(process.execPath, ["--test", ...files], { stdio: "inherit" });
process.exit(r.status ?? 1);
