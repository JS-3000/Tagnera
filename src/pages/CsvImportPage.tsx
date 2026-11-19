import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useData } from '../app/hooks';
import { useSession } from '../app/session';
import { Icon } from '../components/Icon';
import { Empty, Field } from '../components/ui';
import { data } from '../data';
import { downloadBlob, normalizeKey } from '../lib/util';
import {
  guessMapping,
  importTags,
  readCsv,
  rowToValues,
  TARGET_FIELDS,
  type ImportResult,
  type Mapping,
  type ParsedCsv,
  type TargetField,
} from '../services/csvImport';
import { productKeys } from '../services/tags';
import { tr } from '../i18n';

export function CsvImportPage() {
  const { can } = useSession();
  const [file, setFile] = useState<File | null>(null);
  const [hasHeader, setHasHeader] = useState(true);
  const [parsed, setParsed] = useState<ParsedCsv | null>(null);
  const [mapping, setMapping] = useState<Mapping>({});
  const [updateExisting, setUpdateExisting] = useState(false);
  const [defaultPlant, setDefaultPlant] = useState('');
  const [result, setResult] = useState<ImportResult | null>(null);
  const [busy, setBusy] = useState(false);
  const products = useData(() => data.products.list(), []);
  const existing = useData(() => data.tags.list(), []);

  const load = async (f: File, header: boolean) => {
    const p = await readCsv(f, header);
    setParsed(p);
    setMapping(guessMapping(p.headers));
    setResult(null);
  };

  const preview = useMemo(
    () => (parsed ? parsed.rows.slice(0, 6).map((r) => rowToValues(r, mapping)) : []),
    [parsed, mapping],
  );
  const existingKeys = useMemo(() => new Set((existing ?? []).map((t) => normalizeKey(t.tagNumber))), [existing]);
  const productKeySet = useMemo(() => new Set((products ?? []).flatMap(productKeys)), [products]);

  if (!can('admin')) return <Empty>{tr('Der CSV-Import ist Administratoren vorbehalten.')}</Empty>;

  const mapped = (k: TargetField) => mapping[k] !== undefined && mapping[k]! >= 0;

  return (
    <div>
      <div className="page-head">
        <h1>{tr('Tags aus CSV importieren')}</h1>
        <button
          className="btn btn-sm"
          onClick={() =>
            downloadBlob(
              new Blob(
                [
                  '﻿Tag;Typ;Bezeichnung;Anlage;Standort;Hersteller;Artikelnummer;Bestellnummer;Inbetriebnahme\nHV-2001;Handventil;Absperrung Zulauf;Wasseraufbereitung;Halle 3;Kieselmann;567;;01.03.2025\nP-201;Pumpe;Druckerhöhung;Wasseraufbereitung;Halle 3;Grundfos;CR 10-4;;15.04.2025\n',
                ],
                { type: 'text/csv;charset=utf-8' },
              ),
              'connectag-vorlage.csv',
            )
          }
        >
          <Icon name="download" size={18} /> {tr('Beispiel-CSV')}
        </button>
      </div>

      <section className="card">
        <h2>{tr('1. Datei wählen')}</h2>
        <div className="btn-row">
          <label className="btn btn-primary">
            <Icon name="upload" /> {tr('CSV-Datei auswählen')}
            <input
              type="file"
              accept=".csv,text/csv,text/plain"
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = '';
                if (!f) return;
                setFile(f);
                void load(f, hasHeader);
              }}
            />
          </label>
          {file && <span className="muted">{file.name}</span>}
        </div>
        <label className={`check${hasHeader ? ' checked' : ''}`} style={{ marginTop: 12 }}>
          <input
            type="checkbox"
            checked={hasHeader}
            onChange={(e) => {
              setHasHeader(e.target.checked);
              if (file) void load(file, e.target.checked);
            }}
          />
          {tr('Erste Zeile enthält Spaltenüberschriften')}
        </label>
        <p className="small muted" style={{ marginBottom: 0 }}>
          {tr(
            'Trennzeichen (Semikolon, Komma, Tab) und Zeichensatz (UTF-8 oder Excel/Windows) werden automatisch erkannt.',
          )}
        </p>
      </section>

      {parsed && (
        <>
          <section className="card">
            <h2>{tr('2. Spalten zuordnen')}</h2>
            <p className="small muted">
              {parsed.rows.length} {tr('Datenzeilen gefunden. Ordne jedem Feld die passende Spalte deiner Datei zu.')}
            </p>
            <div className="form-grid">
              {TARGET_FIELDS.map((f) => (
                <Field key={f.key} label={tr(f.label) + (f.required ? ' *' : '')}>
                  <select
                    value={mapping[f.key] ?? -1}
                    onChange={(e) => setMapping((m) => ({ ...m, [f.key]: Number(e.target.value) }))}
                  >
                    <option value={-1}>{tr('– nicht importieren –')}</option>
                    {parsed.headers.map((h, i) => (
                      <option key={i} value={i}>
                        {h}
                        {parsed.rows[0]?.[i] ? `  (z. B. „${parsed.rows[0][i].slice(0, 30)}“)` : ''}
                      </option>
                    ))}
                  </select>
                </Field>
              ))}
            </div>
            {!mapped('plant') && (
              <Field
                label={tr('Anlage für alle Zeilen')}
                hint={tr('Wird verwendet, weil keine Spalte „Anlage“ zugeordnet ist.')}
              >
                <input
                  type="text"
                  value={defaultPlant}
                  onChange={(e) => setDefaultPlant(e.target.value)}
                  placeholder={tr('z. B. Wasseraufbereitung')}
                />
              </Field>
            )}
            <label className={`check${updateExisting ? ' checked' : ''}`}>
              <input type="checkbox" checked={updateExisting} onChange={(e) => setUpdateExisting(e.target.checked)} />
              {tr('Vorhandene Tag-Nummern aktualisieren (sonst überspringen)')}
            </label>
          </section>

          <section className="card">
            <h2>{tr('3. Vorschau')}</h2>
            <div className="table-wrap">
              <table className="table stack">
                <thead>
                  <tr>
                    {TARGET_FIELDS.filter((f) => mapped(f.key)).map((f) => (
                      <th key={f.key}>{tr(f.label)}</th>
                    ))}
                    <th>{tr('Hinweis')}</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.map((v, i) => (
                    <tr key={i}>
                      {TARGET_FIELDS.filter((f) => mapped(f.key)).map((f) => (
                        <td key={f.key} data-label={tr(f.label)}>
                          {v[f.key]}
                        </td>
                      ))}
                      <td className="small" data-label={tr('Hinweis')}>
                        {!v.tagNumber && <span style={{ color: 'var(--overdue)' }}>{tr('keine Tag-Nummer')}</span>}
                        {v.tagNumber && existingKeys.has(normalizeKey(v.tagNumber)) && (
                          <span className="pill">
                            {updateExisting ? tr('wird aktualisiert') : tr('existiert – übersprungen')}
                          </span>
                        )}{' '}
                        {v.articleNumber && productKeySet.has(normalizeKey(v.articleNumber)) && (
                          <span className="pill new">{tr('Produkt erkannt')}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {parsed.rows.length > preview.length && (
              <p className="small muted">
                {tr('… und')} {parsed.rows.length - preview.length} {tr('weitere Zeilen.')}
              </p>
            )}
            <button
              className="btn btn-primary btn-lg btn-block"
              style={{ marginTop: 12 }}
              disabled={!mapped('tagNumber') || busy}
              onClick={async () => {
                setBusy(true);
                try {
                  setResult(await importTags(parsed, mapping, { updateExisting, defaultPlant: defaultPlant.trim() }));
                } finally {
                  setBusy(false);
                }
              }}
            >
              <Icon name="upload" /> {tr('{{n}} Zeilen importieren', { n: parsed.rows.length })}
            </button>
            {!mapped('tagNumber') && (
              <p className="small" style={{ color: 'var(--overdue)' }}>
                {tr('Bitte die Spalte für die Tag-Nummer zuordnen.')}
              </p>
            )}
          </section>
        </>
      )}

      {result && (
        <div className="alert">
          <Icon name="check" />
          <div>
            <div className="title">{tr('Import abgeschlossen')}</div>
            {result.created} {tr('neu angelegt,')} {result.updated} {tr('aktualisiert,')} {result.skipped}{' '}
            {tr('übersprungen.')}{' '}
            {result.linkedToProduct > 0 &&
              `${tr('{{n}} mit Produktvorlage verknüpft.', { n: result.linkedToProduct })} `}
            <Link to="/tags">{tr('Zu den Tags')}</Link> · <Link to="/etiketten">{tr('QR-Etiketten drucken')}</Link>
          </div>
        </div>
      )}
    </div>
  );
}
