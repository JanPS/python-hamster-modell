# Hamsterbau

Ein Port des [Java-Hamster-Modells](https://www.java-hamster-modell.de/simulator.html) auf Python – vollständig im Browser, ohne Installation. Kein Pyodide, kein Build-Schritt: ein einziger, eigenständiger Python-Interpreter in reinem JavaScript treibt den Hamster an.

## Nutzung

Einfach `index.html` im Browser öffnen – lokal per Doppelklick oder über einen beliebigen statischen Webserver (z. B. den Schulserver, GitHub Pages, oder `python3 -m http.server`). Es gibt keine Abhängigkeiten, keinen Build-Schritt und keine externen Laufzeit-Downloads außer den Google-Fonts-Schriftschnitten.

## Funktionsumfang

- **Original-Hamster-Befehle:** `vor()`, `linksUm()`, `nimm()`, `gib()`, `vornFrei()`, `kornDa()`, `maulLeer()` – plus die praktischen Zusatzbefehle `rechtsUm()` und `kehrt()`
- **Python-Subset:** Variablen & Zuweisung (inkl. `+= -= *= /=`), `if/elif/else`, `while`, `for x in range(...)`, `def`/`return` (inkl. Rekursion), `break`/`continue`/`pass`, `print(...)`, Vergleiche, `and/or/not`, die üblichen Rechenoperatoren, Kommentare
- **Schritt-für-Schritt-Wiedergabe:** Play/Pause, Vor/Zurück, Geschwindigkeitsregler, synchrone Zeilen-Hervorhebung im Code (auch für reine Rechenschritte)
- **Variablen-Monitor:** zeigt zu jedem Schritt alle Variablen und ihren aktuellen Wert; während eines Funktionsaufrufs zusätzlich die lokalen Variablen
- **Territoriums-Editor:** eigene Territorien klicken (Größe, Wände, Körner, Startposition/-richtung), als JSON speichern/laden
- **Fünf Beispiel-Territorien** mit Aufgabenstellung, darunter eine gelöste Demo
- **Programm speichern/laden** als `.py`-Textdatei

Bewusst *nicht* enthalten: Listen, Dictionaries, Klassen, Imports, f-Strings – für das Hamster-Modell reicht das kleinere Sprach-Subset völlig aus und hält den Fokus auf Kontrollstrukturen.

## Aufbau

Alles steckt in einer einzigen Datei, `index.html`:

1. **Mini-Python-Interpreter** (Tokenizer → Parser → Tree-Walking-Interpreter) mit Frame-Aufzeichnung: jeder Hamster-Befehl und jedes `print()` erzeugt einen Snapshot, sodass der Ablauf danach frei durchgescrubbt werden kann.
2. **Hamster-Territorium** – das Datenmodell (Grid, Wände, Körner, Position/Richtung) inklusive der Original-Befehle und ihrer Fehlerfälle (gegen die Wand laufen, ohne Korn nehmen/ablegen).
3. **Beispiel-Territorien** als kompakte ASCII-Grids.
4. **UI** – Code-Editor mit Zeilennummern, Canvas-Rendering des Territoriums, Territoriums-Editor, Hilfe-Modal.

## Eigene Territorien & Aufgaben

Weitere Beispiele lassen sich direkt im `EXAMPLES`-Array in `index.html` ergänzen (Territorium per ASCII-Grid, Aufgabentext, Startcode) – oder Lernende bauen sie live über „Territorium bauen“ und exportieren sie als `.json`-Datei.

## Entwicklung & Tests

`index.html` ist die ausgelieferte, eigenständige Datei (alles inline). Unter `dev/` liegen dieselben Kernbausteine – Interpreter (`dev/interpreter.js`) und Hamster-Territorium (`dev/hamster-engine.js`) – als separate Node-Module mit einer kleinen Testsuite:

```
cd dev
node test/run-tests.js
```

Wer den Interpreter selbst weiterentwickelt, kann hier isoliert testen (Wandkollision, Kornsammeln, Rekursion, Endlosschleifen-Schutz, Syntaxfehler) und die geprüften Änderungen danach von Hand in den `<script>`-Block von `index.html` übernehmen.

## Lizenz / Nutzung

Frei nutz- und anpassbar für den eigenen Unterricht.
