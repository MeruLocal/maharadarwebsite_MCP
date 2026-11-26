/* eslint-disable @typescript-eslint/no-explicit-any */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { abs, content, heldItems, search, slug, SITE } from './content.js';
import { limitsAnswer, loadLimitsExport, type LimitsExport } from './limits.js';
import { notPublished, registers as defaultRegisters, served, type Registers } from './registers.js';
import { truth } from './truth.js';

export const SERVER_NAME = 'maharadar-mcp';
export const SERVER_VERSION = '0.2.0';

/** One line, repeated on every surface: this is not the product MCP. */
export const DISAMBIGUATION = 'This is the public information server for maharadar.com. It is not the MahaRadar product API or an MCP server for account data (those are planned, not available), and it does not run audits, touch accounts or change anything.';

const READ_ONLY = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false } as const;
const source = () => ({ site: SITE, contentRepo: content.generatedFrom.repo.split('/').pop(), contentCommit: content.generatedFrom.commit, contentBranch: content.generatedFrom.branch });
const sourceShape = z.object({ site: z.string(), contentCommit: z.string() }).passthrough();

/** Record envelope (plan PR #3 §3, trimmed): every served record says what it is, how sure we are, and when it was checked. */
const envelope = (recordType: string, url: string, status: 'available' | 'coming_soon' | 'not_published' = 'available') => ({
  record_type: recordType,
  status,
  publication_status: 'verified_public' as const,
  last_verified: truth.verifiedLiveOn,
  source_url: url,
  source_commit: content.generatedFrom.commit,
});

const ok = (data: Record<string, unknown>) => ({
  content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }],
  structuredContent: data,
});

const toolSlugs = content.tools.map((t) => t.slug) as [string, ...string[]];
const checklistGroups = content.checklist.map((g) => g.id) as [string, ...string[]];

export const ABOUT = {
  name: 'MahaRadar',
  what: 'MahaRadar is a free SEO platform: it audits a website across Google, Bing, Yandex, Naver, Seznam, Baidu and Brave and gives you the exact change to make. You edit the change and stage it as a release, and a rollback is built in.',
  site: SITE,
  freePlan: 'MahaRadar has a free plan with no card. The exact site and team-member limits are not published through this server yet: see maharadar_get_plan_limits.',
  thisServer: DISAMBIGUATION,
  start: [abs('/'), abs('/free-seo'), abs('/pricing'), abs('/platform'), abs('/tools')],
};

export type ServerState = { registers: Registers; limits: LimitsExport | null };
const defaultState = (): ServerState => ({ registers: defaultRegisters, limits: loadLimitsExport() });

const heldNote = (kind: string) => heldItems.filter((h) => h.kind === kind).length;

export function createServer(state: ServerState = defaultState()): McpServer {
  const server = new McpServer(
    { name: SERVER_NAME, version: SERVER_VERSION, title: 'MahaRadar (public site info)', websiteUrl: SITE },
    {
      instructions: `${DISAMBIGUATION} Use maharadar_search for open questions (each hit has an id you can pass to maharadar_fetch), maharadar_find_free_tool to match an SEO task to a free tool, maharadar_get_feature_status to ask whether a feature is live, coming soon or not offered, and maharadar_get_plan_limits for plan limits (it returns status "not_published" until limits are approved: never guess a number). Results carry canonical URLs: cite them. Prices are not published; do not state any. If a tool says "not_published", say so rather than filling the gap.`,
    },
  );

  server.registerTool('maharadar_about', {
    title: 'About MahaRadar',
    description: 'What MahaRadar is, what is free, and what this server can and cannot do (it is the public information server, not the product API or an account MCP). Call first when the user asks "what is MahaRadar".',
    inputSchema: {},
    outputSchema: { name: z.string(), what: z.string(), thisServer: z.string(), start: z.array(z.string()), source: sourceShape },
    annotations: { title: 'About MahaRadar', ...READ_ONLY },
  }, async () => ok({ ...ABOUT, ...envelope('about', SITE), source: source() }));

  server.registerTool('maharadar_search', {
    title: 'Search MahaRadar content',
    description: 'Keyword search across published MahaRadar free tools, platform features, audience guides, FAQs and the SEO checklist. Use for open questions such as "does MahaRadar check hreflang". Returns ranked hits with an id (pass it to maharadar_fetch) and canonical URL. Not for a user\'s own site or account.',
    inputSchema: { query: z.string().min(2).max(200).describe('Plain-language question or keywords'), limit: z.number().int().min(1).max(20).default(8).describe('Max results') },
    outputSchema: { query: z.string(), results: z.array(z.object({ id: z.string(), type: z.string(), title: z.string(), url: z.string(), snippet: z.string(), score: z.number() })), source: sourceShape },
    annotations: { title: 'Search MahaRadar content', ...READ_ONLY },
  }, async ({ query, limit }) => ok({ query, results: search(query, limit), source: source() }));

  server.registerTool('maharadar_fetch', {
    title: 'Fetch a record by id',
    description: 'Fetch the full text of one record by the id maharadar_search returned (for example "free_tool:redirect-checker" or "faq:do-i-need-a-credit-card"). Not for arbitrary URLs; the server never fetches the web.',
    inputSchema: { id: z.string().min(3).max(120).describe('Record id from maharadar_search') },
    outputSchema: { id: z.string(), found: z.boolean(), source: sourceShape },
    annotations: { title: 'Fetch a record by id', ...READ_ONLY },
  }, async ({ id }) => {
    const [type, ...rest] = id.split(':');
    const key = rest.join(':');
    let rec: Record<string, unknown> | null = null;
    if (type === 'free_tool') {
      const t = content.tools.find((x) => x.slug === key);
      if (t) rec = { title: t.name, url: abs(t.path), text: `${t.job} ${t.metaDescription}`, checks: t.checks, input: t.input };
    } else if (type === 'platform_feature') {
      const p = content.platform.find((x) => x.id === key);
      if (p) rec = { title: p.name, url: abs(p.path), text: `${p.summary}\n${p.problem}`, steps: p.steps };
    } else if (type === 'audience') {
      const s = content.solutions.find((x) => x.slug === key);
      if (s) rec = { title: s.name, url: abs(s.path), text: `${s.description}\n${s.problem}`, checklist: s.checklist };
    } else if (type === 'faq') {
      const f = content.faq.find((x) => slug(x.question) === key);
      if (f) rec = { title: f.question, url: abs(f.page ?? '/'), text: f.answer };
    } else if (type === 'checklist_item') {
      const [g, n] = key.split('.');
      const i = content.checklist.find((x) => x.id === g)?.items[Number(n)];
      if (i) rec = { title: i.title, url: abs(i.toolHref ?? '/seo-checklist'), text: i.why };
    }
    if (!rec) return ok({ id, found: false, status: 'not_published', message: 'No published record has this id. Use maharadar_search to find ids.', source: source() });
    return ok({ id, found: true, ...envelope(type, rec.url as string), ...rec, source: source() });
  });

  server.registerTool('maharadar_list_free_tools', {
    title: 'List free SEO tools',
    description: 'List the free MahaRadar SEO tools that work without an account and were verified live on the site, optionally by group. The count is the verified set, not a marketing number. Not for running a tool.',
    inputSchema: { group: z.enum(['Check a page', 'Check a site', 'Technical', 'Content and keywords', 'Beyond Google']).optional().describe('Filter by tool group') },
    outputSchema: { count: z.number(), tools: z.array(z.object({ slug: z.string(), name: z.string(), job: z.string(), group: z.string(), url: z.string(), status: z.string() })), source: sourceShape },
    annotations: { title: 'List free SEO tools', ...READ_ONLY },
  }, async ({ group }) => {
    const tools = content.tools.filter((t) => !group || t.group === group).map((t) => ({ slug: t.slug, name: t.name, job: t.job, group: t.group, url: abs(t.path), status: 'available', verified_live_on: truth.verifiedLiveOn }));
    return ok({ count: tools.length, countBasis: `Tools verified live on ${truth.verifiedLiveOn}. Newer tools are listed only after a production check.`, tools, source: source() });
  });

  server.registerTool('maharadar_get_free_tool', {
    title: 'Get a free SEO tool',
    description: 'Details of one free MahaRadar tool: what it checks, what to enter, and its URL. Use after maharadar_list_free_tools or when the user names a task like "check my redirect chain". Not for running the tool.',
    inputSchema: { slug: z.enum(toolSlugs).describe('Tool slug from maharadar_list_free_tools') },
    outputSchema: { slug: z.string(), name: z.string(), checks: z.array(z.string()), url: z.string(), source: sourceShape },
    annotations: { title: 'Get a free SEO tool', ...READ_ONLY },
  }, async ({ slug: s }) => {
    const t = content.tools.find((x) => x.slug === s)!;
    return ok({ slug: t.slug, name: t.name, job: t.job, group: t.group, description: t.metaDescription, checks: t.checks, input: t.input, crawlsMultiplePages: t.crawlsMultiplePages, url: abs(t.path), ...envelope('tool_record', abs(t.path)), verified_in_production_on: truth.verifiedLiveOn, source: source() });
  });

  server.registerTool('maharadar_get_plan_limits', {
    title: 'Get plan limits',
    description: 'Approved plan limits from the product\'s single limits export. Returns status "not_published" until the limits are approved: it never serves the site\'s proposed table, never a price, and unenforced limits show as "planned" with no number. Answers "what are the free plan limits".',
    inputSchema: { plan: z.string().max(40).optional().describe('Plan key to return only that column') },
    outputSchema: { status: z.string(), pricesPublished: z.boolean(), source: sourceShape },
    annotations: { title: 'Get plan limits', ...READ_ONLY },
  }, async ({ plan }) => ok({ ...limitsAnswer(state.limits, plan), urls: { freePlan: abs('/free-plan'), contact: abs('/contact') }, source: source() }));

  server.registerTool('maharadar_get_platform_feature', {
    title: 'Get a platform feature',
    description: 'How one published MahaRadar platform area works: the problem and the steps. Areas that are not yet accurately described, or whose features are not live, are withheld (status "not_published"); use maharadar_get_feature_status for live / coming-soon status.',
    inputSchema: { id: z.string().max(60).describe(`Platform area id: ${content.platform.map((p) => p.id).join(', ')}`) },
    outputSchema: { id: z.string(), status: z.string(), source: sourceShape },
    annotations: { title: 'Get a platform feature', ...READ_ONLY },
  }, async ({ id }) => {
    const p = content.platform.find((x) => x.id === id);
    if (!p) return ok({ id, status: 'not_published', message: 'This platform area is not published through this server (withheld until the site description is verified, or unknown id).', publishedIds: content.platform.map((x) => x.id), source: source() });
    const fs = truth.featureStatus.items.find((x) => x.id === id);
    return ok({ id: p.id, name: p.name, ...envelope('platform_feature', abs(p.path), fs?.status === 'live' ? 'available' : fs?.status === 'coming_soon' ? 'coming_soon' : 'not_published'), feature_status: fs?.status ?? 'not_published', version_label: fs?.status === 'live' ? fs.versionLabel : null, summary: p.summary, problem: p.problem, steps: p.steps, relatedTools: p.relatedTools.map((s: string) => abs(`/tools/${s}`)), url: abs(p.path), source: source() });
  });

  server.registerTool('maharadar_get_feature_status', {
    title: 'Is a feature live?',
    description: 'Live / coming_soon / not_offered status of named MahaRadar features (Market Radar, Autopilot, uptime monitoring, scheduled social, AI suggestions, customer API, account MCP, server-log upload). Never reports a switched-off or planned feature as available; a version label is returned only when one is published (otherwise null). Use for "is X available".',
    inputSchema: { feature: z.string().max(80).optional().describe('Feature name or keyword; omit to list all') },
    outputSchema: { count: z.number(), features: z.array(z.object({ id: z.string(), name: z.string(), status: z.string(), version_label: z.string().nullable() })), source: sourceShape },
    annotations: { title: 'Is a feature live?', ...READ_ONLY },
  }, async ({ feature }) => {
    const q = (feature ?? '').toLowerCase().split(/\W+/).filter((w) => w.length > 1);
    const STOP = new Set(['is', 'it', 'the', 'a', 'an', 'live', 'available', 'does', 'have', 'has', 'of', 'to']);
    const qw = q.filter((w) => !STOP.has(w));
    const pick = truth.featureStatus.items.filter((f) => !qw.length ? !q.length : qw.some((w) => `${f.id} ${f.name}`.toLowerCase().split(/\W+/).includes(w)));
    return ok({
      count: pick.length,
      features: pick.map((f) => ({ id: f.id, name: f.name, status: f.status, version_label: f.status === 'live' ? f.versionLabel : null, ...(f.note ? { note: f.note } : {}) })),
      as_of: truth.asOf,
      ...(pick.length ? {} : { status: 'not_published', message: 'No status is published for that feature.' }),
      source: source(),
    });
  });

  server.registerTool('maharadar_get_audience_guide', {
    title: 'Get an audience guide',
    description: 'How MahaRadar fits one audience (e-commerce, local business, publishers are published today; others are withheld until verified). Returns the audience problem, behaviours, checklist and FAQs.',
    inputSchema: { audience: z.string().max(60).describe(`Audience slug: ${content.solutions.map((s) => s.slug).join(', ')}`) },
    outputSchema: { slug: z.string().optional(), status: z.string().optional(), source: sourceShape },
    annotations: { title: 'Get an audience guide', ...READ_ONLY },
  }, async ({ audience }) => {
    const s = content.solutions.find((x) => x.slug === audience);
    if (!s) return ok({ status: 'not_published', message: 'This audience guide is not published through this server (withheld until verified, or unknown slug).', publishedSlugs: content.solutions.map((x) => x.slug), source: source() });
    return ok({ slug: s.slug, name: s.name, description: s.description, problem: s.problem, behaviours: s.behaviours.map((b: any) => ({ title: b.title, body: b.body, url: abs(b.href) })), checklist: s.checklist, faqs: s.faqs, url: abs(s.path), ...envelope('guide', abs(s.path)), source: source() });
  });

  server.registerTool('maharadar_get_seo_checklist', {
    title: 'Get the SEO checklist',
    description: 'MahaRadar SEO checklist, task by task, with why each item matters and the free tool that checks it. Use for "SEO checklist" or "what should I check before launch" questions.',
    inputSchema: { group: z.enum(checklistGroups).optional().describe('Checklist group id; omit for all groups') },
    outputSchema: { groups: z.array(z.record(z.string(), z.unknown())), availableGroups: z.array(z.string()), url: z.string(), source: sourceShape },
    annotations: { title: 'Get the SEO checklist', ...READ_ONLY },
  }, async ({ group }) => {
    const groups = content.checklist
      .filter((g) => !group || g.id === group)
      .map((g) => ({ id: g.id, label: g.label, intro: g.intro, items: g.items.map((i: any) => ({ title: i.title, why: i.why, ...(i.toolHref ? { checkWith: abs(i.toolHref) } : {}) })) }));
    return ok({ groups, availableGroups: checklistGroups, url: abs('/seo-checklist'), ...envelope('guide', abs('/seo-checklist')), source: source() });
  });

  server.registerTool('maharadar_find_free_tool', {
    title: 'Find the right free tool for a task',
    description: 'Match an SEO task in plain words (for example "see why my redirect loops", "validate my sitemap") to the best free MahaRadar tools. Returns up to 3 tools with URLs.',
    inputSchema: { task: z.string().min(2).max(200).describe('What the user wants to check or fix') },
    outputSchema: { task: z.string(), matches: z.array(z.object({ name: z.string(), url: z.string(), what: z.string() })), source: sourceShape },
    annotations: { title: 'Find the right free tool', ...READ_ONLY },
  }, async ({ task }) => {
    const hits = search(task, 60).filter((h) => h.type === 'free_tool').slice(0, 3);
    return ok({ task, matches: hits.map((h) => ({ name: h.title, url: h.url, what: h.snippet })), fallback: hits.length ? undefined : abs('/tools'), source: source() });
  });

  server.registerTool('maharadar_get_faq', {
    title: 'Answer a buyer FAQ',
    description: 'Published answers to common MahaRadar buyer questions (for example: do I need a card, how many AI blog posts). Answers that are not yet verified are withheld. Optionally filter by keywords. Each answer cites its page.',
    inputSchema: { topic: z.string().max(100).optional().describe('Optional keywords, e.g. "card"') },
    outputSchema: { count: z.number(), faqs: z.array(z.object({ id: z.string(), question: z.string(), answer: z.string(), url: z.string() })), source: sourceShape },
    annotations: { title: 'Answer a buyer FAQ', ...READ_ONLY },
  }, async ({ topic }) => {
    const words = (topic ?? '').toLowerCase().split(/\W+/).filter((w) => w.length > 1);
    const pick = content.faq.filter((f) => !words.length || words.some((w) => `${f.question} ${f.answer}`.toLowerCase().includes(w)));
    return ok({ count: pick.length, withheld: heldNote('faq'), faqs: pick.map((f) => ({ id: `faq:${slug(f.question)}`, question: f.question, answer: f.answer, url: abs(f.page ?? '/') })), source: source() });
  });

  // ---- Register-backed tools (empty until published; gates in src/registers.ts) ----

  const regTool = <S extends z.ZodRawShape>(name: string, title: string, description: string, reg: keyof Registers, what: string, inputSchema: S, pick: (rec: any, args: any) => boolean, pageUrl?: string) => {
    server.registerTool(name, {
      title,
      description,
      inputSchema,
      outputSchema: { status: z.string(), count: z.number(), source: sourceShape },
      annotations: { title, ...READ_ONLY },
    }, (async (args: any) => {
      const records = served(reg, state.registers).filter((r) => pick(r, args));
      if (!records.length) return ok({ ...notPublished(what, pageUrl ? abs(pageUrl) : undefined), count: 0, source: source() });
      return ok({ status: 'available', count: records.length, records, source: source() });
    }) as any);
  };

  regTool('maharadar_get_claims', 'Get approved claims', 'Founder-approved (L4) MahaRadar claims only, each with source URL and verified date. Returns status "not_published" while the claim register is empty. Never widens a claim.', 'claims', 'approved claims', { topic: z.string().max(100).optional().describe('Optional keywords') },
    (r, a) => !a.topic || JSON.stringify(r).toLowerCase().includes(String(a.topic).toLowerCase()));
  regTool('maharadar_get_trust_facts', 'Get trust facts', 'Trust statements exactly as published and approved (security, compliance, data handling). Returns "not_published" until a statement is approved and published on the site; nothing is inferred (for example no SOC 2 type, scope or date).', 'trustFacts', 'trust facts', { topic: z.string().max(100).optional() },
    (r, a) => !a.topic || JSON.stringify(r).toLowerCase().includes(String(a.topic).toLowerCase()), '/trust');
  regTool('maharadar_list_comparisons', 'List published comparisons', 'Comparison pages published with a checked date; every competitor fact carries a source URL and date. Never prices or verdicts. "not_published" when none exist.', 'comparisons', 'comparisons', {}, () => true);
  regTool('maharadar_get_comparison', 'Get a comparison', 'One published comparison by competitor slug (for example "semrush"), with dated, sourced facts only. "not_published" if no comparison with a checked date exists.', 'comparisons', 'comparisons', { competitor: z.string().min(2).max(60).describe('Competitor slug') },
    (r, a) => r.slug === a.competitor);
  regTool('maharadar_get_market_info', 'Get market info', 'Search engines, privacy regime and availability for one market (US, GB, CA, AU, IN, DE, FR, IT, JP). Every figure needs a source, an as-of date and an Astra check; regulated figures a refresh date. "not_published" until then. Not legal advice.', 'markets', 'market records', { market: z.string().min(2).max(8).describe('Market code, e.g. GB') },
    (r, a) => String(r.market).toLowerCase() === String(a.market).toLowerCase());
  regTool('maharadar_get_changelog', 'Get the changelog', 'Dated shipped and planned items, never mixed. "not_published" until the site changelog is current.', 'changelog', 'changelog entries', { status: z.enum(['shipped', 'planned']).optional() },
    (r, a) => !a.status || r.status === a.status);

  server.registerResource('about', 'maharadar://about', { title: 'About MahaRadar', description: 'What MahaRadar is and what this server offers.', mimeType: 'application/json' },
    async (uri) => ({ contents: [{ uri: uri.href, mimeType: 'application/json', text: JSON.stringify({ ...ABOUT, source: source() }, null, 2) }] }));

  server.registerResource('plan-limits', 'maharadar://plan-limits', { title: 'Plan limits', description: 'Approved plan limits, or status not_published.', mimeType: 'application/json' },
    async (uri) => ({ contents: [{ uri: uri.href, mimeType: 'application/json', text: JSON.stringify({ ...limitsAnswer(state.limits), source: source() }, null, 2) }] }));

  server.registerPrompt('recommend_free_seo_tools', {
    title: 'Recommend free SEO tools',
    description: 'Ask which free MahaRadar tools to run for a site and goal.',
    argsSchema: { site: z.string().describe('Site URL or description'), goal: z.string().describe('What the user wants to improve') },
  }, ({ site, goal }) => ({ messages: [{ role: 'user', content: { type: 'text', text: `Using the MahaRadar tools, recommend which free tools I should run for ${site}, goal: ${goal}. Cite the URLs returned. Do not state any prices.` } }] }));

  server.registerPrompt('is_maharadar_a_fit', {
    title: 'Is MahaRadar a fit?',
    description: 'Assess fit for an audience using audience guides, feature status and plan limits.',
    argsSchema: { audience: z.string().describe('Who you are, e.g. an agency with 8 clients') },
  }, ({ audience }) => ({ messages: [{ role: 'user', content: { type: 'text', text: `I am ${audience}. Using maharadar_get_audience_guide, maharadar_get_feature_status and maharadar_get_plan_limits, tell me honestly whether MahaRadar fits, including what is not published or not yet available. Cite URLs.` } }] }));

  return server;
}
