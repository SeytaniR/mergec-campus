/**
 * UnitStatsComponent.js
 * Pure data component for unit attributes, star level (merge tier), and skill parameters.
 */
export function createUnitStatsComponent(unitDef, starTier = 1) {
  const mult = starTier === 1 ? 1.0 : starTier === 2 ? 1.8 : 3.24;
  const s = unitDef.stats;
  const maxHp = Math.round(s.hp * mult);
  const atk = Math.round(s.atk * mult);
  const def = Math.round(s.def * (1 + (starTier - 1) * 0.35));

  return {
    unitId: unitDef.id,
    unitKey: unitDef.unit_key,
    i18nNameKey: unitDef.i18n_name_key,
    namePtBr: unitDef.name_ptbr,
    i18nSkillKey: unitDef.i18n_skill_key,
    skillDescPtBr: unitDef.skill_desc_ptbr,
    cost: unitDef.cost,
    starTier,
    baseMaxHp: maxHp,
    maxHp,
    hp: maxHp,
    shield: 0,
    maxMana: s.maxMana || 80,
    startMana: s.startMana || 20,
    mana: s.startMana || 20,
    baseAtk: atk,
    atk,
    baseDef: def,
    def,
    baseAtkSpeed: s.atkSpeed || 0.8,
    atkSpeed: s.atkSpeed || 0.8,
    range: s.range || 1,
    skillDamage: Math.round((s.skillDamage || 220) * mult),
    skillShield: Math.round((s.skillShield || 150) * mult),
    skillHeal: Math.round((s.skillHeal || 160) * mult),
    alive: true
  };
}
