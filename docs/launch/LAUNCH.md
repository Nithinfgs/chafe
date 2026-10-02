# Launch drafts

Drafts only; nothing here has been posted. Replace the bracketed bits with your own experience before posting. Numbers in the README demo are from synthetic data, so never present them as real usage.

## Show HN

**Title:** Show HN: Chafe – mine your Claude Code logs for the mistakes your AGENTS.md should prevent

**Text:**
I kept adding rules to CLAUDE.md right after something annoyed me, and never knew whether any of them worked. Claude Code already logs every command and result locally, so I wrote a small tool that reads those logs and looks for repeats across sessions:

- a command failed and a changed version worked (`npm test` → `npm test -- --run`), with the real error and counts
- corrections you typed again and again in different words
- retry loops, and read-only commands you keep approving

Each finding is compared with your existing AGENTS.md/CLAUDE.md: not documented, documented and fixed, or documented but it still happened afterwards. `--apply` writes the new ones into a marked block; `--permissions` prints an allowlist snippet.

It's deterministic: no LLM calls, no network, no runtime dependencies (TypeScript, Node 20+). Claude Code logs only for now. The "you kept saying" detector is heuristic and will miss things; I'd like to hear where it's wrong on real logs.

`npx github:Nithinfgs/chafe --demo` runs on bundled synthetic sessions. Repo: https://github.com/Nithinfgs/chafe

*(Post the link as the URL, text as the first comment. Be around to answer for the first couple of hours.)*

## Reddit (r/ClaudeAI, r/ClaudeCode; read each sub's self-promotion rules first)

**Title:** I made a tool that reads your Claude Code logs and tells you which CLAUDE.md rules are actually being ignored

**Body:**
Problem: my CLAUDE.md grew one rule at a time, and I had no idea which rules mattered or whether the agent was following them. Linters can tell me a path is dead, not whether the instruction changes behavior.

What I built: `chafe` reads the session logs Claude Code already writes in `~/.claude/projects`, and finds:
1. commands that failed and then worked after a change (with counts and the actual error)
2. corrections you repeated across sessions
3. retry loops
4. safe read-only commands you keep approving

Then it checks each against your AGENTS.md/CLAUDE.md and marks it: new / documented / documented but still happening. `--apply` previews a rules block; nothing is written without `--write`.

It's local-only and deterministic, with no LLM and no network. Secrets in commands are redacted in output, but please skim before sharing a report.

What I'd like feedback on: false positives in the "you kept saying" clustering, other agents' log formats (Codex, Cursor), and whether the "documented but recurring" signal is useful to you.

Repo: https://github.com/Nithinfgs/chafe (try `npx github:Nithinfgs/chafe --demo` first, it uses synthetic data)

## X / Twitter

**Short:**
Your CLAUDE.md has 60 rules. Which ones does the agent actually follow?

chafe reads your local Claude Code logs and flags the mistakes that keep recurring, including rules you already wrote that are still being ignored.

No LLM, no network. https://github.com/Nithinfgs/chafe

**Technical:**
Claude Code logs every tool call + result as JSONL. chafe streams them into a Session model and mines:
- failed Bash call → *changed* call that passed (normalized, so `pytest a.py` ≠ `pytest -x`)
- word-overlap clusters of your corrections
- identical failing call ×3+
Then diffs against AGENTS.md mtime to see if a documented fix recurred. Zero deps. https://github.com/Nithinfgs/chafe

**Thread:**
1/ I add a line to CLAUDE.md every time my agent annoys me. I never checked whether any line worked. So I wrote a tool that does.
2/ Claude Code already logs every command and its result locally. chafe reads that and looks for the same mistake across sessions: `npm test` fails, `npm test -- --run` works, 6 sessions in a row.
3/ It also catches things you keep telling the agent ("don't edit dist/") in different words, retry loops, and read-only commands you approve over and over (it prints a permissions snippet).
4/ The useful part: it compares findings with your existing instruction file. "Documented, still happening" means the rule exists and isn't working. Time to shorten it or move it up.
5/ Deterministic, offline, zero runtime deps, Node 20+. Claude Code only for now; adapters welcome. The "kept saying" detector is heuristic and I want to hear where it's wrong. https://github.com/Nithinfgs/chafe

## LinkedIn

Instruction files for coding agents grow one rule at a time, usually right after something goes wrong. I realized I had no way to tell which of my rules were working.

Claude Code writes a local log of every command it runs and whether it failed. I built a small open-source CLI, chafe, that reads those logs and looks for the same mistake recurring across sessions: a command that fails and then works after a change, a correction you keep retyping, a retry loop.

The part I find most useful is the comparison with the existing AGENTS.md/CLAUDE.md. A finding is either new, already documented and fixed, or documented and still happening. That last case tells you a rule exists and isn't doing its job.

It's deterministic and runs offline: no LLM calls, no network, no runtime dependencies. It supports Claude Code logs today, and the heuristics are imperfect. I'd welcome reports of where they're wrong.

https://github.com/Nithinfgs/chafe

## GitHub

- **Description:** Find where your coding agent keeps tripping and turn it into AGENTS.md / CLAUDE.md rules, from your local session logs. No LLM, no network.
- **Topics:** developer-tools, cli, claude-code, agents-md, coding-agents, ai-agents, local-first, nodejs, typescript, open-source
- **Release notes (v0.1.0):** see the GitHub release.

## Where to post, and when

1. Show HN on a weekday morning US time, then answer comments fast.
2. r/ClaudeAI and r/ClaudeCode after checking their rules, one post each, a day apart.
3. Share in the Claude Code and AGENTS.md communities where people already complain about instruction-file bloat.
4. Reply (don't drop links) in existing threads about AGENTS.md drift when someone asks how to audit one.
