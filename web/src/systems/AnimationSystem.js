/**
 * AnimationSystem.js
 * Drives 8-direction (0..7) spritesheet playback for all units and spawns VFX animations (Pixi.js v7).
 */
export class AnimationSystem {
  constructor(assetCache, renderSystem, vfxLayer, eventBus) {
    this.assetCache = assetCache;
    this.renderSystem = renderSystem;
    this.vfxLayer = vfxLayer;
    this.eventBus = eventBus;
    /** @type {Array<Object>} */
    this.activeVfx = [];
  }

  init() {
    this.eventBus.on('vfx:spawn', ({ vfxId, x, y, scale = 1.0 }) => {
      this.spawnVfx(vfxId, x, y, scale);
    });
  }

  async spawnVfx(vfxId, x, y, scale = 1.0) {
    const textures = await this.assetCache.loadVfxTextures(vfxId);
    if (!textures || textures.length === 0) return;

    const spr = new PIXI.Sprite(textures[0]);
    spr.anchor.set(0.5, 0.55);
    spr.position.set(x, y - 36);
    spr.scale.set(scale);
    spr.blendMode = PIXI.BLEND_MODES.ADD;
    this.vfxLayer.addChild(spr);

    this.activeVfx.push({
      sprite: spr,
      textures,
      frameIdx: 0,
      timer: 0,
      frameDuration: 0.055
    });
  }

  update(dt, world) {
    const entities = world.query(['Transform', 'SpriteAnim']);
    for (let i = 0; i < entities.length; i++) {
      const id = entities[i];
      const transform = world.getComponent(id, 'Transform');
      const anim = world.getComponent(id, 'SpriteAnim');
      const view = this.renderSystem.views.get(id);
      if (!view) continue;

      let atlas = this.assetCache.unitAtlases.get(anim.atlasPath);
      if (!atlas) {
        this.assetCache.loadUnitAtlas(anim.atlasPath);
        continue;
      }

      const dir = ((transform.dir % 8) + 8) % 8;
      const animKey = `${dir}-${anim.action}`;
      const frameNames =
        atlas.animations[animKey] ||
        atlas.animations[`${dir}-0`] ||
        atlas.animations['0-0'];

      if (!frameNames || frameNames.length === 0) continue;

      anim.frameTimer += dt;
      if (anim.frameTimer >= anim.frameDuration) {
        anim.frameTimer = 0;
        anim.frameIdx++;

        if (anim.frameIdx >= frameNames.length) {
          if (anim.action === 4) {
            anim.frameIdx = frameNames.length - 1;
          } else if (!anim.loop) {
            anim.action = anim.returnAction || 0;
            anim.loop = true;
            anim.frameIdx = 0;
          } else {
            anim.frameIdx = 0;
          }
        }
      }

      const safeIdx = Math.min(anim.frameIdx, frameNames.length - 1);
      const texName = frameNames[safeIdx];
      const tex = atlas.textures.get(texName);
      if (tex && view.sprite.texture !== tex) {
        view.sprite.texture = tex;
      }
    }

    for (let i = this.activeVfx.length - 1; i >= 0; i--) {
      const vfx = this.activeVfx[i];
      vfx.timer += dt;
      if (vfx.timer >= vfx.frameDuration) {
        vfx.timer = 0;
        vfx.frameIdx++;
        if (vfx.frameIdx >= vfx.textures.length) {
          vfx.sprite.destroy();
          this.activeVfx.splice(i, 1);
        } else {
          vfx.sprite.texture = vfx.textures[vfx.frameIdx];
        }
      }
    }
  }
}
