/**
 * ArenaEnvironmentSystem.js
 * Single-responsibility ECS System that renders the 2.5D Magic Campus Arena background
 * and animates the configurable 2.5D VFX Mesh zones (water caustics, portal vortex,
 * cyan flame braziers, central arcane circle, streetlamp halos, and levitating crystals).
 * Zero God Objects: Driven purely by the PostgreSQL `arena_meshes` catalog.
 */
export class ArenaEnvironmentSystem {
  constructor(arenaLayer, eventBus, getGameState) {
    this.arenaLayer = arenaLayer;
    this.eventBus = eventBus;
    this.getGameState = getGameState;

    this.bgSprite = null;
    this.meshesContainer = new PIXI.Container();
    this.arenaLayer.addChild(this.meshesContainer);

    this.meshes = [];
    this.meshNodes = [];
    this.elapsed = 0;
    this.mergeFlashTimer = 0;
  }

  init() {
    this.loadArenaBackground();
    this.eventBus.on('vfx:spawn', () => {
      this.mergeFlashTimer = 0.85;
    });
  }

  loadArenaBackground() {
    const tex = PIXI.Texture.from('assets/arena/arena_campus_25d.webp');
    this.bgSprite = new PIXI.Sprite(tex);
    this.bgSprite.width = 1376;
    this.bgSprite.height = 768;
    this.arenaLayer.addChildAt(this.bgSprite, 0);
  }

  /**
   * Rebuild 2.5D VFX mesh nodes from the database `arena_meshes` list.
   * @param {Array<Object>} arenaMeshes
   */
  syncMeshes(arenaMeshes) {
    if (!Array.isArray(arenaMeshes)) return;
    this.meshes = arenaMeshes;

    // Clear previous mesh nodes
    for (const node of this.meshNodes) {
      if (node.container && node.container.parent) {
        node.container.parent.removeChild(node.container);
      }
      if (node.container) node.container.destroy({ children: true });
    }
    this.meshNodes = [];

    for (const m of this.meshes) {
      if (!m.enabled) continue;
      if (m.mesh_type === 'board_grid' || m.mesh_type === 'bench_pedestals') continue;

      const pts = Array.isArray(m.points) ? m.points : [];
      if (pts.length === 0) continue;

      const container = new PIXI.Container();
      const gfx = new PIXI.Graphics();
      gfx.blendMode = (m.blend_mode || 'screen').toLowerCase() === 'normal'
        ? PIXI.BLEND_MODES.NORMAL
        : PIXI.BLEND_MODES.ADD;

      container.addChild(gfx);

      // Optional polygon mask for water_caustics so waves stay strictly inside the canal banks
      let maskGfx = null;
      if (m.mesh_type === 'water_caustics' && pts.length >= 3) {
        maskGfx = new PIXI.Graphics();
        maskGfx.beginFill(0xffffff, 1);
        maskGfx.moveTo(pts[0].x, pts[0].y);
        for (let i = 1; i < pts.length; i++) {
          maskGfx.lineTo(pts[i].x, pts[i].y);
        }
        maskGfx.closePath();
        maskGfx.endFill();
        container.addChild(maskGfx);
        gfx.mask = maskGfx;
      }

      this.meshesContainer.addChild(container);
      this.meshNodes.push({
        def: m,
        container,
        gfx,
        maskGfx,
        bounds: this.computeBounds(pts)
      });
    }
  }

  computeBounds(pts) {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const p of pts) {
      const x = Number(p.x) || 0;
      const y = Number(p.y) || 0;
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
    return {
      minX,
      minY,
      maxX,
      maxY,
      cx: (minX + maxX) * 0.5,
      cy: (minY + maxY) * 0.5,
      w: Math.max(16, maxX - minX),
      h: Math.max(16, maxY - minY)
    };
  }

  parseHexColor(hexStr, fallback = 0x38bdf8) {
    if (!hexStr || typeof hexStr !== 'string') return fallback;
    const cleaned = hexStr.replace('#', '').trim();
    const val = parseInt(cleaned, 16);
    return Number.isFinite(val) ? val : fallback;
  }

  update(dt) {
    this.elapsed += dt;
    if (this.mergeFlashTimer > 0) {
      this.mergeFlashTimer = Math.max(0, this.mergeFlashTimer - dt);
    }

    const state = this.getGameState ? this.getGameState() : null;
    const isCombat = state && state.phase === 'combat';

    for (const node of this.meshNodes) {
      const { def, gfx, bounds } = node;
      gfx.clear();

      const color = this.parseHexColor(def.color_hex, 0x38bdf8);
      const alpha = Math.max(0, Math.min(1, Number(def.alpha ?? 0.65)));
      const speed = Math.max(0.1, Number(def.speed ?? 1.0)) * (isCombat ? 1.35 : 1.0);
      const intensity = Math.max(0.1, Number(def.intensity ?? 1.0));
      const t = this.elapsed * speed;

      switch (def.mesh_type) {
        case 'water_caustics':
          this.drawWaterCausticsMesh(gfx, bounds, color, alpha, intensity, t);
          break;
        case 'portal_vortex':
          this.drawPortalVortexMesh(gfx, bounds, color, alpha, intensity, t, isCombat);
          break;
        case 'brazier_fire':
          this.drawBrazierFireMesh(gfx, bounds, color, alpha, intensity, t);
          break;
        case 'rune_circle':
          this.drawRuneCircleMesh(gfx, bounds, color, alpha, intensity, t, isCombat);
          break;
        case 'lantern_halo':
          this.drawLanternHaloMesh(gfx, bounds, color, alpha, intensity, t);
          break;
        case 'crystal_glow':
          this.drawCrystalGlowMesh(gfx, def.points, color, alpha, intensity, t);
          break;
        default:
          this.drawLanternHaloMesh(gfx, bounds, color, alpha, intensity, t);
          break;
      }
    }
  }

  drawWaterCausticsMesh(gfx, b, color, alpha, intensity, t) {
    // 1. Flowing horizontal/diagonal caustics ribbons along the canal
    const waveCount = 14;
    for (let i = 0; i < waveCount; i++) {
      const progress = ((i / waveCount) + t * 0.08) % 1;
      const wy = b.minY + progress * b.h;
      const sway = Math.sin(t * 2.2 + i * 1.4) * 18;
      const ribbonW = (42 + (i % 3) * 18) * intensity;
      const ribbonAlpha = alpha * 0.28 * (0.5 + 0.5 * Math.sin(t * 1.8 + i));

      gfx.lineStyle(2.2, color, ribbonAlpha);
      gfx.moveTo(b.cx - ribbonW + sway, wy);
      gfx.quadraticCurveTo(
        b.cx + sway,
        wy + Math.cos(t * 2 + i) * 9,
        b.cx + ribbonW + sway,
        wy
      );
    }

    // 2. Expanding water ripple rings & mana sparkles
    for (let j = 0; j < 8; j++) {
      const seed = j * 1.73;
      const rx = b.minX + 0.25 * b.w + ((Math.sin(seed * 3.1) * 0.5 + 0.5) * 0.5 * b.w);
      const ry = b.minY + ((j / 8) * b.h);
      const pulse = (t * 0.65 + j * 0.25) % 1;
      const radX = (8 + pulse * 26) * intensity;
      const radY = radX * 0.55;
      const ringAlpha = alpha * (1 - pulse) * 0.45;

      gfx.lineStyle(1.5, 0xffffff, ringAlpha);
      gfx.drawEllipse(rx, ry, radX, radY);
    }
  }

  drawPortalVortexMesh(gfx, b, color, alpha, intensity, t, isCombat) {
    const cx = b.cx;
    const cy = b.cy;
    const rx = (b.w * 0.46) * intensity;
    const ry = (b.h * 0.46) * intensity;

    // Outer ambient portal aura
    const pulse = 0.85 + 0.15 * Math.sin(t * 2.8);
    gfx.beginFill(color, alpha * (isCombat ? 0.34 : 0.22) * pulse);
    gfx.drawEllipse(cx, cy, rx * 1.15, ry * 1.1);
    gfx.endFill();

    // Rotating vortex energy rings
    for (let ring = 1; ring <= 3; ring++) {
      const scale = (ring / 3) * pulse;
      gfx.lineStyle(2.0, ring === 2 ? 0xffffff : color, alpha * 0.65);
      gfx.drawEllipse(cx, cy, rx * scale, ry * scale);
    }

    // Orbiting portal motes
    for (let i = 0; i < 6; i++) {
      const ang = t * 1.9 + (i * Math.PI) / 3;
      const mx = cx + Math.cos(ang) * rx * 0.72;
      const my = cy + Math.sin(ang) * ry * 0.72;
      gfx.beginFill(0xffffff, alpha * 0.85);
      gfx.drawCircle(mx, my, 3.2);
      gfx.endFill();
    }
  }

  drawBrazierFireMesh(gfx, b, color, alpha, intensity, t) {
    const cx = b.cx;
    const baseY = b.maxY - 12;

    // Base glow halo
    const flicker = 0.82 + 0.18 * Math.sin(t * 6.5);
    gfx.beginFill(color, alpha * 0.28 * flicker);
    gfx.drawCircle(cx, baseY - 22, 34 * intensity);
    gfx.endFill();

    // Animated flame tongues
    for (let i = 0; i < 5; i++) {
      const offset = (i - 2) * 7;
      const sway = Math.sin(t * 5.2 + i * 1.3) * 8;
      const flameH = (38 + (i % 2) * 16 + Math.cos(t * 6.0 + i) * 8) * intensity;

      gfx.beginFill(i === 2 ? 0xffffff : color, alpha * (i === 2 ? 0.55 : 0.38));
      gfx.moveTo(cx + offset - 9, baseY);
      gfx.quadraticCurveTo(cx + offset + sway, baseY - flameH * 0.5, cx + offset + sway * 1.2, baseY - flameH);
      gfx.quadraticCurveTo(cx + offset - sway * 0.5, baseY - flameH * 0.5, cx + offset + 9, baseY);
      gfx.closePath();
      gfx.endFill();
    }

    // Rising embers
    for (let e = 0; e < 6; e++) {
      const p = (t * 0.75 + e * 0.17) % 1;
      const ex = cx + Math.sin(t * 3 + e * 2.1) * 14;
      const ey = baseY - 10 - p * 68 * intensity;
      gfx.beginFill(0xffffff, alpha * (1 - p) * 0.9);
      gfx.drawCircle(ex, ey, 2.2 * (1 - p * 0.5));
      gfx.endFill();
    }
  }

  drawRuneCircleMesh(gfx, b, color, alpha, intensity, t, isCombat) {
    const cx = b.cx;
    const cy = b.cy;
    const rx = (b.w * 0.48) * intensity;
    const ry = (b.h * 0.48) * intensity; // 2.5D foreshortened ellipse

    const flashBoost = this.mergeFlashTimer > 0 ? 1 + this.mergeFlashTimer * 0.9 : 1;
    const breath = (0.75 + 0.25 * Math.sin(t * 2.0)) * flashBoost;
    const effAlpha = Math.min(1, alpha * breath * (isCombat ? 1.35 : 1.0));

    // Outer & inner 2.5D perspective runic rings
    gfx.lineStyle(2.2, color, effAlpha * 0.75);
    gfx.drawEllipse(cx, cy, rx, ry);

    gfx.lineStyle(1.6, 0xfacc15, effAlpha * 0.65);
    gfx.drawEllipse(cx, cy, rx * 0.72, ry * 0.72);

    // Rotating 8-point arcane star projected into 2.5D ellipse space
    const pts = 8;
    gfx.lineStyle(1.5, color, effAlpha * 0.55);
    for (let i = 0; i < pts; i++) {
      const a1 = t * 0.45 + (i * Math.PI * 2) / pts;
      const a2 = t * 0.45 + (((i + 3) % pts) * Math.PI * 2) / pts;
      gfx.moveTo(cx + Math.cos(a1) * rx * 0.85, cy + Math.sin(a1) * ry * 0.85);
      gfx.lineTo(cx + Math.cos(a2) * rx * 0.85, cy + Math.sin(a2) * ry * 0.85);
    }
  }

  drawLanternHaloMesh(gfx, b, color, alpha, intensity, t) {
    const cx = b.cx;
    const cy = b.cy;
    const pulse = 0.85 + 0.15 * Math.sin(t * 3.1);
    const rad = Math.max(b.w, b.h) * 0.55 * intensity * pulse;

    // Soft multi-layered volumetric glow
    gfx.beginFill(color, alpha * 0.11);
    gfx.drawCircle(cx, cy, rad * 1.45);
    gfx.endFill();

    gfx.beginFill(color, alpha * 0.18);
    gfx.drawCircle(cx, cy, rad * 0.9);
    gfx.endFill();

    gfx.beginFill(0xffffff, alpha * 0.35);
    gfx.drawCircle(cx, cy, rad * 0.32);
    gfx.endFill();

    // Orbiting fireflies / mana motes
    for (let i = 0; i < 3; i++) {
      const ang = t * 1.6 + i * 2.1;
      const mx = cx + Math.cos(ang) * (rad * 0.85);
      const my = cy + Math.sin(ang * 1.3) * (rad * 0.55);
      gfx.beginFill(0xffffff, alpha * 0.75);
      gfx.drawCircle(mx, my, 1.8);
      gfx.endFill();
    }
  }

  drawCrystalGlowMesh(gfx, points, color, alpha, intensity, t) {
    for (let i = 0; i < points.length; i++) {
      const p = points[i];
      const bobY = Math.sin(t * 2.4 + i * 1.7) * 5;
      const cx = Number(p.x) || 0;
      const cy = (Number(p.y) || 0) + bobY;

      // Soft crystal aura + sparkle core
      gfx.beginFill(color, alpha * 0.14);
      gfx.drawCircle(cx, cy, 22 * intensity);
      gfx.endFill();

      gfx.beginFill(color, alpha * 0.24);
      gfx.drawCircle(cx, cy, 12 * intensity);
      gfx.endFill();

      gfx.beginFill(0xffffff, alpha * 0.65);
      gfx.drawCircle(cx, cy - 2, 3.2 * intensity);
      gfx.endFill();
    }
  }
}
