/**
 * TransformComponent.js
 * Pure spatial data component for 2.5D board/bench coordinates and 8-direction orientation.
 */
export function createTransformComponent({
  x = 0,
  y = 0,
  dir = 0, // 0:S, 1:SE, 2:E, 3:NE, 4:N, 5:NW, 6:W, 7:SW
  scale = 1.0,
  alpha = 1.0
} = {}) {
  return {
    x,
    y,
    dir,
    scale,
    alpha,
    isDragging: false
  };
}

/**
 * Calculate exact 8-direction index (0..7) from delta vector (dx, dy).
 * 0: Sul (Baixo), 1: Sudeste, 2: Leste (Direita), 3: Nordeste,
 * 4: Norte (Cima), 5: Noroeste, 6: Oeste (Esquerda), 7: Sudoeste
 * @param {number} dx
 * @param {number} dy
 * @returns {number}
 */
export function calculateDirection8(dx, dy) {
  if (Math.abs(dx) < 0.01 && Math.abs(dy) < 0.01) return 0;
  const angle = Math.atan2(dy, dx) * (180 / Math.PI);
  const sector = Math.round((90 - angle) / 45);
  return ((sector % 8) + 8) % 8;
}
