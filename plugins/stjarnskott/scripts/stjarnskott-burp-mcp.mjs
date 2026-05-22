#!/usr/bin/env node

import { findWorkbenchRoot, loadSecurityWorkflowModule } from './lib/resolve-workbench-module.mjs';

const serverInfo = {
  name: 'stjarnskott-burp',
  version: '0.1.0'
};

const TOOL_PREFIX = 'stjarnskott:burp-';
const TOOL_NAMES = {
  healthCheck: `${TOOL_PREFIX}health-check`,
  findWorkspace: `${TOOL_PREFIX}find-workspace`,
  prepareCodex: `${TOOL_PREFIX}prepare-codex`,
  passiveCheck: `${TOOL_PREFIX}passive-web-check`,
  summarizeHistory: `${TOOL_PREFIX}summarize-history`,
  discoverSurface: `${TOOL_PREFIX}discover-surface`,
  activeChecks: `${TOOL_PREFIX}run-active-checks`,
  generateReport: `${TOOL_PREFIX}generate-report`,
  workflow: `${TOOL_PREFIX}workflow`
};

const tools = [
  {
    name: TOOL_NAMES.healthCheck,
    description: 'Check whether Burp is running and whether the MCP SSE listener is reachable.',
    inputSchema: {
      type: 'object',
      properties: {
        sse_url: {
          type: 'string',
          description: 'Optional Burp SSE URL override.'
        }
      }
    }
  },
  {
    name: TOOL_NAMES.findWorkspace,
    description: 'Locate the Stjarnskott workspace by looking for codex-workbench.services.json.',
    inputSchema: {
      type: 'object',
      properties: {
        start_dir: {
          type: 'string',
          description: 'Optional directory to start the search from.'
        }
      }
    }
  },
  {
    name: TOOL_NAMES.prepareCodex,
    description: 'Run the Stjarnskott export flow and optionally install the managed MCP block into Codex config.',
    inputSchema: {
      type: 'object',
      properties: {
        workspace_root: {
          type: 'string',
          description: 'Optional explicit Stjarnskott workspace root.'
        },
        install: {
          type: 'boolean',
          description: 'When true, also merge the managed MCP block into ~/.codex/config.toml.'
        }
      }
    }
  },
  {
    name: TOOL_NAMES.passiveCheck,
    description: 'Run low-noise passive checks against a target URL: headers, robots.txt, and security.txt.',
    inputSchema: {
      type: 'object',
      required: ['url'],
      properties: {
        url: {
          type: 'string',
          description: 'Target URL to inspect passively.'
        }
      }
    }
  },
  {
    name: TOOL_NAMES.summarizeHistory,
    description: 'Summarize Burp proxy history into normalized endpoints and interesting paths.',
    inputSchema: {
      type: 'object',
      properties: {
        target_url: {
          type: 'string',
          description: 'Optional target URL to filter Burp history by host.'
        },
        workspace_root: {
          type: 'string',
          description: 'Optional explicit Stjarnskott workspace root.'
        },
        sse_url: {
          type: 'string',
          description: 'Optional Burp SSE URL override.'
        }
      }
    }
  },
  {
    name: TOOL_NAMES.discoverSurface,
    description: 'Run the Stjarnskott workflow in passive mode and write findings artifacts.',
    inputSchema: {
      type: 'object',
      properties: {
        target_url: {
          type: 'string',
          description: 'Optional target URL override. If omitted, Burp history is used to derive the target.'
        },
        workspace_root: {
          type: 'string',
          description: 'Optional explicit Stjarnskott workspace root.'
        },
        sse_url: {
          type: 'string',
          description: 'Optional Burp SSE URL override.'
        }
      }
    }
  },
  {
    name: TOOL_NAMES.activeChecks,
    description: 'Run explicit scoped active checks against a single target URL and write findings artifacts.',
    inputSchema: {
      type: 'object',
      required: ['target_url'],
      properties: {
        target_url: {
          type: 'string',
          description: 'Required target URL for explicit active checks.'
        },
        workspace_root: {
          type: 'string',
          description: 'Optional explicit Stjarnskott workspace root.'
        }
      }
    }
  },
  {
    name: TOOL_NAMES.generateReport,
    description: 'Regenerate a Markdown report from an existing Stjarnskott findings JSON artifact.',
    inputSchema: {
      type: 'object',
      required: ['findings_path'],
      properties: {
        findings_path: {
          type: 'string',
          description: 'Path to a generated .findings.json artifact.'
        }
      }
    }
  },
  {
    name: TOOL_NAMES.workflow,
    description: 'Run the full Stjarnskott workflow: Burp history, passive checks, optional active checks, and artifact generation.',
    inputSchema: {
      type: 'object',
      properties: {
        target_url: {
          type: 'string',
          description: 'Optional target URL override.'
        },
        mode: {
          type: 'string',
          enum: ['passive', 'active'],
          description: 'Workflow mode. Active mode performs additional scoped active checks.'
        },
        workspace_root: {
          type: 'string',
          description: 'Optional explicit Stjarnskott workspace root.'
        },
        sse_url: {
          type: 'string',
          description: 'Optional Burp SSE URL override.'
        }
      }
    }
  }
];

let buffer = Buffer.alloc(0);

process.stdin.on('data', (chunk) => {
  buffer = Buffer.concat([buffer, chunk]);
  processBuffer();
});

function processBuffer() {
  while (true) {
    const headerEnd = buffer.indexOf('\r\n\r\n');
    if (headerEnd === -1) {
      return;
    }

    const headerText = buffer.slice(0, headerEnd).toString('utf8');
    const match = headerText.match(/Content-Length:\s*(\d+)/i);
    if (!match) {
      throw new Error('Missing Content-Length header.');
    }

    const contentLength = Number(match[1]);
    const messageStart = headerEnd + 4;
    const messageEnd = messageStart + contentLength;
    if (buffer.length < messageEnd) {
      return;
    }

    const message = JSON.parse(buffer.slice(messageStart, messageEnd).toString('utf8'));
    buffer = buffer.slice(messageEnd);
    void handleMessage(message);
  }
}

async function handleMessage(message) {
  if (message.method === 'initialize') {
    send({
      jsonrpc: '2.0',
      id: message.id,
      result: {
        protocolVersion: message.params?.protocolVersion ?? '2025-03-26',
        capabilities: {
          tools: {}
        },
        serverInfo
      }
    });
    return;
  }

  if (message.method === 'notifications/initialized') {
    return;
  }

  if (message.method === 'ping') {
    send({
      jsonrpc: '2.0',
      id: message.id,
      result: {}
    });
    return;
  }

  if (message.method === 'tools/list') {
    send({
      jsonrpc: '2.0',
      id: message.id,
      result: {
        tools
      }
    });
    return;
  }

  if (message.method === 'tools/call') {
    const { name, arguments: args = {} } = message.params ?? {};
    try {
      const result = await callTool(name, args);
      send({
        jsonrpc: '2.0',
        id: message.id,
        result
      });
    } catch (error) {
      send({
        jsonrpc: '2.0',
        id: message.id,
        result: {
          isError: true,
          content: [
            {
              type: 'text',
              text: error instanceof Error ? error.message : String(error)
            }
          ]
        }
      });
    }
    return;
  }

  if (message.id !== undefined) {
    send({
      jsonrpc: '2.0',
      id: message.id,
      error: {
        code: -32601,
        message: `Unsupported method: ${message.method}`
      }
    });
  }
}

async function callTool(name, args) {
  switch (name) {
    case TOOL_NAMES.healthCheck: {
      const { module } = await loadSecurityWorkflowModule();
      const result = await module.checkBurpHealth({
        sseUrl: args.sse_url
      });
      return toolResult(result.message, result);
    }
    case TOOL_NAMES.findWorkspace: {
      const workspaceRoot = await findWorkbenchRoot({
        startDir: args.start_dir ?? process.env.PWD ?? process.cwd()
      });
      const result = {
        workspaceRoot,
        found: Boolean(workspaceRoot)
      };
      return toolResult(
        workspaceRoot
          ? `Found Stjarnskott workspace at ${workspaceRoot}.`
          : 'Could not find a Stjarnskott workspace from the current context.',
        result
      );
    }
    case TOOL_NAMES.prepareCodex: {
      const { workspaceRoot, module } = await loadSecurityWorkflowModule({
        workspaceRoot: args.workspace_root,
        startDir: process.env.PWD ?? process.cwd()
      });
      const result = await module.prepareCodexForBurp({
        workspaceRoot,
        install: Boolean(args.install)
      });
      return toolResult(result.message, result, !result.ok);
    }
    case TOOL_NAMES.passiveCheck: {
      const { module } = await loadSecurityWorkflowModule();
      const result = await module.passiveWebCheck({
        url: args.url
      });
      return toolResult(result.message, result);
    }
    case TOOL_NAMES.summarizeHistory: {
      const { workspaceRoot, module } = await loadSecurityWorkflowModule({
        workspaceRoot: args.workspace_root,
        startDir: process.env.PWD ?? process.cwd()
      });
      const result = await module.summarizeBurpHistory({
        targetUrl: args.target_url,
        workspaceRoot,
        sseUrl: args.sse_url
      });
      return toolResult(result.message, result);
    }
    case TOOL_NAMES.discoverSurface: {
      const { workspaceRoot, module } = await loadSecurityWorkflowModule({
        workspaceRoot: args.workspace_root,
        startDir: process.env.PWD ?? process.cwd()
      });
      const result = await module.runStjarnskottWorkflow({
        targetUrl: args.target_url,
        mode: 'passive',
        workspaceRoot,
        sseUrl: args.sse_url
      });
      return toolResult(result.message, result);
    }
    case TOOL_NAMES.activeChecks: {
      const { workspaceRoot, module } = await loadSecurityWorkflowModule({
        workspaceRoot: args.workspace_root,
        startDir: process.env.PWD ?? process.cwd()
      });
      const result = await module.runStjarnskottWorkflow({
        targetUrl: args.target_url,
        mode: 'active',
        workspaceRoot
      });
      return toolResult(result.message, result, false);
    }
    case TOOL_NAMES.generateReport: {
      const { module } = await loadSecurityWorkflowModule();
      const result = await module.generateFindingsReport({
        findingsPath: args.findings_path
      });
      return toolResult(result.message, result);
    }
    case TOOL_NAMES.workflow: {
      const { workspaceRoot, module } = await loadSecurityWorkflowModule({
        workspaceRoot: args.workspace_root,
        startDir: process.env.PWD ?? process.cwd()
      });
      const result = await module.runStjarnskottWorkflow({
        targetUrl: args.target_url,
        mode: args.mode,
        workspaceRoot,
        sseUrl: args.sse_url
      });
      return toolResult(result.message, result, !result.ok);
    }
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

function toolResult(text, structuredContent, isError = false) {
  return {
    isError,
    content: [
      {
        type: 'text',
        text
      }
    ],
    structuredContent
  };
}

function send(message) {
  const body = JSON.stringify(message);
  process.stdout.write(`Content-Length: ${Buffer.byteLength(body, 'utf8')}\r\n\r\n${body}`);
}
