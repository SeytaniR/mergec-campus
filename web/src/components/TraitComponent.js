/**
 * TraitComponent.js
 * Pure component storing the Origin and Class synergy keys for a unit.
 */
export function createTraitComponent({ originKey = 'academy', classKey = 'warrior' } = {}) {
  return {
    originKey,
    classKey
  };
}
