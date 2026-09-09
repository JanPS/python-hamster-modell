# Hamsterbau

Ein Port des [Java-Hamster-Modells](https://www.java-hamster-modell.de/simulator.html) auf Python – vollständig im Browser, ohne Installation. Kein Pyodide, kein Build-Schritt: ein eigenständiger Python-Interpreter in reinem JavaScript treibt den Hamster an. Die App besteht aus `index.html` (alles inline) plus der frei anpassbaren Aufgabensammlung `aufgaben.js`.

## Nutzung

Einfach `index.html` im Browser öffnen – lokal per Doppelklick oder über einen beliebigen statischen Webserver (z. B. den Schulserver, GitHub Pages, oder `python3 -m http.server`). Es gibt keine Abhängigkeiten, keinen Build-Schritt und keine externen Laufzeit-Downloads außer den Google-Fonts-Schriftschnitten. `aufgaben.js` muss neben `index.html` liegen; fehlt sie, startet die App mit einem leeren Territorium.

### Direkt testen
unter https://janps.github.io/python-hamster-modell/

## Funktionsumfang

- **Original-Hamster-Befehle:** `vor()`, `linksUm()`, `nimm()`, `gib()`, `vornFrei()`, `kornDa()`, `maulLeer()` – plus die praktischen Zusatzbefehle `rechtsUm()` und `kehrt()`
- **Python-Subset:** Variablen & Zuweisung (inkl. `+= -= *= /=`), `if/elif/else`, `while`, `for x in range(...)`, `def`/`return` (inkl. Rekursion), `break`/`continue`/`pass`, `print(...)`, Vergleiche, `and/or/not`, die üblichen Rechenoperatoren, Kommentare
- **Schritt-für-Schritt-Wiedergabe:** Play/Pause, Vor/Zurück, Geschwindigkeitsregler, synchrone Zeilen-Hervorhebung im Code (auch für reine Rechenschritte)
- **Variablen-Monitor:** zeigt zu jedem Schritt alle Variablen und ihren aktuellen Wert; während eines Funktionsaufrufs zusätzlich die lokalen Variablen
- **Territoriums-Editor:** eigene Territorien klicken (Größe, Wände, Körner, Startposition/-richtung), als JSON speichern/laden
- **Aufgaben in `aufgaben.js`:** Auswahlliste frei anpassbar (Territorium als ASCII-Zeilen, Aufgabentext, Startprogramm); fehlerhafte Einträge werden übersprungen und oben gemeldet
- **Programm speichern/laden** als `.py`-Textdatei

Bewusst *nicht* enthalten: Listen, Dictionaries, Klassen, Imports, f-Strings – für das Hamster-Modell reicht das kleinere Sprach-Subset völlig aus und hält den Fokus auf Kontrollstrukturen.

## Aufbau

Die Anwendungslogik steckt komplett in `index.html`:

1. **Mini-Python-Interpreter** (Tokenizer → Parser → Tree-Walking-Interpreter) mit Frame-Aufzeichnung: jeder Hamster-Befehl, jede Zuweisung und jedes `print()` erzeugt einen Snapshot, sodass der Ablauf danach frei durchgescrubbt werden kann.
2. **Hamster-Territorium** – das Datenmodell (Grid, Wände, Körner, Position/Richtung) inklusive der Original-Befehle und ihrer Fehlerfälle (gegen die Wand laufen, ohne Korn nehmen/ablegen).
3. **Aufgaben-Lader** – liest `window.HAMSTERBAU_AUFGABEN` aus `aufgaben.js`, prüft jeden Eintrag und wandelt ihn in ein Territorium um.
4. **UI** – Code-Editor mit Zeilennummern, Canvas-Rendering des Territoriums, Variablen-Monitor, Territoriums-Editor, Hilfe-Modal.

## Eigene Territorien & Aufgaben

Die Auswahlliste wird aus `aufgaben.js` gefüllt. Die Datei ist ausführlich kommentiert; ein Eintrag sieht so aus:

```js
{
  id: 'kornsuche',
  titel: 'Kornsuche (Beispiel gelöst)',
  aufgabe: 'Sammle alle Körner in der Reihe ein.',
  territorium: [
    '##########',
    '#.1.2.1.3#',   // #=Wand  .=frei  1..9=Körner
    '##########',
  ],
  start: { zeile: 1, spalte: 1, richtung: 'O', koerner: 0 },
  code: 'while vornFrei():\n    vor()\n',
}
```

Datei bearbeiten, speichern, Seite neu laden. Fehlerhafte Einträge (ungleiche Zeilenlängen, Start auf einer Wand, unbekannte Richtung) werden übersprungen und oberhalb des Editors gemeldet – Details in der Browser-Konsole. `node dev/test/run-tests.js` prüft `aufgaben.js` zusätzlich auf Syntax und Struktur. Alternativ bauen Lernende Territorien live über „Territorium bauen“ und exportieren sie als `.json`.

## Entwicklung & Tests

Ausgeliefert werden `index.html` (Anwendungslogik inline) und `aufgaben.js` (Aufgabendaten). Unter `dev/` liegen dieselben Kernbausteine – Interpreter (`dev/interpreter.js`) und Hamster-Territorium (`dev/hamster-engine.js`) – als separate Node-Module mit einer kleinen Testsuite:

```
cd dev
node test/run-tests.js
```

Wer den Interpreter selbst weiterentwickelt, kann hier isoliert testen (Wandkollision, Kornsammeln, Rekursion, Endlosschleifen-Schutz, Syntaxfehler, Variablen-Monitor, `aufgaben.js`) und die geprüften Änderungen danach von Hand in den `<script>`-Block von `index.html` übernehmen.

## Lizenz / Nutzung

Frei nutz- und anpassbar für den eigenen Unterricht.
