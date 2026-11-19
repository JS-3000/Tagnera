// Maintenance report for a month or quarter: all due work + required spare parts.
import { data } from '../data';
import type { SparePart, Supplier, Tag } from '../data/types';
import { addDays, addMonths, daysBetween, today } from '../lib/util';
import { addInterval, loadAllTaskStatuses, warningWindowDays, type MaintStatus, type TaskStatus } from './maintenance';

export type PeriodKind = 'month' | 'quarter';

export interface Period {
  kind: PeriodKind;
  year: number;
  index: number; // month 1–12 or quarter 1–4
}

const MONTHS = [
  'Januar',
  'Februar',
  'März',
  'April',
  'Mai',
  'Juni',
  'Juli',
  'August',
  'September',
  'Oktober',
  'November',
  'Dezember',
];
export const monthName = (m: number) => MONTHS[m - 1];

export function periodRange(p: Period): { start: string; end: string; label: string } {
  const firstMonth = p.kind === 'month' ? p.index : (p.index - 1) * 3 + 1;
  const start = `${p.year}-${String(firstMonth).padStart(2, '0')}-01`;
  const end = addDays(addMonths(start, p.kind === 'month' ? 1 : 3), -1);
  const label = p.kind === 'month' ? `${monthName(p.index)} ${p.year}` : `${p.index}. Quartal ${p.year}`;
  return { start, end, label };
}

export function currentPeriod(kind: PeriodKind): Period {
  const t = today();
  const year = Number(t.slice(0, 4));
  const month = Number(t.slice(5, 7));
  return { kind, year, index: kind === 'month' ? month : Math.ceil(month / 3) };
}

export interface ReportItem {
  date: string;
  overdue: boolean; // was already due before the period started
  status: TaskStatus;
  /** status of this occurrence seen from today */
  state: MaintStatus;
  /** "2 × Dichtungssatz" … */
  parts: string[];
}

export interface ReportPart {
  part: SparePart;
  supplier: Supplier | null;
  quantity: number;
  tags: Tag[];
}

export async function buildReport(
  p: Period,
): Promise<{ items: ReportItem[]; parts: ReportPart[]; start: string; end: string; label: string }> {
  const range = periodRange(p);
  const [statuses, parts, suppliers] = await Promise.all([
    loadAllTaskStatuses(),
    data.spareParts.list(),
    data.suppliers.list(),
  ]);
  const items: ReportItem[] = [];

  for (const s of statuses) {
    if (s.dueDate < range.start && range.end >= today()) {
      items.push({ date: s.dueDate, overdue: true, status: s, state: 'overdue', parts: [] });
    }
    // repeat the interval from the next due date and collect all dates inside the period
    let d = s.dueDate;
    for (let guard = 0; d <= range.end && guard < 1000; guard++) {
      if (d >= range.start) items.push({ date: d, overdue: false, status: s, state: 'ok', parts: [] });
      d = addInterval(s.dueDate, s.task.intervalValue, s.task.intervalUnit, guard + 1);
    }
  }
  items.sort(
    (a, b) =>
      a.date.localeCompare(b.date) ||
      a.status.tag.tagNumber.localeCompare(b.status.tag.tagNumber, 'de', { numeric: true }),
  );

  // spare parts needed
  const partById = new Map(parts.map((x) => [x.id, x]));
  const supplierById = new Map(suppliers.map((x) => [x.id, x]));
  const need = new Map<string, ReportPart>();
  for (const it of items) {
    for (const rp of it.status.task.requiredParts) {
      const part = partById.get(rp.sparePartId);
      if (!part) continue;
      const entry = need.get(part.id) ?? {
        part,
        supplier: part.supplierId ? (supplierById.get(part.supplierId) ?? null) : null,
        quantity: 0,
        tags: [],
      };
      entry.quantity += rp.quantity;
      if (!entry.tags.includes(it.status.tag)) entry.tags.push(it.status.tag);
      need.set(part.id, entry);
    }
  }
  const partList = [...need.values()].sort(
    (a, b) => (a.supplier?.name ?? '').localeCompare(b.supplier?.name ?? '') || a.part.name.localeCompare(b.part.name),
  );
  for (const it of items) {
    const left = daysBetween(today(), it.date);
    it.state = it.overdue || left < 0 ? 'overdue' : left <= warningWindowDays(it.status.task) ? 'due' : 'ok';
    it.parts = it.status.task.requiredParts
      .map((rp) => (partById.get(rp.sparePartId) ? `${rp.quantity} × ${partById.get(rp.sparePartId)!.name}` : ''))
      .filter(Boolean);
  }
  return { items, parts: partList, ...range };
}

/** One e-mail per supplier with all parts needed in the period. */
export function collectiveOrderMail(
  supplier: Supplier,
  parts: ReportPart[],
  periodLabel: string,
  sender: string,
): string {
  const lines = [
    'Guten Tag,',
    '',
    `für die Wartungsarbeiten im Zeitraum ${periodLabel} bestellen wir:`,
    '',
    ...parts.map(
      (p) =>
        `- ${p.quantity} × ${p.part.name} | Bestell-Nr. ${p.part.supplierOrderNumber || '–'} | Hersteller-Nr. ${p.part.manufacturerPartNumber || '–'} | für ${p.tags.map((t) => t.tagNumber).join(', ')}`,
    ),
    '',
    ...(supplier.customerNumber ? [`Unsere Kundennummer: ${supplier.customerNumber}`, ''] : []),
    'Bitte bestätigen Sie Liefertermin und Preise.',
    '',
    'Mit freundlichen Grüßen',
    sender,
  ];
  return `mailto:${encodeURIComponent(supplier.orderEmail)}?subject=${encodeURIComponent(`Sammelbestellung Ersatzteile ${periodLabel}`)}&body=${encodeURIComponent(lines.join('\n'))}`;
}
