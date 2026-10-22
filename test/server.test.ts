import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import type { Server } from 'node:http';
import { createServer as http } from 'node:http';
import type { AddressInfo } from 'node:net';
import { handler } from '../src/http.js';
import { content, search } from '../src/content.js';

let srv: Server;
let base: string;
beforeAll(async () => {
  srv = http(handler);
  await new Promise<void>((r) => srv.listen(0, r));
  base = `http://127.0.0.1:${(srv.address() as AddressInfo).port}`;
});
afterAll(() => new Promise<void>((r) => srv.close(() => r())));

const rpc = (method: string, params: unknown = {}, id: number | undefined = 1) =>
  fetch(`${base}/mcp`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream', 'mcp-protocol-version': '2025-06-18' },
    body: JSON.stringify({ jsonrpc: '2.0', ...(id === undefined ? {} : { id }), method, params }),
  });

describe('protocol', () => {
  it('initializes without a session id (stateless)', async () => {
    const r = await rpc('initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 't', version: '1' } });
    expect(r.status).toBe(200);
    expect(r.headers.get('mcp-session-id')).toBeNull();
    const j = await r.json();
    expect(j.result.serverInfo.name).toBe('maharadar-mcp');
  });
  it('lists 10 tools, all read-only with titles and annotations', async () => {
    const j = await (await rpc('tools/list')).json();
    expect(j.result.tools).toHaveLength(10);
    for (const t of j.result.tools) {
      expect(t.title).toBeTruthy();
      expect(t.annotations).toMatchObject({ readOnlyHint: true, destructiveHint: false, openWorldHint: false });
      expect(t.description.length).toBeGreaterThan(40);
    }
  });
  it('rejects GET /mcp with 405 and Allow header', async () => {
    const r = await fetch(`${base}/mcp`);
    expect(r.status).toBe(405);
    expect(r.headers.get('allow')).toContain('POST');
  });
  it('returns JSON-RPC parse error with HTTP 400 on bad JSON', async () => {
    const r = await fetch(`${base}/mcp`, { method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream' }, body: '{nope' });
    expect(r.status).toBe(400);
    expect((await r.json()).error.code).toBe(-32700);
  });
  it('rejects bodies over 64 KB', async () => {
    const r = await fetch(`${base}/mcp`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: 'x'.repeat(70_000) });
    expect(r.status).toBe(413);
  });
  it('reports invalid tool arguments as an error, not a crash', async () => {
    const j = await (await rpc('tools/call', { name: 'maharadar_get_free_tool', arguments: { slug: 'nope' } })).json();
    expect(j.result?.isError === true || j.error).toBeTruthy();
  });
});

describe('content truth', () => {
  it('serves only implemented tools, matching the live sitemap tool list', () => {
    const live = ['seo-audit', 'seo-checker', 'website-seo-score', 'meta-tag-checker', 'sitemap-checker', 'robots-txt-tester', 'broken-link-checker', 'redirect-checker', 'schema-markup-validator', 'page-speed-checker', 'hreflang-checker', 'image-seo-checker', 'serp-preview', 'keyword-questions'];
    const slugs = content.tools.map((t) => t.slug).filter((s) => s !== 'seo-checklist');
    expect(slugs.sort()).toEqual([...live].sort());
  });
  it('plan limits keep the proposed status and publish no prices', async () => {
    const j = await (await rpc('tools/call', { name: 'maharadar_get_plan_limits', arguments: {} })).json();
    const d = j.result.structuredContent;
    expect(d.limitsStatus).toBe('proposed');
    expect(d.pricesPublished).toBe(false);
    expect(JSON.stringify(d)).not.toMatch(/[₹$€£]\s?\d/);
  });
  it('every emitted URL is a canonical maharadar.com URL', async () => {
    const urls = new Set<string>();
    for (const q of ['sitemap', 'redirect', 'agency', 'pricing', 'hreflang']) for (const h of search(q, 20)) urls.add(h.url);
    expect(urls.size).toBeGreaterThan(5);
    for (const u of urls) expect(u).toMatch(/^https:\/\/maharadar\.com\//);
  });
  it('maps tasks to the right tool', async () => {
    const j = await (await rpc('tools/call', { name: 'maharadar_find_free_tool', arguments: { task: 'follow my redirect chain' } })).json();
    expect(j.result.structuredContent.matches[0].url).toContain('/tools/redirect-checker');
  });
});

describe('discovery', () => {
  it.each(['/.well-known/mcp/server-card.json', '/.well-known/mcp.json', '/llms.txt', '/robots.txt', '/health', '/version'])('%s returns 200', async (p) => {
    expect((await fetch(base + p)).status).toBe(200);
  });
  it('server card says stateless, unauthenticated, streamable-http', async () => {
    const c = await (await fetch(`${base}/.well-known/mcp/server-card.json`)).json();
    expect(c).toMatchObject({ transport: 'streamable-http', stateless: true, authentication: 'none' });
  });
});

describe('hardening and inventory', () => {
  it('answers 413 for a chunked oversized upload and keeps serving', async () => {
    const { request } = await import('node:http');
    const port = Number(new URL(base).port);
    const status = await new Promise<number>((resolve, reject) => {
      const r = request({ port, host: '127.0.0.1', method: 'POST', path: '/mcp', headers: { 'content-type': 'application/json', 'transfer-encoding': 'chunked' } }, (res) => { res.resume(); resolve(res.statusCode ?? 0); });
      r.on('error', reject);
      for (let i = 0; i < 20; i++) r.write('x'.repeat(8000));
      r.end();
    });
    expect(status).toBe(413);
    expect((await fetch(`${base}/health`)).status).toBe(200);
  });
  it('enumerates exactly 2 resources and 2 prompts', async () => {
    expect((await (await rpc('resources/list')).json()).result.resources).toHaveLength(2);
    expect((await (await rpc('prompts/list')).json()).result.prompts).toHaveLength(2);
  });
  it('every tool returns valid structured output (SDK validates outputSchema) for a sample call', async () => {
    const calls: Array<[string, Record<string, unknown>]> = [
      ['maharadar_about', {}], ['maharadar_search', { query: 'sitemap' }], ['maharadar_list_free_tools', {}],
      ['maharadar_get_free_tool', { slug: 'seo-audit' }], ['maharadar_get_plan_limits', {}], ['maharadar_get_platform_feature', { id: 'site-audit' }],
      ['maharadar_get_audience_guide', { audience: 'agencies' }], ['maharadar_get_seo_checklist', {}], ['maharadar_find_free_tool', { task: 'robots.txt' }], ['maharadar_get_faq', { topic: 'card' }],
    ];
    for (const [name, args] of calls) {
      const j = await (await rpc('tools/call', { name, arguments: args })).json();
      expect(j.error, name).toBeUndefined();
      expect(j.result.isError, name).toBeFalsy();
      expect(j.result.structuredContent.source.contentRepo, name).toBe('MeruLocal/maharadarwebsite');
    }
  });
  it('no tool, resource or prompt output contains a currency amount', async () => {
    const outs = [
      await (await rpc('tools/call', { name: 'maharadar_get_plan_limits', arguments: {} })).text(),
      await (await rpc('tools/call', { name: 'maharadar_search', arguments: { query: 'price pricing cost' } })).text(),
      await (await rpc('tools/call', { name: 'maharadar_get_faq', arguments: {} })).text(),
      await (await rpc('resources/read', { uri: 'maharadar://plan-limits' })).text(),
    ];
    for (const o of outs) expect(o).not.toMatch(/(?:₹|\$|€|£|USD|INR)\s?\d/);
  });
  it('FAQ answers cite the page that shows them', async () => {
    const j = await (await rpc('tools/call', { name: 'maharadar_get_faq', arguments: { topic: 'credit card' } })).json();
    expect(j.result.structuredContent.faqs.length).toBeGreaterThan(0);
    for (const f of j.result.structuredContent.faqs) expect(f.url).toMatch(/^https:\/\/maharadar\.com\//);
  });
  it('unsupported protocol version negotiates down instead of crashing', async () => {
    const j = await (await rpc('initialize', { protocolVersion: '1999-01-01', capabilities: {}, clientInfo: { name: 't', version: '1' } })).json();
    expect(j.result?.protocolVersion ?? j.error).toBeTruthy();
  });
});
