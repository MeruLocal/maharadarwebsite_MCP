/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { readFileSync } from 'node:fs';
import { content, heldItems, rawContent, search } from '../src/content.js';
import { applyTruth, neverServeHits, truth } from '../src/truth.js';
import { limitsAnswer, type LimitsExport } from '../src/limits.js';
import { notPublished, servable, servableClaim, servableComparison, servableMarket, served, type Registers } from '../src/registers.js';
import { ABOUT, createServer, DISAMBIGUATION, type ServerState } from '../src/server.js';
import { llmsTxt, serverCard } from '../src/http.js';

const emptyRegs: Registers = { claims: [], comparisons: [], trustFacts: [], markets: [], changelog: [] };
const approved: LimitsExport = JSON.parse(readFileSync('test/fixtures/plan-limits.export.json', 'utf8'));

async function connect(state: ServerState) {
  const server = createServer(state);
  const [a, b] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: 't', version: '1' });
  await Promise.all([server.connect(a), client.connect(b)]);
  const call = async (name: string, args: Record<string, unknown> = {}) => {
    const r: any = await client.callTool({ name, arguments: args });
    expect(r.isError, name).toBeFalsy();
    return r.structuredContent as any;
  };
  return { client, call };
}
const strip = (s: string) => s.split(DISAMBIGUATION).join('');

describe('D2 never-serve', () => {
  it('detects seeded bad strings', () => {
    for (const bad of ['SEO Center drafts the change', 'publishes directly', 'MCP server for agents', 'row-level security on every table', 'a lock, not a setting', 'AI traffic reporting', 'you pay per site', 'two seats']) {
      expect(neverServeHits(bad), bad).not.toEqual([]);
    }
    expect(neverServeHits('Check a sitemap')).toEqual([]);
  });
  it('removes seeded bad content and reports it as held (fail closed)', () => {
    const raw: any = { tools: [], platform: [{ id: 'x', path: '/x', name: 'X', summary: 'It drafts the fix for you.', problem: '', steps: [] }, { id: 'y', path: '/y', name: 'Y', summary: 'ok', problem: '', steps: [] }], solutions: [], faq: [], checklist: [] };
    const { served: s, held } = applyTruth(raw);
    expect(s.platform.map((p: any) => p.id)).toEqual(['y']);
    expect(held[0]).toMatchObject({ kind: 'platform', id: 'x' });
  });
  it('nothing in served content matches the never-serve list', () => {
    // `limits` (the site's proposed table) is loaded but never served: see D5 tests.
    const { limits: _unserved, ...serving } = content;
    expect(neverServeHits(serving)).toEqual([]);
  });
  it('the snapshot really did contain over-claims, and they are held (audit A2)', () => {
    expect(neverServeHits(rawContent).length).toBeGreaterThan(5);
    const held = heldItems.map((h) => `${h.kind}:${h.id}`);
    expect(held).toEqual(expect.arrayContaining(['platform:api', 'platform:publishing', 'platform:roles-and-permissions', 'faq:Is it really free?']));
  });
  it('no tool output contains a never-serve phrase', async () => {
    const { call } = await connect({ registers: emptyRegs, limits: null });
    const calls: Array<[string, Record<string, unknown>]> = [
      ['maharadar_about', {}], ['maharadar_list_free_tools', {}], ['maharadar_get_faq', {}], ['maharadar_get_seo_checklist', {}], ['maharadar_get_feature_status', {}],
      ['maharadar_get_plan_limits', {}], ['maharadar_get_claims', {}], ['maharadar_get_trust_facts', {}], ['maharadar_get_changelog', {}],
      ...content.tools.map((t): [string, Record<string, unknown>] => ['maharadar_get_free_tool', { slug: t.slug }]),
      ...content.platform.map((p): [string, Record<string, unknown>] => ['maharadar_get_platform_feature', { id: p.id }]),
      ...content.solutions.map((s): [string, Record<string, unknown>] => ['maharadar_get_audience_guide', { audience: s.slug }]),
    ];
    for (const [n, a] of calls) {
      const out = strip(JSON.stringify(await call(n, a)));
      // feature-status names the planned API/MCP honestly as coming_soon: allowed only in that tool.
      if (n === 'maharadar_get_feature_status') continue;
      expect(neverServeHits(out), `${n} ${JSON.stringify(a)}`).toEqual([]);
    }
    for (const q of ['draft', 'publish', 'api', 'schedule', 'isolation', 'seats', 'sitemap']) expect(neverServeHits(strip(JSON.stringify(search(q, 20)))), q).toEqual([]);
  });
});

describe('brand isolation and disambiguation', () => {
  it('no parent or sister product names anywhere served, and no operator is named', async () => {
    const { call } = await connect({ registers: emptyRegs, limits: null });
    const text = [JSON.stringify(ABOUT), JSON.stringify(serverCard()), llmsTxt(), JSON.stringify(await call('maharadar_get_faq'))].join(' ');
    expect(text).not.toMatch(/meru|hellogrowth|hellobooks|hellotime|soor/i);
    expect(JSON.stringify(ABOUT)).not.toContain('operator');
  });
  it('every surface carries the disambiguation line', () => {
    expect(ABOUT.thisServer).toBe(DISAMBIGUATION);
    expect(serverCard().description).toContain(DISAMBIGUATION);
    expect(llmsTxt()).toContain(DISAMBIGUATION);
    expect(DISAMBIGUATION).toMatch(/not the MahaRadar product API/);
  });
  it('about no longer says it drafts fixes or publishes after approval', () => {
    expect(ABOUT.what).not.toMatch(/drafts the fix|publishes it/i);
    expect(ABOUT.what).toMatch(/stage it as a release/);
  });
});

describe('D5 plan limits gate', () => {
  it('not_published with no export, or while approvedBy is null', () => {
    expect(limitsAnswer(null).status).toBe('not_published');
    expect(limitsAnswer({ ...approved, approvedBy: null }).status).toBe('not_published');
    expect(JSON.stringify(limitsAnswer({ ...approved, approvedBy: null }))).not.toContain('200');
  });
  it('serves enforced rows from the export row by row; unenforced rows are planned with no number', () => {
    const a: any = limitsAnswer(approved);
    expect(a.status).toBe('published');
    expect(a.rows[0]).toMatchObject({ id: 'websites', status: 'enforced', values: { free: 3, pro: 'Unlimited' } });
    expect(a.rows[1]).toEqual({ id: 'keywords', label: 'Tracked keywords', status: 'planned' });
    expect(JSON.stringify(a)).not.toMatch(/200|2000/);
    expect(a.pricesPublished).toBe(false);
  });
  it('plan filter narrows the column', () => {
    const a: any = limitsAnswer(approved, 'free');
    expect(a.rows[0].values).toEqual({ free: 3 });
  });
  it('tool and resource use the gate; the site limits table is never served', async () => {
    const { call, client } = await connect({ registers: emptyRegs, limits: approved });
    expect((await call('maharadar_get_plan_limits')).rows[0].values.free).toBe(3);
    const none = await connect({ registers: emptyRegs, limits: null });
    const d = await none.call('maharadar_get_plan_limits');
    expect(d.status).toBe('not_published');
    const res: any = await none.client.readResource({ uri: 'maharadar://plan-limits' });
    expect(JSON.parse(res.contents[0].text).status).toBe('not_published');
    expect(JSON.stringify(d)).not.toMatch(/growth|business|"1"|two seats/i);
    void client;
  });
});

describe('register gates (fixtures only, no network)', () => {
  const base = { publication_status: 'verified_public', source_url: 'https://example.com/s', last_verified: '2026-11-20' };
  it('claims need L4 and an approver', () => {
    expect(servableClaim({ ...base, approval_level: 'L4', approved_by: 'founder', text: 'x' })).toBe(true);
    expect(servableClaim({ ...base, approval_level: 'L3', approved_by: 'founder' })).toBe(false);
    expect(servableClaim({ ...base, approval_level: 'L4' })).toBe(false);
  });
  it('records need status, https source and a date; never-serve text is blocked', () => {
    expect(servable({ ...base, publication_status: 'draft' })).toBe(false);
    expect(servable({ ...base, source_url: 'http://x' })).toBe(false);
    expect(servable({ ...base, last_verified: 'soon' })).toBe(false);
    expect(servable({ ...base, text: 'it drafts the fix' })).toBe(false);
  });
  it('comparisons need checked date, dated sourced facts, no prices or verdicts', () => {
    const fact = { text: 't', source_url: 'https://c.example/p', as_of: '2026-11-01' };
    const c = { ...base, slug: 'semrush', checked_on: '2026-11-10', facts: [fact] };
    expect(servableComparison(c)).toBe(true);
    expect(servableComparison({ ...c, checked_on: null })).toBe(false);
    expect(servableComparison({ ...c, facts: [{ ...fact, as_of: undefined }] })).toBe(false);
    expect(servableComparison({ ...c, facts: [{ ...fact, price: '$9' }] })).toBe(false);
    expect(servableComparison({ ...c, facts: [{ ...fact, verdict: 'best' }] })).toBe(false);
    expect(servableComparison({ ...c, facts: [] })).toBe(false);
  });
  it('markets need Astra check, dated sourced figures and refresh dates for regulated ones', () => {
    const fig = { source_url: 'https://gov.example/x', as_of: '2026-10-01', regulated: true, refresh_date: '2027-04-01' };
    const m = { ...base, market: 'GB', astra_check: 'passed', figures: [fig] };
    expect(servableMarket(m)).toBe(true);
    expect(servableMarket({ ...m, astra_check: 'pending' })).toBe(false);
    expect(servableMarket({ ...m, figures: [{ ...fig, refresh_date: undefined }] })).toBe(false);
  });
  it('empty shipped registers serve nothing, and tools answer not_published', async () => {
    expect(served('claims')).toEqual([]);
    expect(notPublished('x').status).toBe('not_published');
    const { call } = await connect({ registers: emptyRegs, limits: null });
    for (const [n, a] of [['maharadar_get_claims', {}], ['maharadar_get_trust_facts', {}], ['maharadar_list_comparisons', {}], ['maharadar_get_comparison', { competitor: 'semrush' }], ['maharadar_get_market_info', { market: 'DE' }], ['maharadar_get_changelog', {}]] as const) {
      expect(await call(n, a), n).toMatchObject({ status: 'not_published', count: 0 });
    }
  });
  it('published fixtures are served through the tool; unpublished ones are not', async () => {
    const regs: Registers = {
      ...emptyRegs,
      comparisons: [
        { ...base, slug: 'semrush', checked_on: '2026-11-10', facts: [{ text: 't', source_url: 'https://c.example/p', as_of: '2026-11-01' }] },
        { ...base, slug: 'ahrefs', checked_on: null, facts: [] },
      ],
    };
    const { call } = await connect({ registers: regs, limits: null });
    expect((await call('maharadar_get_comparison', { competitor: 'semrush' })).status).toBe('available');
    expect((await call('maharadar_get_comparison', { competitor: 'ahrefs' })).status).toBe('not_published');
  });
});

describe('D4 feature status and D6 tool list', () => {
  it('Market Radar is coming_soon with no version label; E3/E10', async () => {
    const { call } = await connect({ registers: emptyRegs, limits: null });
    const mr = await call('maharadar_get_feature_status', { feature: 'market radar' });
    expect(mr.features[0]).toMatchObject({ id: 'market-radar', status: 'coming_soon', version_label: null });
    const logs = await call('maharadar_get_feature_status', { feature: 'server logs googlebot' });
    expect(logs.features[0].status).toBe('live');
    for (const f of (await call('maharadar_get_feature_status')).features) {
      if (f.status !== 'live') expect(f.version_label).toBeNull();
    }
    expect((await call('maharadar_get_feature_status', { feature: 'zzzz' })).status).toBe('not_published');
  });
  it('switched-off or planned features are never reported as live', () => {
    for (const id of ['market-radar', 'autopilot', 'uptime-monitoring', 'scheduled-social', 'customer-api', 'account-mcp']) {
      expect(truth.featureStatus.items.find((f) => f.id === id)?.status, id).not.toBe('live');
    }
  });
  it('tool list is the verified set with a basis note; overclaiming check strings are removed', async () => {
    const { call } = await connect({ registers: emptyRegs, limits: null });
    const l = await call('maharadar_list_free_tools');
    expect(l.count).toBe(content.tools.length);
    expect(l.countBasis).toMatch(/verified live/);
    expect(l.tools.every((t: any) => t.status === 'available')).toBe(true);
    const score = JSON.stringify(await call('maharadar_get_free_tool', { slug: 'website-seo-score' }));
    expect(score).not.toMatch(/shareable card|expires in 30 days/i);
    const schema = JSON.stringify(await call('maharadar_get_free_tool', { slug: 'schema-markup-validator' }));
    expect(schema).not.toMatch(/paste your own|Recommended properties|contradict/i);
  });
});

describe('fetch and search ids (PR #2 M5)', () => {
  it('fetch resolves every id search returns', async () => {
    const { call } = await connect({ registers: emptyRegs, limits: null });
    const hits = (await call('maharadar_search', { query: 'sitemap redirect card robots', limit: 20 })).results;
    expect(hits.length).toBeGreaterThan(3);
    for (const h of hits) {
      const r = await call('maharadar_fetch', { id: h.id });
      expect(r.found, h.id).toBe(true);
      expect(r.url, h.id).toBe(h.url);
      expect(r.publication_status).toBe('verified_public');
    }
  });
  it('unknown id is not_published, not an error', async () => {
    const { call } = await connect({ registers: emptyRegs, limits: null });
    expect(await call('maharadar_fetch', { id: 'free_tool:nope' })).toMatchObject({ found: false, status: 'not_published' });
  });
  it('held platform and audience ids answer not_published', async () => {
    const { call } = await connect({ registers: emptyRegs, limits: null });
    expect((await call('maharadar_get_platform_feature', { id: 'api' })).status).toBe('not_published');
    expect((await call('maharadar_get_audience_guide', { audience: 'developers' })).status).toBe('not_published');
  });
});

describe('eval file', () => {
  it('has 12 pairs and the tool-answerable ones match what the server returns', async () => {
    const xml = readFileSync('eval/maharadar-eval.xml', 'utf8');
    expect([...xml.matchAll(/<qa_pair>/g)]).toHaveLength(12);
    const { call } = await connect({ registers: emptyRegs, limits: null });
    expect((await call('maharadar_find_free_tool', { task: 'follow my redirect chain' })).matches[0].url).toContain('/tools/redirect-checker');
    expect((await call('maharadar_find_free_tool', { task: 'hreflang reciprocity' })).matches[0].url).toContain('/tools/hreflang-checker');
    expect((await call('maharadar_get_plan_limits')).status).toBe('not_published');
    expect((await call('maharadar_get_feature_status', { feature: 'market radar' })).features[0].status).toBe('coming_soon');
    expect((await call('maharadar_get_feature_status', { feature: 'account mcp' })).features[0].status).toBe('coming_soon');
    expect((await call('maharadar_get_comparison', { competitor: 'semrush' })).status).toBe('not_published');
    const faq = await call('maharadar_get_faq', { topic: 'blog posts' });
    expect(faq.faqs[0].answer).toMatch(/Fifty/);
    expect(faq.faqs.some((f: any) => /credit card/.test(f.question))).toBe(false);
  });
});

describe('blind-review fixes', () => {
  it('never-serve matches across newlines, tabs, double spaces and NBSP', () => {
    for (const bad of ['publishes\ndirectly', 'drafts  the\tfix', 'publishes directly']) expect(neverServeHits(bad), JSON.stringify(bad)).not.toEqual([]);
    expect(neverServeHits({ a: 'publishes\ndirectly' })).not.toEqual([]);
  });
  it('checklist items are filtered and the raw limits table is not on served content', () => {
    const raw: any = { tools: [], platform: [], solutions: [], faq: [], limits: { x: 1 }, checklist: [{ id: 'g', items: [{ title: 'ok', why: 'fine' }, { title: 'bad', why: 'Use our API' }] }] };
    const { served: s, held } = applyTruth(raw);
    expect((s as any).checklist[0].items.map((i: any) => i.title)).toEqual(['ok']);
    expect((s as any).limits).toBeUndefined();
    expect(held.some((h) => h.kind === 'checklist')).toBe(true);
  });
  it('platform area without a feature status is not_published, not live', async () => {
    const { call } = await connect({ registers: emptyRegs, limits: null });
    const r = await call('maharadar_get_platform_feature', { id: 'technical-seo' });
    expect(r.status).toBe('not_published');
  });
  it('comparison gates reject price 0, text prices, record-level verdicts; markets tolerate bad figures; internals are stripped', async () => {
    const base = { publication_status: 'verified_public', source_url: 'https://e.example/s', last_verified: '2026-11-20' };
    const fact = { text: 't', source_url: 'https://c.example/p', as_of: '2026-11-01' };
    const c = { ...base, slug: 's', checked_on: '2026-11-10', facts: [fact] };
    expect(servableComparison({ ...c, facts: [{ ...fact, price: 0 }] })).toBe(false);
    expect(servableComparison({ ...c, facts: [{ ...fact, text: 'Costs $29/mo' }] })).toBe(false);
    expect(servableComparison({ ...c, verdict: 'x' })).toBe(false);
    expect(servableMarket({ ...base, market: 'GB', astra_check: 'passed', figures: 'oops' })).toBe(false);
    expect(servable({ ...base, last_verified: '2026-99-99' })).toBe(false);
    expect(servable({ ...base, last_verified: '2999-01-01' })).toBe(false);
    const { call } = await connect({ registers: { ...emptyRegs, claims: [{ ...base, approval_level: 'L4', approved_by: 'Some Person', text: 'ok' }] }, limits: null });
    const d = await call('maharadar_get_claims');
    expect(d.status).toBe('available');
    expect(JSON.stringify(d)).not.toMatch(/Some Person|approved_by/);
  });
  it('hard-coded ABOUT and instructions are clean', () => {
    expect(neverServeHits(strip(JSON.stringify(ABOUT)))).toEqual([]);
  });
  it('feature status matches whole words', async () => {
    const { call } = await connect({ registers: emptyRegs, limits: null });
    const r = await call('maharadar_get_feature_status', { feature: 'is autopilot live' });
    expect(r.features.map((f: any) => f.id)).toEqual(['autopilot']);
  });
});
