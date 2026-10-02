#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { defaultLogsDir } from "./adapters/claudeCode.js";
import { applyBlock, newRules, pickTarget, renderBlock } from "./rules.js";
import { makeStyle, renderText } from "./report/text.js";
import { renderMarkdown } from "./report/markdown.js";
import { renderHtml } from "./report/html.js";
import { parseSince, run } from "./run.js";

const HELP = `chafe — turn repeated agent friction into evidence-backed instruction rules

Usage
  chafe [path]              Analyze Claude Code sessions for the project at path (default: .)
  chafe --all               Analyze every project that has session logs
  chafe --demo              Try it on bundled synthetic sessions (reads none of your logs)

Output
  --format text|md|json|html   Report format (default: text)
  --permissions                Print a permissions.allow snippet for safe, frequently used commands
  --apply                      Preview rules for AGENTS.md / CLAUDE.md (add --write to save them)

Options
  --since <30d|2w|1m|date>     How far back to look (default: 60d)
  --min <n>                    Sessions a pattern must appear in (default: 2)
  --logs <dir>                 Claude Code logs dir (default: ~/.claude/projects)
  --no-color                   Disable color
  -h, --help / -v, --version
`;

function die(msg: string): never {
  process.stderr.write(`chafe: ${msg}\n`);
  process.exit(1);
}

async function main(): Promise<void> {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      all: { type: "boolean" },
      demo: { type: "boolean" },
      format: { type: "string", default: "text" },
      permissions: { type: "boolean" },
      apply: { type: "boolean" },
      write: { type: "boolean" },
      since: { type: "string", default: "60d" },
      min: { type: "string", default: "2" },
      logs: { type: "string" },
      "no-color": { type: "boolean" },
      help: { type: "boolean", short: "h" },
      version: { type: "boolean", short: "v" },
    },
  });

  const here = path.dirname(fileURLToPath(import.meta.url));
  const pkgRoot = path.resolve(here, "..", "..");
  if (values.help) return void process.stdout.write(HELP);
  if (values.version) {
    const pkg = JSON.parse(fs.readFileSync(path.join(pkgRoot, "package.json"), "utf8")) as {
      version: string;
    };
    return void process.stdout.write(`${pkg.version}\n`);
  }

  const min = Number(values.min);
  if (!Number.isInteger(min) || min < 1) die("--min must be a positive integer");

  let logsDir = values.logs ?? defaultLogsDir();
  let project = values.all ? undefined : path.resolve(positionals[0] ?? ".");
  let instructionsUpdatedAt: number | undefined;
  let sinceMs = parseSince(values.since ?? "60d");

  if (values.demo) {
    const demo = path.join(pkgRoot, "examples", "demo-project");
    logsDir = path.join(demo, "sessions");
    project = path.join(demo, "repo");
    instructionsUpdatedAt = Date.parse("2026-09-20T00:00:00Z");
    sinceMs = 0;
  } else if (!fs.existsSync(logsDir)) {
    die(`no Claude Code logs found at ${logsDir}. Use --logs <dir>, or try --demo.`);
  }

  const results = await run({
    logsDir,
    ...(values.demo && { allLogs: true }),
    ...(project && { project }),
    sinceMs,
    minOccurrences: min,
    ...(instructionsUpdatedAt !== undefined && { instructionsUpdatedAt }),
  });
  if (results.length === 0) {
    die(
      values.all
        ? "no sessions found in that window."
        : `no sessions found for ${project}. Run chafe from a project you've used Claude Code in, or use --all / --demo.`,
    );
  }

  const color =
    !values["no-color"] &&
    !process.env["NO_COLOR"] &&
    (!!process.stdout.isTTY || !!process.env["FORCE_COLOR"]);
  const out = process.stdout;

  if (values.permissions) {
    const rules = [...new Set(results.flatMap((r) => r.permissions.map((p) => p.rule)))];
    out.write(`${JSON.stringify({ permissions: { allow: rules } }, null, 2)}\n`);
    return;
  }

  if (values.apply) {
    const [first] = results;
    if (!first || results.length > 1)
      die("--apply works on one project; run it from inside that project.");
    const rules = newRules(first);
    if (rules.length === 0)
      return void out.write("Nothing new to add: your instructions already cover the logs.\n");
    const target = pickTarget(first.project);
    const existing = fs.existsSync(target) ? fs.readFileSync(target, "utf8") : "";
    const block = renderBlock(rules);
    if (!values.write) {
      out.write(
        `Would add to ${path.relative(process.cwd(), target) || target}:\n\n${block}\nRe-run with --write to save.\n`,
      );
      return;
    }
    fs.writeFileSync(target, applyBlock(existing, block));
    out.write(`Wrote ${rules.length} rules to ${path.relative(process.cwd(), target) || target}\n`);
    return;
  }

  const style = makeStyle(color);
  switch (values.format) {
    case "json":
      return void out.write(`${JSON.stringify(values.all ? results : results[0], null, 2)}\n`);
    case "md":
      return void out.write(results.map(renderMarkdown).join("\n"));
    case "html":
      return void out.write(renderHtml(results[0] as NonNullable<(typeof results)[0]>));
    case "text":
      return void out.write(
        results
          .slice(0, values.all ? 20 : 1)
          .map((r) => renderText(r, style))
          .join("\n"),
      );
    default:
      die(`unknown --format "${values.format}" (text, md, json, html)`);
  }
}

main().catch((e: unknown) => die(e instanceof Error ? e.message : String(e)));
