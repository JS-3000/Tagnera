// Inbox for fault reports (administrators).
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useData } from '../app/hooks';
import { useSession } from '../app/session';
import { Icon } from '../components/Icon';
import { Empty, FileViewer, StoredImage, toast } from '../components/ui';
import { data } from '../data';
import { ISSUE_STATUS_LABELS, type IssueReport, type IssueStatus } from '../data/types';
import { fmtDateTime } from '../lib/util';
import { setIssueStatus, takeOverIssue } from '../services/issues';

type Filter = 'open' | 'done' | 'all';

export function IssuesPage() {
  const { can, user } = useSession();
  const [filter, setFilter] = useState<Filter>('open');
  const [photo, setPhoto] = useState<string | null>(null);
  const issues = useData(
    () =>
      data.issues.list().then((l) =>
        l.sort((a, b) => (a.status === 'new' ? 0 : 1) - (b.status === 'new' ? 0 : 1) || b.createdAt.localeCompare(a.createdAt)),
      ),
    [],
  );
  const tags = useData(() => data.tags.list(), []);
  if (!can('admin')) return <Empty>Meldungen sind Administratoren vorbehalten.</Empty>;

  const tagOf = (i: IssueReport) => tags?.find((t) => t.id === i.tagId);
  const visible = (issues ?? []).filter((i) => (filter === 'all' ? true : filter === 'done' ? i.status === 'done' : i.status !== 'done'));
  const count = (f: Filter) => (issues ?? []).filter((i) => (f === 'all' ? true : f === 'done' ? i.status === 'done' : i.status !== 'done')).length;

  return (
    <div>
      <div className="page-head">
        <h1>Meldungen</h1>
      </div>
      <div className="segmented" style={{ marginBottom: 16, maxWidth: 520 }}>
        {(['open', 'done', 'all'] as Filter[]).map((f) => (
          <button key={f} className={filter === f ? 'on' : ''} onClick={() => setFilter(f)}>
            {{ open: 'Offen', done: 'Erledigt', all: 'Alle' }[f]} ({count(f)})
          </button>
        ))}
      </div>
      {issues === undefined ? (
        <Empty>Lädt …</Empty>
      ) : visible.length === 0 ? (
        <Empty>Keine Meldungen.</Empty>
      ) : (
        <div className="issue-grid">
          {visible.map((i) => {
            const t = tagOf(i);
            return (
              <article key={i.id} className={`card issue ${i.status}`}>
                <div className="issue-head">
                  <span className={`issue-status ${i.status}`}>{ISSUE_STATUS_LABELS[i.status]}</span>
                  <span className="small muted">{fmtDateTime(i.createdAt)}</span>
                </div>
                <div style={{ margin: '6px 0' }}>
                  <Link to={`/t/${i.tagId}`}>
                    <b>{i.tagNumber}</b>
                  </Link>{' '}
                  <span className="small muted">{t ? t.description || t.type : 'Tag nicht mehr vorhanden'}</span>
                </div>
                <p style={{ margin: '0 0 8px', whiteSpace: 'pre-wrap' }}>{i.description}</p>
                <div className="small">
                  <b>{i.name}</b>
                  {i.phone && (
                    <>
                      {' · '}
                      <a href={`tel:${i.phone.replace(/[^+\d]/g, '')}`}>{i.phone}</a>
                    </>
                  )}
                </div>
                {i.photoFileId && (
                  <StoredImage fileId={i.photoFileId} alt="Foto zur Meldung" className="thumb issue-photo" onClick={() => setPhoto(i.photoFileId)} />
                )}
                <div className="actions" style={{ marginTop: 12 }}>
                  {i.status !== 'done' && (
                    <button
                      className="btn btn-primary"
                      onClick={async () => {
                        await takeOverIssue(i, user?.name ?? '');
                        toast('Als Tagebucheintrag übernommen – Meldung erledigt');
                      }}
                    >
                      <Icon name="wrench" /> Als Tagebucheintrag übernehmen
                    </button>
                  )}
                  <select
                    value={i.status}
                    onChange={(e) => setIssueStatus(i, e.target.value as IssueStatus)}
                    aria-label="Status"
                  >
                    {(Object.keys(ISSUE_STATUS_LABELS) as IssueStatus[]).map((s) => (
                      <option key={s} value={s}>
                        Status: {ISSUE_STATUS_LABELS[s]}
                      </option>
                    ))}
                  </select>
                </div>
                {i.logEntryId && <p className="small muted" style={{ marginBottom: 0 }}>Im Tagebuch des Bauteils eingetragen.</p>}
              </article>
            );
          })}
        </div>
      )}
      {photo && <FileViewer fileId={photo} mimeType="image/jpeg" name="Foto" onClose={() => setPhoto(null)} />}
    </div>
  );
}
