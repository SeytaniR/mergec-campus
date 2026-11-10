/**
 * BoardCoordSystem.js
 * Manages the 2.5D Perspective Tactical Arena Grid (7 cols x 6 rows) + 9-slot Runic Bench,
 * aligned with the 1376x768 Magic Campus 2.5D Arena artwork and editable live via arena_meshes.
 */
export class BoardCoordSystem {
  constructor(boardLayer) {
    this.boardLayer = boardLayer;
    this.COLS = 7;
    this.ROWS = 6; // Rows 0..2 = Enemy half, Rows 3..5 = Player half
    this.BENCH_SLOTS = 9;

    this.DESIGN_WIDTH = 1376;
    this.DESIGN_HEIGHT = 768;

    // Default calibrated 2.5D trapezoidal perspective quad for the 7x6 marble courtyard
    this.boardQuad = [
      { x: 388, y: 236 }, // Top-Left (North-West)
      { x: 988, y: 236 }, // Top-Right (North-East)
      { x: 1054, y: 546 }, // Bottom-Right (South-East)
      { x: 322, y: 546 }  // Bottom-Left (South-West)
    ];
    this.gridAlpha = 0.34;
    this.gridEnabled = true;

    // Default calibrated 9 runic bench pedestals along the bottom stone ledge
    this.benchStart = { x: 278, y: 674 };
    this.benchEnd = { x: 1098, y: 674 };
    this.benchRadiusX = 36;
    this.benchRadiusY = 24;
    this.benchAlpha = 0.48;
    this.benchEnabled = true;

    this.gridGraphics = new PIXI.Graphics();
    this.highlightGraphics = new PIXI.Graphics();
    this.boardLayer.addChild(this.gridGraphics);
    this.boardLayer.addChild(this.highlightGraphics);
  }

  init() {
    this.drawBoardAndBench();
  }

  /**
   * Synchronize board perspective quad and 9 bench pedestals from PostgreSQL arena_meshes.
   * @param {Array<Object>} arenaMeshes
   */
  syncFromArenaMeshes(arenaMeshes) {
    if (!Array.isArray(arenaMeshes)) return;

    const boardMesh = arenaMeshes.find(m => m.mesh_id === 'board_perspective_grid' || m.mesh_type === 'board_grid');
    if (boardMesh && Array.isArray(boardMesh.points) && boardMesh.points.length >= 4) {
      this.boardQuad = boardMesh.points.slice(0, 4).map(p => ({ x: Number(p.x), y: Number(p.y) }));
      this.gridAlpha = Number(boardMesh.alpha ?? 0.34);
      this.gridEnabled = Boolean(boardMesh.enabled ?? true);
    }

    const benchMesh = arenaMeshes.find(m => m.mesh_id === 'bench_runic_pedestals' || m.mesh_type === 'bench_pedestals');
    if (benchMesh && Array.isArray(benchMesh.points) && benchMesh.points.length >= 2) {
      this.benchStart = { x: Number(benchMesh.points[0].x), y: Number(benchMesh.points[0].y) };
      this.benchEnd = { x: Number(benchMesh.points[1].x), y: Number(benchMesh.points[1].y) };
      this.benchAlpha = Number(benchMesh.alpha ?? 0.48);
      this.benchEnabled = Boolean(benchMesh.enabled ?? true);
      if (benchMesh.params) {
        this.benchRadiusX = Number(benchMesh.params.radius_x || 36);
        this.benchRadiusY = Number(benchMesh.params.radius_y || 24);
      }
    }

    this.drawBoardAndBench();
  }

  /**
   * Bilinear interpolation inside the 2.5D trapezoidal boardQuad.
   * u in [0..1] (left to right), v in [0..1] (top/North to bottom/South).
   */
  quadLerp(u, v) {
    const [tl, tr, br, bl] = this.boardQuad;
    const topX = tl.x + (tr.x - tl.x) * u;
    const topY = tl.y + (tr.y - tl.y) * u;
    const botX = bl.x + (br.x - bl.x) * u;
    const botY = bl.y + (br.y - bl.y) * u;
    return {
      x: topX + (botX - topX) * v,
      y: topY + (botY - topY) * v
    };
  }

  getCellCorners(col, row) {
    const u0 = col / this.COLS;
    const u1 = (col + 1) / this.COLS;
    const v0 = row / this.ROWS;
    const v1 = (row + 1) / this.ROWS;
    return [
      this.quadLerp(u0, v0),
      this.quadLerp(u1, v0),
      this.quadLerp(u1, v1),
      this.quadLerp(u0, v1)
    ];
  }

  drawBoardAndBench() {
    const g = this.gridGraphics;
    g.clear();

    // 1. Draw translucent 2.5D perspective tactical grid over the marble courtyard
    if (this.gridEnabled && this.gridAlpha > 0.01) {
      for (let r = 0; r < this.ROWS; r++) {
        for (let c = 0; c < this.COLS; c++) {
          const [p0, p1, p2, p3] = this.getCellCorners(c, r);
          const isEnemySide = r < 3;
          const isAlt = (r + c) % 2 === 0;

          const borderColor = isEnemySide ? 0xf43f5e : 0x38bdf8;
          const fillColor = isEnemySide ? 0x3b0a1e : 0x0c2d48;
          const fillAlpha = (isAlt ? 0.14 : 0.07) * this.gridAlpha;
          const lineAlpha = (isEnemySide ? 0.42 : 0.68) * this.gridAlpha;

          g.lineStyle(1.4, borderColor, lineAlpha);
          g.beginFill(fillColor, fillAlpha);
          g.moveTo(p0.x, p0.y);
          g.lineTo(p1.x, p1.y);
          g.lineTo(p2.x, p2.y);
          g.lineTo(p3.x, p3.y);
          g.closePath();
          g.endFill();
        }
      }

      // Center frontline arcane divider (between row 2 and row 3)
      const midLeft = this.quadLerp(0, 0.5);
      const midRight = this.quadLerp(1, 0.5);
      g.lineStyle(2.2, 0xfacc15, Math.min(0.9, this.gridAlpha * 1.6));
      g.moveTo(midLeft.x - 8, midLeft.y);
      g.lineTo(midRight.x + 8, midRight.y);
    }

    // 2. Draw subtle glowing runic rings on the 9 carved bench pedestals
    if (this.benchEnabled && this.benchAlpha > 0.01) {
      for (let i = 0; i < this.BENCH_SLOTS; i++) {
        const pos = this.benchToWorld(i);
        g.lineStyle(1.8, 0x38bdf8, this.benchAlpha * 0.85);
        g.beginFill(0x0ea5e9, this.benchAlpha * 0.14);
        g.drawEllipse(pos.x, pos.y - 4, this.benchRadiusX, this.benchRadiusY);
        g.endFill();
      }
    }
  }

  highlightDropTarget(target) {
    const h = this.highlightGraphics;
    h.clear();
    if (!target) return;

    if (target.zone === 'board') {
      const [p0, p1, p2, p3] = this.getCellCorners(target.col, target.row);
      h.lineStyle(2.8, 0x4ade80, 0.98);
      h.beginFill(0x22c55e, 0.34);
      h.moveTo(p0.x, p0.y);
      h.lineTo(p1.x, p1.y);
      h.lineTo(p2.x, p2.y);
      h.lineTo(p3.x, p3.y);
      h.closePath();
      h.endFill();
    } else if (target.zone === 'bench') {
      const pos = this.benchToWorld(target.slotIndex);
      h.lineStyle(2.8, 0xfacc15, 0.98);
      h.beginFill(0xfbbf24, 0.35);
      h.drawEllipse(pos.x, pos.y - 4, this.benchRadiusX + 4, this.benchRadiusY + 3);
      h.endFill();
    }
  }

  boardToWorld(col, row) {
    const u = (col + 0.5) / this.COLS;
    const v = (row + 0.62) / this.ROWS;
    return this.quadLerp(u, v);
  }

  benchToWorld(slotIndex) {
    const t = this.BENCH_SLOTS > 1 ? slotIndex / (this.BENCH_SLOTS - 1) : 0.5;
    return {
      x: this.benchStart.x + (this.benchEnd.x - this.benchStart.x) * t,
      y: this.benchStart.y + (this.benchEnd.y - this.benchStart.y) * t
    };
  }

  /**
   * Compute 2.5D depth scale factor so units further South (closer to camera)
   * appear slightly larger than units further North.
   */
  getDepthScale(wy) {
    const topY = this.boardQuad[0].y;
    const botY = this.benchStart.y;
    const t = Math.max(0, Math.min(1, (wy - topY) / Math.max(1, botY - topY)));
    return 0.88 + t * 0.20;
  }

  worldToDropTarget(wx, wy) {
    // 1. Check 9 Runic Bench Pedestals first
    let bestBenchIdx = -1;
    let bestBenchDist = Infinity;
    for (let i = 0; i < this.BENCH_SLOTS; i++) {
      const bp = this.benchToWorld(i);
      const dx = wx - bp.x;
      const dy = wy - bp.y;
      const d = Math.hypot(dx, dy * 1.35);
      if (d < 56 && d < bestBenchDist) {
        bestBenchDist = d;
        bestBenchIdx = i;
      }
    }
    if (bestBenchIdx !== -1) {
      return { zone: 'bench', slotIndex: bestBenchIdx };
    }

    // 2. Check Player half of the 2.5D perspective board (rows 3..5)
    let bestCell = null;
    let bestCellDist = Infinity;
    for (let r = 3; r < this.ROWS; r++) {
      for (let c = 0; c < this.COLS; c++) {
        const cp = this.boardToWorld(c, r);
        const d = Math.hypot(wx - cp.x, (wy - cp.y) * 1.25);
        if (d < 62 && d < bestCellDist) {
          bestCellDist = d;
          bestCell = { zone: 'board', col: c, row: r };
        }
      }
    }
    return bestCell;
  }
}
