import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { applyTruth, type Held } from './truth.js';

/* eslint-disable @typescript-eslint/no-explicit-any */
export type Content = {
  generatedFrom: { repo: string; branch: string; commit: string };
  site: string;
  tools: any[];
  platform: any[];
  solutions: any[];
  faq: Array<{ question: string; answer: string; page: string | null }>;
  checklist: any[];
  limits: any;
};

const file = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'data', 'content.json');
/** The unfiltered site snapshot. Never serve this directly: use `content`. */
export const rawContent: Content = JSON.parse(readFileSync(file, 'utf8'));
const applied = applyTruth(rawContent);
/** What the server may serve: the snapshot minus everything held by data/product-truth.json. */
export const content: Content = applied.served;
export const heldItems: Held[] = applied.held;

export const SITE = content.site;
export const abs = (p: string) => (p.startsWith('http') ? p : `${SITE}${p}`);

export type Hit = { id: string; type: string; title: string; url: string; snippet: string; score: number };

export const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);
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
  const add = (type: string, key: string, title: string, url: string, body: string) => {
    const s = score(query, title, body);
    if (s > 0) hits.push({ id: `${type}:${key}`, type, title, url: abs(url), snippet: body.replace(/\s+/g, ' ').slice(0, 220), score: s });
  };
  for (const t of content.tools) add('free_tool', t.slug, t.name, t.path, `${t.job} ${t.checks.join(' ')}`);
  for (const p of content.platform) add('platform_feature', p.id, p.name, p.path, `${p.summary} ${p.problem} ${p.steps.map((s: any) => s.title + ' ' + s.body).join(' ')}`);
  for (const s of content.solutions) add('audience', s.slug, s.name, s.path, `${s.description} ${s.problem}`);
  for (const f of content.faq) add('faq', slug(f.question), f.question, f.page ?? '/', f.answer);
  for (const g of content.checklist) for (const [n, i] of g.items.entries()) add('checklist_item', `${g.id}.${n}`, i.title, i.toolHref ?? '/seo-checklist', i.why);
  return hits.sort((a, b) => b.score - a.score).slice(0, limit);
}
