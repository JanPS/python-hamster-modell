// SPDX-License-Identifier: MIT — Copyright (c) 2026 Jan Schuster. Siehe LICENSE.
const { parse, Interpreter, PyError } = require('../interpreter.js');
const { Territory } = require('../hamster-engine.js');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

function makeTerritory(rowsSpec, hamster) {
  const grid = rowsSpec.map((row) => row.split('').map((ch) => ({
    wall: ch === '#',
    grain: /[0-9]/.test(ch) ? parseInt(ch, 10) : 0,
  })));
  return new Territory({ rows: grid.length, cols: grid[0].length, grid, hamster });
}

let failures = 0;
function check(name, cond, extra) {
  if (!cond) { failures++; console.log('FAIL:', name, extra || ''); }
  else console.log('ok  :', name);
}

// Test 1: einfacher Vorwärtslauf bis zur Wand, dann Fehler erwartet
{
  const territory = makeTerritory([
    '######',
    '#....#',
    '######',
  ], { row: 1, col: 1, dir: 1, grain: 0 });
  const src = `
i = 0
while vornFrei():
    vor()
    i = i + 1
print(i)
`;
  const ast = parse(src);
  const interp = new Interpreter(territory);
  const result = interp.run(ast);
  check('vorwaerts bis wand: kein fehler', result.error === null, result.error);
  const lastFrame = result.frames[result.frames.length - 1];
  check('vorwaerts bis wand: endposition col=4', lastFrame.snapshot.hCol === 4, lastFrame.snapshot.hCol);
  const consoleOut = result.frames.find((f) => f.label.startsWith('print'));
  check('vorwaerts bis wand: i=3 ausgegeben', consoleOut.console.trim() === '3', JSON.stringify(consoleOut.console));
}

// Test 2: Korn sammeln mit if/kornDa/nimm in Schleife + Funktion
{
  const territory = makeTerritory([
    '#######',
    '#1011.#',
    '#######',
  ], { row: 1, col: 1, dir: 1, grain: 0 });
  const src = `
def sammleFeld():
    if kornDa():
        nimm()

while vornFrei():
    sammleFeld()
    vor()
sammleFeld()
print(maulLeer())
`;
  const ast = parse(src);
  const interp = new Interpreter(territory);
  const result = interp.run(ast);
  check('korn sammeln: kein fehler', result.error === null, result.error);
  const last = result.frames[result.frames.length - 1];
  check('korn sammeln: 3 koerner im maul', last.snapshot.hGrain === 3, last.snapshot.hGrain);
  check('korn sammeln: maulLeer False ausgegeben', last.console.trim() === 'False', JSON.stringify(last.console));
}

// Test 3: Fehlerfall - gegen die Wand laufen
{
  const territory = makeTerritory([
    '###',
    '#.#',
    '###',
  ], { row: 1, col: 1, dir: 0, grain: 0 });
  const src = `vor()\n`;
  const ast = parse(src);
  const interp = new Interpreter(territory);
  const result = interp.run(ast);
  check('wandcrash: fehler erkannt', result.error && result.error.includes('Wand'), result.error);
}

// Test 4: for-range Schleife + verschachtelte Funktionen + Rekursion
{
  const territory = makeTerritory(['####', '#..#', '####'], { row: 1, col: 1, dir: 1, grain: 0 });
  const src = `
def fakultaet(n):
    if n <= 1:
        return 1
    return n * fakultaet(n - 1)

summe = 0
for i in range(1, 5):
    summe += i
print(summe)
print(fakultaet(5))
`;
  const ast = parse(src);
  const interp = new Interpreter(territory);
  const result = interp.run(ast);
  check('for+rekursion: kein fehler', result.error === null, result.error);
  const prints = result.frames.filter((f) => f.label.startsWith('print')).map((f) => f.console);
  check('for+rekursion: summe=10', prints[0].trim() === '10', prints[0]);
  check('for+rekursion: fakultaet(5)=120', prints[1].trim().endsWith('120'), prints[1]);
}

// Test 5: Endlosschleifenschutz
{
  const territory = makeTerritory(['####', '#..#', '####'], { row: 1, col: 1, dir: 1, grain: 0 });
  const src = `
x = 0
while True:
    x = x + 1
`;
  const ast = parse(src);
  const interp = new Interpreter(territory, { maxSteps: 5000 });
  const result = interp.run(ast);
  check('endlosschleife: abbruch mit fehler', result.error && result.error.includes('Schritte'), result.error);
}

// Test 6: Syntaxfehler wird sauber gemeldet
{
  try {
    parse('wenn kornDa():\n    nimm()\n');
    check('syntaxfehler erkannt', false);
  } catch (e) {
    check('syntaxfehler erkannt', e instanceof PyError, e);
  }
}

// Test 7: linksUm/rechtsUm/kehrt Richtungswechsel
{
  const territory = makeTerritory(['#####', '#...#', '#####'], { row: 1, col: 2, dir: 0, grain: 0 });
  const src = `
linksUm()
`;
  const ast = parse(src);
  const interp = new Interpreter(territory);
  const result = interp.run(ast);
  const last = result.frames[result.frames.length - 1];
  check('linksUm von Norden -> Westen (3)', last.snapshot.hDir === 3, last.snapshot.hDir);
}

// Test 8: ++ / -- werden mit hilfreicher Meldung abgelehnt
{
  try {
    parse('i = 0\ni++\n');
    check('++ abgelehnt', false);
  } catch (e) {
    check('++ abgelehnt', e instanceof PyError && e.message.includes("kein '++'"), e.message);
  }
  try {
    parse('i = 5\ni--\n');
    check('-- abgelehnt', false);
  } catch (e) {
    check('-- abgelehnt', e instanceof PyError && e.message.includes("kein '--'"), e.message);
  }
  check('+= weiterhin ok', (() => { try { parse('i = 0\ni += 1\n'); return true; } catch { return false; } })());
}

// Test 9: Zuweisungen erzeugen einen hervorhebbaren Schritt
{
  const territory = makeTerritory(['#####', '#...#', '#####'], { row: 1, col: 1, dir: 1, grain: 0 });
  const src = [
    'schritte = 0',      // Zeile 1
    'while vornFrei():',  // Zeile 2
    '    vor()',          // Zeile 3
    '    schritte += 1',  // Zeile 4
    'print(schritte)',    // Zeile 5
  ].join('\n');
  const ast = parse(src);
  const result = new Interpreter(territory).run(ast);
  check('zuweisung: kein fehler', result.error === null, result.error);
  const assignFrames = result.frames.filter((f) => f.line === 4);
  check('zuweisung: zeile 4 als schritt erfasst', assignFrames.length === 2, assignFrames.length);
  check('zuweisung: label zeigt neuen wert', assignFrames[1].label === 'schritte = 2', assignFrames[1].label);
  check('zuweisung: hamster-snapshot unveraendert uebernommen',
    assignFrames[0].snapshot.hCol === 2, assignFrames[0].snapshot.hCol);
}

// Test 10: Variablen-Monitor - jeder Frame trägt den aktuellen Variablenstand
{
  const territory = makeTerritory(['#####', '#...#', '#####'], { row: 1, col: 1, dir: 1, grain: 0 });
  const src = [
    'name = "Emil"',
    'schritte = 0',
    'while vornFrei():',
    '    vor()',
    '    schritte += 1',
  ].join('\n');
  const result = new Interpreter(territory).run(parse(src));
  check('monitor: kein fehler', result.error === null, result.error);
  const last = result.frames[result.frames.length - 1];
  const map = new Map(last.vars);
  check('monitor: schritte am ende = 2', map.get('schritte') === 2, JSON.stringify(last.vars));
  check('monitor: string-variable erhalten', map.get('name') === 'Emil', JSON.stringify(last.vars));
  const firstAssign = result.frames.find((f) => f.vars.length === 1);
  check('monitor: erster schritt kennt nur "name"', firstAssign && firstAssign.vars[0][0] === 'name', JSON.stringify(firstAssign && firstAssign.vars));
}

// Test 11: Monitor zeigt lokale Variablen während eines Funktionsaufrufs
{
  const territory = makeTerritory(['####', '#..#', '####'], { row: 1, col: 1, dir: 1, grain: 0 });
  const src = [
    'g = 10',
    'def f(a):',
    '    b = a + 1',
    '    return b',
    'ergebnis = f(5)',
  ].join('\n');
  const result = new Interpreter(territory).run(parse(src));
  check('monitor-lokal: kein fehler', result.error === null, result.error);
  const insideF = result.frames.find((f) => new Map(f.vars).get('b') === 6);
  check('monitor-lokal: b=6 sichtbar in f', !!insideF, 'kein frame mit b=6');
  check('monitor-lokal: g weiterhin sichtbar', insideF && new Map(insideF.vars).get('g') === 10);
  const last = result.frames[result.frames.length - 1];
  check('monitor-lokal: b nach rückkehr weg', !new Map(last.vars).has('b'), JSON.stringify(last.vars));
  check('monitor-lokal: ergebnis=6 global', new Map(last.vars).get('ergebnis') === 6, JSON.stringify(last.vars));
}

// Test 12: aufgaben.js ist gültig und in sich stimmig
{
  const src = fs.readFileSync(path.join(__dirname, '..', '..', 'aufgaben.js'), 'utf8');
  const sandbox = { window: {} };
  let evalOk = true;
  try { vm.runInNewContext(src, sandbox, { filename: 'aufgaben.js' }); }
  catch (e) { evalOk = false; check('aufgaben.js: lädt ohne Syntaxfehler', false, e.message); }
  if (evalOk) {
    check('aufgaben.js: lädt ohne Syntaxfehler', true);
    const list = sandbox.window.HAMSTERBAU_AUFGABEN;
    check('aufgaben.js: nicht-leeres Array', Array.isArray(list) && list.length > 0, typeof list);
    const ids = new Set();
    let strukturOk = true;
    let startOk = true;
    for (const a of list || []) {
      if (!a || !a.id || !a.titel || !Array.isArray(a.territorium) || a.territorium.length < 1) { strukturOk = false; continue; }
      const w = a.territorium[0].length;
      if (a.territorium.some((r) => typeof r !== 'string' || r.length !== w)) strukturOk = false;
      ids.add(a.id);
      const s = a.start || {};
      const z = Number.isFinite(s.zeile) ? s.zeile : 1;
      const sp = Number.isFinite(s.spalte) ? s.spalte : 1;
      if (a.territorium[z] && a.territorium[z][sp] === '#') startOk = false;
    }
    check('aufgaben.js: jede Aufgabe hat id/titel/territorium, Zeilen gleich lang', strukturOk);
    check('aufgaben.js: ids eindeutig', ids.size === (list ? list.length : 0), [...ids].join(','));
    check('aufgaben.js: kein Hamster startet auf einer Wand', startOk);
  }
}

console.log(failures === 0 ? '\nALLE TESTS OK' : `\n${failures} TEST(S) FEHLGESCHLAGEN`);
process.exit(failures === 0 ? 0 : 1);
