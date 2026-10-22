// Regenerates data/content.json from a checkout of MeruLocal/maharadarwebsite.
// Usage: SITE_REPO="C:/Software RSS/maharadarwebsite" npm run sync:content
// The site's content files are the single source of truth; nothing in data/ is hand-edited.
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import path from 'node:path';

const repo = process.env.SITE_REPO;
if (!repo) throw new Error('Set SITE_REPO to a maharadarwebsite checkout');
const imp = (p: string) => import(pathToFileURL(path.join(repo, 'src/content', p)).href);

const [tools, platform, solutions, faq, pillars, checklist] = await Promise.all([
  imp('tools.ts'), imp('platform-pages.ts'), imp('solutions.ts'), imp('faq.ts'), imp('pillars.ts'), imp('seo-checklist.ts'),
]);
const limits = JSON.parse(readFileSync(path.join(repo, 'src/content/limits.json'), 'utf8'));
const commit = execFileSync('git', ['-C', repo, 'rev-parse', 'HEAD']).toString().trim();
const branch = execFileSync('git', ['-C', repo, 'rev-parse', '--abbrev-ref', 'HEAD']).toString().trim();

const out = {
  generatedFrom: { repo: 'MeruLocal/maharadarwebsite', branch, commit },
  site: 'https://maharadar.com',
  tools: tools.implementedTools().map((t: any) => ({
    slug: t.slug, name: t.name, job: t.job, group: t.group, path: tools.toolPath(t),
    metaDescription: t.metaDescription, checks: t.checks, input: t.inputLabel,
    crawlsMultiplePages: t.crawlsMultiplePages,
  })),
  platform: platform.PLATFORM_PAGES.map((p: any) => {
    const pillar = pillars.pillarById(p.id) ?? pillars.PLATFORM_EXTRAS.find((x: any) => x.id === p.id);
    return {
      id: p.id, name: pillar?.name ?? p.id, path: pillar?.path ?? `/platform/${p.id}`,
      summary: pillar?.summary ?? '', problem: p.problem,
      steps: p.steps, limits: p.limits, relatedTools: p.relatedTools, faqs: p.faqs,
    };
  }),
  solutions: solutions.SOLUTIONS_CONTENT.map((s: any) => ({
    slug: s.slug, name: s.name, path: `/solutions/${s.slug}`, description: s.metaDescription,
    problem: s.problem, behaviours: s.behaviours, checklist: s.checklist, faqs: s.faqs,
  })),
  faq: Object.values(faq.FAQ_BANK),
  checklist: checklist.SEO_CHECKLIST,
  limits,
};
writeFileSync('data/content.json', JSON.stringify(out, null, 2) + '\n');
console.log(`content.json: ${out.tools.length} tools, ${out.platform.length} platform pages, ${out.solutions.length} solutions, ${out.faq.length} faqs @ ${commit.slice(0, 8)}`);
