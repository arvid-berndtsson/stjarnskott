---
name: stjarnskott-burp
description: Use Burp from Codex to analyze proxy history, map surface area, run checks, and generate findings.
---

# Stjarnskott Burp

Use this skill when you need to help someone use Burp from Codex for web security discovery and testing workflows.

## Purpose

This plugin is for:

- using Burp's own extracted proxy jar with Codex
- exporting Burp-only Codex MCP config from this repo
- troubleshooting Burp listener and proxy failures
- running passive-first security checks
- using bundled Burp workflow MCP tools from Codex

## Local Files

- Burp proxy launcher: `plugins/burp/scripts/launch-burp-proxy.mjs`
- Burp-only manifest: `codex/services.burp.json`
- Codex wrapper CLI: `codex/src/cli.ts`
- Generated Codex output: `generated/codex/`

## Commands

Use these commands from the repository root:

```bash
node --experimental-transform-types codex/src/cli.ts export --manifest codex/services.burp.json
node --experimental-transform-types codex/src/cli.ts install
```

If Burp should stay running as a managed service for the session:

```bash
node --experimental-transform-types codex/src/cli.ts start --manifest codex/services.burp.json
```

## Bundled MCP Tools

- `stjarnskott:burp-health-check`
- `stjarnskott:burp-find-workspace`
- `stjarnskott:burp-prepare-codex`
- `stjarnskott:burp-passive-web-check`
- `stjarnskott:burp-summarize-history`
- `stjarnskott:burp-discover-surface`
- `stjarnskott:burp-run-active-checks`
- `stjarnskott:burp-workflow`
- `stjarnskott:burp-generate-report`

## Troubleshooting

If Burp is open but Codex cannot use it:

- check `generated/codex/status.json`
- check `generated/codex/logs/burp.stderr.log`
- confirm the Burp MCP listener is enabled on `127.0.0.1:9876`
- in Burp, click `Extract server proxy jar` once so the proxy JAR exists under Burp's default location
- if the proxy JAR lives somewhere else, set `BURP_MCP_PROXY_JAR`
- rerun the Burp-only export
