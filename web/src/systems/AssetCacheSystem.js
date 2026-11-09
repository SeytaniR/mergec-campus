/**
 * AssetCacheSystem.js
 * Loads and caches 8-direction unit spritesheets and VFX atlases (Pixi.js v7).
 * Avoids global TextureCache ID collisions by slicing directly from BaseTexture.
 */
export class AssetCacheSystem {
  constructor() {
    /** @type {Map<string, Object>} */
    this.unitAtlases = new Map();
    /** @type {Map<string, Promise<Object>>} */
    this.loadingPromises = new Map();
    /** @type {Map<string, Array<PIXI.Texture>>} */
    this.vfxFramesCache = new Map();
  }

  /**
   * Load and slice an 8-direction unit atlas from its atlas.json path.
   * @param {string} atlasJsonPath
   * @returns {Promise<Object|null>}
   */
  async loadUnitAtlas(atlasJsonPath) {
    if (this.unitAtlases.has(atlasJsonPath)) {
      return this.unitAtlases.get(atlasJsonPath);
    }
    if (this.loadingPromises.has(atlasJsonPath)) {
      return this.loadingPromises.get(atlasJsonPath);
    }

    const promise = (async () => {
      try {
        const res = await fetch(atlasJsonPath);
        if (!res.ok) throw new Error(`HTTP ${res.status} for ${atlasJsonPath}`);
        const data = await res.json();

        const baseDir = atlasJsonPath.substring(0, atlasJsonPath.lastIndexOf('/') + 1);
        const imageFile = (data.meta && data.meta.image) ? data.meta.image : 'atlas.webp';
        const imageUrl = baseDir + imageFile;

        const loadedTex = await PIXI.Assets.load(imageUrl);
        const baseTex = loadedTex.baseTexture || loadedTex;
        const texMap = new Map();

        const framesObj = data.frames || {};
        for (const [frameKey, frameData] of Object.entries(framesObj)) {
          const r = frameData.frame;
          if (!r) continue;
          const rect = new PIXI.Rectangle(r.x, r.y, r.w, r.h);
          const subTex = new PIXI.Texture(baseTex, rect);
          texMap.set(frameKey, subTex);
        }

        const parsedAtlas = {
          textures: texMap,
          animations: data.animations || {}
        };
        this.unitAtlases.set(atlasJsonPath, parsedAtlas);
        return parsedAtlas;
      } catch (err) {
        console.warn(`[AssetCacheSystem] Failed to load unit atlas ${atlasJsonPath}:`, err);
        return null;
      } finally {
        this.loadingPromises.delete(atlasJsonPath);
      }
    })();

    this.loadingPromises.set(atlasJsonPath, promise);
    return promise;
  }

  /**
   * Load and slice a VFX animation effect by ID.
   * @param {string} vfxId
   * @returns {Promise<Array<PIXI.Texture>|null>}
   */
  async loadVfxTextures(vfxId) {
    if (this.vfxFramesCache.has(vfxId)) {
      return this.vfxFramesCache.get(vfxId);
    }

    const jsonPath = `assets/effects/${vfxId}/atlas.json`;
    try {
      const res = await fetch(jsonPath);
      if (!res.ok) return null;
      const data = await res.json();
      const imageUrl = `assets/effects/${vfxId}/atlas.webp`;
      const loadedTex = await PIXI.Assets.load(imageUrl);
      const baseTex = loadedTex.baseTexture || loadedTex;

      const texMap = new Map();
      for (const [k, fData] of Object.entries(data.frames || {})) {
        const r = fData.frame;
        if (!r) continue;
        const subTex = new PIXI.Texture(baseTex, new PIXI.Rectangle(r.x, r.y, r.w, r.h));
        texMap.set(k, subTex);
      }

      const playKeys = (data.animations && data.animations.play)
        ? data.animations.play
        : Array.from(texMap.keys());

      const textures = playKeys.map(k => texMap.get(k)).filter(Boolean);
      if (textures.length > 0) {
        this.vfxFramesCache.set(vfxId, textures);
        return textures;
      }
      return null;
    } catch (err) {
      console.warn(`[AssetCacheSystem] VFX ${vfxId} load error:`, err);
      return null;
    }
  }
}
