import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useData, useMedia } from '../app/hooks';
import { useSession } from '../app/session';
import { Icon } from '../components/Icon';
import { Empty, StatusBadge } from '../components/ui';
import { fmtDate, fmtDateTime, nowIso } from '../lib/util';
import { intervalLabel } from '../services/maintenance';
import {
  buildReport,
  collectiveOrderMail,
  currentPeriod,
  monthName,
  type Period,
  type PeriodKind,
  type ReportPart,
} from '../services/report';
import { tr } from '../i18n';

export function ReportPage() {
  const { user, can } = useSession();
  const [period, setPeriod] = useState<Period>(() => currentPeriod('month'));
  const wide = useMedia('(min-width: 900px)');
  const navigate = useNavigate();
  const [pdfBusy, setPdfBusy] = useState(false);
  const report = useData(() => buildReport(period), [period.kind, period.year, period.index]);

  // real A4 PDF (pdfmake, loaded on demand) – opens in the in-app viewer with download button
  const makePdf = async () => {
    if (!report) return;
    setPdfBusy(true);
    try {
      const { createReportPdf } = await import('../services/reportPdf');
      const blob = await createReportPdf(report, user?.name ?? '');
      const url = URL.createObjectURL(blob);
      const q = new URLSearchParams({ src: url, name: `Wartungsreport ${report.label}.pdf`, back: '/report' });
      navigate(`/viewer?${q.toString()}`);
    } catch (e) {
      alert(tr('PDF konnte nicht erstellt werden: ') + (e instanceof Error ? e.message : String(e)));
    } finally {
      setPdfBusy(false);
    }
  };

  const setKind = (kind: PeriodKind) => setPeriod({ ...currentPeriod(kind), year: period.year });
  const step = (dir: -1 | 1) => {
    const max = period.kind === 'month' ? 12 : 4;
    let { year, index } = period;
    index += dir;
    if (index < 1) {
      index = max;
      year--;
    } else if (index > max) {
      index = 1;
      year++;
    }
    setPeriod({ ...period, year, index });
  };

  // group parts by supplier for collective orders
  const bySupplier = new Map<string, ReportPart[]>();
  for (const p of report?.parts ?? []) {
    if (!p.supplier?.orderEmail) continue;
    bySupplier.set(p.supplier.id, [...(bySupplier.get(p.supplier.id) ?? []), p]);
  }

  return (
    <div>
      <div className="page-head no-print">
        <h1>{tr('Wartungsreport')}</h1>
        <Link className="btn" to="/kalender">
          <Icon name="calendar" /> {tr('Kalender')}
        </Link>
        <button className="btn btn-primary" onClick={makePdf} disabled={!report || pdfBusy}>
          <Icon name="printer" /> {pdfBusy ? tr('PDF wird erstellt …') : tr('Drucken / PDF')}
        </button>
      </div>

      <section className="card no-print">
        <div className="segmented" style={{ marginBottom: 12 }}>
          <button className={period.kind === 'month' ? 'on' : ''} onClick={() => setKind('month')}>
            {tr('Monat')}
          </button>
          <button className={period.kind === 'quarter' ? 'on' : ''} onClick={() => setKind('quarter')}>
            {tr('Quartal')}
          </button>
        </div>
        <div className="period-row">
          <button className="btn" onClick={() => step(-1)} aria-label={tr('Zurück')}>
            ‹
          </button>
          <select
            value={period.index}
            onChange={(e) => setPeriod({ ...period, index: Number(e.target.value) })}
            aria-label={period.kind === 'month' ? tr('Monat') : tr('Quartal')}
          >
            {Array.from({ length: period.kind === 'month' ? 12 : 4 }, (_, i) => i + 1).map((i) => (
              <option key={i} value={i}>
                {period.kind === 'month' ? monthName(i) : tr('{{n}}. Quartal', { n: i })}
              </option>
            ))}
          </select>
          <input
            type="number"
            value={period.year}
            onChange={(e) => setPeriod({ ...period, year: Number(e.target.value) || period.year })}
            aria-label={tr('Jahr')}
          />
          <button className="btn" onClick={() => step(1)} aria-label={tr('Weiter')}>
            ›
          </button>
        </div>
      </section>

      {!report ? (
        <Empty>{tr('Lädt …')}</Empty>
      ) : (
        <>
          <div className="report-title">
            <img
              src={`${import.meta.env.BASE_URL}logo.svg`}
              alt={tr('ConnecTag')}
              className="print-only"
              style={{ height: 28, marginBottom: 8 }}
            />
            <h2 style={{ fontSize: '1.4rem' }}>
              {tr('Wartungsreport')} {report.label}{' '}
              <span className="muted small" style={{ fontWeight: 400 }}>
                ({fmtDate(report.start)} – {fmtDate(report.end)})
              </span>
            </h2>
            <p className="print-only small">
              {tr('Erstellt am')} {fmtDateTime(nowIso())} {tr('von')} {user?.name}
            </p>
          </div>

          <section className="card">
            <h2>
              {tr('Fällige Arbeiten (')}
              {report.items.length})
            </h2>
            {report.items.length === 0 ? (
              <Empty>{tr('Keine Wartungen in diesem Zeitraum.')}</Empty>
            ) : wide ? (
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>{tr('Fällig')}</th>
                      <th>{tr('Tag')}</th>
                      <th>{tr('Anlage / Standort')}</th>
                      <th>{tr('Aufgabe')}</th>
                      <th>{tr('Intervall')}</th>
                      <th>{tr('Erledigt')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.items.map((it, i) => (
                      <tr key={i}>
                        <td className="nowrap">
                          {fmtDate(it.date)}
                          {it.overdue && (
                            <div>
                              <span className="status status-overdue">{tr('Überfällig')}</span>
                            </div>
                          )}
                        </td>
                        <td>
                          <Link to={`/t/${it.status.tag.id}`}>
                            <b>{it.status.tag.tagNumber}</b>
                          </Link>
                          <div className="small muted">{it.status.tag.type}</div>
                        </td>
                        <td>
                          {it.status.tag.plant}
                          <div className="small muted">{it.status.tag.location}</div>
                        </td>
                        <td>
                          {it.status.task.title}
                          {it.status.task.description && (
                            <div className="small muted">{it.status.task.description}</div>
                          )}
                        </td>
                        <td className="small">
                          {intervalLabel(it.status.task.intervalValue, it.status.task.intervalUnit)}
                        </td>
                        <td style={{ fontSize: '1.4rem' }}>☐</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div>
                {report.items.map((it, i) => (
                  <article key={i} className={`report-card ${it.state}`}>
                    <div className="rc-head">
                      <div>
                        <Link to={`/t/${it.status.tag.id}`}>
                          <b>{it.status.tag.tagNumber}</b>
                        </Link>{' '}
                        <span className="small muted">{it.status.tag.description || it.status.tag.type}</span>
                      </div>
                      <StatusBadge status={it.state} />
                    </div>
                    <div style={{ marginTop: 4, fontWeight: 600 }}>{it.status.task.title}</div>
                    <div className="small">
                      {tr('Fällig am')} <b>{fmtDate(it.date)}</b> ·{' '}
                      {intervalLabel(it.status.task.intervalValue, it.status.task.intervalUnit)}
                    </div>
                    {it.parts.length > 0 && (
                      <div className="small muted">
                        {tr('Ersatzteile:')} {it.parts.join(', ')}
                      </div>
                    )}
                  </article>
                ))}
              </div>
            )}
          </section>

          <section className="card">
            <h2>{tr('Benötigte Ersatzteile')}</h2>
            {report.parts.length === 0 ? (
              <Empty>{tr('Für diesen Zeitraum werden keine Ersatzteile benötigt.')}</Empty>
            ) : (
              <div className="table-wrap">
                <table className="table stack">
                  <thead>
                    <tr>
                      <th>{tr('Menge')}</th>
                      <th>{tr('Teil')}</th>
                      <th>{tr('Hersteller-Nr.')}</th>
                      <th>{tr('Bestell-Nr.')}</th>
                      <th>{tr('Lieferant')}</th>
                      <th>{tr('Für Tags')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.parts.map((p) => (
                      <tr key={p.part.id}>
                        <td data-label={tr('Menge')}>
                          <b>{p.quantity}</b>
                        </td>
                        <td data-label={tr('Teil')}>{p.part.name}</td>
                        <td data-label={tr('Hersteller-Nr.')} className="mono small">
                          {p.part.manufacturerPartNumber}
                        </td>
                        <td data-label={tr('Bestell-Nr.')} className="mono small">
                          {p.part.supplierOrderNumber}
                        </td>
                        <td data-label={tr('Lieferant')}>{p.supplier?.name ?? '–'}</td>
                        <td data-label={tr('Für Tags')} className="small">
                          {p.tags.map((t) => t.tagNumber).join(', ')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {can('edit') && bySupplier.size > 0 && (
              <div className="actions no-print" style={{ marginTop: 12 }}>
                {[...bySupplier.values()].map((list) => (
                  <a
                    key={list[0].supplier!.id}
                    className="btn"
                    href={collectiveOrderMail(list[0].supplier!, list, report.label, user?.name ?? '')}
                  >
                    <Icon name="mail" /> {tr('Sammelbestellung')} {list[0].supplier!.name}
                  </a>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
