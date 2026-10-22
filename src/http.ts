import { createServer as createHttpServer, type IncomingMessage, type ServerResponse, type Server } from 'node:http';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { content } from './content.js';
import { createServer, SERVER_NAME, SERVER_VERSION } from './server.js';

const MAX_BODY = 64 * 1024;
const RATE_PER_MIN = 120;

export const publicUrl = () => (process.env.PUBLIC_URL ?? 'https://mcp.maharadar.com').replace(/\/$/, '');

export function serverCard() {
  const base = publicUrl();
  return {
    name: SERVER_NAME,
    title: 'MahaRadar (public site info)',
    version: SERVER_VERSION,
    description:
      'Public, read-only facts about MahaRadar, the free SEO platform at maharadar.com: free SEO tools, platform features, audience guides, plan limits and the SEO checklist, with canonical URLs. No account, no write tools.',
    homepage: content.site,
    endpoint: `${base}/mcp`,
    transport: 'streamable-http',
    stateless: true,
    authentication: 'none',
    protocolVersions: ['2025-11-25', '2025-06-18', '2025-03-26'],
    capabilities: { tools: true, resources: true, prompts: true },
    operator: 'Meru Technosoft',
    llmsTxt: `${base}/llms.txt`,
    contentSource: content.generatedFrom,
  };
}

export function llmsTxt(): string {
  const base = publicUrl();
  const tools = content.tools.map((t) => `- ${t.name}: ${content.site}${t.path}`).join('\n');
  return `# MahaRadar MCP server

> Public, read-only MCP server with facts about MahaRadar (${content.site}), the free SEO platform. Streamable HTTP, stateless, no authentication.

## Connect

- Endpoint: ${base}/mcp
- Server card: ${base}/.well-known/mcp/server-card.json
- Claude Code: claude mcp add --transport http maharadar ${base}/mcp

## Tools

- maharadar_about, maharadar_search, maharadar_find_free_tool, maharadar_list_free_tools, maharadar_get_free_tool
- maharadar_get_plan_limits, maharadar_get_platform_feature, maharadar_get_audience_guide, maharadar_get_seo_checklist, maharadar_get_faq

## Free tools the server describes (canonical pages)

${tools}

## Notes

- Paid-plan prices are not published by MahaRadar; this server does not state any.
- Content is generated from the maharadar.com site source (${content.generatedFrom.repo} @ ${content.generatedFrom.commit.slice(0, 8)}).
`;
}

function cors(res: ServerResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'content-type, accept, mcp-protocol-version, mcp-session-id, last-event-id');
  res.setHeader('Access-Control-Expose-Headers', 'mcp-session-id');
}

function json(res: ServerResponse, status: number, body: unknown, extra: Record<string, string> = {}) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...extra });
  res.end(JSON.stringify(body));
}

function rpcError(res: ServerResponse, status: number, code: number, message: string, extra: Record<string, string> = {}) {
  json(res, status, { jsonrpc: '2.0', error: { code, message }, id: null }, extra);
}

const hits = new Map<string, { n: number; reset: number }>();
const MAX_TRACKED = 10_000;
let lastSweep = 0;
function clientKey(req: IncomingMessage): string {
  // x-forwarded-for is client-controllable; honour it only behind a proxy that overwrites it (TRUST_PROXY=1).
  const xff = process.env.TRUST_PROXY === '1' ? String(req.headers['x-forwarded-for'] ?? '').split(',').pop()?.trim() : '';
  return xff || req.socket.remoteAddress || 'unknown';
}
function limited(req: IncomingMessage): boolean {
  const ip = clientKey(req);
  const now = Date.now();
  if (now - lastSweep > 30_000) {
    lastSweep = now;
    for (const [k, v] of hits) if (v.reset < now) hits.delete(k);
  }
  const e = hits.get(ip);
  if (!e || e.reset < now) {
    if (hits.size >= MAX_TRACKED) hits.delete(hits.keys().next().value as string); // bounded: evict oldest, O(1)
    hits.set(ip, { n: 1, reset: now + 60_000 });
    return false;
  }
  return ++e.n > RATE_PER_MIN;
}

/** Reads the JSON body; on overflow answers 413 itself and resolves null (never throws mid-stream, which would destroy the socket before the reply). */
async function readBody(req: IncomingMessage, res: ServerResponse): Promise<unknown | null> {
  const declared = Number(req.headers['content-length'] ?? 0);
  const tooBig = () => {
    rpcError(res, 413, -32000, 'Body too large', { connection: 'close' });
    req.resume(); // discard the rest so the client can read the 413
    res.on('finish', () => setTimeout(() => req.destroy(), 1000).unref());
    return null;
  };
  if (declared > MAX_BODY) return tooBig();
  const chunks: Buffer[] = [];
  let size = 0;
  const over = await new Promise<boolean>((resolve, reject) => {
    req.on('data', (c: Buffer) => {
      size += c.length;
      if (size > MAX_BODY) { req.removeAllListeners('data'); resolve(true); } else chunks.push(c);
    });
    req.on('end', () => resolve(false));
    req.on('error', reject);
  });
  if (over) return tooBig();
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw Object.assign(new Error('Parse error'), { status: 400, code: -32700 });
  }
}

export function handler(req: IncomingMessage, res: ServerResponse): void {
  void route(req, res).catch((e) => {
    if (res.headersSent) return res.end();
    rpcError(res, e?.status ?? 500, e?.code ?? -32603, e?.status ? e.message : 'Internal server error');
  });
}

async function route(req: IncomingMessage, res: ServerResponse): Promise<void> {
  cors(res);
  const url = new URL(req.url ?? '/', 'http://x');
  const p = url.pathname;
  if (req.method === 'OPTIONS') { res.writeHead(204, { 'access-control-max-age': '86400' }); return void res.end(); }

  if (p === '/mcp') {
    if (req.method !== 'POST') return rpcError(res, 405, -32000, 'Method not allowed. This server is stateless: use POST /mcp.', { allow: 'POST, OPTIONS' });
    if (limited(req)) return rpcError(res, 429, -32000, 'Rate limit exceeded', { 'retry-after': '60' });
    const body = await readBody(req, res);
    if (body === null && res.writableEnded) return;
    const server = createServer();
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
    res.on('close', () => { void transport.close(); void server.close(); });
    await server.connect(transport);
    return transport.handleRequest(req, res, body);
  }
  if (req.method !== 'GET' && req.method !== 'HEAD') return json(res, 405, { error: 'method_not_allowed' }, { allow: 'GET, HEAD, OPTIONS' });

  if (p === '/health') return json(res, 200, { status: 'ok' });
  if (p === '/version') return json(res, 200, { name: SERVER_NAME, version: SERVER_VERSION, tools: 10, resources: 2, prompts: 2, mcp_endpoint: `${publicUrl()}/mcp`, contentCommit: content.generatedFrom.commit, contentBranch: content.generatedFrom.branch });
  if (p === '/.well-known/mcp/server-card.json' || p === '/.well-known/mcp.json') return json(res, 200, serverCard(), { 'cache-control': 'public, max-age=3600' });
  if (p === '/llms.txt') { res.writeHead(200, { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'public, max-age=3600' }); return void res.end(llmsTxt()); }
  if (p === '/robots.txt') { res.writeHead(200, { 'content-type': 'text/plain; charset=utf-8' }); return void res.end('User-agent: *\nAllow: /\n'); }
  if (p === '/') return json(res, 200, { name: SERVER_NAME, endpoint: `${publicUrl()}/mcp`, serverCard: `${publicUrl()}/.well-known/mcp/server-card.json`, docs: `${publicUrl()}/llms.txt` });
  return json(res, 404, { error: 'not_found' });
}

export function start(port = Number(process.env.PORT ?? 3010)): Server {
  const s = createHttpServer(handler);
  s.requestTimeout = 30_000;
  s.headersTimeout = 15_000;
  s.listen(port, () => console.error(`${SERVER_NAME} ${SERVER_VERSION} listening on :${port}`));
  const stop = () => s.close(() => process.exit(0));
  process.on('SIGTERM', stop);
  process.on('SIGINT', stop);
  return s;
}
