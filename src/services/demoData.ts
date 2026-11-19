// Fixed demo dataset "Demoanlage ConnecTag" (formerly "Demoanlage Tagnera").
//
// - The 10 tags have FIXED UUIDs (the QR codes are printed – never change them).
// - All other demo records get stable IDs derived from a name (demoId), so a newer
//   DEMO_VERSION can replace exactly the demo records and nothing else.
// - Dates are relative to "today". Every day the demo diary entries are shifted again,
//   so the status mix (6 ok, 2 due, 2 overdue) looks the same on every presentation day.
// - Maintenance intervals, FAQ and spare parts are example values ("Demo-Daten").

import { data } from '../data';
import type {
  Faq,
  IntervalUnit,
  LogEntry,
  LogKind,
  MaintenanceTask,
  Product,
  SparePart,
  Supplier,
  Tag,
  User,
} from '../data/types';
import { addDays, addMonths, today } from '../lib/util';
import { registerFixedQrTags, saveSettings } from './settings';

/** Increase when the demo content changes – devices then replace their demo data. */
export const DEMO_VERSION = 1;
export const DEMO_PLANT = 'Demoanlage ConnecTag';
const OLD_DEMO_PLANT = 'Demoanlage Tagnera'; // renamed in place, without a new demo version
const STATE_KEY = 'tagnera.demo.v1';

// ---------------------------------------------------------------- stable ids

/** Deterministic UUID-formatted id from a text key (same key -> same id on every device). */
export function demoId(key: string): string {
  // cyrb128 hash -> 128 bit
  let h1 = 1779033703,
    h2 = 3144134277,
    h3 = 1013904242,
    h4 = 2773480762;
  const s = 'tagnera-demo:' + key;
  for (let i = 0; i < s.length; i++) {
    const k = s.charCodeAt(i);
    h1 = h2 ^ Math.imul(h1 ^ k, 597399067);
    h2 = h3 ^ Math.imul(h2 ^ k, 2869860233);
    h3 = h4 ^ Math.imul(h3 ^ k, 951274213);
    h4 = h1 ^ Math.imul(h4 ^ k, 2716044179);
  }
  h1 = Math.imul(h3 ^ (h1 >>> 18), 597399067);
  h2 = Math.imul(h4 ^ (h2 >>> 22), 2869860233);
  h3 = Math.imul(h1 ^ (h3 >>> 17), 951274213);
  h4 = Math.imul(h2 ^ (h4 >>> 19), 2716044179);
  const hex = [h1 ^ h2 ^ h3 ^ h4, h2 ^ h1, h3 ^ h1, h4 ^ h1]
    .map((n) => (n >>> 0).toString(16).padStart(8, '0'))
    .join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-5${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

// ---------------------------------------------------------------- definition

type DateFn = (t: string) => string;
const monthsAgo =
  (m: number, plusDays = 0): DateFn =>
  (t) =>
    addDays(addMonths(t, -m), plusDays);

interface TaskDef {
  key: string;
  title: string;
  description: string;
  value: number;
  unit: IntervalUnit;
  parts?: [string, number][]; // [part key, quantity]
}
interface PartDef {
  key: string;
  name: string;
  notes?: string;
}
interface LogDef {
  date: DateFn;
  person: string;
  kind: LogKind;
  text: string;
  done?: string[]; // task keys
}
interface DemoDef {
  uuid: string;
  tagNumber: string;
  type: string;
  description: string;
  location: string;
  manufacturer: string;
  articleNumber: string;
  aliases?: string[];
  productName: string;
  tasks: TaskDef[];
  parts: PartDef[];
  faq: [string, string][];
  log: LogDef[];
}

const W = 'M. Weber';
const S = 'J. Simon';
const COMMISSIONING = monthsAgo(17);
const ibn = (text: string): LogDef => ({ date: COMMISSIONING, person: S, kind: 'inbetriebnahme', text });

/** In the order of the printed list. */
export const DEMO_DEFS: DemoDef[] = [
  {
    uuid: '7a41d91b-5a92-4d1d-be5f-ab29f05d5163',
    tagNumber: '1BV101',
    type: 'Automatischer Schwimmer-Entlüfter',
    description: 'Entlüftung Vorlagebehälter',
    location: 'Ebene 1, Vorlagebehälter',
    manufacturer: 'VOSS',
    articleNumber: 'PURG-INOX 2000',
    productName: 'Schwimmer-Schnellentlüfter PURG-INOX 2000',
    tasks: [
      {
        key: 'check',
        title: 'Funktion und Dichtheit prüfen',
        description: 'Entlüftungsfunktion beobachten, Gehäuse und Anschluss auf Undichtigkeit prüfen.',
        value: 6,
        unit: 'months',
      },
      {
        key: 'clean',
        title: 'Schwimmer und Ventilsitz reinigen',
        description: 'Absperren, drucklos machen, Haube öffnen, Schwimmer und Sitz reinigen, Dichtung prüfen.',
        value: 1,
        unit: 'years',
        parts: [['seal', 1]],
      },
    ],
    parts: [
      { key: 'seal', name: 'Gehäusedichtung', notes: 'Beim Öffnen der Haube immer erneuern' },
      { key: 'valve', name: 'Ventileinsatz komplett' },
    ],
    faq: [
      [
        'Der Entlüfter tropft dauerhaft – was tun?',
        'Meist sitzt Schmutz auf dem Ventilsitz. Anlagenteil absperren, drucklos machen und Schwimmer sowie Sitz reinigen. Hilft das nicht, Ventileinsatz bzw. Dichtung tauschen.',
      ],
      [
        'Es kommt keine Luft heraus, obwohl die Leitung Luft enthält.',
        'Prüfen, ob die Absperrung vor dem Entlüfter offen ist und die Entlüftungsöffnung frei ist. Ein festsitzender Schwimmer deutet auf Ablagerungen hin.',
      ],
      [
        'Darf der Entlüfter in jeder Lage eingebaut werden?',
        'Schwimmer-Entlüfter arbeiten nur senkrecht am höchsten Punkt der Leitung bzw. des Behälters zuverlässig.',
      ],
      [
        'Wie oft sollte der Entlüfter geprüft werden?',
        'In dieser Demo halbjährlich per Sichtprüfung und jährlich mit Reinigung. Maßgeblich sind die Herstellerangaben und die Betriebsbedingungen.',
      ],
    ],
    log: [
      ibn('Inbetriebnahme, Entlüftungsfunktion geprüft.'),
      {
        date: monthsAgo(5),
        person: W,
        kind: 'wartung',
        text: 'Haube geöffnet, Schwimmer und Ventilsitz gereinigt, Dichtung erneuert.',
        done: ['clean', 'check'],
      },
      { date: monthsAgo(2), person: W, kind: 'pruefung', text: 'Sichtprüfung: dicht, Funktion i. O.', done: ['check'] },
    ],
  },
  {
    uuid: 'be49ecf3-25c5-4c86-82e4-87261e81bf21',
    tagNumber: '1F102',
    type: 'Beutelfiltergehäuse',
    description: 'Vorfilter Rohwasser',
    location: 'Ebene 1, Zulauf',
    manufacturer: 'Sommer & Strassburger',
    articleNumber: 'FiltraLine® Größe 2 F&B',
    productName: 'FiltraLine® Beutelfiltergehäuse Größe 2 (Food & Beverage)',
    tasks: [
      {
        key: 'bag',
        title: 'Filterbeutel wechseln',
        description: 'Gehäuse entlasten, Deckel öffnen, Filterbeutel tauschen, Stützkorb und Dichtung prüfen.',
        value: 3,
        unit: 'months',
        parts: [['bag', 1]],
      },
      {
        key: 'gasket',
        title: 'Deckeldichtung prüfen/wechseln',
        description: 'Dichtung auf Risse, Verformung und Quellung prüfen, bei Bedarf ersetzen.',
        value: 1,
        unit: 'years',
        parts: [['gasket', 1]],
      },
    ],
    parts: [
      { key: 'bag', name: 'Filterbeutel Größe 2', notes: 'Feinheit je nach Anwendung' },
      { key: 'gasket', name: 'Deckeldichtung' },
      { key: 'basket', name: 'Stützkorb Größe 2' },
    ],
    faq: [
      [
        'Woran erkenne ich, dass der Filterbeutel voll ist?',
        'Am steigenden Differenzdruck zwischen Ein- und Austritt bzw. an sinkendem Durchfluss. Den Grenzwert legt der Betreiber fest.',
      ],
      [
        'Der Deckel ist nach dem Beutelwechsel undicht.',
        'Dichtung auf richtigen Sitz, Beschädigung und Sauberkeit prüfen. Verschluss gleichmäßig anziehen.',
      ],
      [
        'Darf der Deckel unter Druck geöffnet werden?',
        'Nein. Gehäuse immer absperren, entlasten und entleeren, bevor der Deckel geöffnet wird.',
      ],
      [
        'Der Beutel ist gerissen – was ist zu tun?',
        'Beutel tauschen und die nachgeschalteten Anlagenteile auf eingetragene Partikel prüfen. Häufige Ursache: zu hoher Differenzdruck.',
      ],
    ],
    log: [
      ibn('Inbetriebnahme, erster Filterbeutel eingesetzt.'),
      { date: monthsAgo(4), person: W, kind: 'wartung', text: 'Deckeldichtung geprüft und ersetzt.', done: ['gasket'] },
      {
        date: monthsAgo(3, 6),
        person: W,
        kind: 'wartung',
        text: 'Filterbeutel gewechselt, Stützkorb gereinigt.',
        done: ['bag'],
      },
    ],
  },
  {
    uuid: 'd06cc8cc-5868-47f6-a18a-068995e3904a',
    tagNumber: '1VR103',
    type: 'Rückschlagklappe',
    description: 'Rückflussverhinderung Druckseite 1P101',
    location: 'Ebene 1, Druckleitung',
    manufacturer: 'Kieselmann',
    articleNumber: '5091032000-041',
    productName: 'Tellerrückschlagventil Typ 5091',
    tasks: [
      {
        key: 'tight',
        title: 'Dichtheit und Funktion prüfen',
        description: 'Rückfluss bei stehender Pumpe prüfen, auf Geräusche (Flattern) achten.',
        value: 1,
        unit: 'years',
      },
      {
        key: 'seal',
        title: 'Dichtungen wechseln',
        description: 'Ventil ausbauen, Dichtungen ersetzen, Teller und Feder prüfen.',
        value: 2,
        unit: 'years',
        parts: [['seals', 1]],
      },
    ],
    parts: [
      { key: 'seals', name: 'Dichtungssatz Rückschlagventil' },
      { key: 'spring', name: 'Druckfeder' },
    ],
    faq: [
      [
        'Die Armatur klappert bzw. flattert im Betrieb.',
        'Häufig ist der Durchfluss zu gering, um den Teller ganz zu öffnen. Betriebspunkt und Einbausituation prüfen.',
      ],
      [
        'Bei stehender Pumpe läuft Medium zurück.',
        'Teller oder Dichtung sind verschmutzt oder verschlissen. Ventil reinigen und Dichtungen ersetzen.',
      ],
      [
        'Spielt die Einbaurichtung eine Rolle?',
        'Ja. Die Durchflussrichtung ist am Gehäuse markiert und muss eingehalten werden.',
      ],
    ],
    log: [
      ibn('Inbetriebnahme, Einbaurichtung kontrolliert.'),
      {
        date: monthsAgo(10),
        person: W,
        kind: 'wartung',
        text: 'Dichtungen gewechselt, Teller gereinigt.',
        done: ['seal'],
      },
      {
        date: monthsAgo(3),
        person: S,
        kind: 'pruefung',
        text: 'Dichtheitsprüfung bei Pumpenstillstand: kein Rückfluss.',
        done: ['tight'],
      },
    ],
  },
  {
    uuid: '665fdabd-0105-4af7-a7fc-a2c951b677bd',
    tagNumber: '3XV101',
    type: 'Auf/Zu-Ventil, pneumatisch',
    description: 'Zulauf Reaktionstank',
    location: 'Ebene 2, Reaktionstank',
    manufacturer: 'Kieselmann',
    articleNumber: '4510100130-041',
    productName: 'Scheibenventil Typ 4510 mit pneumatischem Drehantrieb',
    tasks: [
      {
        key: 'seal',
        title: 'Scheibenventil-Dichtung wechseln',
        description: 'Ventil ausbauen, Dichtung ersetzen, Scheibe und Lagerung prüfen.',
        value: 1,
        unit: 'years',
        parts: [['seal', 1]],
      },
      {
        key: 'actuator',
        title: 'Antrieb und Rückmeldung prüfen',
        description: 'Auf/Zu-Fahrt beobachten, Endlagenrückmeldung und Druckluftanschluss prüfen.',
        value: 6,
        unit: 'months',
      },
    ],
    parts: [
      { key: 'seal', name: 'Scheibenventil-Dichtung' },
      { key: 'actseal', name: 'Dichtungssatz Drehantrieb' },
    ],
    faq: [
      [
        'Das Ventil schaltet nicht.',
        'Druckluftversorgung, Magnetventil/Steuerkopf und elektrische Ansteuerung prüfen. Läuft der Antrieb, aber die Scheibe nicht, Kupplung prüfen.',
      ],
      ['Die Endlagenrückmeldung fehlt.', 'Sitz und Einstellung der Rückmelder bzw. des Steuerkopfes prüfen.'],
      [
        'Das Ventil ist in Zu-Stellung undicht.',
        'Dichtung verschlissen oder gequollen. Ventil drucklos machen und Dichtung ersetzen.',
      ],
      [
        'Was ist vor Arbeiten am Ventil zu beachten?',
        'Leitung absperren und entleeren, Druckluft abschalten und gegen Wiedereinschalten sichern.',
      ],
    ],
    log: [
      ibn('Inbetriebnahme, Schaltzeiten und Rückmeldung geprüft.'),
      { date: monthsAgo(12, -25), person: W, kind: 'wartung', text: 'Dichtung gewechselt.', done: ['seal'] },
      {
        date: monthsAgo(2),
        person: W,
        kind: 'pruefung',
        text: 'Antrieb und Rückmeldung i. O. Dichtungswechsel demnächst einplanen.',
        done: ['actuator'],
      },
    ],
  },
  {
    uuid: '829c0f55-148d-4c0f-8279-011a1ebffa9f',
    tagNumber: '4HV110',
    type: 'Handventil',
    description: 'Absperrung Probenahme',
    location: 'Ebene 2, Probenahme',
    manufacturer: 'Kieselmann',
    articleNumber: '4310025130-041',
    productName: 'Scheibenventil Typ 4310, handbetätigt',
    tasks: [
      {
        key: 'check',
        title: 'Gängigkeit und Dichtheit prüfen',
        description: 'Handhebel betätigen, Rastung prüfen, auf Undichtigkeit achten.',
        value: 1,
        unit: 'years',
      },
      {
        key: 'seal',
        title: 'Dichtung wechseln',
        description: 'Ventil ausbauen und Dichtung ersetzen.',
        value: 2,
        unit: 'years',
        parts: [['seal', 1]],
      },
    ],
    parts: [
      { key: 'seal', name: 'Scheibenventil-Dichtung' },
      { key: 'lever', name: 'Handhebel mit Rastung' },
    ],
    faq: [
      [
        'Der Hebel lässt sich nur schwer bewegen.',
        'Häufig ist die Dichtung gequollen oder verschmutzt. Ventil drucklos machen, prüfen und Dichtung ersetzen.',
      ],
      [
        'Darf das Handventil zum Drosseln verwendet werden?',
        'Absperrarmaturen sind für Auf/Zu ausgelegt. Dauerhaftes Drosseln kann die Dichtung beschädigen.',
      ],
      [
        'Das Ventil ist geschlossen, aber nicht dicht.',
        'Dichtung prüfen und ersetzen. Stellung des Hebels in der Rastung kontrollieren.',
      ],
    ],
    log: [
      ibn('Inbetriebnahme.'),
      { date: monthsAgo(8), person: W, kind: 'wartung', text: 'Dichtung gewechselt.', done: ['seal'] },
      { date: monthsAgo(3), person: W, kind: 'pruefung', text: 'Gängigkeit und Dichtheit i. O.', done: ['check'] },
    ],
  },
  {
    uuid: '9498ff79-08a5-48a3-89a1-ab25511ee1d3',
    tagNumber: '2P104',
    type: 'Dosierpumpe',
    description: 'Dosierung pH-Korrektur',
    location: 'Ebene 2, Dosierstation',
    manufacturer: 'Grundfos',
    articleNumber: 'DDA 7.5-16 FCM-C-PV/V/C F-31U2U2FG',
    productName: 'SMART Digital S DDA 7.5-16',
    tasks: [
      {
        key: 'kit',
        title: 'Dosierkopf, Ventile und Membran prüfen',
        description: 'Dosierkopf, Saug-/Druckventil und Membran prüfen; bei Verschleiß Wartungsset einbauen.',
        value: 1,
        unit: 'years',
        parts: [['kit', 1]],
      },
      {
        key: 'visual',
        title: 'Sichtprüfung Leckage und Dosierleitungen',
        description: 'Dosierkopf, Anschlüsse und Leitungen auf Leckage und Luftblasen prüfen.',
        value: 3,
        unit: 'months',
      },
    ],
    parts: [
      { key: 'kit', name: 'Wartungsset Dosierkopf (Membran, Ventile, Dichtungen)' },
      { key: 'valve', name: 'Druckventil komplett' },
    ],
    faq: [
      [
        'Die Pumpe läuft, fördert aber nichts.',
        'Häufig Luft im Dosierkopf oder ein verschmutztes Ventil. Pumpe entlüften, Saugleitung und Ventile prüfen.',
      ],
      [
        'Die Pumpe meldet einen Fehler zur Membran oder Leckage.',
        'Pumpe stoppen, Dosierkopf auf Leckage prüfen. Membran bei Bedarf mit dem Wartungsset ersetzen.',
      ],
      [
        'Die Dosiermenge stimmt nicht.',
        'Kalibrierung prüfen und ggf. neu kalibrieren; außerdem Gegendruck und Ventile kontrollieren.',
      ],
      [
        'Was ist beim Arbeiten mit der Chemikalie zu beachten?',
        'Schutzausrüstung tragen und das Sicherheitsdatenblatt des Mediums beachten. Leitungen vor dem Öffnen drucklos machen.',
      ],
    ],
    log: [
      ibn('Inbetriebnahme, Pumpe kalibriert.'),
      {
        date: monthsAgo(4),
        person: W,
        kind: 'wartung',
        text: 'Dosierkopf geprüft, Wartungsset eingebaut.',
        done: ['kit', 'visual'],
      },
      { date: monthsAgo(1), person: W, kind: 'pruefung', text: 'Sichtprüfung: keine Leckage.', done: ['visual'] },
    ],
  },
  {
    uuid: '96dcfd4b-9757-48db-9309-48aa95d79ef4',
    tagNumber: '1P101',
    type: 'Kreiselpumpe, mehrstufig',
    description: 'Hauptförderpumpe',
    location: 'Ebene 1, Pumpenstand',
    manufacturer: 'Grundfos',
    articleNumber: 'CRN32-4-2 A-F-A-E-HQQE 3x400/690',
    aliases: ['96122356'],
    productName: 'Mehrstufige Kreiselpumpe CRN 32-4-2',
    tasks: [
      {
        key: 'shaft',
        title: 'Gleitringdichtung prüfen',
        description: 'Wellendichtung auf Leckage prüfen, bei Tropfleckage Gleitringdichtung tauschen.',
        value: 6,
        unit: 'months',
        parts: [['mech', 1]],
      },
      {
        key: 'motor',
        title: 'Motorlager und Laufgeräusch prüfen',
        description: 'Geräusch, Vibration und Temperatur am Motor prüfen und dokumentieren.',
        value: 1,
        unit: 'years',
      },
    ],
    parts: [
      { key: 'mech', name: 'Gleitringdichtung HQQE (Kartusche)' },
      { key: 'orings', name: 'O-Ring-Satz Pumpenkopf' },
    ],
    faq: [
      [
        'Die Pumpe tropft an der Welle.',
        'Leichte Feuchtigkeit kann normal sein. Bei deutlicher Leckage Gleitringdichtung prüfen und tauschen.',
      ],
      [
        'Die Pumpe ist laut oder vibriert.',
        'Mögliche Ursachen: Luft im System, zu geringer Zulaufdruck (Kavitation) oder Lagerschaden. Zulauf und Lager prüfen.',
      ],
      [
        'Die Pumpe bringt nicht die gewohnte Leistung.',
        'Drehrichtung, Entlüftung, verschmutzte Saugleitung oder Filter prüfen.',
      ],
      [
        'Darf die Pumpe trocken laufen?',
        'Nein. Vor dem Start füllen und entlüften; Trockenlauf beschädigt die Gleitringdichtung.',
      ],
      [
        'Wie wird die Pumpe entlüftet?',
        'Über die Entlüftungsschraube am Pumpenkopf, bis blasenfreies Medium austritt. Details stehen in der Betriebsanleitung.',
      ],
    ],
    log: [
      ibn('Inbetriebnahme, Drehrichtung und Entlüftung geprüft.'),
      {
        date: monthsAgo(6, -12),
        person: W,
        kind: 'pruefung',
        text: 'Gleitringdichtung trocken, i. O.',
        done: ['shaft'],
      },
      {
        date: monthsAgo(5),
        person: S,
        kind: 'pruefung',
        text: 'Motorlager: Geräusch und Temperatur unauffällig.',
        done: ['motor'],
      },
      {
        date: monthsAgo(1),
        person: W,
        kind: 'reparatur',
        text: 'Leichte Tropfleckage an der Welle bemerkt – Prüfung der Gleitringdichtung steht aus.',
      },
    ],
  },
  {
    uuid: 'b70d0122-3f51-43dc-8749-2044a91e7669',
    tagNumber: '5V101',
    type: 'Hochdruckgebläse, 1,5 kW',
    description: 'Belüftung Reaktionstank',
    location: 'Ebene 2, Gebläseraum',
    manufacturer: 'Dassler',
    articleNumber: 'DSC20C150T',
    productName: 'Hochdruckgebläse DSC20C150T, Motor 1,5 kW, PTC, Aluguss',
    tasks: [
      {
        key: 'filter',
        title: 'Ansaugfilter reinigen',
        description: 'Ansaugfilter ausbauen, reinigen oder ersetzen.',
        value: 3,
        unit: 'months',
        parts: [['filter', 1]],
      },
      {
        key: 'run',
        title: 'Laufgeräusch, Temperatur und PTC prüfen',
        description: 'Geräusch, Vibration und Gehäusetemperatur prüfen, PTC-Auswertung testen.',
        value: 1,
        unit: 'years',
      },
    ],
    parts: [
      { key: 'filter', name: 'Ansaugfilterelement' },
      { key: 'silencer', name: 'Schalldämpfereinsatz' },
    ],
    faq: [
      [
        'Das Gebläse wird sehr heiß und schaltet ab.',
        'Oft ist der Ansaugfilter zugesetzt oder der Gegendruck zu hoch. Filter reinigen und Druckseite prüfen. Der PTC schützt den Motor vor Überhitzung.',
      ],
      [
        'Das Laufgeräusch ist lauter als sonst.',
        'Filter, Schalldämpfer und Befestigung prüfen. Bei metallischen Geräuschen Gebläse abschalten und prüfen lassen.',
      ],
      ['Die Luftmenge ist zu gering.', 'Ansaugfilter, Leitungen und Belüftungselemente auf Verstopfung prüfen.'],
    ],
    log: [
      ibn('Inbetriebnahme, PTC-Auswertung getestet.'),
      {
        date: monthsAgo(6),
        person: S,
        kind: 'pruefung',
        text: 'Laufgeräusch und Temperatur unauffällig, PTC i. O.',
        done: ['run'],
      },
      { date: monthsAgo(1), person: W, kind: 'wartung', text: 'Ansaugfilter gereinigt.', done: ['filter'] },
    ],
  },
  {
    uuid: '0428d30c-f9d5-4e3e-911f-7d82aba918f2',
    tagNumber: '2FV102',
    type: 'Schrägsitz-Stellventil',
    description: 'Durchflussregelung',
    location: 'Ebene 2, Regelstrecke',
    manufacturer: 'Schubert & Salzer',
    articleNumber: '4016123',
    aliases: ['7020/020V1H20R1-1---S3------1'],
    productName: 'Schrägsitz-Stellventil Typ 7020 mit Stellungsregler',
    tasks: [
      {
        key: 'stroke',
        title: 'Hubtest und Stellungsregler prüfen',
        description: 'Hub 0–100 % fahren, Stellungsrückmeldung und Regelverhalten prüfen.',
        value: 1,
        unit: 'years',
      },
      {
        key: 'packing',
        title: 'Spindelabdichtung prüfen',
        description: 'Spindeldurchführung auf Leckage prüfen.',
        value: 6,
        unit: 'months',
        parts: [['packing', 1]],
      },
    ],
    parts: [
      { key: 'packing', name: 'Spindelabdichtung (Packungssatz)' },
      { key: 'seat', name: 'Kegel-/Sitzdichtung' },
    ],
    faq: [
      [
        'Das Ventil regelt unruhig (schwingt).',
        'Reglerparameter und Druckluftversorgung prüfen; ggf. Stellungsregler neu initialisieren.',
      ],
      [
        'Die Stellungsrückmeldung stimmt nicht mit dem Hub überein.',
        'Stellungsregler neu einmessen bzw. initialisieren lassen.',
      ],
      [
        'An der Spindel tritt Medium aus.',
        'Spindelabdichtung verschlissen. Ventil drucklos machen und Abdichtung ersetzen.',
      ],
    ],
    log: [
      ibn('Inbetriebnahme, Stellungsregler initialisiert.'),
      {
        date: monthsAgo(4),
        person: S,
        kind: 'pruefung',
        text: 'Hubtest 0–100 % durchgeführt, Rückmeldung i. O.',
        done: ['stroke'],
      },
      { date: monthsAgo(2), person: W, kind: 'pruefung', text: 'Spindelabdichtung dicht.', done: ['packing'] },
    ],
  },
  {
    uuid: '8657b0c8-d83c-4106-8efd-50b37d18cb92',
    tagNumber: '2QT101-1',
    type: 'pH-/Redox-Sensor (Analysenmessung)',
    description: 'pH-Messung Ablauf',
    location: 'Ebene 2, Messstelle Ablauf',
    manufacturer: 'Endress+Hauser',
    articleNumber: 'CPS16E-AA7BTA2+Z1',
    productName: 'Memosens CPS16E pH-/Redox-Sensor',
    tasks: [
      {
        key: 'cal',
        title: 'Sensor kalibrieren (2-Punkt)',
        description: 'Kalibrierung mit zwei Pufferlösungen, Ergebnis dokumentieren.',
        value: 1,
        unit: 'months',
        parts: [['buffer', 1]],
      },
      {
        key: 'clean',
        title: 'Sensor reinigen und prüfen',
        description: 'Sensor ausbauen, Glasmembran und Diaphragma reinigen, auf Beschädigung prüfen.',
        value: 3,
        unit: 'months',
      },
      {
        key: 'replace',
        title: 'Sensorzustand bewerten / Sensor tauschen',
        description: 'Steilheit und Nullpunkt bewerten; bei Alterung Sensor ersetzen.',
        value: 2,
        unit: 'years',
        parts: [['sensor', 1]],
      },
    ],
    parts: [
      { key: 'buffer', name: 'Pufferlösungen pH 4 / pH 7' },
      { key: 'sensor', name: 'Ersatzsensor pH/Redox' },
    ],
    faq: [
      [
        'Der Messwert driftet oder ist träge.',
        'Sensor reinigen und neu kalibrieren. Bei alten Sensoren sinkt die Steilheit – dann tauschen.',
      ],
      [
        'Die Kalibrierung wird nicht akzeptiert.',
        'Frische Pufferlösungen verwenden, Sensor reinigen und genügend Einstellzeit abwarten.',
      ],
      [
        'Darf der Sensor trocken lagern?',
        'Glaselektroden nicht austrocknen lassen; bei Ausbau die Feuchthaltekappe bzw. Aufbewahrungslösung verwenden.',
      ],
      ['Wie oft muss kalibriert werden?', 'Abhängig von Medium und Anforderungen. In dieser Demo monatlich.'],
    ],
    log: [
      ibn('Inbetriebnahme, Sensor kalibriert.'),
      { date: monthsAgo(1), person: W, kind: 'wartung', text: 'Sensor gereinigt, Glasmembran i. O.', done: ['clean'] },
      {
        date: monthsAgo(1, 5),
        person: W,
        kind: 'pruefung',
        text: '2-Punkt-Kalibrierung durchgeführt, Steilheit 97 %.',
        done: ['cal', 'replace'],
      },
    ],
  },
];

// ---------------------------------------------------------------- build records

const DEMO_SUPPLIER: Supplier = {
  id: demoId('supplier'),
  name: 'Demo Industriebedarf GmbH',
  orderEmail: 'bestellung@example.com',
  phone: '+49 000 000000',
  contactPerson: 'Innendienst',
  customerNumber: 'K-DEMO-01',
};

export const DEMO_USERS: User[] = [
  { id: demoId('user:simon'), name: 'J. Simon', role: 'admin' },
  { id: demoId('user:weber'), name: 'M. Weber', role: 'editor' },
  { id: demoId('user:gast'), name: 'Gast', role: 'reader' },
];

interface DemoRecords {
  users: User[];
  suppliers: Supplier[];
  products: Product[];
  tags: Tag[];
  tasks: MaintenanceTask[];
  spareParts: SparePart[];
  faqs: Faq[];
  logEntries: LogEntry[];
}

function buildRecords(t: string): DemoRecords {
  const r: DemoRecords = {
    users: DEMO_USERS,
    suppliers: [DEMO_SUPPLIER],
    products: [],
    tags: [],
    tasks: [],
    spareParts: [],
    faqs: [],
    logEntries: [],
  };
  const stamp = COMMISSIONING(t) + 'T08:00:00.000Z';
  let orderNo = 10000;
  DEMO_DEFS.forEach((d, i) => {
    const pid = demoId(`product:${d.tagNumber}`);
    r.products.push({
      id: pid,
      manufacturer: d.manufacturer,
      articleNumber: d.articleNumber,
      aliases: d.aliases ?? [],
      name: d.productName,
      type: d.type,
      description: '',
      supplierId: DEMO_SUPPLIER.id,
      orderNumber: `L-${10001 + i}`,
      supportName: 'Demo Anlagenbau GmbH',
      supportEmail: 'service@example.com',
      supportPhone: '+49 000 000000',
      createdAt: stamp,
      updatedAt: stamp,
    });
    r.tags.push({
      id: d.uuid,
      tagNumber: d.tagNumber,
      type: d.type,
      description: d.description,
      plant: DEMO_PLANT,
      location: d.location,
      manufacturer: d.manufacturer,
      articleNumber: d.articleNumber,
      orderNumber: '',
      productId: pid,
      commissionedAt: COMMISSIONING(t),
      supportName: '',
      supportEmail: '',
      supportPhone: '',
      notes: '',
      createdAt: stamp,
      updatedAt: stamp,
    });
    const partId = (k: string) => demoId(`part:${d.tagNumber}:${k}`);
    const taskId = (k: string) => demoId(`task:${d.tagNumber}:${k}`);
    const short = d.tagNumber.replace(/[^A-Z0-9]/gi, '');
    d.parts.forEach((p, j) =>
      r.spareParts.push({
        id: partId(p.key),
        ownerType: 'product',
        ownerId: pid,
        name: p.name,
        manufacturerPartNumber: `DEMO-${short}-${j + 1}`,
        supplierId: DEMO_SUPPLIER.id,
        supplierOrderNumber: `L-${(orderNo += 7)}`,
        notes: p.notes ?? '',
      }),
    );
    d.tasks.forEach((tk) =>
      r.tasks.push({
        id: taskId(tk.key),
        ownerType: 'product',
        ownerId: pid,
        title: tk.title,
        description: tk.description,
        intervalValue: tk.value,
        intervalUnit: tk.unit,
        requiredParts: (tk.parts ?? []).map(([k, q]) => ({ sparePartId: partId(k), quantity: q })),
      }),
    );
    d.faq.forEach(([question, answer], j) =>
      r.faqs.push({
        id: demoId(`faq:${d.tagNumber}:${j}`),
        ownerType: 'product',
        ownerId: pid,
        question,
        answer,
        sort: j,
      }),
    );
    d.log.forEach((l, j) => {
      const date = l.date(t);
      r.logEntries.push({
        id: demoId(`log:${d.tagNumber}:${j}`),
        tagId: d.uuid,
        date,
        person: l.person,
        kind: l.kind,
        description: l.text,
        photoFileId: null,
        completedTaskIds: (l.done ?? []).map(taskId),
        createdAt: date + 'T09:00:00.000Z',
      });
    });
  });
  return r;
}

export const DEMO_TAG_IDS = new Set(DEMO_DEFS.map((d) => d.uuid));
/** The printed demo cards point here – never change. */
export const DEMO_QR_BASE = 'https://js-3000.github.io/Tagnera/';
registerFixedQrTags(DEMO_TAG_IDS, DEMO_QR_BASE);
const DEMO_PRODUCT_IDS = new Set(DEMO_DEFS.map((d) => demoId(`product:${d.tagNumber}`)));
export const isDemoTag = (id: string) => DEMO_TAG_IDS.has(id);

// ---------------------------------------------------------------- state on this device

interface DemoState {
  version: number;
  anchor: string; // date the demo diary dates were computed for
}

function readState(): DemoState | null {
  try {
    return JSON.parse(localStorage.getItem(STATE_KEY) || 'null');
  } catch {
    return null;
  }
}
function writeState(s: DemoState) {
  try {
    localStorage.setItem(STATE_KEY, JSON.stringify(s));
  } catch {
    /* ignore */
  }
}

/** Remove everything that belongs to the demo (incl. own entries on demo tags). Own tags stay. */
async function removeDemo(): Promise<void> {
  const ownerIds = new Set([...DEMO_TAG_IDS, ...DEMO_PRODUCT_IDS]);
  const [entries, docs, faqs, parts, tasks] = await Promise.all([
    data.logEntries.list(),
    data.documents.list(),
    data.faqs.list(),
    data.spareParts.list(),
    data.tasks.list(),
  ]);
  const demoEntries = entries.filter((e) => DEMO_TAG_IDS.has(e.tagId));
  const demoIssues = (await data.issues.list()).filter((i) => DEMO_TAG_IDS.has(i.tagId));
  await data.files.removeMany(demoIssues.map((i) => i.photoFileId).filter((x): x is string => !!x));
  await data.issues.removeMany(demoIssues.map((i) => i.id));
  await data.files.removeMany(demoEntries.map((e) => e.photoFileId).filter((x): x is string => !!x));
  await data.logEntries.removeMany(demoEntries.map((e) => e.id));
  for (const d of docs.filter((x) => ownerIds.has(x.ownerId))) {
    const versions = await data.documentVersions.findBy('documentId', d.id);
    await data.files.removeMany(versions.map((v) => v.fileId).filter(Boolean));
    await data.documentVersions.removeMany(versions.map((v) => v.id));
    await data.documents.remove(d.id);
  }
  await data.faqs.removeMany(faqs.filter((x) => ownerIds.has(x.ownerId)).map((x) => x.id));
  await data.spareParts.removeMany(parts.filter((x) => ownerIds.has(x.ownerId)).map((x) => x.id));
  await data.tasks.removeMany(tasks.filter((x) => ownerIds.has(x.ownerId)).map((x) => x.id));
  await data.tags.removeMany([...DEMO_TAG_IDS]);
  await data.products.removeMany([...DEMO_PRODUCT_IDS]);
}

/** One-time cleanup of the earlier demo "Wasseraufbereitung" (random ids, recognised by its content). */
async function removeLegacyDemo(): Promise<void> {
  const products = await data.products.list();
  const legacy = products.filter(
    (p) =>
      (p.manufacturer === 'Kieselmann' && p.articleNumber === '567') ||
      (p.manufacturer === 'Grundfos' && p.articleNumber === 'CR 10-4'),
  );
  if (legacy.length === 0) return;
  const { deleteTag, deleteProduct } = await import('./tags');
  for (const t of (await data.tags.list()).filter((x) => x.plant === 'Wasseraufbereitung')) await deleteTag(t.id);
  for (const p of legacy) await deleteProduct(p.id);
  const oldSuppliers = ['Armaturen Weber GmbH', 'Pumpen & Service Nord', 'FiltraTech Handel'];
  await data.suppliers.removeMany(
    (await data.suppliers.list()).filter((s) => oldSuppliers.includes(s.name)).map((s) => s.id),
  );
  const oldUsers = ['Administrator', 'Max Becker', 'Lea Hoffmann'];
  await data.users.removeMany((await data.users.list()).filter((u) => oldUsers.includes(u.name)).map((u) => u.id));
}

async function writeDemo(t: string): Promise<void> {
  const r = buildRecords(t);
  await data.users.saveMany(r.users);
  await data.suppliers.saveMany(r.suppliers);
  await data.products.saveMany(r.products);
  await data.tags.saveMany(r.tags);
  await data.tasks.saveMany(r.tasks);
  await data.spareParts.saveMany(r.spareParts);
  await data.faqs.saveMany(r.faqs);
  await data.logEntries.saveMany(r.logEntries);
}

/**
 * Called on every app start (before the first screen):
 * - empty device or older demo version -> (re)load the demo
 * - same version, new day -> shift the demo diary dates to today
 */
export async function ensureDemoData(): Promise<'loaded' | 'shifted' | 'unchanged'> {
  const t = today();
  const state = readState();
  const present = (await Promise.all([...DEMO_TAG_IDS].map((id) => data.tags.get(id)))).some(Boolean);

  if (!state || state.version !== DEMO_VERSION || !present) {
    await removeLegacyDemo();
    await removeDemo();
    await writeDemo(t);
    writeState({ version: DEMO_VERSION, anchor: t });
    // new device (e.g. a customer scanning a demo card): starts without account ("Öffentlich");
    // "Anmelden (Demo)" then offers the demo users
    if (!state) saveSettings({ currentUserId: DEMO_USERS[0].id, loggedOut: true });
    return 'loaded';
  }
  await renameOldDemoPlant();
  if (state.anchor !== t) {
    // only update demo entries that still exist (deleted ones stay deleted until reset)
    const fresh = buildRecords(t).logEntries;
    const existing = await Promise.all(fresh.map((e) => data.logEntries.get(e.id)));
    const shifted: LogEntry[] = [];
    fresh.forEach((e, i) => {
      const old = existing[i];
      if (old) shifted.push({ ...old, date: e.date, createdAt: e.createdAt });
    });
    await data.logEntries.saveMany(shifted);
    // commissioning date moves along, too
    const tags = await Promise.all(DEMO_DEFS.map((d) => data.tags.get(d.uuid)));
    await data.tags.saveMany(
      tags.filter((x): x is Tag => !!x).map((x) => ({ ...x, commissionedAt: COMMISSIONING(t) })),
    );
    writeState({ version: DEMO_VERSION, anchor: t });
    return 'shifted';
  }
  return 'unchanged';
}

/** Rename "Demoanlage Tagnera" -> "Demoanlage ConnecTag" on the demo tags, keeping all entries. */
async function renameOldDemoPlant(): Promise<void> {
  const tags = (await Promise.all([...DEMO_TAG_IDS].map((id) => data.tags.get(id)))).filter(
    (t): t is Tag => !!t && t.plant === OLD_DEMO_PLANT,
  );
  if (tags.length) await data.tags.saveMany(tags.map((t) => ({ ...t, plant: DEMO_PLANT })));
}

/** "Demo zurücksetzen": original demo state; own tags (other UUIDs) stay. */
export async function resetDemo(): Promise<void> {
  await removeDemo();
  await writeDemo(today());
  writeState({ version: DEMO_VERSION, anchor: today() });
}
