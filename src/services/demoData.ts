// "Demo-Daten laden": one plant (Wasseraufbereitung) with 10 tags, two product templates,
// suppliers, diary entries, one due and one overdue maintenance.
// Manufacturer names are real, article numbers / contents are invented for demonstration.

import { data } from '../data';
import type {
  DocumentItem,
  DocumentVersion,
  Faq,
  LogEntry,
  MaintenanceTask,
  Product,
  SparePart,
  Supplier,
  Tag,
  User,
} from '../data/types';
import { addDays, addMonths, nowIso, today, uuid } from '../lib/util';
import { saveFile } from './tags';

const PLANT = 'Wasseraufbereitung';

export async function loadDemoData(): Promise<void> {
  await data.clearAll();
  const now = nowIso();
  const t0 = today();

  // ---------------------------------------------------------------- users
  const users: User[] = [
    { id: uuid(), name: 'Administrator', role: 'admin' },
    { id: uuid(), name: 'Max Becker', role: 'editor' },
    { id: uuid(), name: 'Lea Hoffmann', role: 'reader' },
  ];
  await data.users.saveMany(users);

  // ---------------------------------------------------------------- suppliers
  const supArmaturen: Supplier = {
    id: uuid(),
    name: 'Armaturen Weber GmbH',
    orderEmail: 'bestellung@armaturen-weber.example',
    phone: '+49 711 123456-0',
    contactPerson: 'Frau Kraus',
    customerNumber: 'K-48213',
  };
  const supPumpen: Supplier = {
    id: uuid(),
    name: 'Pumpen & Service Nord',
    orderEmail: 'ersatzteile@pumpen-nord.example',
    phone: '+49 40 987654-0',
    contactPerson: 'Herr Jansen',
    customerNumber: '100772',
  };
  const supFilter: Supplier = {
    id: uuid(),
    name: 'FiltraTech Handel',
    orderEmail: 'order@filtratech.example',
    phone: '+49 89 445566',
    contactPerson: 'Vertrieb Süd',
    customerNumber: 'FT-2201',
  };
  await data.suppliers.saveMany([supArmaturen, supPumpen, supFilter]);

  // ---------------------------------------------------------------- products
  const base = { createdAt: now, updatedAt: now };
  const pValve: Product = {
    ...base,
    id: uuid(),
    manufacturer: 'Kieselmann',
    articleNumber: '567',
    name: 'Kugelhahn DN50 Edelstahl',
    type: 'Handventil',
    description: 'Hygienischer Kugelhahn, Edelstahl 1.4404, Handhebel, Dichtungen EPDM.',
    supplierId: supArmaturen.id,
    orderNumber: 'AW-567-050',
    supportName: 'Anlagenbau Muster GmbH – Service',
    supportEmail: 'service@anlagenbau-muster.example',
    supportPhone: '+49 711 555 100',
  };
  const pPump: Product = {
    ...base,
    id: uuid(),
    manufacturer: 'Grundfos',
    articleNumber: 'CR 10-4',
    name: 'Kreiselpumpe CR 10-4',
    type: 'Pumpe',
    description: 'Vertikale mehrstufige Kreiselpumpe, 2,2 kW, Gleitringdichtung HQQE.',
    supplierId: supPumpen.id,
    orderNumber: 'PSN-CR10-4',
    supportName: 'Pumpen & Service Nord – Hotline',
    supportEmail: 'service@pumpen-nord.example',
    supportPhone: '+49 40 987654-77',
  };
  await data.products.saveMany([pValve, pPump]);

  // spare parts
  const spValveSeal: SparePart = {
    id: uuid(),
    ownerType: 'product',
    ownerId: pValve.id,
    name: 'Dichtungssatz EPDM DN50',
    manufacturerPartNumber: '567-050-DS-EPDM',
    supplierId: supArmaturen.id,
    supplierOrderNumber: 'AW-100234',
    notes: '2 Sitzdichtungen, 2 O-Ringe',
  };
  const spValveLever: SparePart = {
    id: uuid(),
    ownerType: 'product',
    ownerId: pValve.id,
    name: 'Handhebel komplett',
    manufacturerPartNumber: '567-050-HH',
    supplierId: supArmaturen.id,
    supplierOrderNumber: 'AW-100240',
    notes: '',
  };
  const spPumpSeal: SparePart = {
    id: uuid(),
    ownerType: 'product',
    ownerId: pPump.id,
    name: 'Gleitringdichtung HQQE',
    manufacturerPartNumber: '96455086',
    supplierId: supPumpen.id,
    supplierOrderNumber: 'PSN-96455086',
    notes: 'Wellendurchmesser 22 mm',
  };
  const spPumpOring: SparePart = {
    id: uuid(),
    ownerType: 'product',
    ownerId: pPump.id,
    name: 'O-Ring-Satz Pumpenkopf',
    manufacturerPartNumber: '96455095',
    supplierId: supPumpen.id,
    supplierOrderNumber: 'PSN-96455095',
    notes: '',
  };
  await data.spareParts.saveMany([spValveSeal, spValveLever, spPumpSeal, spPumpOring]);

  // maintenance tasks of the templates
  const taskValveSeal: MaintenanceTask = {
    id: uuid(),
    ownerType: 'product',
    ownerId: pValve.id,
    title: 'Dichtung wechseln',
    description: 'Sitzdichtungen und O-Ringe tauschen, Gängigkeit prüfen.',
    intervalValue: 1,
    intervalUnit: 'years',
    requiredParts: [{ sparePartId: spValveSeal.id, quantity: 1 }],
  };
  const taskValveCheck: MaintenanceTask = {
    id: uuid(),
    ownerType: 'product',
    ownerId: pValve.id,
    title: 'Sichtprüfung auf Leckage',
    description: 'Gehäuse und Anschlüsse auf Undichtigkeit prüfen, Hebel betätigen.',
    intervalValue: 6,
    intervalUnit: 'months',
    requiredParts: [],
  };
  const taskPumpSeal: MaintenanceTask = {
    id: uuid(),
    ownerType: 'product',
    ownerId: pPump.id,
    title: 'Gleitringdichtung prüfen/tauschen',
    description: 'Leckage an der Welle prüfen. Bei Tropfleckage Dichtung tauschen.',
    intervalValue: 2,
    intervalUnit: 'years',
    requiredParts: [
      { sparePartId: spPumpSeal.id, quantity: 1 },
      { sparePartId: spPumpOring.id, quantity: 1 },
    ],
  };
  const taskPumpBearing: MaintenanceTask = {
    id: uuid(),
    ownerType: 'product',
    ownerId: pPump.id,
    title: 'Motorlager und Laufgeräusch prüfen',
    description: 'Geräusch, Vibration und Temperatur am Motor prüfen und dokumentieren.',
    intervalValue: 3,
    intervalUnit: 'months',
    requiredParts: [],
  };
  await data.tasks.saveMany([taskValveSeal, taskValveCheck, taskPumpSeal, taskPumpBearing]);

  // FAQ (5 per template)
  const faq = (ownerId: string, list: [string, string][]): Faq[] =>
    list.map(([question, answer], i) => ({ id: uuid(), ownerType: 'product', ownerId, question, answer, sort: i }));
  await data.faqs.saveMany([
    ...faq(pValve.id, [
      ['Welches Anzugsdrehmoment gilt für die Gehäuseschrauben?', 'M10: 25 Nm, über Kreuz in zwei Durchgängen anziehen. Werte aus der Betriebsanleitung, Kapitel 6, haben Vorrang.'],
      ['Der Hebel lässt sich nur schwer bewegen – was tun?', 'Meist sind die Sitzdichtungen gequollen oder verschlissen. Anlage drucklos machen und Dichtungssatz 567-050-DS-EPDM einbauen.'],
      ['Darf der Kugelhahn zum Regeln (Drosseln) verwendet werden?', 'Nein. Kugelhähne nur voll offen oder voll geschlossen betreiben, sonst werden die Sitzdichtungen beschädigt.'],
      ['Welche Dichtungswerkstoffe sind verfügbar?', 'Standard ist EPDM. Für Öle/Fette gibt es FKM, für hohe Temperaturen PTFE-Sitze. Bestellnummer beim Lieferanten erfragen.'],
      ['Wie wird der Hahn vor der Demontage gesichert?', 'Leitungsabschnitt absperren, drucklos machen, entleeren und gegen Wiedereinschalten sichern (LOTO).'],
    ]),
    ...faq(pPump.id, [
      ['Die Pumpe tropft an der Welle – ist das normal?', 'Leichte Feuchtigkeit ist normal. Bei mehr als ca. 10 Tropfen pro Minute die Gleitringdichtung tauschen.'],
      ['Wie wird die Pumpe richtig entlüftet?', 'Entlüftungsschraube am Pumpenkopf öffnen, bis blasenfreies Wasser austritt. Nie trocken laufen lassen.'],
      ['Welche Drehrichtung ist richtig?', 'Siehe Pfeil auf dem Motorlüfterdeckel. Bei falscher Drehrichtung zwei Phasen tauschen (Elektrofachkraft).'],
      ['Die Pumpe ist laut und vibriert. Ursache?', 'Häufig Kavitation (Zulaufdruck zu gering) oder Lagerschaden. Zulaufdruck und Filter prüfen.'],
      ['Wie lange darf die Pumpe gegen geschlossenen Schieber laufen?', 'Maximal wenige Sekunden. Die Mindestfördermenge laut Datenblatt muss eingehalten werden.'],
    ]),
  ]);

  // a document per product (small generated PDF), with an older version for the valve
  const vOld = await saveFile(makePdf('Betriebsanleitung Kieselmann 567', 'Revision B (veraltet)'), 'BA_567_RevB.pdf', 'application/pdf');
  const vNew = await saveFile(makePdf('Betriebsanleitung Kieselmann 567', 'Revision C - neue Drehmomente'), 'BA_567_RevC.pdf', 'application/pdf');
  const pumpPdf = await saveFile(makePdf('Datenblatt Grundfos CR 10-4', 'Kennlinie und Abmessungen'), 'DB_CR10-4.pdf', 'application/pdf');
  const docValve: DocumentItem = { id: uuid(), ownerType: 'product', ownerId: pValve.id, title: 'Betriebsanleitung', category: 'Anleitung', createdAt: addMonths(t0, -14) + 'T08:00:00.000Z' };
  const docPump: DocumentItem = { id: uuid(), ownerType: 'product', ownerId: pPump.id, title: 'Datenblatt', category: 'Datenblatt', createdAt: addMonths(t0, -10) + 'T08:00:00.000Z' };
  await data.documents.saveMany([docValve, docPump]);
  const ver = (documentId: string, f: { id: string; name: string; mimeType: string; size: number }, note: string, addedAt: string): DocumentVersion => ({
    id: uuid(), documentId, fileId: f.id, fileName: f.name, mimeType: f.mimeType, size: f.size, note, addedAt,
  });
  await data.documentVersions.saveMany([
    ver(docValve.id, vOld, 'Rev. B', addMonths(t0, -14) + 'T08:00:00.000Z'),
    ver(docValve.id, vNew, 'Rev. C – neue Anzugsdrehmomente', addDays(t0, -12) + 'T08:00:00.000Z'),
    ver(docPump.id, pumpPdf, '', addMonths(t0, -10) + 'T08:00:00.000Z'),
  ]);

  // ---------------------------------------------------------------- tags
  const commissioned = addMonths(t0, -20);
  const mk = (p: Partial<Tag> & Pick<Tag, 'tagNumber' | 'type'>): Tag => ({
    id: uuid(),
    description: '',
    plant: PLANT,
    location: '',
    manufacturer: '',
    articleNumber: '',
    orderNumber: '',
    productId: null,
    commissionedAt: commissioned,
    supportName: '',
    supportEmail: '',
    supportPhone: '',
    notes: '',
    createdAt: now,
    updatedAt: now,
    ...p,
  });
  const valve = (n: string, location: string, description: string) =>
    mk({ tagNumber: n, type: 'Handventil', description, location, manufacturer: pValve.manufacturer, articleNumber: pValve.articleNumber, productId: pValve.id });

  const hv1001 = valve('HV-1001', 'Halle 1, Rohwasserzulauf', 'Absperrung Rohwasser');
  const hv1002 = valve('HV-1002', 'Halle 1, vor Filter F-301', 'Absperrung Filtereintritt');
  const hv1003 = valve('HV-1003', 'Halle 1, nach Filter F-301', 'Absperrung Filteraustritt');
  const hv1004 = valve('HV-1004', 'Halle 1, Bypass Filter', 'Bypass Filterstrecke');
  const hv1005 = valve('HV-1005', 'Halle 2, Reinwassertank', 'Entleerung Reinwassertank');
  const hv1006 = valve('HV-1006', 'Halle 2, Pumpe P-101 saugseitig', 'Absperrung Saugseite P-101');
  const p101 = mk({ tagNumber: 'P-101', type: 'Pumpe', description: 'Reinwasser-Förderpumpe', location: 'Halle 2, Pumpensumpf', manufacturer: pPump.manufacturer, articleNumber: pPump.articleNumber, productId: pPump.id, commissionedAt: addMonths(t0, -26) });
  const p102 = mk({ tagNumber: 'P-102', type: 'Pumpe', description: 'Reserve-Förderpumpe', location: 'Halle 2, Pumpensumpf', manufacturer: pPump.manufacturer, articleNumber: pPump.articleNumber, productId: pPump.id, commissionedAt: addMonths(t0, -8) });
  const fv201 = mk({ tagNumber: 'FV-201', type: 'Regelventil', description: 'Durchflussregelung Reinwasser', location: 'Halle 2, Druckleitung', manufacturer: 'Samson', articleNumber: '3241', orderNumber: 'AW-3241-DN40', supportName: 'MSR-Service Anlagenbau Muster', supportEmail: 'msr@anlagenbau-muster.example', supportPhone: '+49 711 555 120' });
  const f301 = mk({ tagNumber: 'F-301', type: 'Filter', description: 'Kerzenfilter Rohwasser', location: 'Halle 1', manufacturer: 'FiltraTech', articleNumber: 'KF-25-10', orderNumber: 'FT-KF2510' });
  const tags = [hv1001, hv1002, hv1003, hv1004, hv1005, hv1006, p101, p102, fv201, f301];
  await data.tags.saveMany(tags);

  // tag-specific items (not from a template)
  const spFilter: SparePart = { id: uuid(), ownerType: 'tag', ownerId: f301.id, name: 'Filterkerze 25 µm, 10"', manufacturerPartNumber: 'KF-25-10-E', supplierId: supFilter.id, supplierOrderNumber: 'FT-88120', notes: '4 Stück pro Wechsel' };
  const spPositioner: SparePart = { id: uuid(), ownerType: 'tag', ownerId: fv201.id, name: 'Membran Stellantrieb', manufacturerPartNumber: '3271-MEM-120', supplierId: supArmaturen.id, supplierOrderNumber: 'AW-327112', notes: '' };
  await data.spareParts.saveMany([spFilter, spPositioner]);
  const taskFilter: MaintenanceTask = { id: uuid(), ownerType: 'tag', ownerId: f301.id, title: 'Filterkerzen wechseln', description: 'Alle 4 Kerzen tauschen, Differenzdruck notieren.', intervalValue: 3, intervalUnit: 'months', requiredParts: [{ sparePartId: spFilter.id, quantity: 4 }] };
  const taskFv: MaintenanceTask = { id: uuid(), ownerType: 'tag', ownerId: fv201.id, title: 'Funktionsprüfung Stellungsregler', description: 'Hubtest 0–100 %, Kennlinie prüfen.', intervalValue: 1, intervalUnit: 'years', requiredParts: [] };
  await data.tasks.saveMany([taskFilter, taskFv]);
  await data.faqs.save({ id: uuid(), ownerType: 'tag', ownerId: f301.id, question: 'Ab welchem Differenzdruck müssen die Kerzen gewechselt werden?', answer: 'Ab 1,0 bar Differenzdruck oder spätestens nach 3 Monaten.', sort: 0 });

  // ---------------------------------------------------------------- diary entries
  // Dates are chosen so that:
  //  - HV-1001 "Dichtung wechseln" is overdue (last done 13 months ago)
  //  - F-301 "Filterkerzen wechseln" is due (last done 85 days ago, interval 3 months)
  //  - most other tasks are ok
  const entries: LogEntry[] = [];
  const add = (tag: Tag, date: string, kind: LogEntry['kind'], description: string, done: MaintenanceTask[] = [], person = 'Max Becker') =>
    entries.push({ id: uuid(), tagId: tag.id, date, person, kind, description, photoFileId: null, completedTaskIds: done.map((t) => t.id), createdAt: date + 'T10:00:00.000Z' });

  add(hv1001, addMonths(t0, -13), 'wartung', 'Dichtungssatz getauscht, Hahn leichtgängig.', [taskValveSeal, taskValveCheck]);
  add(hv1001, addMonths(t0, -4), 'pruefung', 'Sichtprüfung ohne Befund.', [taskValveCheck]);
  add(hv1001, addDays(t0, -20), 'reparatur', 'Hebel gelockert – Mutter nachgezogen. Dichtungswechsel steht noch aus.', [], 'Lea Hoffmann');
  for (const v of [hv1002, hv1003, hv1004, hv1005, hv1006]) {
    add(v, addMonths(t0, -5), 'wartung', 'Jahreswartung: Dichtungen getauscht, Sichtprüfung i. O.', [taskValveSeal, taskValveCheck]);
  }
  add(hv1004, addMonths(t0, -2), 'umbau', 'Hebel gegen abschließbaren Hebel getauscht (Bypass gesichert).');
  add(p101, addMonths(t0, -7), 'wartung', 'Gleitringdichtung gewechselt, Pumpe entlüftet.', [taskPumpSeal]);
  add(p101, addMonths(t0, -1), 'pruefung', 'Lager- und Geräuschprüfung i. O., Motortemperatur 48 °C.', [taskPumpBearing]);
  add(p102, addMonths(t0, -2), 'pruefung', 'Reservepumpe Probelauf 15 min, i. O.', [taskPumpBearing]);
  add(f301, addDays(t0, -85), 'wartung', 'Filterkerzen gewechselt, Δp vorher 1,1 bar, nachher 0,2 bar.', [taskFilter]);
  add(fv201, addMonths(t0, -3), 'pruefung', 'Hubtest durchgeführt, Kennlinie i. O.', [taskFv]);
  await data.logEntries.saveMany(entries);
}

/**
 * Builds a tiny one-page PDF with two lines of text, so the demo has real
 * documents that open in the browser. Real PDFs can be uploaded in the app.
 */
function makePdf(title: string, subtitle: string): Blob {
  const esc = (s: string) => s.replace(/[\\()]/g, (c) => '\\' + c).replace(/[^\x20-\x7e]/g, '?');
  const content = `BT /F1 22 Tf 60 760 Td (${esc(title)}) Tj ET\nBT /F1 14 Tf 60 730 Td (${esc(subtitle)}) Tj ET\nBT /F1 11 Tf 60 690 Td (Demo-Dokument - erzeugt von Tagnera) Tj ET`;
  const objs = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>',
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ];
  let pdf = '%PDF-1.4\n';
  const offsets: number[] = [];
  objs.forEach((o, i) => {
    offsets.push(pdf.length);
    pdf += `${i + 1} 0 obj\n${o}\nendobj\n`;
  });
  const xref = pdf.length;
  pdf += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n`;
  offsets.forEach((o) => (pdf += String(o).padStart(10, '0') + ' 00000 n \n'));
  pdf += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return new Blob([pdf], { type: 'application/pdf' });
}
