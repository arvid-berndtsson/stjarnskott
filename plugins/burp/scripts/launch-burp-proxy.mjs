#!/usr/bin/env node

import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const sseUrl = process.env.BURP_MCP_SSE_URL ?? 'http://127.0.0.1:9876/sse';
const proxyJar = process.env.BURP_MCP_PROXY_JAR ?? defaultBurpProxyJarPath();
const javaCommand = process.env.BURP_JAVA_PATH ?? 'java';

if (!existsSync(proxyJar)) {
  console.error(`Burp MCP proxy JAR not found at ${proxyJar}.`);
  console.error('To use Burp with this repo:');
  console.error('1. Open Burp Suite and confirm the Burp MCP extension is loaded.');
  console.error('2. In the extension Installation section, click "Extract server proxy jar".');
  console.error('3. If you saved the jar somewhere else, set BURP_MCP_PROXY_JAR to that path.');
  process.exit(1);
}

const child = spawn(javaCommand, ['-jar', proxyJar, '--sse-url', sseUrl], {
  env: process.env,
  stdio: 'inherit'
});

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 1);
});

child.on('error', (error) => {
  console.error(`Failed to start Burp MCP proxy via Java: ${error.message}`);
  process.exit(1);
});

function defaultBurpProxyJarPath() {
  const home = os.homedir();

  if (process.platform === 'win32') {
    const appData = process.env.APPDATA ?? path.join(home, 'AppData', 'Roaming');
    return path.join(appData, 'BurpSuite', 'mcp-proxy', 'mcp-proxy-all.jar');
  }

  return path.join(home, '.BurpSuite', 'mcp-proxy', 'mcp-proxy-all.jar');
}
