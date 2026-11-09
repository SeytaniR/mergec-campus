/**
 * UnitRenderSystem.js
 * Manages Pixi.js v7 display containers for all unit entities, including
 * star aura rings, 8-direction sprites, HP/Shield/Mana bars, and floating combat text.
 */
export class UnitRenderSystem {
  constructor(unitLayer, vfxLayer, eventBus) {
    this.unitLayer = unitLayer;
    this.vfxLayer = vfxLayer;
    this.eventBus = eventBus;
    this.unitLayer.sortableChildren = true;

    /** @type {Map<number, Object>} */
    this.views = new Map();
    /** @type {Array<Object>} */
    this.floatingTexts = [];
  }

  init() {
    this.eventBus.on('entity:destroying', ({ entityId }) => {
      this.removeView(entityId);
    });

    this.eventBus.on('combat:floating_text', ({ x, y, text, color = 0xffffff, scale = 1.0 }) => {
      this.spawnFloatingText(x, y, text, color, scale);
    });
  }

  createView(entityId, transform, stats, anim, grid) {
    const root = new PIXI.Container();
    root.position.set(transform.x, transform.y);
    root.zIndex = Math.round(transform.y);

    const baseRing = new PIXI.Graphics();
    root.addChild(baseRing);

    const sprite = new PIXI.Sprite(PIXI.Texture.EMPTY);
    const ax = anim.anchor && anim.anchor[0] !== undefined ? anim.anchor[0] : 0.5;
    const ay = anim.anchor && anim.anchor[1] !== undefined ? anim.anchor[1] : 0.9;
    sprite.anchor.set(ax, ay);
    root.addChild(sprite);

    const hud = new PIXI.Container();
    hud.y = -88;
    root.addChild(hud);

    const barsGfx = new PIXI.Graphics();
    hud.addChild(barsGfx);

    const starText = new PIXI.Text('⭐'.repeat(stats.starTier), {
      fontFamily: 'Segoe UI, sans-serif',
      fontSize: 12,
      fontWeight: 'bold',
      fill: 0xfacc15,
      stroke: 0x000000,
      strokeThickness: 3
    });
    starText.anchor.set(0.5, 1);
    starText.y = -4;
    hud.addChild(starText);

    root.eventMode = 'static';
    root.cursor = 'pointer';
    root.hitArea = new PIXI.Rectangle(-38, -88, 76, 102);

    root.on('pointerdown', (e) => {
      this.eventBus.emit('unit:pointerdown', { entityId, event: e });
    });

    this.unitLayer.addChild(root);
    const view = { root, baseRing, sprite, hud, barsGfx, starText, lastStarTier: 0 };
    this.views.set(entityId, view);
    this.redrawBarsAndRing(view, stats, grid);
    return view;
  }

  removeView(entityId) {
    const view = this.views.get(entityId);
    if (view) {
      view.root.destroy({ children: true });
      this.views.delete(entityId);
    }
  }

  redrawBarsAndRing(view, stats, grid) {
    const isEnemy = grid.team === 'enemy';
    const starColors = [0x38bdf8, 0x38bdf8, 0xfacc15, 0xf43f5e];
    const ringColor = isEnemy ? 0xf43f5e : starColors[stats.starTier] || 0x38bdf8;

    const ring = view.baseRing;
    ring.clear();
    ring.lineStyle(1.5 + stats.starTier * 0.5, ringColor, 0.85);
    ring.beginFill(0x000000, 0.42);
    ring.drawEllipse(0, 0, 28 + (stats.starTier - 1) * 5, 13 + (stats.starTier - 1) * 2);
    ring.endFill();

    if (view.lastStarTier !== stats.starTier) {
      view.starText.text = '⭐'.repeat(stats.starTier);
      view.lastStarTier = stats.starTier;
    }

    const g = view.barsGfx;
    g.clear();
    const w = 54;
    const h = 7;
    const x = -w / 2;

    g.beginFill(0x090d16, 0.9);
    g.drawRoundedRect(x - 1, -1, w + 2, h + 6, 3);
    g.endFill();

    const hpRatio = Math.max(0, Math.min(1, stats.hp / Math.max(1, stats.maxHp)));
    const hpColor = isEnemy ? 0xef4444 : 0x22c55e;
    if (hpRatio > 0) {
      g.beginFill(hpColor, 1);
      g.drawRoundedRect(x, 0, w * hpRatio, h, 2);
      g.endFill();
    }

    if (stats.shield > 0) {
      const shRatio = Math.min(1, stats.shield / Math.max(1, stats.maxHp));
      g.beginFill(0xe2e8f0, 0.85);
      g.drawRoundedRect(x, 0, w * shRatio, h, 2);
      g.endFill();
    }

    const manaRatio = Math.max(0, Math.min(1, stats.mana / Math.max(1, stats.maxMana)));
    if (manaRatio > 0) {
      g.beginFill(0x3b82f6, 1);
      g.drawRoundedRect(x, h + 1, w * manaRatio, 3.5, 1.5);
      g.endFill();
    }
  }

  spawnFloatingText(x, y, text, color = 0xffffff, scale = 1.0) {
    const label = new PIXI.Text(String(text), {
      fontFamily: 'Segoe UI, sans-serif',
      fontSize: Math.round(15 * scale),
      fontWeight: '800',
      fill: color,
      stroke: 0x000000,
      strokeThickness: 3.5
    });
    label.anchor.set(0.5, 0.5);
    label.position.set(x + (Math.random() - 0.5) * 18, y - 65);
    this.vfxLayer.addChild(label);
    this.floatingTexts.push({ label, elapsed: 0, duration: 0.85 });
  }

  update(dt, world) {
    const entities = world.query(['Transform', 'UnitStats', 'SpriteAnim', 'GridCell']);
    for (let i = 0; i < entities.length; i++) {
      const id = entities[i];
      const transform = world.getComponent(id, 'Transform');
      const stats = world.getComponent(id, 'UnitStats');
      const anim = world.getComponent(id, 'SpriteAnim');
      const grid = world.getComponent(id, 'GridCell');

      let view = this.views.get(id);
      if (!view) {
        view = this.createView(id, transform, stats, anim, grid);
      }

      view.root.position.set(transform.x, transform.y);
      const depthFactor = 0.88 + Math.max(0, Math.min(1, (transform.y - 230) / 450)) * 0.18;
      const starScale = (0.72 + (stats.starTier - 1) * 0.13) * depthFactor;
      view.sprite.scale.set(starScale * transform.scale);
      view.root.alpha = stats.alive ? transform.alpha : 0.45;
      view.root.zIndex = transform.isDragging ? 9999 : Math.round(transform.y);

      this.redrawBarsAndRing(view, stats, grid);
    }

    for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
      const ft = this.floatingTexts[i];
      ft.elapsed += dt;
      ft.label.y -= 36 * dt;
      ft.label.alpha = Math.max(0, 1 - ft.elapsed / ft.duration);
      if (ft.elapsed >= ft.duration) {
        ft.label.destroy();
        this.floatingTexts.splice(i, 1);
      }
    }
  }
}
