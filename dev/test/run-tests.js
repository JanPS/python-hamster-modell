const { parse, Interpreter, PyError } = require('../interpreter.js');
const { Territory } = require('../hamster-engine.js');

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

console.log(failures === 0 ? '\nALLE TESTS OK' : `\n${failures} TEST(S) FEHLGESCHLAGEN`);
process.exit(failures === 0 ? 0 : 1);
