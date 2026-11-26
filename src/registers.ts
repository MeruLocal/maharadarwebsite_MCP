/* eslint-disable @typescript-eslint/no-explicit-any */
import { readData, neverServeHits } from './truth.js';

/** Common record envelope (plan PR #3 §3), trimmed to what this server can truthfully fill today. */
export type Status = 'available' | 'beta' | 'integration' | 'coming_soon' | 'unavailable' | 'not_published';

export type Registers = {
  claims: any[];
  comparisons: any[];
  trustFacts: any[];
  markets: any[];
  changelog: any[];
};

export const registers: Registers = readData<Registers>('registers.json');

const isDate = (s: unknown): boolean => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);
const hasSource = (r: any) => typeof r.source_url === 'string' && /^https:\/\//.test(r.source_url);

/** A record is servable only when verified public, sourced and dated, and clear of the never-serve list. */
export function servable(r: any): boolean {
  return r?.publication_status === 'verified_public' && hasSource(r) && isDate(r.last_verified) && neverServeHits(r).length === 0;
}

/** L4 = founder-approved claim. Only these are served as claims. */
export const servableClaim = (r: any): boolean => servable(r) && r.approval_level === 'L4' && !!r.approved_by;

/** Comparison facts additionally need a checked date and a source on every competitor fact; prices and verdicts are stripped. */
export function servableComparison(r: any): boolean {
  if (!servable(r) || !isDate(r.checked_on) || !Array.isArray(r.facts) || r.facts.length === 0) return false;
  return r.facts.every((f: any) => hasSource(f) && isDate(f.as_of) && !f.price && !f.verdict);
}

/** Markets: any figure needs source + as_of; regulated figures also need refresh_date; DE/FR/IT/JP stay draft until reviewed. */
export function servableMarket(r: any): boolean {
  if (!servable(r)) return false;
  if (r.astra_check !== 'passed') return false;
  const figs: any[] = r.figures ?? [];
  return figs.every((f) => hasSource(f) && isDate(f.as_of) && (!f.regulated || isDate(f.refresh_date)));
}

export const gates = {
  claims: servableClaim,
  comparisons: servableComparison,
  trustFacts: servable,
  markets: servableMarket,
  changelog: servable,
} as const;

export type RegisterName = keyof typeof gates;

/** Records of a register that pass its gate. */
export const served = (name: RegisterName, reg: Registers = registers): any[] => reg[name].filter(gates[name]);

/** Standard answer when a register has nothing servable. */
export const notPublished = (what: string, url?: string) => ({
  status: 'not_published' as const,
  message: `No ${what} are published through this server yet. Nothing is inferred or filled in.`,
  ...(url ? { url } : {}),
});
