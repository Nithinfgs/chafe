# Contributing

Thanks for looking. chafe is small on purpose, so most changes are easy to review.

## Setup

```bash
npm install
npm test                 # builds, then runs node:test
npm run lint && npm run format:check
```

Node 20+. There are no runtime dependencies, and I'd like to keep it that way.

## Ground rules

- **Deterministic and offline.** No network calls, no LLM calls, no telemetry.
- **Precision over recall.** A noisy suggestion costs the user trust. If a heuristic produces false positives on real logs, tighten it.
- **Never surface secrets.** Anything shown from a log goes through `redact()`.
- **Add a test** for each detector change (`test/detectors.test.ts` has the pattern).

## Adding an agent adapter

An adapter turns one agent's log format into the `Session` shape in `src/types.ts`:
tool calls (name, input, result with `isError`), human messages and timestamps.
See `src/adapters/claudeCode.ts`. Open an issue with a **redacted** sample log first, because log formats change.

## Reporting a bad suggestion

Open an issue using the "Bad suggestion" template. Paste the finding and, if you can, a redacted version of the log lines that produced it.

## Regenerating the demo

`node scripts/gen-demo.mjs` rewrites the synthetic sessions. `node scripts/render-svg.mjs docs/assets/demo.svg --lines 43 --cols 92 -- --demo` re-renders the README image from real CLI output.
