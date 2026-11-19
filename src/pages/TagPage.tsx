import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useData, useMedia, useTitle } from '../app/hooks';
import { Columns } from '../components/Columns';
import { useSession } from '../app/session';
import { DocumentList } from '../components/Documents';
import { Icon } from '../components/Icon';
import { OrderModal } from '../components/OrderModal';
import { QrCode } from '../components/QrCode';
import { Empty, FileViewer, Modal, StatusBadge, StoredImage } from '../components/ui';
import { LOG_KIND_LABELS, type LogEntry, type SparePart, type Supplier } from '../data/types';
import { fmtDate, isUuid } from '../lib/util';
import { describeDue, intervalLabel, worstStatus, type TaskStatus } from '../services/maintenance';
import { isDemoTag } from '../services/demoData';
import { openIssuesForTag } from '../services/issues';
import { isScanned } from '../services/scanProof';
import { rememberScan, tagUrl } from '../services/settings';
import { deleteLogEntry, loadTagDetail, type TagDetail } from '../services/tags';

export function TagPage() {
  const { id = '' } = useParams();
  const { isPublic, ready } = useSession();
  const detail = useData(() => loadTagDetail(id), [id]);

  useEffect(() => {
    if (detail) rememberScan(detail.tag.id);
  }, [detail]);

  if (detail === undefined) return <Empty>Lädt …</Empty>;
  if (detail === null) return <UnknownTag id={id} />;
  if (!ready) return <Empty>Lädt …</Empty>;
  if (isPublic) return <PublicTagView d={detail} />;
  return <TagView d={detail} />;
}

/** Without an account: only tag number, description and "Störung melden". */
function PublicTagView({ d }: { d: TagDetail }) {
  const { tag } = d;
  useTitle(tag.tagNumber);
  return (
    <div className="narrow" style={{ maxWidth: 640, margin: '0 auto' }}>
      <section className="tag-head public-card">
        <div className="tagno">{tag.tagNumber}</div>
        <div style={{ fontSize: '1.15rem', fontWeight: 600, marginTop: 4 }}>{tag.type}</div>
        {tag.description && <div style={{ opacity: 0.85 }}>{tag.description}</div>}
        {tag.plant && (
          <div className="plant" style={{ marginTop: 6 }}>
            {tag.plant}
          </div>
        )}
      </section>
      <div className="actions" style={{ gridTemplateColumns: '1fr' }}>
        <Link className="btn btn-primary btn-lg" to={`/t/${tag.id}/meldung`}>
          <Icon name="bell" /> Störung melden
        </Link>
        <Link className="btn btn-lg" to={`/anmelden?back=${encodeURIComponent(`/t/${tag.id}`)}`}>
          <Icon name="users" /> Anmelden (Demo)
        </Link>
      </div>
      <p className="small muted" style={{ textAlign: 'center', marginTop: 16 }}>
        Mit Account sehen Sie die vollständige Bauteilakte: Wartung, Tagebuch, Dokumente, Ersatzteile.
      </p>
    </div>
  );
}

function UnknownTag({ id }: { id: string }) {
  const { can } = useSession();
  const valid = isUuid(id);
  return (
    <div>
      <div className="alert due">
        <div>
          <div className="title">Unbekannter QR-Code</div>
          <div className="small">
            Zu diesem Code gibt es auf diesem Gerät noch keinen Tag.
            <br />
            <span className="mono" style={{ wordBreak: 'break-all' }}>
              {id}
            </span>
          </div>
        </div>
      </div>
      {valid && can('edit') ? (
        <Link className="btn btn-primary btn-lg btn-block" to={`/tags/neu?id=${id}`} style={{ marginBottom: 12 }}>
          <Icon name="plus" /> Neuen Tag mit diesem Code anlegen
        </Link>
      ) : (
        <p className="muted">
          {valid
            ? 'Nur Bearbeiter oder Administratoren können hier einen neuen Tag anlegen.'
            : 'Der Code enthält keine gültige Tag-ID.'}
        </p>
      )}
      <Link className="btn btn-block" to="/scan?scan=1">
        <Icon name="scan" /> Erneut scannen
      </Link>
    </div>
  );
}

function TagView({ d }: { d: TagDetail }) {
  const { can } = useSession();
  const navigate = useNavigate();
  const { tag, product } = d;
  const [order, setOrder] = useState<{ part: SparePart; supplier: Supplier | null } | null>(null);
  const [showQr, setShowQr] = useState(false);
  const status = d.tasks.length ? worstStatus(d.tasks) : null;
  const wide = useMedia('(min-width: 1100px)');
  const openIssues = useData(() => openIssuesForTag(tag.id), [tag.id]);
  // editors complete maintenance only after scanning the QR code at the component
  const mayComplete = can('admin') || (can('edit') && isScanned(tag.id));
  useTitle(tag.tagNumber);

  const supportSection = (cls: string, id?: string) => (
    <section className={`card ${cls}`} id={id}>
      <div className="section-head">
        <h2>
          <Icon name="phone" /> Support-Kontakt
        </h2>
      </div>
      {d.support ? (
        <>
          {d.support.name && <p style={{ marginTop: 0, fontWeight: 700 }}>{d.support.name}</p>}
          <div className="actions">
            {d.support.phone && (
              <a className="btn btn-dark btn-lg" href={`tel:${d.support.phone.replace(/[^+\d]/g, '')}`}>
                <Icon name="phone" /> {d.support.phone}
              </a>
            )}
            {d.support.email && (
              <a
                className="btn btn-lg"
                href={`mailto:${d.support.email}?subject=${encodeURIComponent(`Support-Anfrage ${tag.tagNumber} (${tag.type})`)}&body=${encodeURIComponent(`Tag: ${tag.tagNumber}\nAnlage: ${tag.plant}\nHersteller/Art.-Nr.: ${tag.manufacturer} ${tag.articleNumber}\nLink: ${tagUrl(tag.id)}\n\nAnliegen:\n`)}`}
              >
                <Icon name="mail" /> E-Mail
              </a>
            )}
          </div>
          <p className="small muted" style={{ marginBottom: 0 }}>
            {d.support.source === 'product' ? 'Kontakt aus der Produktvorlage' : 'Kontakt speziell für diesen Tag'}
          </p>
        </>
      ) : (
        <Empty>Kein Support-Kontakt hinterlegt.</Empty>
      )}
    </section>
  );

  return (
    <div className="tag-layout">
      <Columns
        left="0.8fr"
        right="1.2fr"
        tiles={[
          {
            key: 'head',
            col: 'left',
            order: 1,
            node: (
              <header className="tag-head">
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                  <div style={{ flex: 1 }}>
                    <div className="tagno">{tag.tagNumber}</div>
                    <div style={{ fontSize: '1.1rem', fontWeight: 600 }}>
                      {tag.type}
                      {tag.description && <span style={{ fontWeight: 400, opacity: 0.85 }}> – {tag.description}</span>}
                    </div>
                    {tag.plant && <div className="plant">{tag.plant}</div>}
                    {isDemoTag(tag.id) && (
                      <div className="demo-note" title="Wartungsintervalle, FAQ und Ersatzteile sind Beispielwerte">
                        Demo-Daten · Intervalle, FAQ und Ersatzteile sind Beispielwerte
                      </div>
                    )}
                  </div>
                  <StatusBadge status={status} />
                </div>
                <dl className="meta">
                  <dt>Hersteller</dt>
                  <dd>{tag.manufacturer || '–'}</dd>
                  <dt>Artikel-Nr.</dt>
                  <dd>
                    {tag.articleNumber || '–'}
                    {product && can('admin') && (
                      <>
                        {' '}
                        <Link to={`/katalog/${product.id}`} style={{ color: 'var(--accent)', fontWeight: 400 }}>
                          (Vorlage)
                        </Link>
                      </>
                    )}
                  </dd>
                  {d.orderNumber && (
                    <>
                      <dt>Bestell-Nr.</dt>
                      <dd>{d.orderNumber}</dd>
                    </>
                  )}
                  {tag.location && (
                    <>
                      <dt>Standort</dt>
                      <dd>{tag.location}</dd>
                    </>
                  )}
                </dl>
              </header>
            ),
          },
          {
            key: 'next',
            col: 'left',
            order: 2,
            node: d.tasks.length > 0 && <NextMaintenance tasks={d.tasks} tagId={tag.id} />,
          },
          {
            key: 'issues',
            col: 'left',
            order: 3,
            node: openIssues && openIssues.length > 0 && (
              <div className="alert overdue">
                <Icon name="bell" size={26} />
                <div style={{ flex: 1 }}>
                  <div className="title">
                    {openIssues.length === 1 ? '1 offene Meldung' : `${openIssues.length} offene Meldungen`}
                  </div>
                  <div className="small">{openIssues[0].description.slice(0, 90)}</div>
                </div>
                {can('admin') && (
                  <Link className="btn btn-sm" to="/meldungen">
                    Ansehen
                  </Link>
                )}
              </div>
            ),
          },
          {
            key: 'actions',
            col: 'left',
            order: 4,
            node: (
              <div className="actions">
                {can('edit') && (
                  <Link className="btn btn-primary btn-lg" to={`/t/${tag.id}/eintrag`}>
                    <Icon name="plus" /> Eintrag hinzufügen
                  </Link>
                )}
                <Link className="btn btn-dark btn-lg" to="/scan?scan=1">
                  <Icon name="scan" /> Nächstes Bauteil scannen
                </Link>
                <Link className="btn" to={`/t/${tag.id}/meldung`}>
                  <Icon name="bell" /> Störung melden
                </Link>
              </div>
            ),
          },
          {
            key: 'qr',
            col: 'left',
            order: 98,
            node: wide && (
              <section className="card no-print">
                <div className="qr-card">
                  <QrCode text={tagUrl(tag.id)} />
                  <div className="actions" style={{ flex: 1, gridTemplateColumns: '1fr' }}>
                    <Link className="btn btn-sm" to={`/etiketten?tags=${tag.id}`}>
                      <Icon name="printer" size={18} /> Etikett drucken
                    </Link>
                    {can('edit') && (
                      <Link className="btn btn-sm" to={`/tags/${tag.id}/bearbeiten`}>
                        <Icon name="edit" size={18} /> Tag bearbeiten
                      </Link>
                    )}
                  </div>
                </div>
              </section>
            ),
          },
          { key: 'support', col: 'left', order: 90, node: supportSection('', 'support') },
          {
            key: 'jump',
            col: 'right',
            order: 5,
            node: !wide && (
              <nav className="jump no-print" aria-label="Bereiche">
                <a href="#wartung" onClick={jump}>
                  Wartung
                </a>
                <a href="#tagebuch" onClick={jump}>
                  Tagebuch
                </a>
                <a href="#dokumente" onClick={jump}>
                  Dokumente
                </a>
                <a href="#faq" onClick={jump}>
                  FAQ
                </a>
                <a href="#ersatzteile" onClick={jump}>
                  Ersatzteile
                </a>
                <a href="#support" onClick={jump}>
                  Support
                </a>
              </nav>
            ),
          },
          {
            key: 'wartung',
            col: 'right',
            order: 10,
            node: (
              <section className="card" id="wartung">
                <div className="section-head">
                  <h2>
                    <Icon name="calendar" /> Wartung
                  </h2>
                </div>
                {d.tasks.length === 0 && <Empty>Keine Wartungsaufgaben hinterlegt.</Empty>}
                <ul className="list">
                  {d.tasks.map((s) => (
                    <li key={s.task.id} className="list-item" style={{ alignItems: 'flex-start' }}>
                      <div className="grow">
                        <div className="title">{s.task.title}</div>
                        <div className="small muted">
                          {intervalLabel(s.task.intervalValue, s.task.intervalUnit)} · zuletzt:{' '}
                          {s.lastDone ? fmtDate(s.lastDone) : `nie (ab Inbetriebnahme ${fmtDate(s.startDate)})`}
                        </div>
                        <div className="small">
                          Fällig am <b>{fmtDate(s.dueDate)}</b> ({describeDue(s)})
                        </div>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-end' }}>
                        <StatusBadge status={s.status} />
                        {mayComplete && (
                          <Link className="btn btn-sm" to={`/t/${tag.id}/eintrag?task=${s.task.id}`}>
                            <Icon name="check" size={18} /> Erledigt
                          </Link>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            ),
          },
          {
            key: 'tagebuch',
            col: 'right',
            order: 11,
            node: (
              <section className="card" id="tagebuch">
                <div className="section-head">
                  <h2>
                    <Icon name="wrench" /> Tagebuch
                  </h2>
                  {can('edit') && (
                    <Link className="btn btn-sm" to={`/t/${tag.id}/eintrag`}>
                      <Icon name="plus" size={18} /> Eintrag
                    </Link>
                  )}
                </div>
                <Diary entries={d.entries} tasks={d.tasks} canDelete={can('admin')} />
              </section>
            ),
          },
          {
            key: 'dokumente',
            col: 'right',
            order: 12,
            node: (
              <section className="card" id="dokumente">
                <div className="section-head">
                  <h2>
                    <Icon name="doc" /> Dokumente
                  </h2>
                </div>
                <DocumentList
                  docs={d.documents}
                  owner={{ ownerType: 'tag', ownerId: tag.id }}
                  canAdd={can('edit')}
                  canManage={(doc) => (doc.inherited ? can('admin') : can('edit'))}
                />
              </section>
            ),
          },
          {
            key: 'ersatzteile',
            col: 'right',
            order: 13,
            node: (
              <section className="card" id="ersatzteile">
                <div className="section-head">
                  <h2>
                    <Icon name="box" /> Ersatzteile
                  </h2>
                </div>
                {d.spareParts.length === 0 && <Empty>Keine Ersatzteile hinterlegt.</Empty>}
                <ul className="list">
                  {d.spareParts.map((p) => (
                    <li key={p.id} className="list-item wrap" style={{ alignItems: 'flex-start' }}>
                      <div className="grow">
                        <div className="title">{p.name}</div>
                        <dl className="kv small" style={{ margin: '4px 0 0' }}>
                          <dt>Hersteller-Nr.</dt>
                          <dd className="mono">{p.manufacturerPartNumber || '–'}</dd>
                          <dt>Bestell-Nr.</dt>
                          <dd className="mono">{p.supplierOrderNumber || '–'}</dd>
                          <dt>Lieferant</dt>
                          <dd>{p.supplier?.name ?? '–'}</dd>
                          {p.notes && (
                            <>
                              <dt>Hinweis</dt>
                              <dd>{p.notes}</dd>
                            </>
                          )}
                        </dl>
                      </div>
                      {can('edit') && (
                        <div className="item-actions">
                          <button
                            className="btn btn-primary"
                            onClick={() => setOrder({ part: p, supplier: p.supplier })}
                          >
                            <Icon name="cart" /> Bestellen
                          </button>
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              </section>
            ),
          },
          {
            key: 'faq',
            col: 'right',
            order: 14,
            node: (
              <section className="card" id="faq">
                <div className="section-head">
                  <h2>
                    <Icon name="help" /> FAQ
                  </h2>
                </div>
                {d.faqs.length === 0 && <Empty>Keine Fragen hinterlegt.</Empty>}
                {d.faqs.map((f) => (
                  <details key={f.id} className="acc">
                    <summary>{f.question}</summary>
                    <div className="acc-body">{f.answer}</div>
                  </details>
                ))}
              </section>
            ),
          },
          {
            key: 'more',
            col: 'left',
            order: 99,
            node: !wide && (
              <div className="actions two no-print">
                <button className="btn" onClick={() => setShowQr(true)}>
                  <Icon name="qr" /> QR-Code
                </button>
                {can('edit') && (
                  <button className="btn" onClick={() => navigate(`/tags/${tag.id}/bearbeiten`)}>
                    <Icon name="edit" /> Bearbeiten
                  </button>
                )}
              </div>
            ),
          },
        ]}
      />

      {order && <OrderModal tag={tag} part={order.part} supplier={order.supplier} onClose={() => setOrder(null)} />}
      {showQr && (
        <Modal title={`QR-Code ${tag.tagNumber}`} onClose={() => setShowQr(false)}>
          <QrCode text={tagUrl(tag.id)} style={{ maxWidth: 280, margin: '0 auto 12px' }} />
          <p className="small muted mono" style={{ wordBreak: 'break-all', textAlign: 'center' }}>
            {tagUrl(tag.id)}
          </p>
          <Link className="btn btn-block" to={`/etiketten?tags=${tag.id}`}>
            <Icon name="printer" /> Etikett drucken
          </Link>
        </Modal>
      )}
    </div>
  );
}

/** Smooth scroll to a section without changing the hash route. */
function jump(e: React.MouseEvent<HTMLAnchorElement>) {
  e.preventDefault();
  const id = e.currentTarget.getAttribute('href')!.slice(1);
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function NextMaintenance({ tasks, tagId }: { tasks: TaskStatus[]; tagId: string }) {
  const { can } = useSession();
  if (tasks.length === 0) return null;
  // most urgent first: overdue, then due, then earliest date
  const next = [...tasks].sort((a, b) => a.dueDate.localeCompare(b.dueDate))[0];
  const cls = next.status === 'overdue' ? 'overdue' : next.status === 'due' ? 'due' : '';
  const more = tasks.filter((t) => t.status !== 'ok').length - (next.status !== 'ok' ? 1 : 0);
  return (
    <div className={`alert ${cls}`}>
      <Icon name="calendar" size={28} />
      <div style={{ flex: 1 }}>
        <div className="title">
          {next.status === 'overdue'
            ? 'Wartung überfällig'
            : next.status === 'due'
              ? 'Wartung fällig'
              : 'Nächste Wartung'}
          : {next.task.title}
        </div>
        <div>
          {fmtDate(next.dueDate)} – {describeDue(next)}
          {more > 0 && ` · ${more} weitere fällig`}
        </div>
      </div>
      {(can('admin') || (can('edit') && isScanned(tagId))) && next.status !== 'ok' && (
        <Link className="btn btn-sm" to={`/t/${tagId}/eintrag?task=${next.task.id}`}>
          Erledigt
        </Link>
      )}
    </div>
  );
}

function Diary({ entries, tasks, canDelete }: { entries: LogEntry[]; tasks: TaskStatus[]; canDelete: boolean }) {
  const [photo, setPhoto] = useState<string | null>(null);
  const titleOf = (id: string) => tasks.find((t) => t.task.id === id)?.task.title ?? 'Wartungsaufgabe';
  if (entries.length === 0) return <Empty>Noch keine Einträge.</Empty>;
  return (
    <div>
      {entries.map((e) => (
        <article key={e.id} className="entry">
          <div className="entry-head">
            <span className="kind">{LOG_KIND_LABELS[e.kind]}</span>
            <span className="muted small">
              {fmtDate(e.date)} · {e.person || 'unbekannt'}
            </span>
            {e.source === 'scan' && (
              <span className="src-badge scan" title="Eintrag nach QR-Scan am Bauteil erstellt">
                <Icon name="scan" size={14} /> per Scan erfasst
              </span>
            )}
            {e.source === 'manual' && (
              <span className="src-badge manual" title="Eintrag ohne QR-Scan erstellt">
                ohne Scan erfasst
              </span>
            )}
            {canDelete && (
              <button
                className="icon-btn"
                style={{ marginLeft: 'auto', width: 40, height: 40 }}
                aria-label="Eintrag löschen"
                onClick={() => confirm('Eintrag löschen?') && deleteLogEntry(e)}
              >
                <Icon name="trash" size={18} />
              </button>
            )}
          </div>
          <div style={{ whiteSpace: 'pre-wrap' }}>{e.description}</div>
          {e.completedTaskIds.length > 0 && (
            <div className="done-tasks">✓ Erledigt: {e.completedTaskIds.map(titleOf).join(', ')}</div>
          )}
          {e.photoFileId && (
            <StoredImage
              fileId={e.photoFileId}
              alt="Foto zum Eintrag"
              className="thumb"
              onClick={() => setPhoto(e.photoFileId)}
            />
          )}
        </article>
      ))}
      {photo && <FileViewer fileId={photo} mimeType="image/jpeg" name="Foto" onClose={() => setPhoto(null)} />}
    </div>
  );
}
