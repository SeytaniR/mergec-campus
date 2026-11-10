/**
 * SynergySystem.js
 * Calculates active Origin and Class traits for unique player units on the board
 * and applies combat stat multipliers.
 */
import { ORIGINS_REGISTRY, CLASSES_REGISTRY } from '../data/TraitRegistry.js';

export class SynergySystem {
  constructor(eventBus) {
    this.eventBus = eventBus;
    this.world = null;
    this.activeSynergies = [];
  }

  init(world) {
    this.world = world;
    this.eventBus.on('board:changed', () => {
      this.recalculate();
    });
  }

  recalculate() {
    if (!this.world) return;
    const entities = this.world.query(['UnitStats', 'Trait', 'GridCell']);

    /** @type {Map<string, Set<string>>} */
    const originCounts = new Map();
    /** @type {Map<string, Set<string>>} */
    const classCounts = new Map();

    for (const id of entities) {
      const grid = this.world.getComponent(id, 'GridCell');
      if (grid.team !== 'player' || grid.zone !== 'board') continue;

      const stats = this.world.getComponent(id, 'UnitStats');
      const trait = this.world.getComponent(id, 'Trait');

      if (!originCounts.has(trait.originKey)) originCounts.set(trait.originKey, new Set());
      originCounts.get(trait.originKey).add(stats.unitId);

      if (!classCounts.has(trait.classKey)) classCounts.set(trait.classKey, new Set());
      classCounts.get(trait.classKey).add(stats.unitId);
    }

    const list = [];

    for (const [originKey, set] of originCounts.entries()) {
      const def = ORIGINS_REGISTRY[originKey];
      if (!def) continue;
      const count = set.size;
      let activeTier = 0;
      for (const th of def.thresholds) {
        if (count >= th) activeTier = th;
      }
      list.push({
        type: 'origin',
        key: originKey,
        icon: def.icon,
        i18nNameKey: def.i18nNameKey,
        namePtBr: def.namePtBr,
        i18nDescKey: def.i18nDescKey,
        count,
        activeTier,
        thresholds: def.thresholds,
        bonusVars: def.bonuses[activeTier] || def.bonuses[def.thresholds[0]] || {}
      });
    }

    for (const [classKey, set] of classCounts.entries()) {
      const def = CLASSES_REGISTRY[classKey];
      if (!def) continue;
      const count = set.size;
      let activeTier = 0;
      for (const th of def.thresholds) {
        if (count >= th) activeTier = th;
      }
      list.push({
        type: 'class',
        key: classKey,
        icon: def.icon,
        i18nNameKey: def.i18nNameKey,
        namePtBr: def.namePtBr,
        i18nDescKey: def.i18nDescKey,
        count,
        activeTier,
        thresholds: def.thresholds,
        bonusVars: def.bonuses[activeTier] || def.bonuses[def.thresholds[0]] || {}
      });
    }

    list.sort((a, b) => {
      if ((b.activeTier > 0) !== (a.activeTier > 0)) return b.activeTier > 0 ? 1 : -1;
      return b.count - a.count;
    });

    this.activeSynergies = list;
    this.eventBus.emit('synergies:updated', { synergies: list });
  }

  /**
   * Apply active synergy buffs to player units on the board at combat start.
   */
  applyCombatBuffs(world) {
    const activeMap = new Map();
    for (const syn of this.activeSynergies) {
      if (syn.activeTier > 0) {
        activeMap.set(`${syn.type}:${syn.key}`, syn);
      }
    }

    const entities = world.query(['UnitStats', 'Trait', 'GridCell']);
    for (const id of entities) {
      const grid = world.getComponent(id, 'GridCell');
      if (grid.team !== 'player' || grid.zone !== 'board') continue;

      const stats = world.getComponent(id, 'UnitStats');
      const trait = world.getComponent(id, 'Trait');

      // Reset to base first
      stats.maxHp = stats.baseMaxHp;
      stats.hp = stats.maxHp;
      stats.atk = stats.baseAtk;
      stats.def = stats.baseDef;
      stats.atkSpeed = stats.baseAtkSpeed;
      stats.shield = 0;
      stats.mana = stats.startMana;

      if (activeMap.has(`origin:${trait.originKey}`)) {
        const syn = activeMap.get(`origin:${trait.originKey}`);
        if (trait.originKey === 'academy') {
          stats.mana = Math.min(stats.maxMana, stats.mana + (syn.bonusVars.bonus || 15));
        } else if (trait.originKey === 'mech') {
          stats.shield += syn.bonusVars.bonus || 180;
          stats.def += syn.bonusVars.def || 20;
        } else if (trait.originKey === 'beast') {
          stats.atkSpeed = +(stats.atkSpeed * (1 + (syn.bonusVars.bonus || 18) / 100)).toFixed(2);
        } else if (trait.originKey === 'dragon') {
          stats.atk = Math.round(stats.atk * (1 + (syn.bonusVars.bonus || 20) / 100));
        }
      }

      if (activeMap.has(`class:${trait.classKey}`)) {
        const syn = activeMap.get(`class:${trait.classKey}`);
        if (trait.classKey === 'warrior') {
          stats.def += syn.bonusVars.bonus || 20;
          stats.atk += syn.bonusVars.atk || 15;
        } else if (trait.classKey === 'guardian') {
          stats.maxHp = Math.round(stats.maxHp * (1 + (syn.bonusVars.bonus || 20) / 100));
          stats.hp = stats.maxHp;
        } else if (trait.classKey === 'ranger') {
          stats.atkSpeed = +(stats.atkSpeed * (1 + (syn.bonusVars.bonus || 20) / 100)).toFixed(2);
        }
      }
    }
  }
}
