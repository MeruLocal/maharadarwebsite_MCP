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

const isDate = (s: unknown, allowFuture = false): boolean => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s)) && (allowFuture || Date.parse(s) <= Date.now() + 86_400_000);
const hasSource = (r: any) => typeof r.source_url === 'string' && /^https:\/\//.test(r.source_url);

/** A record is servable only when verified public, sourced and dated, and clear of the never-serve list. */
const FORBIDDEN_KEYS = ['price', 'prices', 'pricing', 'verdict', 'winner', 'best'];
const hasForbidden = (r: any): boolean => !!r && typeof r === 'object' && Object.entries(r).some(([k, v]) => FORBIDDEN_KEYS.includes(k.toLowerCase()) || hasForbidden(v));
const CURRENCY = /(?:[₹$€£]|usd|inr|eur|gbp)\s?\d|\d\s?(?:usd|inr|eur|gbp)|\bbest\b|#1|\bnumber one\b/i;

export function servable(r: any): boolean {
  return !hasForbidden(r) && !CURRENCY.test(JSON.stringify(r) ?? '') && r?.publication_status === 'verified_public' && hasSource(r) && isDate(r.last_verified) && neverServeHits(r).length === 0;
}

/** L4 = founder-approved claim. Only these are served as claims. */
export const servableClaim = (r: any): boolean => servable(r) && r.approval_level === 'L4' && !!r.approved_by;

/** Comparison facts additionally need a checked date and a source on every competitor fact; prices and verdicts are stripped. */
export function servableComparison(r: any): boolean {
  if (!servable(r) || !isDate(r.checked_on) || !Array.isArray(r.facts) || r.facts.length === 0) return false;
  return r.facts.every((f: any) => hasSource(f) && isDate(f.as_of) && true);
}

/** Markets: any figure needs source + as_of; regulated figures also need refresh_date; DE/FR/IT/JP stay draft until reviewed. */
export function servableMarket(r: any): boolean {
  if (!servable(r)) return false;
  if (r.astra_check !== 'passed') return false;
  if (r.figures !== undefined && !Array.isArray(r.figures)) return false;
  const figs: any[] = r.figures ?? [];
  return figs.every((f) => hasSource(f) && isDate(f.as_of) && (!f.regulated || isDate(f.refresh_date, true)));
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
const INTERNAL = ['approved_by', 'approval_level', 'reviewer', 'notes', 'internal', 'astra_check'];
const strip = (r: any): any => (Array.isArray(r) ? r.map(strip) : r && typeof r === 'object' ? Object.fromEntries(Object.entries(r).filter(([k]) => !INTERNAL.includes(k)).map(([k, v]) => [k, strip(v)])) : r);

/** Records of a register that pass its gate, minus internal fields (approver, reviewer, notes). */
export const served = (name: RegisterName, reg: Registers = registers): any[] => (Array.isArray(reg[name]) ? reg[name] : []).filter((r) => { try { return gates[name](r); } catch { return false; } }).map(strip);

/** Standard answer when a register has nothing servable. */
export const notPublished = (what: string, url?: string) => ({
  status: 'not_published' as const,
  message: `No ${what} are published through this server yet. Nothing is inferred or filled in.`,
  ...(url ? { url } : {}),
});
