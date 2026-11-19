# ConnecTag

**brings your tag a level up**

> Früher „Tagnera“. Repository-Name, Adresse (`https://js-3000.github.io/Tagnera/`) und interne Speicher-Schlüssel
> (`tagnera…`) bleiben bewusst gleich, damit gedruckte QR-Codes und vorhandene Daten weiter funktionieren.

Klickbarer Prototyp einer Web-App, die Bauteil-Tags im Anlagenbau digitalisiert (z. B. `HV-1001` für ein Handventil).
Jeder Tag bekommt einen QR-Code. Wer ihn scannt, sieht die digitale Akte des Bauteils: Tagebuch, Wartungsintervalle,
Dokumente, FAQ, Ersatzteile und Support-Kontakt.

- Läuft komplett im Browser, **ohne Server**. Alle Daten liegen lokal im Browser (IndexedDB).
- Installierbar als App auf dem Handy (PWA), funktioniert auch offline.
- Oberfläche auf Deutsch und Englisch (Standard: Sprache des Geräts), Handy-Ansicht fürs Feld, eigene PC-Ansicht
  für die Verwaltung, Hallen-Monitor für den Fernseher.

---

## 1. Lokal starten

Voraussetzung: [Node.js](https://nodejs.org) ab Version 20.

```bash
npm install
```

```bash
npm run dev
```

Dann im Browser <http://localhost:5173> öffnen. Die **Demoanlage ConnecTag** (10 Tags) wird beim ersten Öffnen
automatisch geladen, siehe Abschnitt 7.

Weitere Befehle:

| Befehl              | Wozu                                                      |
| ------------------- | --------------------------------------------------------- |
| `npm run build`     | Prüft die Typen und baut die fertige App nach `dist/`      |
| `npm run preview`   | Startet die gebaute App aus `dist/` zum Testen            |
| `npm run dev:https` | Entwicklungsserver mit HTTPS, für den Kamera-Test am Handy |

## 2. Auf dem Handy testen

Die Kamera darf im Browser **nur über HTTPS** benutzt werden. Es gibt zwei Wege:

### a) Einfach und empfohlen: über GitHub Pages

Siehe Abschnitt 3. Danach die Adresse `https://js-3000.github.io/Tagnera/` auf dem Handy öffnen.

### b) Im eigenen WLAN (für schnelle Tests während der Entwicklung)

1. Rechner und Handy im selben WLAN.
2. `npm run dev:https` starten. In der Ausgabe steht eine Zeile wie `Network: https://192.168.178.23:5173/`.
3. Diese Adresse auf dem Handy öffnen. Der Browser warnt vor dem selbst erstellten Zertifikat:
   „Erweitert“ → „Trotzdem fortfahren“ wählen.
4. Wenn die Seite gar nicht lädt, blockiert vermutlich die Firewall des Rechners den Port 5173.

### Als App installieren

- **Android (Chrome):** Menü ⋮ → „App installieren“ bzw. „Zum Startbildschirm hinzufügen“.
- **iPhone (Safari):** Teilen-Symbol → „Zum Home-Bildschirm“.

### Gut zu wissen

- **Taschenlampe:** Funktioniert unter Android/Chrome. Safari auf dem iPhone unterstützt das nicht, dort wird der
  Schalter ausgeblendet.
- **QR-Code mit der normalen Handykamera scannen:** Die Kamera-App öffnet die Bauteilseite im Browser. Die Daten
  stammen aus dem Browser-Speicher dieses Geräts. Auf iPhones haben der Safari-Tab und die installierte App
  **getrennte** Speicher. Zum Vorführen also am besten im Browser arbeiten oder die Daten per JSON in die App importieren.
- **Daten zwischen Geräten übertragen:** Einstellungen → „Daten exportieren“, die Datei aufs andere Gerät
  bringen, dort „Daten importieren“ (ersetzt alle Daten dort).

## 3. Auf GitHub Pages veröffentlichen

Das Repository enthält bereits den Workflow `.github/workflows/deploy.yml`. Er baut die App bei jedem Push auf `main`
und veröffentlicht sie.

**Einmalig einrichten:**

1. Auf GitHub das Repository öffnen → **Settings** → **Pages**.
2. Unter **Build and deployment → Source** den Eintrag **GitHub Actions** auswählen.
3. Code auf den Branch `main` pushen (oder unter **Actions** den Workflow „Auf GitHub Pages veröffentlichen“ manuell
   mit **Run workflow** starten).
4. Unter **Actions** den Lauf abwarten (ca. 1–2 Minuten, grüner Haken).
5. Die App ist erreichbar unter **`https://js-3000.github.io/Tagnera/`**. Die Adresse steht auch unter Settings → Pages.

Danach reicht jeder Push auf `main`, und nach ein bis zwei Minuten ist die neue Version online. Installierte Apps
aktualisieren sich beim nächsten Öffnen automatisch.

> **Wichtig für QR-Etiketten:** Die Adresse im QR-Code ist die Adresse, unter der die App beim Drucken läuft.
> Etiketten deshalb aus der GitHub-Pages-Version drucken oder unter **Einstellungen → QR-Code-Adresse** die
> Pages-Adresse eintragen.

## 4. Bedienung im Überblick

| Bereich             | Was geht                                                                                                                                                      |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Scannen**         | Kamera mit Scanrahmen und Taschenlampe, Suche nach Tag-Nummer, „Zuletzt gescannt“. Bei einem unbekannten Code kann ein Bearbeiter direkt einen neuen Tag mit dieser ID anlegen. |
| **Bauteilseite**    | Kopf mit Tag, Typ, Anlage, Hersteller, Art.-Nr.; Hinweis zur nächsten Wartung; Tagebuch, Dokumente, FAQ, Ersatzteile (Bestellen per E-Mail), Support (Anruf/E-Mail). |
| **Eintrag**         | Art (Wartung, Reparatur, Prüfung, Umbau), Datum, Person, Text, Foto. Angehakte Wartungsaufgaben starten ihr Intervall neu.                                       |
| **Hinweise**        | Alle fälligen (orange) und überfälligen (rot) Wartungen. Keine Push-Nachrichten.                                                                              |
| **Tags**            | Tabelle mit Suche und Filtern, Tag anlegen/bearbeiten. Mit „Produkt erkannt“ werden die Daten aus dem Produktkatalog übernommen.                                 |
| **Produktkatalog**  | Vorlagen aus Hersteller + Artikelnummer mit Dokumenten (mit Versionen), FAQ, Wartungsaufgaben, Ersatzteilen, Support.                                          |
| **Lieferanten**     | Name, Bestell-E-Mail, Telefon, Kundennummer.                                                                                                                   |
| **QR-Etiketten**    | Avery-Bögen L6009, L6011, L6012, L4778, L4773, L7163; Logo, Tag-Nummer, Anlage und QR-Code; Startposition für angebrochene Bögen; X/Y-Versatz zum Kalibrieren. |
| **CSV-Import**      | Datei wählen, Spalten selbst zuordnen, Vorschau, Import (inkl. Produkterkennung).                                                                             |
| **Wartungsreport**  | Monat oder Quartal: alle fälligen Arbeiten und die benötigten Ersatzteile, druckbar, Sammelbestellung je Lieferant.                                            |
| **Einstellungen**   | Benutzer/Rolle wechseln, Benutzerverwaltung, „Demo zurücksetzen“, JSON-Export/-Import, QR-Code-Adresse.                                                        |
| **Übersicht (PC)**  | Kennzahlen, offene Wartungen der nächsten 60 Tage, offene Meldungen, letzte Einträge, Button „Hallen-Monitor starten“.                                         |
| **Wartungskalender**| Monatsansicht mit Punkten (grün geplant, orange fällig, rot überfällig), Tagesliste. Erledigen im Kalender nur als Administrator („ohne Scan erfasst“).       |
| **Störung melden**  | Ohne Account nach dem Scan: Beschreibung, Name, Telefon (optional), Foto (optional), Diktieren per Mikrofon.                                                  |
| **Meldungen**       | Eingang für Administratoren mit rotem Zähler: Status neu / in Bearbeitung / erledigt, „Als Tagebucheintrag übernehmen“.                                      |
| **Hallen-Monitor**  | `#/monitor`: Heute fällig, Überfällig, Heute erledigt, offene Störmeldungen, nächste 7 Tage. Vollbild, große Schrift, aktualisiert sich jede Minute.          |

**Rollen (Anmeldung im Prototyp simuliert, ohne Passwort):**

- **Öffentlich (ohne Account):** Wer einen QR-Code scannt und nicht angemeldet ist, sieht nur Tag-Nummer,
  Bauteilbezeichnung und „Störung melden“. **Neue Geräte starten so.** „Anmelden (Demo)“ zeigt die Demo-Benutzer.
- **Leser:** nur ansehen.
- **Bearbeiter:** zusätzlich Tagebuch, Bestellungen, Tags und Tag-Dokumente. **Wartungen erledigen nur nach dem
  Scan** des QR-Codes am Bauteil (In-App-Scanner oder Handykamera, gilt 30 Minuten für genau diesen Tag).
  Andere Einträge ohne Scan sind erlaubt und werden als „ohne Scan erfasst“ markiert.
- **Administrator:** alles, inkl. Meldungen, Kalender-Erledigung, Katalog, Lieferanten, CSV-Import und Benutzer.

Im Tagebuch zeigt jeder neue Eintrag „per Scan erfasst“ oder „ohne Scan erfasst“ (Nachweis vor Ort).
Zum Testen lässt sich die Rolle in den Einstellungen umschalten, auch auf „Öffentlich“.

**Etiketten drucken:** Im Druckdialog „Skalierung 100 %“ bzw. „Tatsächliche Größe“ und „Ränder: keine“ wählen,
Kopf- und Fußzeilen ausschalten. Zuerst auf Normalpapier drucken (Option „Umrisse mitdrucken“) und gegen den
Etikettenbogen halten. Kleine Abweichungen des Druckers gleicht der X/Y-Versatz aus.

## 5. Wichtige Entscheidungen

- **Wartungsreport als echtes PDF:** „Drucken / PDF“ erzeugt mit pdfmake ein eigenes A4-Dokument (Logo, Anlage,
  Zeitraum, Tabellen mit Seitenumbruch, Ersatzteile je Lieferant, „Seite x von y“). Das funktioniert auf Handy und PC
  gleich – zuverlässiger als das Drucken der Webseite. Die Bibliothek wird erst beim Klick geladen.
- **Sprachen:** i18next. Die deutschen Texte sind zugleich die Schlüssel (`tr('Speichern')`), die englischen
  Übersetzungen stehen in `src/i18n/en.json`. Fehlt eine Übersetzung, erscheint der deutsche Text.
  Demo-Inhalte, Herstellerdokumente, der PDF-Report und die Bestell-E-Mail bleiben deutsch.
- **Layout:** Kacheln stehen in zwei festen Spalten (`components/Columns.tsx`) – keine Lücken, kein Springen,
  ausgeblendete Kacheln lassen nur Kacheln derselben Spalte nachrücken.

- **Vorlagen werden verknüpft, nicht kopiert.** Ein Tag zeigt die Dokumente, FAQ, Wartungsaufgaben und Ersatzteile
  seiner Produktvorlage *live* an. Wird an der Vorlage etwas geändert, sehen das sofort alle Tags dieses Produkts.
  Zusätzlich kann jeder Tag eigene Einträge haben.
- **Dokumente haben Versionen.** Ein neues Dokument zeigt „Neu hinzugefügt am …“. Eine neue Version zeigt
  „Neue Version vom … – Bemerkung“, die alten Fassungen stehen unter „Ältere Versionen“. 30 Tage lang gibt es
  zusätzlich ein „NEU“-Abzeichen.
- **Wartungsstatus wird berechnet, nicht gespeichert.** Fälligkeit = letzter Tagebucheintrag, der die Aufgabe als
  erledigt markiert (sonst das Inbetriebnahmedatum) + Intervall. „Fällig“ (orange) gilt ab 10 % des Intervalls vor
  dem Termin (mindestens 7, höchstens 30 Tage), „überfällig“ (rot) nach dem Termin.
- **QR-Inhalt:** `<App-Adresse>/#/t/<UUID>`. Die UUID ist zufällig und ändert sich nie, auch wenn die Tag-Nummer
  geändert wird. Das Hash-Routing (`#/…`) funktioniert ohne Server-Konfiguration auf GitHub Pages.
- **Fotos** werden vor dem Speichern auf max. 1600 px verkleinert (JPEG). Sie bleiben gut lesbar und belegen nur
  einen Bruchteil des Speichers.

## 6. Projektstruktur und späterer Wechsel auf Supabase/PostgreSQL

```
src/
  data/
    types.ts          Datenmodell (eine Schnittstelle = später eine Tabelle)
    backend.ts        Schnittstellen Repository<T> und DataBackend
    dexieBackend.ts   Umsetzung mit IndexedDB (Dexie)
    index.ts          Hier wird das Backend ausgewählt (eine Zeile)
  services/           Fachlogik: Wartung, Tags, Report, CSV, Backup, Demo-Daten …
  pages/              Bildschirme
  components/         Wiederverwendbare Bausteine (Scanner, QR-Code, Dokumente …)
```

Die Oberfläche greift nie direkt auf IndexedDB zu, sondern nur über `data.<tabelle>.list/get/findBy/save/remove`.
Für Supabase schreibt man eine `supabaseBackend.ts` mit denselben Methoden (z. B. `findBy` → `.eq()`), Dateien
kommen in Supabase Storage, und in `src/data/index.ts` wird eine Zeile geändert. Die Datentypen sind bereits flach
und mit UUIDs als Schlüssel angelegt, sie lassen sich also direkt als Tabellen übernehmen.

## 7. Feste Demo „Demoanlage ConnecTag“

Für Kundentermine gibt es einen festen Demo-Datensatz, der auf jedem Handy gleich aussieht:

- **10 Tags mit festen UUIDs** (`src/services/demoData.ts`, Liste `DEMO_DEFS`). Die gedruckten Demo-Karten zeigen auf
  `https://js-3000.github.io/Tagnera/#/t/<UUID>`. **UUIDs und diese Adresse nie ändern.**
- **Automatisch geladen:** Beim ersten Öffnen der App (oder beim ersten Scan einer Demo-Karte) werden die Demo-Daten
  geladen, ohne Klick und ohne Import. Neue Geräte starten als „Öffentlich“; nach „Anmelden (Demo)“ ist die volle
  Bauteilakte sichtbar.
- **Status-Mix:** 6 × OK, 2 × fällig (1F102, 2QT101-1), 2 × überfällig (1P101, 3XV101). Die Tagebuch-Daten werden
  täglich auf das aktuelle Datum umgerechnet, damit der Mix an jedem Vorführtag stimmt. Selbst eingetragene
  Einträge (z. B. „Erledigt“) bleiben erhalten und verändern den Status wie im echten Betrieb.
- **Versionierung:** `DEMO_VERSION` in `demoData.ts`. Nach einer Änderung am Demo-Inhalt die Zahl erhöhen. Geräte mit
  älterer Version ersetzen beim nächsten Öffnen alles, was zu den 10 Demo-Tags gehört. Eigene Tags (andere UUIDs)
  bleiben erhalten.
- **Zurücksetzen:** Einstellungen → „Demo zurücksetzen“ stellt den Originalzustand wieder her (für alle Rollen).
  Gelöschtes oder Geändertes betrifft immer nur das eigene Gerät.
- **Demo-Etiketten:** QR-Etiketten → „Demo-Etiketten“ wählt die 10 Demo-Tags in der Reihenfolge der Liste aus, mit
  Tag-Nummer und Kurzbezeichnung. Das Format (Avery-Bogen) wählst du wie gewohnt.
- Wartungsintervalle, FAQ und Ersatzteile (DEMO-…, L-…) sind Beispielwerte. Die Bauteilseite zeigt dazu den Hinweis
  „Demo-Daten“.

## 8. Herstellerdokumente und eigene PDFs

Dokumente, die mit der App ausgeliefert werden, liegen unter `public/docs/<Hersteller>/` und sind in
`public/docs/manifest.json` eingetragen (Titel, Art, Sprache, Quelle, Abrufdatum). Sie erscheinen auf der
Bauteilseite unter „Dokumente“ und öffnen sich im eingebauten PDF-Viewer (Zoom, Seiten, Herunterladen). Einmal
geöffnete Dokumente bleiben im Speicher des Handys und funktionieren dann auch ohne Netz.

**Eigenes PDF hinzufügen:**

1. Die Datei nach `public/docs/eigene/` kopieren, z. B. `public/docs/eigene/Pruefprotokoll_1P101.pdf`.
   Dateinamen am besten ohne Leerzeichen und Umlaute; Dateien über 20 MB nicht einchecken.
2. In `public/docs/manifest.json` unter `"documents"` einen Eintrag ergänzen:

   ```json
   {
     "id": "eigene-pruefprotokoll-1p101",
     "file": "eigene/Pruefprotokoll_1P101.pdf",
     "title": "Prüfprotokoll Inbetriebnahme",
     "type": "Prüfbericht",
     "language": "de",
     "sourceUrl": "",
     "retrievedAt": "2026-11-18",
     "articleNumbers": [],
     "tags": ["1P101"]
   }
   ```

   - `tags`: Tag-Nummern, bei denen das Dokument erscheinen soll.
   - `articleNumbers`: Artikelnummern einer Produktvorlage. Das Dokument erscheint dann bei **allen** Tags dieses
     Produkts, auch bei neu angelegten.
   - `retrievedAt`: Datum, das in der App als „Stand“ angezeigt wird.
   - optional `startPage`: Seite, auf der der Viewer das PDF öffnet.
   - `id` muss eindeutig sein.
3. Committen und pushen. Nach dem Deploy (1–2 Minuten) ist das Dokument auf allen Geräten sichtbar.

Fehlt eine Anleitung, steht in `"requests"` ein Eintrag „Betriebsanleitung – beim Hersteller anfragen“. Er öffnet
eine vorbereitete E-Mail an die hinterlegte Adresse (`email`, leer = ohne Empfänger). Liegt die Anleitung später
vor, den Eintrag aus `"requests"` löschen und das PDF wie oben eintragen.

Dokumente, die in der App selbst hochgeladen werden, liegen dagegen nur auf dem jeweiligen Gerät (Browser-Speicher).

## 9. Störmeldungen in der Demo vorführen

Ohne Server landet eine Meldung nur auf dem Gerät, auf dem sie abgeschickt wird. So führst du es vor:

1. Einstellungen → Rolle **„Öffentlich (ohne Account)“** (oder ein neues Handy nehmen).
2. Demo-Karte scannen → nur Tag und **„Störung melden“** → Beschreibung, Name, Foto → absenden →
   „Danke, Ihre Meldung ist eingegangen“.
3. **„Anmelden (Demo)“** → J. Simon (Administrator). Auf der Bauteilseite steht „1 offene Meldung“,
   in der Navigation „Meldungen“ mit rotem Zähler.
4. Meldungen → **„Als Tagebucheintrag übernehmen“** → der Eintrag steht im Tagebuch, die Meldung ist erledigt.
5. Optional: Hallen-Monitor auf demselben Gerät zeigt die offene Meldung, bis sie übernommen ist.

## 10. Hallen-Monitor (Fernseher)

- Übersicht (PC) → **„Hallen-Monitor starten“** (Vollbild) oder direkt `https://js-3000.github.io/Tagnera/#/monitor`
  im Browser des Fernsehers öffnen. Optional nur eine Anlage: `#/monitor?anlage=Demoanlage%20ConnecTag`.
- Aktualisiert sich jede Minute, blättert bei vielen Einträgen automatisch, verhindert das Abschalten des
  Bildschirms (Wake Lock, wo der Browser es kann). Beenden mit **Esc** oder dem dezenten ✕ oben rechts.
- **Wichtig:** Ohne Server zeigt der Monitor nur die Daten des Geräts, auf dem er läuft. Für eine echte Halle braucht
  es später den Server (siehe Abschnitt 6), dann sehen alle Geräte dieselben Daten.

## 11. Offline-Modus

- App, Bauteilseiten und bereits geöffnete Dokumente funktionieren ohne Netz (Service Worker + lokale Datenbank).
  Im Kopf erscheint dann **„Offline“**.
- Für den späteren Server ist eine Warteschlange vorbereitet (`src/services/outbox.ts`): Ist ein Server angebunden
  (`configureRemote(...)`), wird jeder Schreibvorgang dort zwischengespeichert und bei Verbindung der Reihe nach
  nachgesendet. Im Prototyp ohne Server wird nichts in die Warteschlange gelegt.

## 12. Responsive-Prüfung

```bash
npm run build
```

```bash
npm run check:responsive
```

Ruft alle wichtigen Seiten bei 320, 360, 390, 430, 768, 1024, 1280 und 1920 px sowie im Handy-Querformat auf,
meldet seitlichen Überlauf und zu kleine Touch-Ziele (< 44 px) und legt Screenshots samt Übersicht unter
`test-results/responsive/index.html` ab. Auf dem eigenen Rechner einmalig `npx playwright install chromium` ausführen.

## 13. App auf dem Handy aktualisieren (neues Icon)

- **Inhalt und Funktionen** aktualisieren sich automatisch: App öffnen, einige Sekunden warten, schließen und erneut
  öffnen – dann läuft die neue Version.
- **Das App-Icon und der Name auf dem Startbildschirm** werden vom Betriebssystem zwischengespeichert:
  - **Android (Chrome):** übernimmt neues Icon und Namen meist automatisch innerhalb von 1–2 Tagen. Sofort: App vom
    Startbildschirm entfernen, die Adresse in Chrome öffnen und erneut „App installieren“ wählen.
  - **iPhone (Safari):** übernimmt Icons nie automatisch. Icon lange drücken → „App entfernen“ → in Safari
    `https://js-3000.github.io/Tagnera/` öffnen → Teilen → „Zum Home-Bildschirm“.
  - Beim Entfernen des Icons bleiben die Daten auf Android in Chrome erhalten. Auf dem iPhone hat die installierte App
    einen eigenen Speicher – vorher in den Einstellungen „Daten exportieren“ und danach wieder importieren, falls dort
    eigene Daten liegen. Die Demo lädt sich ohnehin automatisch.

## Nicht Teil des Prototyps

Kein Backend, kein echter Login, keine Push-Nachrichten, keine SAP-Schnittstelle, keine native App.
