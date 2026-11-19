// "Bestellen": asks for the quantity and opens a pre-filled e-mail (mailto:).
import { useState } from 'react';
import { useSession } from '../app/session';
import type { SparePart, Supplier, Tag } from '../data/types';
import { Icon } from './Icon';
import { Modal } from './ui';
import { tr } from '../i18n';

export function buildOrderMail(
  tag: Tag,
  part: SparePart,
  supplier: Supplier | null,
  qty: number,
  sender: string,
): string {
  const subject = `Bestellung ${part.supplierOrderNumber || part.manufacturerPartNumber} – ${qty} × ${part.name} (${tag.tagNumber})`;
  const lines = [
    'Guten Tag,',
    '',
    'bitte liefern Sie folgendes Ersatzteil:',
    '',
    `Menge: ${qty}`,
    `Bezeichnung: ${part.name}`,
    `Bestellnummer: ${part.supplierOrderNumber || '–'}`,
    `Herstellerartikelnummer: ${part.manufacturerPartNumber || '–'}`,
    ...(supplier?.customerNumber ? [`Unsere Kundennummer: ${supplier.customerNumber}`] : []),
    '',
    `Für Bauteil (Tag): ${tag.tagNumber}${tag.type ? ` – ${tag.type}` : ''}`,
    ...(tag.plant ? [`Anlage: ${tag.plant}`] : []),
    ...(tag.manufacturer || tag.articleNumber
      ? [`Hersteller/Art.-Nr.: ${tag.manufacturer} ${tag.articleNumber}`.trim()]
      : []),
    '',
    'Bitte bestätigen Sie Liefertermin und Preis.',
    '',
    'Mit freundlichen Grüßen',
    sender,
  ];
  const to = supplier?.orderEmail ?? '';
  return `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(lines.join('\n'))}`;
}

export function OrderModal({
  tag,
  part,
  supplier,
  onClose,
}: {
  tag: Tag;
  part: SparePart;
  supplier: Supplier | null;
  onClose: () => void;
}) {
  const { user } = useSession();
  const [qty, setQty] = useState(1);
  return (
    <Modal title={tr('Ersatzteil bestellen')} onClose={onClose}>
      <dl className="kv" style={{ marginTop: 0 }}>
        <dt>{tr('Teil')}</dt>
        <dd>
          <b>{part.name}</b>
        </dd>
        <dt>{tr('Bestellnummer')}</dt>
        <dd className="mono">{part.supplierOrderNumber || '–'}</dd>
        <dt>{tr('Lieferant')}</dt>
        <dd>{supplier ? `${supplier.name} (${supplier.orderEmail || 'keine E-Mail'})` : '–'}</dd>
        <dt>{tr('Tag')}</dt>
        <dd>{tag.tagNumber}</dd>
      </dl>
      <div className="field" style={{ marginTop: 16 }}>
        <span>{tr('Menge')}</span>
        <div className="qty">
          <button className="btn" onClick={() => setQty((q) => Math.max(1, q - 1))} aria-label={tr('weniger')}>
            −
          </button>
          <input
            type="number"
            min={1}
            value={qty}
            onChange={(e) => setQty(Math.max(1, Number(e.target.value) || 1))}
            aria-label={tr('Menge')}
          />
          <button className="btn" onClick={() => setQty((q) => q + 1)} aria-label={tr('mehr')}>
            +
          </button>
        </div>
      </div>
      {!supplier?.orderEmail && (
        <p className="small" style={{ color: 'var(--overdue)' }}>
          {tr('Für dieses Teil ist keine Bestell-E-Mail hinterlegt. Die E-Mail öffnet sich ohne Empfänger.')}
        </p>
      )}
      <a
        className="btn btn-primary btn-lg btn-block"
        href={buildOrderMail(tag, part, supplier, qty, user?.name ?? '')}
        onClick={() => setTimeout(onClose, 300)}
      >
        <Icon name="mail" /> {tr('E-Mail öffnen')}
      </a>
    </Modal>
  );
}
