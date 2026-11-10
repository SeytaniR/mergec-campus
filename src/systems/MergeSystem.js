/**
 * MergeSystem.js
 * Automatically detects 3 matching player units (same unitId & starTier 1 or 2)
 * across Bench + Board and fuses them into starTier + 1 with cascading support.
 */
import { createUnitStatsComponent } from '../components/UnitStatsComponent.js';

export class MergeSystem {
  constructor(eventBus, i18n, unitsCatalogMap) {
    this.eventBus = eventBus;
    this.i18n = i18n;
    this.unitsCatalogMap = unitsCatalogMap;
    this.world = null;
  }

  init(world) {
    this.world = world;
    this.eventBus.on('unit:check_merge', () => {
      this.tryMergeAll();
    });
  }

  /**
   * Recursively check and execute 3-of-a-kind merges for player units.
   */
  tryMergeAll() {
    if (!this.world) return;
    let mergedAny = false;

    do {
      mergedAny = false;
      const entities = this.world.query(['UnitStats', 'GridCell', 'Transform', 'SpriteAnim']);
      /** @type {Map<string, number[]>} */
      const groups = new Map();

      for (const id of entities) {
        const grid = this.world.getComponent(id, 'GridCell');
        const stats = this.world.getComponent(id, 'UnitStats');
        if (grid.team !== 'player' || stats.starTier >= 3) continue;

        const key = `${stats.unitId}__${stats.starTier}`;
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(id);
      }

      for (const [, group] of groups.entries()) {
        if (group.length >= 3) {
          // Sort so board units come first (keep the survivor on the board if possible)
          group.sort((a, b) => {
            const ga = this.world.getComponent(a, 'GridCell');
            const gb = this.world.getComponent(b, 'GridCell');
            if (ga.zone === 'board' && gb.zone !== 'board') return -1;
            if (ga.zone !== 'board' && gb.zone === 'board') return 1;
            return a - b;
          });

          const survivorId = group[0];
          const sac1 = group[1];
          const sac2 = group[2];

          const oldStats = this.world.getComponent(survivorId, 'UnitStats');
          const unitDef = this.unitsCatalogMap.get(oldStats.unitId);
          const newTier = oldStats.starTier + 1;

          if (unitDef) {
            const upgradedStats = createUnitStatsComponent(unitDef, newTier);
            this.world.addComponent(survivorId, 'UnitStats', upgradedStats);
          } else {
            oldStats.starTier = newTier;
            oldStats.maxHp = Math.round(oldStats.maxHp * 1.8);
            oldStats.hp = oldStats.maxHp;
            oldStats.atk = Math.round(oldStats.atk * 1.8);
          }

          // Destroy sacrificed units
          this.world.destroyEntity(sac1);
          this.world.destroyEntity(sac2);

          // Play celebratory cast animation & VFX on survivor
          const transform = this.world.getComponent(survivorId, 'Transform');
          const anim = this.world.getComponent(survivorId, 'SpriteAnim');
          anim.action = 7;
          anim.frameIdx = 0;
          anim.loop = false;
          anim.returnAction = 0;

          this.eventBus.emit('vfx:spawn', {
            vfxId: anim.vfxId || '10008',
            x: transform.x,
            y: transform.y,
            scale: 1.35
          });

          const unitName = this.i18n.t(oldStats.i18nNameKey, {}, oldStats.namePtBr);
          this.eventBus.emit('combat:floating_text', {
            x: transform.x,
            y: transform.y - 20,
            text: `${'⭐'.repeat(newTier)} MERGE!`,
            color: 0xfacc15,
            scale: 1.25
          });

          this.eventBus.emit('ui:toast', {
            message: this.i18n.t('toast.merge.success', {
              name: unitName,
              stars: newTier
            }),
            type: 'merge'
          });

          mergedAny = true;
          break;
        }
      }
    } while (mergedAny);

    this.eventBus.emit('board:changed');
  }
}
