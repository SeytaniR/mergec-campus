/**
 * CombatAIStateComponent.js
 * Pure component for tactical auto-battler AI state during combat rounds.
 */
export function createCombatAIStateComponent() {
  return {
    state: 'IDLE', // 'IDLE' | 'MOVING' | 'ATTACKING' | 'CASTING' | 'DEAD'
    targetEntityId: null,
    attackTimer: 0,
    moveTimer: 0,
    moveDuration: 0.32,
    startX: 0,
    startY: 0,
    destX: 0,
    destY: 0
  };
}
