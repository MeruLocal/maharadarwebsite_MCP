import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { abs, content, search, SITE } from './content.js';

export const SERVER_NAME = 'maharadar-mcp';
export const SERVER_VERSION = '0.1.0';

const READ_ONLY = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false } as const;
const source = () => ({ site: SITE, contentCommit: content.generatedFrom.commit, contentBranch: content.generatedFrom.branch });
const sourceShape = z.object({ site: z.string(), contentCommit: z.string() }).passthrough();

const ok = (data: Record<string, unknown>) => ({
  content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }],
  structuredContent: data,
});

const toolSlugs = content.tools.map((t) => t.slug) as [string, ...string[]];
const platformIds = content.platform.map((p) => p.id) as [string, ...string[]];
const audienceSlugs = content.solutions.map((s) => s.slug) as [string, ...string[]];
const checklistGroups = content.checklist.map((g) => g.id) as [string, ...string[]];

export const ABOUT = {
  name: 'MahaRadar',
  what: 'MahaRadar is a free SEO platform: it audits a website, drafts the fix, publishes it after a human approves, and keeps a rollback, across Google, Bing, Yandex, Naver, Seznam, Baidu and Brave.',
  operator: 'Meru Technosoft',
  site: SITE,
  freePlan: 'The full platform is free for one website, with no card and no expiry. See maharadar_get_plan_limits for the exact limits.',
  thisServer:
    'This is the public, read-only information server for maharadar.com. It does not run audits, touch accounts or change anything. The product API and MCP server for account data are a separate Business-plan feature.',
  start: [abs('/'), abs('/free-seo'), abs('/pricing'), abs('/platform'), abs('/tools')],
};

export function createServer(): McpServer {
  const server = new McpServer(
    { name: SERVER_NAME, version: SERVER_VERSION, title: 'MahaRadar (public site info)', websiteUrl: SITE },
    {
      instructions:
        'Read-only facts about MahaRadar, the free SEO platform at maharadar.com. Use maharadar_search for open questions, maharadar_find_free_tool to match an SEO task to a free tool, maharadar_get_plan_limits for what is free vs paid. Every result carries canonical URLs: cite them. Paid-plan prices are not published; do not state any.',
    },
  );

  server.registerTool('maharadar_about', {
    title: 'About MahaRadar',
    description: 'What MahaRadar is, who operates it, what is free, and what this server can and cannot do. Call first when the user asks "what is MahaRadar".',
    inputSchema: {},
    outputSchema: { name: z.string(), what: z.string(), thisServer: z.string(), start: z.array(z.string()), source: sourceShape },
    annotations: { title: 'About MahaRadar', ...READ_ONLY },
  }, async () => ok({ ...ABOUT, source: source() }));

  server.registerTool('maharadar_search', {
    title: 'Search MahaRadar content',
    description: 'Keyword search across MahaRadar free tools, platform features, audience guides, FAQs and the SEO checklist. Use for open questions such as "does MahaRadar check hreflang" or "is there a free SEO audit". Returns ranked hits with canonical URLs.',
    inputSchema: { query: z.string().min(2).max(200).describe('Plain-language question or keywords'), limit: z.number().int().min(1).max(20).default(8).describe('Max results') },
    outputSchema: { query: z.string(), results: z.array(z.object({ type: z.string(), title: z.string(), url: z.string(), snippet: z.string(), score: z.number() })), source: sourceShape },
    annotations: { title: 'Search MahaRadar content', ...READ_ONLY },
  }, async ({ query, limit }) => ok({ query, results: search(query, limit), source: source() }));

  server.registerTool('maharadar_list_free_tools', {
    title: 'List free SEO tools',
    description: 'List the free MahaRadar SEO tools that work without an account (SEO audit, sitemap checker, robots.txt tester, schema validator, hreflang checker and more), optionally by group.',
    inputSchema: { group: z.enum(['Check a page', 'Check a site', 'Technical', 'Content and keywords', 'Beyond Google']).optional().describe('Filter by tool group') },
    outputSchema: { count: z.number(), tools: z.array(z.object({ slug: z.string(), name: z.string(), job: z.string(), group: z.string(), url: z.string() })), source: sourceShape },
    annotations: { title: 'List free SEO tools', ...READ_ONLY },
  }, async ({ group }) => {
    const tools = content.tools.filter((t) => !group || t.group === group).map((t) => ({ slug: t.slug, name: t.name, job: t.job, group: t.group, url: abs(t.path) }));
    return ok({ count: tools.length, tools, source: source() });
  });

  server.registerTool('maharadar_get_free_tool', {
    title: 'Get a free SEO tool',
    description: 'Details of one free MahaRadar tool: what it checks, what to enter, and its URL. Use after maharadar_list_free_tools or when the user names a task like "check my redirect chain".',
    inputSchema: { slug: z.enum(toolSlugs).describe('Tool slug from maharadar_list_free_tools') },
    annotations: { title: 'Get a free SEO tool', ...READ_ONLY },
  }, async ({ slug }) => {
    const t = content.tools.find((x) => x.slug === slug)!;
    return ok({ slug: t.slug, name: t.name, job: t.job, group: t.group, description: t.metaDescription, checks: t.checks, input: t.input, crawlsMultiplePages: t.crawlsMultiplePages, url: abs(t.path), source: source() });
  });

  server.registerTool('maharadar_get_plan_limits', {
    title: 'Get plan limits',
    description: 'Free, Growth and Business plan entitlements (websites, team seats, tracked keywords, URLs per crawl, AI blog posts, cadence). Answers "is MahaRadar really free" and "what are the limits". Money prices are NOT published; the response says so and carries the review status of the limits table.',
    inputSchema: { plan: z.enum(['free', 'growth', 'business']).optional().describe('Return only this plan column') },
    annotations: { title: 'Get plan limits', ...READ_ONLY },
  }, async ({ plan }) => {
    const l = content.limits;
    const tiers = l.tiers.filter((t: any) => !plan || t.id === plan).map((t: any) => ({ id: t.id, name: t.name, price: t.price.display, note: t.note }));
    const rows = l.rows.map((r: any) => ({
      feature: r.label,
      group: r.group,
      ...(plan ? { value: r[plan] ?? 'Not included' } : { free: r.free ?? 'Not included', growth: r.growth ?? 'Not included', business: r.business ?? 'Not included' }),
    }));
    return ok({
      limitsVersion: l.version,
      limitsStatus: l.status,
      approvedBy: l.approvedBy,
      enforcementVerified: l.enforcementVerified,
      pricesPublished: false,
      caveat: 'These limits are marked "proposed" in the site source and are not yet signed off; no currency prices exist for Growth or Business. Quote the limits as published on the pricing page and send price questions to the contact page.',
      tiers,
      rows,
      footnotes: l.footnotes.map((f: any) => ({ text: f.text, verified: f.verified })),
      urls: { pricing: abs('/pricing'), freePlan: abs('/free-plan'), contact: abs('/contact') },
      source: source(),
    });
  });

  server.registerTool('maharadar_get_platform_feature', {
    title: 'Get a platform feature',
    description: 'How one MahaRadar platform area works (site audit and SEO Center, page SEO, technical SEO, keywords, links, beyond-Google engines, local SEO, content, intelligence, publishing, roles, API): the problem, the steps, and what is free, paid and not possible.',
    inputSchema: { id: z.enum(platformIds).describe('Platform area id') },
    annotations: { title: 'Get a platform feature', ...READ_ONLY },
  }, async ({ id }) => {
    const p = content.platform.find((x) => x.id === id)!;
    return ok({ id: p.id, name: p.name, summary: p.summary, problem: p.problem, steps: p.steps, limits: p.limits, relatedTools: p.relatedTools.map((s: string) => abs(`/tools/${s}`)), faqs: p.faqs, url: abs(p.path), source: source() });
  });

  server.registerTool('maharadar_get_audience_guide', {
    title: 'Get an audience guide',
    description: 'How MahaRadar fits one audience: agencies, e-commerce, SaaS, local business, publishers or developers. Returns the audience problem, specific behaviours, checklist and FAQs.',
    inputSchema: { audience: z.enum(audienceSlugs).describe('Audience slug') },
    annotations: { title: 'Get an audience guide', ...READ_ONLY },
  }, async ({ audience }) => {
    const s = content.solutions.find((x) => x.slug === audience)!;
    return ok({ slug: s.slug, name: s.name, description: s.description, problem: s.problem, behaviours: s.behaviours.map((b: any) => ({ title: b.title, body: b.body, url: abs(b.href) })), checklist: s.checklist, faqs: s.faqs, url: abs(s.path), source: source() });
  });

  server.registerTool('maharadar_get_seo_checklist', {
    title: 'Get the SEO checklist',
    description: 'MahaRadar SEO checklist, task by task, with why each item matters and the free tool that checks it. Use for "SEO checklist" or "what should I check before launch" questions.',
    inputSchema: { group: z.enum(checklistGroups).optional().describe('Checklist group id; omit for all groups') },
    annotations: { title: 'Get the SEO checklist', ...READ_ONLY },
  }, async ({ group }) => {
    const groups = content.checklist
      .filter((g) => !group || g.id === group)
      .map((g) => ({ id: g.id, label: g.label, intro: g.intro, items: g.items.map((i: any) => ({ title: i.title, why: i.why, ...(i.toolHref ? { checkWith: abs(i.toolHref) } : {}) })) }));
    return ok({ groups, availableGroups: checklistGroups, url: abs('/seo-checklist'), source: source() });
  });

  server.registerTool('maharadar_find_free_tool', {
    title: 'Find the right free tool for a task',
    description: 'Match an SEO task in plain words (for example "see why my redirect loops", "validate my sitemap", "preview my title in Google") to the best free MahaRadar tools. Returns up to 3 tools with URLs.',
    inputSchema: { task: z.string().min(2).max(200).describe('What the user wants to check or fix') },
    annotations: { title: 'Find the right free tool', ...READ_ONLY },
  }, async ({ task }) => {
    const hits = search(task, 60).filter((h) => h.type === 'free_tool').slice(0, 3);
    return ok({ task, matches: hits.map((h) => ({ name: h.title, url: h.url, what: h.snippet })), fallback: hits.length ? undefined : abs('/tools'), source: source() });
  });

  server.registerResource('about', 'maharadar://about', { title: 'About MahaRadar', description: 'What MahaRadar is and what this server offers.', mimeType: 'application/json' },
    async (uri) => ({ contents: [{ uri: uri.href, mimeType: 'application/json', text: JSON.stringify({ ...ABOUT, source: source() }, null, 2) }] }));

  server.registerResource('plan-limits', 'maharadar://plan-limits', { title: 'Plan limits table', description: 'Free, Growth and Business limits as published (status: proposed).', mimeType: 'application/json' },
    async (uri) => ({ contents: [{ uri: uri.href, mimeType: 'application/json', text: JSON.stringify({ status: content.limits.status, version: content.limits.version, rows: content.limits.rows, source: source() }, null, 2) }] }));

  server.registerPrompt('recommend_free_seo_tools', {
    title: 'Recommend free SEO tools',
    description: 'Ask which free MahaRadar tools to run for a site and goal.',
    argsSchema: { site: z.string().describe('Site URL or description'), goal: z.string().describe('What the user wants to improve') },
  }, ({ site, goal }) => ({ messages: [{ role: 'user', content: { type: 'text', text: `Using the MahaRadar tools, recommend which free tools I should run for ${site}, goal: ${goal}. Cite the URLs returned. Do not state any paid prices.` } }] }));

  server.registerPrompt('is_maharadar_a_fit', {
    title: 'Is MahaRadar a fit?',
    description: 'Assess fit for an audience using audience guides and plan limits.',
    argsSchema: { audience: z.string().describe('Who you are, e.g. an agency with 8 clients') },
  }, ({ audience }) => ({ messages: [{ role: 'user', content: { type: 'text', text: `I am ${audience}. Using maharadar_get_audience_guide and maharadar_get_plan_limits, tell me honestly whether MahaRadar fits, including limits that may not. Cite URLs.` } }] }));

  return server;
}
