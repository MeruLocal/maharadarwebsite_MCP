import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/* eslint-disable @typescript-eslint/no-explicit-any */
export type Content = {
  generatedFrom: { repo: string; branch: string; commit: string };
  site: string;
  tools: any[];
  platform: any[];
  solutions: any[];
  faq: Array<{ question: string; answer: string }>;
  checklist: any[];
  limits: any;
};

const file = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'data', 'content.json');
export const content: Content = JSON.parse(readFileSync(file, 'utf8'));

export const SITE = content.site;
export const abs = (p: string) => (p.startsWith('http') ? p : `${SITE}${p}`);

export type Hit = { type: string; title: string; url: string; snippet: string; score: number };

const tok = (s: string) => s.toLowerCase().split(/[^a-z0-9.]+/).filter((w) => w.length > 1);

function score(query: string[], title: string, body: string): number {
  const t = title.toLowerCase();
  const b = body.toLowerCase();
  let s = 0;
  for (const w of query) {
    if (t.includes(w)) s += 3;
    if (b.includes(w)) s += 1;
  }
  return s;
}

/** Keyword search over the mirrored site content. Deterministic; no network. */
export function search(q: string, limit = 8): Hit[] {
  const query = tok(q);
  if (!query.length) return [];
  const hits: Hit[] = [];
  const add = (type: string, title: string, url: string, body: string) => {
    const s = score(query, title, body);
    if (s > 0) hits.push({ type, title, url: abs(url), snippet: body.replace(/\s+/g, ' ').slice(0, 220), score: s });
  };
  for (const t of content.tools) add('free_tool', t.name, t.path, `${t.job} ${t.checks.join(' ')}`);
  for (const p of content.platform) add('platform_feature', p.name, p.path, `${p.summary} ${p.problem} ${p.steps.map((s: any) => s.title + ' ' + s.body).join(' ')}`);
  for (const s of content.solutions) add('audience', s.name, s.path, `${s.description} ${s.problem}`);
  for (const f of content.faq) add('faq', f.question, '/pricing', f.answer);
  for (const g of content.checklist) for (const i of g.items) add('checklist_item', i.title, i.toolHref ?? '/seo-checklist', i.why);
  return hits.sort((a, b) => b.score - a.score).slice(0, limit);
}
