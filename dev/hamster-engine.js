// SPDX-License-Identifier: MIT — Copyright (c) 2026 Jan Schuster. Siehe LICENSE.
// ---------------------------------------------------------------------------
// Hamster-Territorium: Datenmodell + Befehle (nach dem Hamster-Modell von D. Boles)
// Richtungen: 0=Norden(oben) 1=Osten(rechts) 2=Sueden(unten) 3=Westen(links)
// ---------------------------------------------------------------------------
const { HamsterError } = (typeof module !== 'undefined') ? require('./interpreter.js') : { HamsterError: Error };

const DIR_NAMES = ['Norden', 'Osten', 'Süden', 'Westen'];
const DR = [-1, 0, 1, 0];
const DC = [0, 1, 0, -1];

function cloneGrid(grid) {
  return grid.map((row) => row.map((cell) => ({ wall: cell.wall, grain: cell.grain })));
}

class Territory {
  constructor(def) {
    this.rows = def.rows;
    this.cols = def.cols;
    this.grid = def.grid.map((row) => row.map((cell) => ({ wall: !!cell.wall, grain: cell.grain | 0 })));
    this.hRow = def.hamster.row;
    this.hCol = def.hamster.col;
    this.hDir = def.hamster.dir;
    this.hGrain = def.hamster.grain || 0;
    this.name = def.name || 'Territorium';

    this.commands = {
      vor: () => this.vor(),
      linksUm: () => this.linksUm(),
      nimm: () => this.nimm(),
      gib: () => this.gib(),
      vornFrei: () => this.vornFrei(),
      kornDa: () => this.kornDa(),
      maulLeer: () => this.maulLeer(),
      // Zusatzbefehle (nicht im Original-Java-Hamster-Modell, praktische Ergänzung):
      rechtsUm: () => { this.linksUm(); this.linksUm(); this.linksUm(); },
      kehrt: () => { this.linksUm(); this.linksUm(); },
    };
  }

  inBounds(r, c) { return r >= 0 && r < this.rows && c >= 0 && c < this.cols; }

  vornFrei() {
    const nr = this.hRow + DR[this.hDir];
    const nc = this.hCol + DC[this.hDir];
    if (!this.inBounds(nr, nc)) return false;
    return !this.grid[nr][nc].wall;
  }

  vor() {
    if (!this.vornFrei()) {
      throw new HamsterError('Der Hamster ist gegen eine Wand oder den Rand des Territoriums gelaufen!');
    }
    this.hRow += DR[this.hDir];
    this.hCol += DC[this.hDir];
  }

  linksUm() { this.hDir = (this.hDir + 3) % 4; }

  kornDa() { return this.grid[this.hRow][this.hCol].grain > 0; }

  maulLeer() { return this.hGrain === 0; }

  nimm() {
    if (!this.kornDa()) throw new HamsterError('Hier liegt kein Korn zum Aufnehmen!');
    this.grid[this.hRow][this.hCol].grain -= 1;
    this.hGrain += 1;
  }

  gib() {
    if (this.maulLeer()) throw new HamsterError('Der Hamster hat kein Korn im Maul zum Ablegen!');
    this.grid[this.hRow][this.hCol].grain += 1;
    this.hGrain -= 1;
  }

  snapshot() {
    return {
      rows: this.rows,
      cols: this.cols,
      grid: cloneGrid(this.grid),
      hRow: this.hRow,
      hCol: this.hCol,
      hDir: this.hDir,
      hGrain: this.hGrain,
    };
  }
}

if (typeof module !== 'undefined') module.exports = { Territory, DIR_NAMES, DR, DC };
