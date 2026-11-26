/* eslint-disable @typescript-eslint/no-explicit-any */
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * Plan limits come ONLY from the app's single limits export (data/plan-limits.export.json, PLAN-MTA-0069).
 * The site's own limits table is never served: it is proposed, unsigned and, per the 2026-11-20 audit, wrong.
 * Assumed export shape (adapt the adapter, not the gate, when the real file lands):
 *   { version, exportedFrom, approvedBy: string|null, plans: [{key,name}],
 *     rows: [{ id, label, enforced: boolean, values: { [planKey]: string|number|null } }] }
 */
export type LimitsExport = {
  version: string;
  exportedFrom?: string;
  approvedBy: string | null;
  plans: Array<{ key: string; name: string }>;
  rows: Array<{ id: string; label: string; enforced: boolean; values: Record<string, string | number | null> }>;
};

const exportFile = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'data', 'plan-limits.export.json');
export const loadLimitsExport = (): LimitsExport | null => (existsSync(exportFile) ? (JSON.parse(readFileSync(exportFile, 'utf8')) as LimitsExport) : null);

export type LimitsAnswer =
  | { status: 'not_published'; reason: string; pricesPublished: false }
  | { status: 'published'; limitsVersion: string; approvedBy: string; exportedFrom?: string; pricesPublished: false; plans: Array<{ key: string; name: string }>; rows: any[] };

/** Gate: nothing is served until approvedBy is set; unenforced rows are `planned` with no number. */
export function limitsAnswer(exp: LimitsExport | null, plan?: string): LimitsAnswer {
  if (!exp) return { status: 'not_published', reason: 'No plan-limits export is available to this server.', pricesPublished: false };
  if (!exp.approvedBy) return { status: 'not_published', reason: 'The limits export has no approver yet (approvedBy is null).', pricesPublished: false };
  const plans = exp.plans.filter((p) => !plan || p.key === plan);
  const rows = exp.rows.map((r) =>
    r.enforced
      ? { id: r.id, label: r.label, status: 'enforced', values: Object.fromEntries(plans.map((p) => [p.key, r.values[p.key] ?? null])) }
      : { id: r.id, label: r.label, status: 'planned' },
  );
  return { status: 'published', limitsVersion: exp.version, approvedBy: exp.approvedBy, exportedFrom: exp.exportedFrom, pricesPublished: false, plans, rows };
}
