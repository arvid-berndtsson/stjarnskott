---
name: stjarnskott-zap
description: Use ZAP from Codex to spider targets, run scans, inspect alerts, and review web security findings.
---

# Stjarnskott ZAP

Use this skill when you need to help someone use OWASP ZAP from Codex through the official ZAP MCP Integration add-on.

## Purpose

This plugin is for:

- exporting ZAP-only Codex MCP config from this repo
- connecting Codex to the ZAP MCP Integration add-on
- troubleshooting local ZAP MCP connectivity
- using ZAP MCP tools, resources, and prompts from Codex
- reviewing alerts, history, and scan progress from ZAP

## Local Files

- ZAP-only manifest: `codex/services.zap.json`
- Combined manifest: `codex/services.json`
- Codex wrapper CLI: `codex/src/cli.ts`
- Generated Codex output: `generated/codex/`

## Commands

Use these commands from the repository root:

```bash
npm run prepare:zap -- --url https://127.0.0.1:8282 --security-key "$ZAP_MCP_SECURITY_KEY" --install
```

Or, if you want to separate the steps:

```bash
node --experimental-transform-types codex/src/cli.ts prepare-zap --manifest codex/services.zap.json --url https://127.0.0.1:8282 --security-key "$ZAP_MCP_SECURITY_KEY"
node --experimental-transform-types codex/src/cli.ts install
```

## Setup Notes

- In ZAP, install the `MCP Integration` add-on from the Marketplace.
- This plugin defaults to `http://127.0.0.1:8282` because ZAP commonly uses a self-signed local certificate for HTTPS.
- If you keep `Secure Only` enabled in ZAP, update the connection to `https://127.0.0.1:8282` or `https://localhost:8282` and trust the ZAP root CA as needed.
- If you keep the ZAP security key enabled, use `prepare-zap --security-key ...` so the managed Codex config includes the `Authorization` header.

## Suggested First Prompts

- `Use ZAP to spider https://example.com and summarize what it finds.`
- `Use ZAP to show the highest-severity alerts in the current session.`
- `Use ZAP to run a full scan against a test target and explain the results.`
