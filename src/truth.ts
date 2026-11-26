/* eslint-disable @typescript-eslint/no-explicit-any */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

export type Truth = {
  asOf: string;
  verifiedLiveOn: string;
  neverServe: string[];
  held: { platform: Record<string, string>; solutions: Record<string, string>; faq: Record<string, string> };
  toolOverrides: Record<string, { dropChecksMatching?: string[]; metaDescription?: string; input?: string }>;
  featureStatus: { items: Array<{ id: string; name: string; status: 'live' | 'coming_soon' | 'not_offered'; versionLabel: string | null; note?: string }> };
};

const dataDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'data');
export const readData = <T>(name: string): T => JSON.parse(readFileSync(path.join(dataDir, name), 'utf8')) as T;
export const truth: Truth = readData<Truth>('product-truth.json');

const patterns = (t: Truth) => t.neverServe.map((p) => new RegExp(p, 'i'));

/** Phrases from the never-serve list found anywhere in a value (strings, nested). */
export function neverServeHits(value: unknown, t: Truth = truth): string[] {
  const text = typeof value === 'string' ? value : JSON.stringify(value);
  return patterns(t).filter((r) => r.test(text)).map((r) => r.source);
}

export type Held = { kind: 'platform' | 'solutions' | 'faq' | 'tool'; id: string; reason: string };

/**
 * Remove held items and apply tool overrides. Items are only ever removed or shortened, never reworded.
 * Anything that still matches the never-serve list afterwards is also removed (fail closed).
 */
export function applyTruth<C extends { tools: any[]; platform: any[]; solutions: any[]; faq: any[]; checklist: any[] }>(raw: C, t: Truth = truth): { served: C; held: Held[] } {
  const held: Held[] = [];
  const keep = <T>(items: T[], kind: Held['kind'], idOf: (x: T) => string, rules: Record<string, string>): T[] =>
    items.filter((x) => {
      const id = idOf(x);
      const hard = rules[id];
      const auto = neverServeHits(x, t);
      if (hard || auto.length) {
        held.push({ kind, id, reason: hard ?? `matches never-serve list: ${auto.join(', ')}` });
        return false;
      }
      return true;
    });

  const tools = raw.tools.map((tool) => {
    const o = t.toolOverrides[tool.slug];
    if (!o) return tool;
    const drops = (o.dropChecksMatching ?? []).map((s) => s.toLowerCase());
    return {
      ...tool,
      checks: tool.checks.filter((c: string) => !drops.some((d) => c.toLowerCase().includes(d))),
      ...(o.metaDescription ? { metaDescription: o.metaDescription } : {}),
      ...(o.input ? { input: o.input } : {}),
    };
  });
  const served = {
    ...raw,
    tools: keep(tools, 'tool', (x: any) => x.slug, {}),
    platform: keep(raw.platform, 'platform', (x: any) => x.id, t.held.platform),
    solutions: keep(raw.solutions, 'solutions', (x: any) => x.slug, t.held.solutions),
    faq: keep(raw.faq, 'faq', (x: any) => x.question, t.held.faq),
    checklist: raw.checklist,
  } as C;
  return { served, held };
}
