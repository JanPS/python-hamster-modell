// SPDX-License-Identifier: MIT — Copyright (c) 2026 Jan Schuster. Siehe LICENSE.
// ---------------------------------------------------------------------------
// Mini-Python-Interpreter für das Hamster-Modell
// Unterstützt: Zahlen, Strings, bool, None, Variablen, Zuweisung (=, +=, -=,
// *=, /=), if/elif/else, while, for x in range(...), def/return, break,
// continue, pass, print(), Vergleiche, and/or/not, + - * / // % **, Klammern,
// Funktionsaufrufe (inkl. Rekursion). Kein Listen/Dict-Support (bewusst
// minimal gehalten, siehe Hilfe-Panel in der UI).
// ---------------------------------------------------------------------------

// ===== Fehlerklassen =====
class PyError extends Error {
  constructor(message, line) {
    super(message);
    this.pyMessage = message;
    this.line = line;
  }
}
class HamsterError extends PyError {}

// Interne Signale für Kontrollfluss (kein echter Fehler)
class BreakSignal {}
class ContinueSignal {}
class ReturnSignal { constructor(value) { this.value = value; } }

// ===== Tokenizer =====
const KEYWORDS = new Set([
  'if', 'elif', 'else', 'while', 'for', 'in', 'def', 'return', 'break',
  'continue', 'pass', 'and', 'or', 'not', 'True', 'False', 'None',
]);

function tokenize(source) {
  const tokens = [];
  const lines = source.replace(/\r\n/g, '\n').replace(/\t/g, '    ').split('\n');
  const indentStack = [0];
  let parenDepth = 0;

  for (let lineNo = 0; lineNo < lines.length; lineNo++) {
    let raw = lines[lineNo];
    // Kommentar entfernen (naiv: # außerhalb von Strings)
    let line = stripComment(raw);

    if (parenDepth === 0) {
      const trimmed = line.trim();
      if (trimmed === '') continue; // Leerzeile / reine Kommentarzeile
      const indent = line.length - line.replace(/^ */, '').length;
      if (indent > indentStack[indentStack.length - 1]) {
        indentStack.push(indent);
        tokens.push({ type: 'INDENT', line: lineNo + 1 });
      }
      while (indent < indentStack[indentStack.length - 1]) {
        indentStack.pop();
        tokens.push({ type: 'DEDENT', line: lineNo + 1 });
      }
      if (indent !== indentStack[indentStack.length - 1]) {
        throw new PyError(`Zeile ${lineNo + 1}: uneinheitliche Einrückung`, lineNo + 1);
      }
    }

    tokenizeLine(line, lineNo + 1, tokens, (d) => (parenDepth += d));
    if (parenDepth === 0) {
      const last = tokens[tokens.length - 1];
      if (last && last.type !== 'NEWLINE' && last.type !== 'INDENT' && last.type !== 'DEDENT') {
        tokens.push({ type: 'NEWLINE', line: lineNo + 1 });
      }
    }
  }
  while (indentStack.length > 1) {
    indentStack.pop();
    tokens.push({ type: 'DEDENT', line: lines.length });
  }
  tokens.push({ type: 'EOF', line: lines.length });
  return tokens;
}

function stripComment(line) {
  let inStr = null;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inStr) {
      if (c === '\\') { i++; continue; }
      if (c === inStr) inStr = null;
    } else if (c === '"' || c === "'") {
      inStr = c;
    } else if (c === '#') {
      return line.slice(0, i);
    }
  }
  return line;
}

const OPS3 = ['**='];
const OPS2 = ['==', '!=', '<=', '>=', '//', '**', '+=', '-=', '*=', '/='];
const OPS1 = ['+', '-', '*', '/', '%', '(', ')', ',', ':', '=', '<', '>'];

function tokenizeLine(line, lineNo, tokens, addParen) {
  let i = 0;
  const n = line.length;
  while (i < n) {
    const c = line[i];
    if (c === ' ') { i++; continue; }
    if (c === '"' || c === "'") {
      const quote = c;
      let j = i + 1;
      let s = '';
      while (j < n && line[j] !== quote) {
        if (line[j] === '\\' && j + 1 < n) {
          const nc = line[j + 1];
          const map = { n: '\n', t: '\t', '\\': '\\', "'": "'", '"': '"' };
          s += map[nc] !== undefined ? map[nc] : nc;
          j += 2;
        } else {
          s += line[j];
          j++;
        }
      }
      tokens.push({ type: 'STRING', value: s, line: lineNo });
      i = j + 1;
      continue;
    }
    if (/[0-9]/.test(c) || (c === '.' && /[0-9]/.test(line[i + 1] || ''))) {
      let j = i;
      let isFloat = false;
      while (j < n && /[0-9]/.test(line[j])) j++;
      if (line[j] === '.') { isFloat = true; j++; while (j < n && /[0-9]/.test(line[j])) j++; }
      const text = line.slice(i, j);
      tokens.push({ type: 'NUMBER', value: isFloat ? parseFloat(text) : parseInt(text, 10), line: lineNo });
      i = j;
      continue;
    }
    if (/[A-Za-z_]/.test(c)) {
      let j = i;
      while (j < n && /[A-Za-z0-9_]/.test(line[j])) j++;
      const word = line.slice(i, j);
      if (KEYWORDS.has(word)) tokens.push({ type: word.toUpperCase(), line: lineNo });
      else tokens.push({ type: 'NAME', value: word, line: lineNo });
      i = j;
      continue;
    }
    if (c === '+' && line[i + 1] === '+') throw new PyError(`Zeile ${lineNo}: In Python gibt es kein '++'. Zum Hochzählen einer Variablen: i += 1`, lineNo);
    if (c === '-' && line[i + 1] === '-') throw new PyError(`Zeile ${lineNo}: In Python gibt es kein '--'. Zum Runterzählen einer Variablen: i -= 1`, lineNo);
    const three = line.slice(i, i + 3);
    if (OPS3.includes(three)) { tokens.push({ type: three, line: lineNo }); i += 3; continue; }
    const two = line.slice(i, i + 2);
    if (OPS2.includes(two)) { tokens.push({ type: two, line: lineNo }); i += 2; continue; }
    if (OPS1.includes(c)) {
      if (c === '(') addParen(1);
      if (c === ')') addParen(-1);
      tokens.push({ type: c, line: lineNo });
      i++;
      continue;
    }
    throw new PyError(`Zeile ${lineNo}: unerwartetes Zeichen '${c}'`, lineNo);
  }
}

// ===== Parser =====
class Parser {
  constructor(tokens) { this.toks = tokens; this.pos = 0; }
  peek(o = 0) { return this.toks[this.pos + o]; }
  at(type) { return this.peek().type === type; }
  advance() { return this.toks[this.pos++]; }
  expect(type) {
    if (!this.at(type)) {
      const t = this.peek();
      throw new PyError(`Zeile ${t.line}: erwartet '${type}', gefunden '${t.type}'`, t.line);
    }
    return this.advance();
  }
  skipNewlines() { while (this.at('NEWLINE')) this.advance(); }

  parseProgram() {
    const stmts = [];
    this.skipNewlines();
    while (!this.at('EOF')) {
      stmts.push(this.parseStatement());
      this.skipNewlines();
    }
    return { type: 'Program', body: stmts };
  }

  parseBlock() {
    this.expect(':');
    this.expect('NEWLINE');
    this.expect('INDENT');
    const stmts = [];
    this.skipNewlines();
    while (!this.at('DEDENT')) {
      stmts.push(this.parseStatement());
      this.skipNewlines();
    }
    this.expect('DEDENT');
    return stmts;
  }

  parseStatement() {
    const t = this.peek();
    switch (t.type) {
      case 'IF': return this.parseIf();
      case 'WHILE': return this.parseWhile();
      case 'FOR': return this.parseFor();
      case 'DEF': return this.parseDef();
      case 'RETURN': {
        this.advance();
        let arg = null;
        if (!this.at('NEWLINE')) arg = this.parseExpr();
        return { type: 'Return', argument: arg, line: t.line };
      }
      case 'BREAK': this.advance(); return { type: 'Break', line: t.line };
      case 'CONTINUE': this.advance(); return { type: 'Continue', line: t.line };
      case 'PASS': this.advance(); return { type: 'Pass', line: t.line };
      default: return this.parseSimpleStatement();
    }
  }

  parseIf() {
    const line = this.expect('IF').line;
    const test = this.parseExpr();
    const consequent = this.parseBlock();
    let alternate = null;
    this.skipNewlines();
    if (this.at('ELIF')) {
      alternate = [this.parseIf()];
      return { type: 'If', test, consequent, alternate, line };
    } else if (this.at('ELSE')) {
      this.advance();
      alternate = this.parseBlock();
    }
    return { type: 'If', test, consequent, alternate, line };
  }

  parseWhile() {
    const line = this.expect('WHILE').line;
    const test = this.parseExpr();
    const body = this.parseBlock();
    return { type: 'While', test, body, line };
  }

  parseFor() {
    const line = this.expect('FOR').line;
    const varName = this.expect('NAME').value;
    this.expect('IN');
    const iterCall = this.parseExpr();
    const body = this.parseBlock();
    return { type: 'For', varName, iter: iterCall, body, line };
  }

  parseDef() {
    const line = this.expect('DEF').line;
    const name = this.expect('NAME').value;
    this.expect('(');
    const params = [];
    while (!this.at(')')) {
      params.push(this.expect('NAME').value);
      if (this.at(',')) this.advance(); else break;
    }
    this.expect(')');
    const body = this.parseBlock();
    return { type: 'FunctionDef', name, params, body, line };
  }

  parseSimpleStatement() {
    const start = this.peek();
    const expr = this.parseExpr();
    if (['=', '+=', '-=', '*=', '/='].includes(this.peek().type)) {
      const op = this.advance().type;
      const value = this.parseExpr();
      if (expr.type !== 'Name') throw new PyError(`Zeile ${start.line}: ungültiges Ziel für Zuweisung`, start.line);
      return { type: 'Assign', name: expr.name, op, value, line: start.line };
    }
    return { type: 'ExprStatement', expr, line: start.line };
  }

  // Ausdrücke, aufsteigende Präzedenz
  parseExpr() { return this.parseOr(); }
  parseOr() {
    let left = this.parseAnd();
    while (this.at('OR')) { this.advance(); const right = this.parseAnd(); left = { type: 'BoolOp', op: 'or', left, right }; }
    return left;
  }
  parseAnd() {
    let left = this.parseNot();
    while (this.at('AND')) { this.advance(); const right = this.parseNot(); left = { type: 'BoolOp', op: 'and', left, right }; }
    return left;
  }
  parseNot() {
    if (this.at('NOT')) { const line = this.advance().line; const arg = this.parseNot(); return { type: 'UnaryOp', op: 'not', arg, line }; }
    return this.parseComparison();
  }
  parseComparison() {
    let left = this.parseAdd();
    const cmpOps = ['==', '!=', '<', '>', '<=', '>='];
    while (cmpOps.includes(this.peek().type)) {
      const op = this.advance().type;
      const right = this.parseAdd();
      left = { type: 'Compare', op, left, right };
    }
    return left;
  }
  parseAdd() {
    let left = this.parseMul();
    while (this.at('+') || this.at('-')) {
      const op = this.advance().type;
      const right = this.parseMul();
      left = { type: 'BinOp', op, left, right };
    }
    return left;
  }
  parseMul() {
    let left = this.parseUnary();
    while (this.at('*') || this.at('/') || this.at('//') || this.at('%')) {
      const op = this.advance().type;
      const right = this.parseUnary();
      left = { type: 'BinOp', op, left, right };
    }
    return left;
  }
  parseUnary() {
    if (this.at('-') || this.at('+')) {
      const op = this.advance().type;
      const arg = this.parseUnary();
      return { type: 'UnaryOp', op, arg };
    }
    return this.parsePower();
  }
  parsePower() {
    const base = this.parseCall();
    if (this.at('**')) { this.advance(); const exp = this.parseUnary(); return { type: 'BinOp', op: '**', left: base, right: exp }; }
    return base;
  }
  parseCall() {
    let node = this.parseAtom();
    while (this.at('(')) {
      const line = this.advance().line;
      const args = [];
      while (!this.at(')')) {
        args.push(this.parseExpr());
        if (this.at(',')) this.advance(); else break;
      }
      this.expect(')');
      if (node.type !== 'Name') throw new PyError(`Zeile ${line}: Aufruf nur auf Namen möglich`, line);
      node = { type: 'Call', callee: node.name, args, line };
    }
    return node;
  }
  parseAtom() {
    const t = this.peek();
    switch (t.type) {
      case 'NUMBER': this.advance(); return { type: 'Num', value: t.value };
      case 'STRING': this.advance(); return { type: 'Str', value: t.value };
      case 'TRUE': this.advance(); return { type: 'Bool', value: true };
      case 'FALSE': this.advance(); return { type: 'Bool', value: false };
      case 'NONE': this.advance(); return { type: 'NoneLit' };
      case 'NAME': this.advance(); return { type: 'Name', name: t.value, line: t.line };
      case '(': {
        this.advance();
        const e = this.parseExpr();
        this.expect(')');
        return e;
      }
      default:
        throw new PyError(`Zeile ${t.line}: unerwartetes Token '${t.type}'`, t.line);
    }
  }
}

function parse(source) {
  const tokens = tokenize(source);
  const parser = new Parser(tokens);
  return parser.parseProgram();
}

// ===== Environment =====
class Env {
  constructor(parent) { this.vars = new Map(); this.parent = parent; }
  get(name) {
    let e = this;
    while (e) { if (e.vars.has(name)) return e.vars.get(name); e = e.parent; }
    return undefined;
  }
  has(name) {
    let e = this;
    while (e) { if (e.vars.has(name)) return true; e = e.parent; }
    return false;
  }
  set(name, value) {
    let e = this;
    while (e) { if (e.vars.has(name)) { e.vars.set(name, value); return; } e = e.parent; }
    this.vars.set(name, value); // neue lokale Variable
  }
  declare(name, value) { this.vars.set(name, value); }
}

class PyFunction {
  constructor(node, closureEnv) { this.node = node; this.closureEnv = closureEnv; }
}

// ===== Interpreter =====
const MAX_STEPS = 200000;
const MAX_CALL_DEPTH = 300;
const MAX_MS = 4000;
const MAX_FRAMES = 40000;

class Interpreter {
  constructor(hamster, opts = {}) {
    this.hamster = hamster; // liefert vor/linksUm/... und wirft HamsterError
    this.frames = [];
    this.consoleText = '';
    this.stepCount = 0;
    this.callDepth = 0;
    this.startTime = 0;
    this.maxSteps = opts.maxSteps || MAX_STEPS;
  }

  pushFrame(label, line, extra) {
    extra = extra || {};
    if (this.frames.length >= MAX_FRAMES && !extra.error) return;
    const prev = this.frames[this.frames.length - 1];
    let vars = this.snapshotVars();
    if (prev && sameVars(prev.vars, vars)) vars = prev.vars;
    this.frames.push({
      label,
      line: line || null,
      console: this.consoleText,
      snapshot: extra.snapshot || this.hamster.snapshot(),
      vars,
      error: extra.error || null,
    });
  }

  snapshotVars() {
    const chain = [];
    for (let e = this.currentEnv; e; e = e.parent) chain.push(e);
    const out = [];
    const idx = new Map();
    for (let k = chain.length - 1; k >= 0; k--) {
      for (const [name, value] of chain[k].vars) {
        if (value instanceof PyFunction) continue;
        if (idx.has(name)) out[idx.get(name)] = [name, value];
        else { idx.set(name, out.length); out.push([name, value]); }
      }
    }
    return out;
  }

  checkBudget(line) {
    this.stepCount++;
    if (this.stepCount > this.maxSteps) {
      throw new PyError('Abbruch: zu viele Schritte ausgeführt (evtl. Endlosschleife?)', line);
    }
    if ((this.stepCount & 1023) === 0 && Date.now() - this.startTime > MAX_MS) {
      throw new PyError('Abbruch: Zeitlimit überschritten (evtl. Endlosschleife?)', line);
    }
  }

  run(ast) {
    this.startTime = Date.now();
    const globalEnv = new Env(null);
    this.currentEnv = globalEnv;
    this.pushFrame('Start', null);
    try {
      this.execBlock(ast.body, globalEnv);
    } catch (e) {
      if (e instanceof PyError) {
        this.pushFrame('Fehler', e.line, { error: e.pyMessage });
      } else {
        this.pushFrame('Fehler', null, { error: 'Interner Fehler: ' + e.message });
      }
      return { frames: this.frames, error: e.pyMessage || e.message };
    }
    return { frames: this.frames, error: null };
  }

  execBlock(stmts, env) {
    for (const s of stmts) this.execStmt(s, env);
  }

  execStmt(node, env) {
    this.checkBudget(node.line);
    switch (node.type) {
      case 'ExprStatement':
        this.evalExpr(node.expr, env);
        return;
      case 'Assign': {
        let value = this.evalExpr(node.value, env);
        if (node.op !== '=') {
          const cur = env.get(node.name);
          if (cur === undefined) throw new PyError(`Zeile ${node.line}: '${node.name}' ist nicht definiert`, node.line);
          value = applyBinOp(node.op.slice(0, -1), cur, value, node.line);
        }
        env.set(node.name, value);
        const prev = this.frames[this.frames.length - 1];
        this.pushFrame(node.name + ' = ' + pyStr(value), node.line, prev ? { snapshot: prev.snapshot } : null);
        return;
      }
      case 'If': {
        if (truthy(this.evalExpr(node.test, env))) this.execBlock(node.consequent, env);
        else if (node.alternate) this.execBlock(node.alternate, env);
        return;
      }
      case 'While': {
        let guard = 0;
        while (truthy(this.evalExpr(node.test, env))) {
          try { this.execBlock(node.body, env); }
          catch (e) { if (e instanceof BreakSignal) break; if (e instanceof ContinueSignal) { continue; } throw e; }
          guard++;
          this.checkBudget(node.line);
        }
        return;
      }
      case 'For': {
        const range = this.evalRangeCall(node.iter, env);
        for (const i of range) {
          env.set(node.varName, i);
          try { this.execBlock(node.body, env); }
          catch (e) { if (e instanceof BreakSignal) break; if (e instanceof ContinueSignal) continue; throw e; }
          this.checkBudget(node.line);
        }
        return;
      }
      case 'FunctionDef':
        env.declare(node.name, new PyFunction(node, env));
        return;
      case 'Return':
        throw new ReturnSignal(node.argument ? this.evalExpr(node.argument, env) : null);
      case 'Break':
        throw new BreakSignal();
      case 'Continue':
        throw new ContinueSignal();
      case 'Pass':
        return;
      default:
        throw new PyError(`Zeile ${node.line}: unbekannte Anweisung`, node.line);
    }
  }

  evalRangeCall(node, env) {
    if (node.type !== 'Call' || node.callee !== 'range') {
      throw new PyError(`Zeile ${node.line}: 'for' erwartet 'range(...)'`, node.line);
    }
    const args = node.args.map((a) => this.evalExpr(a, env));
    let start = 0, stop, step = 1;
    if (args.length === 1) stop = args[0];
    else if (args.length === 2) { start = args[0]; stop = args[1]; }
    else if (args.length >= 3) { start = args[0]; stop = args[1]; step = args[2]; }
    else throw new PyError(`Zeile ${node.line}: range() braucht 1-3 Argumente`, node.line);
    const out = [];
    if (step === 0) throw new PyError(`Zeile ${node.line}: range()-Schritt darf nicht 0 sein`, node.line);
    if (step > 0) for (let v = start; v < stop; v += step) out.push(v);
    else for (let v = start; v > stop; v += step) out.push(v);
    return out;
  }

  evalExpr(node, env) {
    switch (node.type) {
      case 'Num': return node.value;
      case 'Str': return node.value;
      case 'Bool': return node.value;
      case 'NoneLit': return null;
      case 'Name': {
        if (!env.has(node.name)) throw new PyError(`Zeile ${node.line}: Name '${node.name}' ist nicht definiert`, node.line);
        return env.get(node.name);
      }
      case 'UnaryOp': {
        const v = this.evalExpr(node.arg, env);
        if (node.op === 'not') return !truthy(v);
        if (node.op === '-') return -v;
        if (node.op === '+') return +v;
        break;
      }
      case 'BoolOp': {
        const l = this.evalExpr(node.left, env);
        if (node.op === 'and') return truthy(l) ? this.evalExpr(node.right, env) : l;
        return truthy(l) ? l : this.evalExpr(node.right, env);
      }
      case 'Compare': {
        const l = this.evalExpr(node.left, env);
        const r = this.evalExpr(node.right, env);
        switch (node.op) {
          case '==': return pyEquals(l, r);
          case '!=': return !pyEquals(l, r);
          case '<': return l < r;
          case '>': return l > r;
          case '<=': return l <= r;
          case '>=': return l >= r;
        }
        break;
      }
      case 'BinOp': {
        const l = this.evalExpr(node.left, env);
        const r = this.evalExpr(node.right, env);
        return applyBinOp(node.op, l, r, node.line);
      }
      case 'Call':
        return this.evalCall(node, env);
      default:
        throw new PyError('Unbekannter Ausdruck', node.line);
    }
  }

  evalCall(node, env) {
    const name = node.callee;
    const argVals = node.args.map((a) => this.evalExpr(a, env));

    // Eingebaute Hamster-Befehle
    if (this.hamster.commands[name]) {
      const result = this.hamster.commands[name](...argVals);
      this.pushFrame(name + '(' + argVals.join(', ') + ')', node.line);
      return result;
    }
    if (name === 'print') {
      this.consoleText += argVals.map(pyStr).join(' ') + '\n';
      this.pushFrame('print(' + argVals.map(pyStr).join(', ') + ')', node.line);
      return null;
    }
    if (name === 'range') {
      throw new PyError(`Zeile ${node.line}: range() kann nur in 'for ... in range(...)' verwendet werden`, node.line);
    }
    if (name === 'len') {
      const v = argVals[0];
      if (typeof v === 'string') return v.length;
      throw new PyError(`Zeile ${node.line}: len() wird hier nicht unterstützt`, node.line);
    }
    if (name === 'abs') return Math.abs(argVals[0]);
    if (name === 'int') return Math.trunc(Number(argVals[0]));

    if (!env.has(name)) throw new PyError(`Zeile ${node.line}: Funktion oder Befehl '${name}' ist nicht definiert`, node.line);
    const fn = env.get(name);
    if (!(fn instanceof PyFunction)) throw new PyError(`Zeile ${node.line}: '${name}' ist keine Funktion`, node.line);
    if (fn.node.params.length !== argVals.length) {
      throw new PyError(`Zeile ${node.line}: '${name}' erwartet ${fn.node.params.length} Argument(e), bekam ${argVals.length}`, node.line);
    }
    this.callDepth++;
    if (this.callDepth > MAX_CALL_DEPTH) {
      this.callDepth--;
      throw new PyError(`Zeile ${node.line}: zu tiefe Rekursion in '${name}'`, node.line);
    }
    const callEnv = new Env(fn.closureEnv);
    fn.node.params.forEach((p, i) => callEnv.declare(p, argVals[i]));
    const prevEnv = this.currentEnv;
    this.currentEnv = callEnv;
    let ret = null;
    try {
      this.execBlock(fn.node.body, callEnv);
    } catch (e) {
      if (e instanceof ReturnSignal) ret = e.value;
      else { this.callDepth--; this.currentEnv = prevEnv; throw e; }
    }
    this.callDepth--;
    this.currentEnv = prevEnv;
    return ret;
  }
}

function truthy(v) {
  if (v === null || v === undefined) return false;
  if (typeof v === 'number') return v !== 0;
  if (typeof v === 'string') return v.length > 0;
  return !!v;
}
function pyEquals(a, b) { return a === b; }
function pyStr(v) {
  if (v === null || v === undefined) return 'None';
  if (v === true) return 'True';
  if (v === false) return 'False';
  return String(v);
}
function pyRepr(v) { return typeof v === 'string' ? '"' + v + '"' : pyStr(v); }
function sameVars(a, b) {
  if (!a || a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i][0] !== b[i][0] || a[i][1] !== b[i][1]) return false;
  }
  return true;
}
function applyBinOp(op, l, r, line) {
  switch (op) {
    case '+':
      if (typeof l === 'string' || typeof r === 'string') return pyStr(l) + pyStr(r);
      return l + r;
    case '-': return l - r;
    case '*': return l * r;
    case '/':
      if (r === 0) throw new PyError(`Zeile ${line}: Division durch 0`, line);
      return l / r;
    case '//':
      if (r === 0) throw new PyError(`Zeile ${line}: Division durch 0`, line);
      return Math.floor(l / r);
    case '%':
      if (r === 0) throw new PyError(`Zeile ${line}: Division durch 0`, line);
      return ((l % r) + r) % r;
    case '**': return Math.pow(l, r);
    default: throw new PyError(`Zeile ${line}: unbekannter Operator '${op}'`, line);
  }
}

module.exports = { tokenize, parse, Interpreter, PyError, HamsterError };
