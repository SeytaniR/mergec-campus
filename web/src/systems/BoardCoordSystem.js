/**
 * BoardCoordSystem.js
 * Manages tactical arena grid geometry (7 cols x 6 rows) + 9-slot Merge Bench,
 * renders the stylized Magic Campus arena tiles (Pixi.js v7), and provides coordinate conversions.
 */
export class BoardCoordSystem {
  constructor(boardLayer) {
    this.boardLayer = boardLayer;
    this.COLS = 7;
    this.ROWS = 6; // Rows 0..2 = Enemy half, Rows 3..5 = Player half
    this.BENCH_SLOTS = 9;

    this.DESIGN_WIDTH = 920;
    this.DESIGN_HEIGHT = 720;

    this.CELL_W = 104;
    this.CELL_H = 82;
    this.BOARD_START_X = (this.DESIGN_WIDTH - this.COLS * this.CELL_W) / 2;
    this.BOARD_START_Y = 78;

    this.BENCH_CELL_W = 86;
    this.BENCH_CELL_H = 76;
    this.BENCH_START_X = (this.DESIGN_WIDTH - this.BENCH_SLOTS * this.BENCH_CELL_W) / 2;
    this.BENCH_Y = 605;

    this.gridGraphics = new PIXI.Graphics();
    this.highlightGraphics = new PIXI.Graphics();
    this.boardLayer.addChild(this.gridGraphics);
    this.boardLayer.addChild(this.highlightGraphics);
  }

  init() {
    this.drawBoardAndBench();
  }

  drawBoardAndBench() {
    const g = this.gridGraphics;
    g.clear();

    // Outer arcane arena pedestal
    g.lineStyle(2, 0x38bdf8, 0.45);
    g.beginFill(0x0f172a, 0.85);
    g.drawRoundedRect(
      this.BOARD_START_X - 24,
      this.BOARD_START_Y - 22,
      this.COLS * this.CELL_W + 48,
      this.ROWS * this.CELL_H + 44,
      18
    );
    g.endFill();

    // Draw 7x6 Arena Grid Cells
    for (let r = 0; r < this.ROWS; r++) {
      for (let c = 0; c < this.COLS; c++) {
        const x = this.BOARD_START_X + c * this.CELL_W;
        const y = this.BOARD_START_Y + r * this.CELL_H;
        const isEnemySide = r < 3;
        const isAlt = (r + c) % 2 === 0;

        const baseColor = isEnemySide
          ? (isAlt ? 0x2a1629 : 0x211122)
          : (isAlt ? 0x13263b : 0x0f1f32);
        const borderColor = isEnemySide ? 0xf43f5e : 0x38bdf8;

        g.lineStyle(1.5, borderColor, isEnemySide ? 0.28 : 0.45);
        g.beginFill(baseColor, 0.92);
        g.drawRoundedRect(x + 3, y + 3, this.CELL_W - 6, this.CELL_H - 6, 8);
        g.endFill();
      }
    }

    // Center battle divider line
    const midY = this.BOARD_START_Y + 3 * this.CELL_H;
    g.lineStyle(2.5, 0xf59e0b, 0.75);
    g.moveTo(this.BOARD_START_X - 10, midY);
    g.lineTo(this.BOARD_START_X + this.COLS * this.CELL_W + 10, midY);

    // Bench pedestal bar
    g.lineStyle(2, 0xfbbf24, 0.55);
    g.beginFill(0x0b1324, 0.94);
    g.drawRoundedRect(
      this.BENCH_START_X - 16,
      this.BENCH_Y - 12,
      this.BENCH_SLOTS * this.BENCH_CELL_W + 32,
      this.BENCH_CELL_H + 24,
      14
    );
    g.endFill();

    // Draw 9 Bench Slots
    for (let i = 0; i < this.BENCH_SLOTS; i++) {
      const bx = this.BENCH_START_X + i * this.BENCH_CELL_W;
      const by = this.BENCH_Y;
      g.lineStyle(1.5, 0x60a5fa, 0.45);
      g.beginFill(0x162238, 0.95);
      g.drawRoundedRect(bx + 3, by + 3, this.BENCH_CELL_W - 6, this.BENCH_CELL_H - 6, 8);
      g.endFill();
    }
  }

  highlightDropTarget(target) {
    const h = this.highlightGraphics;
    h.clear();
    if (!target) return;

    if (target.zone === 'board') {
      const x = this.BOARD_START_X + target.col * this.CELL_W;
      const y = this.BOARD_START_Y + target.row * this.CELL_H;
      h.lineStyle(2.5, 0x4ade80, 0.95);
      h.beginFill(0x22c55e, 0.32);
      h.drawRoundedRect(x + 2, y + 2, this.CELL_W - 4, this.CELL_H - 4, 8);
      h.endFill();
    } else if (target.zone === 'bench') {
      const bx = this.BENCH_START_X + target.slotIndex * this.BENCH_CELL_W;
      const by = this.BENCH_Y;
      h.lineStyle(2.5, 0xfacc15, 0.95);
      h.beginFill(0xfbbf24, 0.32);
      h.drawRoundedRect(bx + 2, by + 2, this.BENCH_CELL_W - 4, this.BENCH_CELL_H - 4, 8);
      h.endFill();
    }
  }

  boardToWorld(col, row) {
    return {
      x: this.BOARD_START_X + (col + 0.5) * this.CELL_W,
      y: this.BOARD_START_Y + (row + 0.65) * this.CELL_H
    };
  }

  benchToWorld(slotIndex) {
    return {
      x: this.BENCH_START_X + (slotIndex + 0.5) * this.BENCH_CELL_W,
      y: this.BENCH_Y + 0.68 * this.BENCH_CELL_H
    };
  }

  worldToDropTarget(wx, wy) {
    if (
      wy >= this.BENCH_Y - 15 &&
      wy <= this.BENCH_Y + this.BENCH_CELL_H + 15 &&
      wx >= this.BENCH_START_X &&
      wx <= this.BENCH_START_X + this.BENCH_SLOTS * this.BENCH_CELL_W
    ) {
      const slotIndex = Math.floor((wx - this.BENCH_START_X) / this.BENCH_CELL_W);
      if (slotIndex >= 0 && slotIndex < this.BENCH_SLOTS) {
        return { zone: 'bench', slotIndex };
      }
    }

    if (
      wx >= this.BOARD_START_X &&
      wx <= this.BOARD_START_X + this.COLS * this.CELL_W &&
      wy >= this.BOARD_START_Y + 3 * this.CELL_H &&
      wy <= this.BOARD_START_Y + this.ROWS * this.CELL_H
    ) {
      const col = Math.floor((wx - this.BOARD_START_X) / this.CELL_W);
      const row = Math.floor((wy - this.BOARD_START_Y) / this.CELL_H);
      if (col >= 0 && col < this.COLS && row >= 3 && row < this.ROWS) {
        return { zone: 'board', col, row };
      }
    }

    return null;
  }
}
