// Maintenance report as a real A4 PDF (pdfmake). Same file on phone and PC:
// logo + plant in the header, period, creation date, table of due work,
// spare parts per supplier, page numbers. Tables break cleanly across pages.
import type { Content, TDocumentDefinitions } from 'pdfmake/interfaces';
import markLight from '../assets/brand/logo-mark.svg?raw';
import { fmtDate, fmtDateTime, nowIso } from '../lib/util';
import { intervalLabel, STATUS_LABELS } from './maintenance';
import type { ReportItem, ReportPart } from './report';

const PRIMARY = '#1F2A36';
const ACCENT = '#F28C28';
const MUTED = '#5B6875';
const STATUS_COLORS = { ok: '#2E9B5F', due: '#A8560B', overdue: '#D64541' } as const;

interface ReportData {
  label: string;
  start: string;
  end: string;
  items: ReportItem[];
  parts: ReportPart[];
}

async function loadPdfMake() {
  const [{ default: pdfMake }, fonts] = await Promise.all([
    import('pdfmake/build/pdfmake'),
    import('pdfmake/build/vfs_fonts'),
  ]);
  // vfs_fonts exports the font table itself (CommonJS) – shape differs between bundlers
  type Vfs = Record<string, string>;
  const m = fonts as unknown as Vfs & { default?: Vfs & { pdfMake?: { vfs: Vfs } }; pdfMake?: { vfs: Vfs } };
  const candidates = [m.default, m.default?.pdfMake?.vfs, m.pdfMake?.vfs, m as Vfs];
  const vfs = candidates.find((c) => c && typeof c === 'object' && 'Roboto-Regular.ttf' in c) ?? {};
  (pdfMake as unknown as { vfs: Vfs }).vfs = vfs;
  return pdfMake;
}

export async function createReportPdf(report: ReportData, author: string): Promise<Blob> {
  const pdfMake = await loadPdfMake();
  const plants = [...new Set(report.items.map((i) => i.status.tag.plant).filter(Boolean))];
  const created = fmtDateTime(nowIso());
  const counts = {
    overdue: report.items.filter((i) => i.state === 'overdue').length,
    due: report.items.filter((i) => i.state === 'due').length,
    ok: report.items.filter((i) => i.state === 'ok').length,
  };

  const cell = (text: string, extra: object = {}) => ({ text, fontSize: 8.5, ...extra });
  const head = (text: string) => ({ text, bold: true, fontSize: 8, color: '#FFFFFF', fillColor: PRIMARY });

  const workTable: Content =
    report.items.length === 0
      ? { text: 'Keine Wartungen in diesem Zeitraum.', italics: true, color: MUTED, margin: [0, 4, 0, 12] }
      : {
          table: {
            headerRows: 1,
            dontBreakRows: true,
            widths: [48, 46, 52, '*', '*', 52, '*', 26],
            body: [
              ['Fällig', 'Status', 'Tag', 'Bezeichnung', 'Aufgabe', 'Intervall', 'Ersatzteile', 'Erl.'].map(head),
              ...report.items.map((it) => [
                cell(fmtDate(it.date)),
                cell(STATUS_LABELS[it.state], { bold: true, color: STATUS_COLORS[it.state] }),
                cell(it.status.tag.tagNumber, { bold: true }),
                cell([it.status.tag.description || it.status.tag.type, it.status.tag.location].filter(Boolean).join('\n')),
                cell(it.status.task.title),
                cell(intervalLabel(it.status.task.intervalValue, it.status.task.intervalUnit)),
                cell(it.parts.join('\n') || '–'),
                { canvas: [{ type: 'rect' as const, x: 4, y: 1, w: 10, h: 10, lineWidth: 0.8, lineColor: PRIMARY }] },
              ]),
            ],
          },
          layout: {
            fillColor: (row: number) => (row > 0 && row % 2 === 0 ? '#F4F5F7' : null),
            hLineColor: () => '#D9DDE3',
            vLineColor: () => '#D9DDE3',
            hLineWidth: () => 0.5,
            vLineWidth: () => 0.5,
            paddingTop: () => 3,
            paddingBottom: () => 3,
          },
          margin: [0, 4, 0, 14],
        };

  // spare parts grouped by supplier
  const groups = new Map<string, ReportPart[]>();
  for (const p of report.parts) {
    const k = p.supplier?.id ?? '-';
    groups.set(k, [...(groups.get(k) ?? []), p]);
  }
  const partBlocks: Content[] = [];
  for (const list of groups.values()) {
    const s = list[0].supplier;
    partBlocks.push({
      unbreakable: list.length < 8,
      stack: [
        { text: s?.name ?? 'Ohne Lieferant', bold: true, fontSize: 10, margin: [0, 6, 0, 1] },
        {
          text: [s?.orderEmail, s?.phone, s?.customerNumber ? `Kd.-Nr. ${s.customerNumber}` : ''].filter(Boolean).join(' · '),
          fontSize: 8,
          color: MUTED,
          margin: [0, 0, 0, 3],
        },
        {
          table: {
            headerRows: 1,
            widths: [34, '*', 80, 70, '*'],
            body: [
              ['Menge', 'Teil', 'Hersteller-Nr.', 'Bestell-Nr.', 'Für Tags'].map(head),
              ...list.map((p) => [
                cell(String(p.quantity), { bold: true, alignment: 'right' }),
                cell(p.part.name),
                cell(p.part.manufacturerPartNumber || '–'),
                cell(p.part.supplierOrderNumber || '–'),
                cell(p.tags.map((t) => t.tagNumber).join(', ')),
              ]),
            ],
          },
          layout: 'lightHorizontalLines',
        },
      ],
    });
  }

  const doc: TDocumentDefinitions = {
    pageSize: 'A4',
    pageMargins: [36, 78, 36, 48],
    info: { title: `Wartungsreport ${report.label}`, author, creator: 'ConnecTag' },
    defaultStyle: { font: 'Roboto', fontSize: 9, color: PRIMARY },
    header: () => ({
      margin: [36, 22, 36, 0],
      columns: [
        { svg: markLight, width: 34 },
        {
          stack: [
            { text: 'ConnecTag', bold: true, fontSize: 14 },
            { text: 'BRINGS YOUR TAG A LEVEL UP', fontSize: 6, color: MUTED, characterSpacing: 1.2 },
          ],
          margin: [6, 3, 0, 0],
          width: 'auto',
        },
        {
          stack: [
            { text: `Wartungsreport ${report.label}`, bold: true, fontSize: 11, alignment: 'right' },
            { text: plants.join(', ') || '–', fontSize: 8.5, color: ACCENT, bold: true, alignment: 'right' },
          ],
          margin: [0, 3, 0, 0],
        },
      ],
    }),
    footer: (page: number, pages: number) => ({
      margin: [36, 14, 36, 0],
      columns: [
        { text: `ConnecTag · Wartungsreport ${report.label} · erstellt ${created}`, fontSize: 7.5, color: MUTED },
        { text: `Seite ${page} von ${pages}`, fontSize: 7.5, color: MUTED, alignment: 'right' },
      ],
    }),
    content: [
      { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 523, y2: 0, lineWidth: 2, lineColor: ACCENT }], margin: [0, 0, 0, 10] },
      {
        columns: [
          { stack: [{ text: 'Zeitraum', fontSize: 7.5, color: MUTED }, { text: `${report.label} (${fmtDate(report.start)} – ${fmtDate(report.end)})`, bold: true }] },
          { stack: [{ text: 'Erstellt', fontSize: 7.5, color: MUTED }, { text: `${created}${author ? ` von ${author}` : ''}` }] },
          {
            stack: [
              { text: 'Übersicht', fontSize: 7.5, color: MUTED },
              {
                text: [
                  { text: `${counts.overdue} überfällig`, color: STATUS_COLORS.overdue, bold: true },
                  ' · ',
                  { text: `${counts.due} fällig`, color: STATUS_COLORS.due, bold: true },
                  ' · ',
                  { text: `${counts.ok} geplant`, color: STATUS_COLORS.ok, bold: true },
                ],
              },
            ],
          },
        ],
        margin: [0, 0, 0, 12],
      },
      { text: `Fällige Wartungen (${report.items.length})`, fontSize: 12, bold: true, margin: [0, 0, 0, 2] },
      workTable,
      { text: 'Benötigte Ersatzteile je Lieferant', fontSize: 12, bold: true, margin: [0, 4, 0, 2] },
      ...(partBlocks.length ? partBlocks : [{ text: 'Für diesen Zeitraum werden keine Ersatzteile benötigt.', italics: true, color: MUTED }]),
    ],
  };

  return new Promise<Blob>((resolve) => pdfMake.createPdf(doc).getBlob((b: Blob) => resolve(b)));
}
