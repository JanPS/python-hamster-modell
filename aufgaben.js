/*
 * aufgaben.js — Aufgaben & Territorien für Hamsterbau
 * ==================================================================
 *
 * Diese Datei füllt die Auswahlliste oben rechts in der App. Sie darf
 * frei angepasst werden: bearbeiten, speichern, Seite neu laden.
 *
 * Wird die Datei nicht gefunden, startet die App mit einem leeren
 * Territorium. Enthält eine einzelne Aufgabe einen Fehler, wird nur
 * diese übersprungen und oben ein Hinweis angezeigt (Details in der
 * Browser-Konsole).
 *
 * ------------------------------------------------------------------
 * Aufbau einer Aufgabe (Objekt im Array unten):
 *
 *   id           eindeutiger Kurzname, keine Leerzeichen        (Pflicht)
 *   titel        Text in der Auswahlliste                       (Pflicht)
 *   aufgabe      Aufgabenstellung im gelben Kasten
 *                ("" oder weglassen = kein Kasten)
 *   territorium  Liste von Textzeilen, die das Feld zeichnen:   (Pflicht)
 *                   #     = Wand
 *                   .     = freies Feld
 *                   1..9  = so viele Körner auf diesem Feld
 *                Alle Zeilen müssen gleich lang sein.
 *   start        Startaufstellung des Hamsters:
 *                   zeile, spalte  Index in "territorium", 0-basiert
 *                                  (Zeile 0 = oberste Textzeile,
 *                                   Spalte 0 = erstes Zeichen)
 *                   richtung       "N", "O", "S" oder "W"  (Standard: "O")
 *                   koerner        Körner im Maul beim Start (Standard: 0)
 *                start darf weggelassen werden (Standard: Zeile 1,
 *                Spalte 1, Richtung Osten, 0 Körner).
 *   code         Startprogramm im Editor (mehrzeiliger Text)
 *
 * Die Reihenfolge im Array ist die Reihenfolge in der Liste; die erste
 * Aufgabe wird beim Öffnen der Seite angezeigt.
 * ------------------------------------------------------------------
 */

window.HAMSTERBAU_AUFGABEN = [

  {
    id: 'kornsuche',
    titel: 'Kornsuche (Beispiel gelöst)',
    aufgabe: 'Sammle alle Körner in der Reihe ein.',
    territorium: [
      '##########',
      '#.1.2.1.3#',
      '##########',
    ],
    start: { zeile: 1, spalte: 1, richtung: 'O' },
    code: [
      '# Raeumt ein Feld leer, auch wenn mehrere Koerner liegen.',
      'def feldLeeren():',
      '    while kornDa():',
      '        nimm()',
      '',
      'feldLeeren()',
      'while vornFrei():',
      '    vor()',
      '    feldLeeren()',
      '',
      'print("Fertig! Maul leer:", maulLeer())',
      '',
    ].join('\n'),
  },

  {
    id: 'wand',
    titel: 'Bis zur Wand',
    aufgabe: 'Lass den Hamster laufen, bis er vor einer Wand steht, und zaehle dabei die Schritte.',
    territorium: [
      '############',
      '#..........#',
      '############',
    ],
    start: { zeile: 1, spalte: 1, richtung: 'O' },
    code: [
      '# Zaehle die Schritte bis zur Wand.',
      'schritte = 0',
      '',
      '# Dein Code hier...',
      '',
      'print("Schritte:", schritte)',
      '',
    ].join('\n'),
  },

  {
    id: 'quadrat',
    titel: 'Das Quadrat',
    aufgabe: 'Der Hamster soll ein Quadrat mit Seitenlaenge 4 ablaufen (nutze eine Schleife!).',
    territorium: [
      '###########',
      '#.........#',
      '#.........#',
      '#.........#',
      '#.........#',
      '#.........#',
      '#.........#',
      '###########',
    ],
    start: { zeile: 3, spalte: 3, richtung: 'O' },
    code: [
      '# Tipp: eine Seite = 4x vor(), dann einmal drehen.',
      '# Das Ganze viermal wiederholen -> for-Schleife!',
      '',
      'for seite in range(4):',
      '    # ... dein Code ...',
      '    pass',
      '',
    ].join('\n'),
  },

  {
    id: 'slalom',
    titel: 'Der Slalom',
    aufgabe: 'Fahre um die Hindernisse herum, ohne gegen eine Wand zu laufen.',
    territorium: [
      '##############',
      '#............#',
      '#.##.##.##.#.#',
      '#............#',
      '##############',
    ],
    start: { zeile: 1, spalte: 1, richtung: 'O' },
    code: [
      '# Finde einen Weg um die Hindernisse.',
      'while vornFrei():',
      '    vor()',
      '',
    ].join('\n'),
  },

  {
    id: 'leer',
    titel: 'Leeres Territorium',
    aufgabe: '',
    territorium: [
      '############',
      '#..........#',
      '#..........#',
      '#..........#',
      '#..........#',
      '############',
    ],
    start: { zeile: 1, spalte: 1, richtung: 'O' },
    code: '# Schreibe hier dein eigenes Hamster-Programm...\n',
  },

];
