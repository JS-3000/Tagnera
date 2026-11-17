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
  const productKeys = useMemo(() => new Set((products ?? []).map((p) => normalizeKey(p.articleNumber))), [products]);

  if (!can('admin')) return <Empty>Der CSV-Import ist Administratoren vorbehalten.</Empty>;

  const mapped = (k: TargetField) => mapping[k] !== undefined && mapping[k]! >= 0;

  return (
    <div>
      <div className="page-head">
        <h1>Tags aus CSV importieren</h1>
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
              'tagnera-vorlage.csv',
            )
          }
        >
          <Icon name="download" size={18} /> Beispiel-CSV
        </button>
      </div>

      <section className="card">
        <h2>1. Datei wählen</h2>
        <div className="btn-row">
          <label className="btn btn-primary">
            <Icon name="upload" /> CSV-Datei auswählen
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
          Erste Zeile enthält Spaltenüberschriften
        </label>
        <p className="small muted" style={{ marginBottom: 0 }}>
          Trennzeichen (Semikolon, Komma, Tab) und Zeichensatz (UTF-8 oder Excel/Windows) werden automatisch erkannt.
        </p>
      </section>

      {parsed && (
        <>
          <section className="card">
            <h2>2. Spalten zuordnen</h2>
            <p className="small muted">
              {parsed.rows.length} Datenzeilen gefunden. Ordne jedem Feld die passende Spalte deiner Datei zu.
            </p>
            <div className="form-grid">
              {TARGET_FIELDS.map((f) => (
                <Field key={f.key} label={f.label + (f.required ? ' *' : '')}>
                  <select
                    value={mapping[f.key] ?? -1}
                    onChange={(e) => setMapping((m) => ({ ...m, [f.key]: Number(e.target.value) }))}
                  >
                    <option value={-1}>– nicht importieren –</option>
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
              <Field label="Anlage für alle Zeilen" hint="Wird verwendet, weil keine Spalte „Anlage“ zugeordnet ist.">
                <input
                  type="text"
                  value={defaultPlant}
                  onChange={(e) => setDefaultPlant(e.target.value)}
                  placeholder="z. B. Wasseraufbereitung"
                />
              </Field>
            )}
            <label className={`check${updateExisting ? ' checked' : ''}`}>
              <input type="checkbox" checked={updateExisting} onChange={(e) => setUpdateExisting(e.target.checked)} />
              Vorhandene Tag-Nummern aktualisieren (sonst überspringen)
            </label>
          </section>

          <section className="card">
            <h2>3. Vorschau</h2>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    {TARGET_FIELDS.filter((f) => mapped(f.key)).map((f) => (
                      <th key={f.key}>{f.label}</th>
                    ))}
                    <th>Hinweis</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.map((v, i) => (
                    <tr key={i}>
                      {TARGET_FIELDS.filter((f) => mapped(f.key)).map((f) => (
                        <td key={f.key}>{v[f.key]}</td>
                      ))}
                      <td className="small">
                        {!v.tagNumber && <span style={{ color: 'var(--overdue)' }}>keine Tag-Nummer</span>}
                        {v.tagNumber && existingKeys.has(normalizeKey(v.tagNumber)) && (
                          <span className="pill">
                            {updateExisting ? 'wird aktualisiert' : 'existiert – übersprungen'}
                          </span>
                        )}{' '}
                        {v.articleNumber && productKeys.has(normalizeKey(v.articleNumber)) && (
                          <span className="pill new">Produkt erkannt</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {parsed.rows.length > preview.length && (
              <p className="small muted">… und {parsed.rows.length - preview.length} weitere Zeilen.</p>
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
              <Icon name="upload" /> {parsed.rows.length} Zeilen importieren
            </button>
            {!mapped('tagNumber') && (
              <p className="small" style={{ color: 'var(--overdue)' }}>
                Bitte die Spalte für die Tag-Nummer zuordnen.
              </p>
            )}
          </section>
        </>
      )}

      {result && (
        <div className="alert">
          <Icon name="check" />
          <div>
            <div className="title">Import abgeschlossen</div>
            {result.created} neu angelegt, {result.updated} aktualisiert, {result.skipped} übersprungen.{' '}
            {result.linkedToProduct > 0 && `${result.linkedToProduct} mit Produktvorlage verknüpft. `}
            <Link to="/tags">Zu den Tags</Link> · <Link to="/etiketten">QR-Etiketten drucken</Link>
          </div>
        </div>
      )}
    </div>
  );
}
