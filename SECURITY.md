# Security

chafe reads session logs on your machine. Those logs can contain secrets typed into commands, so the tool is built to stay local and to redact what it prints.

- It makes no network requests and has no runtime dependencies.
- Commands and error text shown in reports go through a redactor (API keys, tokens, bearer headers, URL passwords, `*_KEY=`/`*_SECRET=` assignments) and the home directory is shortened to `~`. Redaction is pattern-based, so it is a safety net, not a guarantee. Review output before sharing it.
- `--apply --write` only edits the block between `chafe:start` and `chafe:end` in your instruction file.

## Reporting a vulnerability

Please use GitHub's private vulnerability reporting ("Report a vulnerability" under the Security tab) rather than a public issue. Include the version and a minimal reproduction. Never include real logs or credentials.
