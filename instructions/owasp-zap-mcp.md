# OWASP ZAP MCP Setup

This setup is not fully automatic.

This repository can prepare the Codex-side configuration for ZAP, but you still need to enable ZAP's MCP server inside ZAP itself.

## What You Need To Do In ZAP

1. Install OWASP ZAP.
2. Open `Marketplace` in ZAP.
3. Install the `MCP Integration` add-on.
4. Open `Options -> MCP Integration`.
5. Confirm or change these settings:
   - `Port`
     Default is `8282`.
   - `Secure Only`
     Default is enabled. If it stays enabled, ZAP will reject plain HTTP.
   - `Security Key`
     Default is enabled. If it stays enabled, MCP clients must send the key in the `Authorization` header.
6. If `Security Key` is enabled, copy the key.

## Recommended Codex Setup

If you want to keep ZAP's default secure setup:

```bash
npm run prepare:zap -- --url https://127.0.0.1:8282 --security-key "$ZAP_MCP_SECURITY_KEY" --install
```

If your MCP client cannot trust ZAP's generated certificate yet, use local HTTP instead:

```bash
npm run prepare:zap -- --url http://127.0.0.1:8282 --security-key "$ZAP_MCP_SECURITY_KEY" --install
```

If you disable the ZAP security key requirement, you can omit `--security-key`.

## What `prepare:zap` Does

The `prepare:zap` command:

- writes a local ignored manifest at `codex/services.zap.local.json`
- sets the chosen ZAP URL
- adds the `Authorization` header when you provide `--security-key`
- exports the Codex MCP config
- optionally installs it into `~/.codex/config.toml`
- runs a health check and prints guided troubleshooting

## Certificate Notes

When `Secure Only` is enabled, ZAP uses HTTPS.

ZAP generates its own root CA, so some MCP clients may reject the connection until that certificate is trusted. If trusting the certificate is not practical for your environment, use local HTTP instead.

## Quick Verification

After setup:

1. Keep ZAP running.
2. Make sure the MCP server is enabled in `Options -> MCP Integration`.
3. Run:

```bash
node --experimental-transform-types codex/src/cli.ts export --manifest codex/services.zap.json
```

4. Check `generated/codex/status.json`.

## Official References

- [The ZAP MCP Server](https://www.zaproxy.org/blog/2026-04-02-zap-mcp-server/)
- [ZAP MCP Tools](https://www.zaproxy.org/docs/desktop/addons/mcp-integration/mcp-tools/)
- [ZAP MCP Automation Config](https://www.zaproxy.org/docs/desktop/addons/mcp-integration/mcp-automation-config/)
