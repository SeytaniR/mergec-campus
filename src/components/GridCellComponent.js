/**
 * GridCellComponent.js
 * Pure component storing tactical grid placement ('bench' or 'board').
 */
export function createGridCellComponent({
  zone = 'bench', // 'bench' | 'board'
  slotIndex = 0,  // 0..8 for bench
  col = 0,        // 0..6 for board
  row = 0,        // 0..5 for board (0..2 enemy, 3..5 player)
  team = 'player' // 'player' | 'enemy'
} = {}) {
  return {
    zone,
    slotIndex,
    col,
    row,
    homeCol: col,
    homeRow: row,
    team
  };
}
