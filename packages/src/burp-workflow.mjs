import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { withBurpMcpClient } from './burp-mcp-client.mjs';

const DEFAULT_HISTORY_PAGE_SIZE = 25;
const MAX_HISTORY_PAGES = 8;
const ACTIVE_PATH_CHECKS = [
  '/.git/HEAD',
  '/.git/config',
  '/.env',
  '/openapi.json',
  '/swagger-ui/',
  '/actuator/health'
];

export async function summarizeBurpHistory({
  targetUrl,
  workspaceRoot,
  sseUrl,
  commandRunner = defaultBurpToolRunner
} = {}) {
  const target = targetUrl ? new URL(targetUrl) : null;
  const historyItems = await collectBurpHistory({
    workspaceRoot,
    sseUrl,
    commandRunner
  });

  const endpoints = normalizeHistoryItems(historyItems)
    .filter((item) => !target || item.host === target.host)
    .map((item) => ({
      method: item.method,
      host: item.host,
      path: item.path,
      status: item.status,
      notes: item.notes
    }));

  const endpointMap = new Map();
  for (const endpoint of endpoints) {
    const key = `${endpoint.method} ${endpoint.host}${endpoint.path}`;
    const existing = endpointMap.get(key);
    if (existing) {
      existing.count += 1;
      continue;
    }

    endpointMap.set(key, {
      ...endpoint,
      count: 1
    });
  }

  const uniqueEndpoints = [...endpointMap.values()].sort((left, right) => {
    if (right.count !== left.count) {
      return right.count - left.count;
    }
    return `${left.method} ${left.host}${left.path}`.localeCompare(`${right.method} ${right.host}${right.path}`);
  });

  const derivedTarget = target ?? deriveTargetFromEndpoints(uniqueEndpoints);
  const interesting = uniqueEndpoints.filter((endpoint) => isInterestingPath(endpoint.path)).slice(0, 15);

  return {
    mode: 'burp-history',
    historyCount: historyItems.length,
    targetUrl: derivedTarget?.toString() ?? null,
    endpointCount: uniqueEndpoints.length,
    endpoints: uniqueEndpoints,
    interestingEndpoints: interesting,
    message: buildHistoryMessage({
      targetUrl: derivedTarget?.toString() ?? 'unknown target',
      historyCount: historyItems.length,
      endpointCount: uniqueEndpoints.length,
      interestingCount: interesting.length
    })
  };
}

export async function runScopedActiveChecks({
  targetUrl,
  workspaceRoot,
  fetchImpl = globalThis.fetch,
  signalTimeoutMs = 5_000
} = {}) {
  if (!targetUrl) {
    throw new Error('targetUrl is required for active checks.');
  }

  const target = new URL(targetUrl);
  const checks = [];

  for (const pathname of ACTIVE_PATH_CHECKS) {
    const url = new URL(pathname, target).toString();
    const response = await fetchText(fetchImpl, url, {
      method: 'GET',
      signal: AbortSignal.timeout(signalTimeoutMs)
    });
    checks.push({
      url,
      path: pathname,
      result: response
    });
  }

  const findings = checks.flatMap((check) => classifyActiveCheck(check));

  return {
    mode: 'active',
    targetUrl: target.toString(),
    checks,
    findings,
    workspaceRoot,
    message: `Ran ${checks.length} scoped active checks against ${target.origin}.`
  };
}

export async function runBurpWorkflow({
  targetUrl,
  mode = 'passive',
  workspaceRoot,
  sseUrl,
  fetchImpl = globalThis.fetch,
  commandRunner = defaultBurpToolRunner
} = {}) {
  const runMode = mode === 'active' ? 'active' : 'passive';
  let burpSummary = null;
  let limitedMode = false;
  let limitedReason = '';

  try {
    burpSummary = await summarizeBurpHistory({
      targetUrl,
      workspaceRoot,
      sseUrl,
      commandRunner
    });
  } catch (error) {
    limitedMode = true;
    limitedReason = error instanceof Error ? error.message : String(error);
  }

  const selectedTarget = resolveWorkflowTarget(targetUrl, burpSummary?.targetUrl);
  if (!selectedTarget) {
    throw new Error(
      limitedMode
        ? `Burp history was unavailable (${limitedReason}) and no target_url was provided for fallback mode.`
        : 'Could not determine a target URL from Burp history. Pass target_url explicitly.'
    );
  }

  const passive = await runPassiveAnalysis(selectedTarget, fetchImpl);
  const findings = [
    ...classifyHistoryFindings(burpSummary),
    ...classifyPassiveFindings(passive)
  ];

  let active = null;
  if (runMode === 'active') {
    active = await runScopedActiveChecks({
      targetUrl: selectedTarget,
      workspaceRoot,
      fetchImpl
    });
    findings.push(...active.findings);
  }

  const artifacts = workspaceRoot
    ? await writeWorkflowArtifacts({
        workspaceRoot,
        targetUrl: selectedTarget,
        burpSummary,
        passive,
        active,
        findings,
        mode: runMode,
        limitedMode,
        limitedReason
      })
    : null;

  const result = {
    ok: true,
    mode: runMode,
    targetUrl: selectedTarget,
    limitedMode,
    limitedReason: limitedMode ? limitedReason : null,
    burp: burpSummary,
    passive,
    active,
    findings,
    artifacts,
    message: buildWorkflowMessage({
      targetUrl: selectedTarget,
      findingCount: findings.length,
      passiveCount: findings.filter((finding) => finding.source === 'passive').length,
      activeCount: findings.filter((finding) => finding.source === 'active').length,
      limitedMode,
      limitedReason,
      artifactPath: artifacts?.findingsPath
    })
  };

  return result;
}

export async function generateFindingsReport({
  findingsPath
} = {}) {
  if (!findingsPath) {
    throw new Error('findingsPath is required.');
  }

  const payload = JSON.parse(await readFile(findingsPath, 'utf8'));
  const report = renderMarkdownReport(payload);
  const reportPath = findingsPath.replace(/\.findings\.json$/, '.report.md');
  await writeFile(reportPath, report, 'utf8');

  return {
    findingsPath,
    reportPath,
    findingCount: Array.isArray(payload.findings) ? payload.findings.length : 0,
    message: `Regenerated Markdown report at ${reportPath}.`
  };
}

async function collectBurpHistory({
  workspaceRoot,
  sseUrl,
  commandRunner
}) {
  const items = [];
  let offset = 0;

  for (let page = 0; page < MAX_HISTORY_PAGES; page += 1) {
    const result = await commandRunner({
      toolName: 'get_proxy_http_history',
      args: {
        count: DEFAULT_HISTORY_PAGE_SIZE,
        offset
      },
      workspaceRoot,
      sseUrl
    });

    const text = getToolText(result);
    if (/access denied/i.test(text)) {
      throw new Error('Burp denied proxy history access. Approve HTTP history access in Burp and rerun the workflow.');
    }

    if (/reached end of items/i.test(text)) {
      break;
    }

    const pageItems = parseHistoryPage(text);
    if (pageItems.length === 0) {
      break;
    }

    items.push(...pageItems);
    offset += DEFAULT_HISTORY_PAGE_SIZE;
  }

  return items;
}

async function runPassiveAnalysis(targetUrl, fetchImpl) {
  const target = new URL(targetUrl);
  const [head, robots, security, homepage] = await Promise.all([
    fetchText(fetchImpl, target.toString(), { method: 'HEAD' }),
    fetchText(fetchImpl, new URL('/robots.txt', target).toString()),
    fetchText(fetchImpl, new URL('/.well-known/security.txt', target).toString()),
    fetchText(fetchImpl, target.toString())
  ]);

  return {
    targetUrl: target.toString(),
    head,
    homepage,
    robots,
    security
  };
}

function normalizeHistoryItems(historyItems) {
  return historyItems
    .map(parseHistoryItem)
    .filter(Boolean);
}

function parseHistoryPage(text) {
  return text
    .split(/\n\s*\n/)
    .map((chunk) => chunk.trim())
    .filter(Boolean)
    .map((chunk) => {
      try {
        return JSON.parse(chunk);
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}

function parseHistoryItem(item) {
  if (!item?.request || typeof item.request !== 'string') {
    return null;
  }

  const requestLines = item.request.split(/\r?\n/);
  const [method = 'GET', rawPath = '/'] = requestLines[0]?.split(/\s+/) ?? [];
  const hostHeader = requestLines.find((line) => /^host:/i.test(line));
  const host = hostHeader?.split(':').slice(1).join(':').trim() ?? null;
  const pathName = sanitizePath(rawPath);
  const responseStatus = parseResponseStatus(item.response);

  if (!host && !/^https?:\/\//i.test(rawPath)) {
    return null;
  }

  const absoluteUrl = /^https?:\/\//i.test(rawPath)
    ? new URL(rawPath)
    : new URL(pathName, `https://${host}`);

  return {
    method,
    host: absoluteUrl.host,
    path: `${absoluteUrl.pathname}${absoluteUrl.search}`,
    status: responseStatus,
    notes: item.notes ?? null
  };
}

function parseResponseStatus(rawResponse) {
  if (typeof rawResponse !== 'string') {
    return null;
  }

  const firstLine = rawResponse.split(/\r?\n/, 1)[0] ?? '';
  const match = firstLine.match(/\s(\d{3})\b/);
  return match ? Number(match[1]) : null;
}

function sanitizePath(rawPath) {
  if (/^https?:\/\//i.test(rawPath)) {
    const parsed = new URL(rawPath);
    return `${parsed.pathname}${parsed.search}`;
  }

  return rawPath.startsWith('/') ? rawPath : `/${rawPath}`;
}

function deriveTargetFromEndpoints(endpoints) {
  const hosts = new Map();
  for (const endpoint of endpoints) {
    const current = hosts.get(endpoint.host) ?? 0;
    hosts.set(endpoint.host, current + endpoint.count);
  }

  const [host] = [...hosts.entries()].sort((left, right) => right[1] - left[1])[0] ?? [];
  return host ? new URL(`https://${host}`) : null;
}

function resolveWorkflowTarget(explicitTarget, derivedTarget) {
  if (explicitTarget) {
    return new URL(explicitTarget).toString();
  }

  return derivedTarget ? new URL(derivedTarget).toString() : null;
}

function classifyHistoryFindings(summary) {
  if (!summary) {
    return [];
  }

  return summary.interestingEndpoints.slice(0, 10).map((endpoint, index) => ({
    id: `history-${index + 1}`,
    title: `Interesting endpoint observed: ${endpoint.path}`,
    severity: /admin|debug|internal|actuator|swagger|openapi|graphql/i.test(endpoint.path) ? 'medium' : 'info',
    source: 'history',
    category: 'surface',
    evidence: {
      host: endpoint.host,
      method: endpoint.method,
      path: endpoint.path,
      status: endpoint.status
    },
    recommendation: 'Review this endpoint in Burp and confirm whether it is expected, authenticated, and appropriately protected.'
  }));
}

function classifyPassiveFindings(passive) {
  const findings = [];
  const headers = passive.head.headers ?? {};

  for (const headerName of ['content-security-policy', 'strict-transport-security', 'x-frame-options', 'x-content-type-options', 'referrer-policy']) {
    if (!headers[headerName]) {
      findings.push({
        id: `passive-header-${headerName}`,
        title: `Missing security header: ${headerName}`,
        severity: headerName === 'strict-transport-security' || headerName === 'content-security-policy' ? 'medium' : 'low',
        source: 'passive',
        category: 'headers',
        evidence: {
          targetUrl: passive.targetUrl,
          header: headerName
        },
        recommendation: `Set the ${headerName} header where appropriate for the application and confirm the policy value matches the deployment.`
      });
    }
  }

  if (headers.server) {
    findings.push({
      id: 'passive-server-header',
      title: 'Server header exposed',
      severity: 'info',
      source: 'passive',
      category: 'fingerprint',
      evidence: {
        targetUrl: passive.targetUrl,
        header: 'server',
        value: headers.server
      },
      recommendation: 'Review whether server fingerprinting details should be reduced or standardized.'
    });
  }

  if (!passive.security.ok) {
    findings.push({
      id: 'passive-security-txt-missing',
      title: 'security.txt not available',
      severity: 'info',
      source: 'passive',
      category: 'disclosure',
      evidence: {
        targetUrl: passive.targetUrl,
        path: '/.well-known/security.txt',
        status: passive.security.status ?? passive.security.error
      },
      recommendation: 'Consider publishing a security.txt file to document a reporting path for vulnerabilities.'
    });
  }

  if (passive.robots.ok && /admin|private|internal|debug/i.test(passive.robots.text)) {
    findings.push({
      id: 'passive-robots-interesting',
      title: 'robots.txt references interesting paths',
      severity: 'info',
      source: 'passive',
      category: 'surface',
      evidence: {
        targetUrl: passive.targetUrl,
        path: '/robots.txt'
      },
      recommendation: 'Review the disallowed paths listed in robots.txt and confirm they are not overly exposed.'
    });
  }

  return findings;
}

function classifyActiveCheck(check) {
  if (!check.result.ok) {
    return [];
  }

  if (check.path === '/.env' || check.path === '/.git/config') {
    return [
      {
        id: `active-${slug(check.path)}`,
        title: `Sensitive file responded successfully: ${check.path}`,
        severity: 'high',
        source: 'active',
        category: 'exposure',
        evidence: {
          url: check.url,
          status: check.result.status
        },
        recommendation: 'Block public access to sensitive files and confirm they are not served by the application or CDN.'
      }
    ];
  }

  if (check.path === '/.git/HEAD') {
    return [
      {
        id: 'active-git-head',
        title: 'Git metadata endpoint may be exposed',
        severity: 'high',
        source: 'active',
        category: 'exposure',
        evidence: {
          url: check.url,
          status: check.result.status
        },
        recommendation: 'Ensure the .git directory is not accessible from the web root.'
      }
    ];
  }

  if (check.path === '/actuator/health' || check.path === '/openapi.json' || check.path === '/swagger-ui/') {
    return [
      {
        id: `active-${slug(check.path)}`,
        title: `Operational or API discovery endpoint responded: ${check.path}`,
        severity: 'medium',
        source: 'active',
        category: 'surface',
        evidence: {
          url: check.url,
          status: check.result.status
        },
        recommendation: 'Confirm this endpoint is intentionally exposed and protected appropriately for the environment.'
      }
    ];
  }

  return [];
}

async function writeWorkflowArtifacts({
  workspaceRoot,
  targetUrl,
  burpSummary,
  passive,
  active,
  findings,
  mode,
  limitedMode,
  limitedReason
}) {
  const target = new URL(targetUrl);
  const targetSlug = slug(target.host);
  const outputDir = path.join(workspaceRoot, 'generated', 'codex', 'workflow');
  const findingsPath = path.join(outputDir, `${targetSlug}.findings.json`);
  const reportPath = path.join(outputDir, `${targetSlug}.report.md`);
  const statusPath = path.join(outputDir, `${targetSlug}.status.json`);

  const payload = {
    targetUrl,
    generatedAt: new Date().toISOString(),
    mode,
    limitedMode,
    limitedReason: limitedMode ? limitedReason : null,
    burp: burpSummary,
    passive,
    active,
    findings
  };

  await mkdir(outputDir, { recursive: true });
  await writeFile(findingsPath, JSON.stringify(payload, null, 2) + '\n', 'utf8');
  await writeFile(reportPath, renderMarkdownReport(payload), 'utf8');
  await writeFile(
    statusPath,
    JSON.stringify(
      {
        targetUrl,
        mode,
        limitedMode,
        limitedReason: limitedMode ? limitedReason : null,
        findingsPath,
        reportPath,
        findingCount: findings.length
      },
      null,
      2
    ) + '\n',
    'utf8'
  );

  return {
    outputDir,
    findingsPath,
    reportPath,
    statusPath
  };
}

function renderMarkdownReport(payload) {
  const lines = [
    `# Stjarnskott Findings Report`,
    '',
    `- Target: ${payload.targetUrl}`,
    `- Mode: ${payload.mode}`,
    `- Limited mode: ${payload.limitedMode ? `yes (${payload.limitedReason})` : 'no'}`,
    `- Generated: ${payload.generatedAt}`,
    ''
  ];

  if (payload.burp) {
    lines.push('## Burp History Summary', '');
    lines.push(`- History items: ${payload.burp.historyCount}`);
    lines.push(`- Unique endpoints: ${payload.burp.endpointCount}`);
    lines.push('');
  }

  lines.push('## Findings', '');
  if (!payload.findings.length) {
    lines.push('No findings were generated in this run.', '');
  } else {
    for (const finding of payload.findings) {
      lines.push(`### ${finding.id}: ${finding.title}`);
      lines.push(`- Severity: ${finding.severity}`);
      lines.push(`- Source: ${finding.source}`);
      lines.push(`- Category: ${finding.category}`);
      lines.push(`- Recommendation: ${finding.recommendation}`);
      lines.push(`- Evidence: \`${JSON.stringify(finding.evidence)}\``);
      lines.push('');
    }
  }

  return `${lines.join('\n')}\n`;
}

function buildHistoryMessage({ targetUrl, historyCount, endpointCount, interestingCount }) {
  return `Summarized ${historyCount} Burp history items for ${targetUrl}. Normalized ${endpointCount} unique endpoints and marked ${interestingCount} as interesting.`;
}

function buildWorkflowMessage({ targetUrl, findingCount, passiveCount, activeCount, limitedMode, limitedReason, artifactPath }) {
  const parts = [
    `Stjarnskott workflow completed for ${targetUrl}.`,
    `Generated ${findingCount} findings (${passiveCount} passive, ${activeCount} active).`
  ];

  if (limitedMode) {
    parts.push(`Burp was unavailable, so the workflow ran in limited mode: ${limitedReason}`);
  }

  if (artifactPath) {
    parts.push(`Findings written to ${artifactPath}.`);
  }

  return parts.join(' ');
}

async function defaultBurpToolRunner({
  toolName,
  args,
  workspaceRoot,
  sseUrl
}) {
  const proxyScript = path.join(workspaceRoot ?? process.cwd(), 'plugins', 'burp', 'scripts', 'launch-burp-proxy.mjs');
  const env = {
    ...process.env
  };

  if (sseUrl) {
    env.BURP_MCP_SSE_URL = sseUrl;
  }

  return withBurpMcpClient(
    {
      command: process.execPath,
      args: [proxyScript],
      cwd: workspaceRoot ?? process.cwd(),
      env
    },
    async (client) => client.callTool(toolName, args)
  );
}

function getToolText(result) {
  return result?.content
    ?.filter((entry) => entry?.type === 'text')
    .map((entry) => entry.text)
    .join('\n') ?? '';
}

async function fetchText(fetchImpl, url, init = {}) {
  try {
    const response = await fetchImpl(url, {
      ...init,
      signal: init.signal ?? AbortSignal.timeout(5_000)
    });
    const headers = Object.fromEntries([...response.headers.entries()].map(([key, value]) => [key.toLowerCase(), value]));
    const text = init.method === 'HEAD' ? '' : await response.text();
    return {
      ok: response.ok,
      status: response.status,
      headers,
      text
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
      headers: {},
      text: ''
    };
  }
}

function isInterestingPath(pathname) {
  return /admin|login|oauth|token|callback|graphql|swagger|openapi|internal|debug|actuator|health|metrics/i.test(pathname);
}

function slug(value) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'target';
}
