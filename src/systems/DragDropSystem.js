/**
 * DragDropSystem.js
 * Handles pointer/touch unit selection, dragging across Bench & Board,
 * swapping occupied cells, enforcing board capacity, and selling units.
 */
export class DragDropSystem {
  constructor(stage, sceneContainer, boardCoords, eventBus, i18n, getGameState) {
    this.stage = stage;
    this.sceneContainer = sceneContainer;
    this.boardCoords = boardCoords;
    this.eventBus = eventBus;
    this.i18n = i18n;
    this.getGameState = getGameState;

    this.world = null;
    this.draggedEntityId = null;
    this.originPos = { x: 0, y: 0 };
  }

  init(world) {
    this.world = world;
    this.stage.eventMode = 'static';

    this.eventBus.on('unit:pointerdown', ({ entityId, event }) => {
      this.onUnitPointerDown(entityId, event);
    });

    this.stage.on('pointermove', (e) => this.onPointerMove(e));
    this.stage.on('pointerup', (e) => this.onPointerUp(e));
    this.stage.on('pointerupoutside', (e) => this.onPointerUp(e));
  }

  onUnitPointerDown(entityId, event) {
    if (!this.world) return;
    const stats = this.world.getComponent(entityId, 'UnitStats');
    const grid = this.world.getComponent(entityId, 'GridCell');
    const trait = this.world.getComponent(entityId, 'Trait');
    const anim = this.world.getComponent(entityId, 'SpriteAnim');
    const transform = this.world.getComponent(entityId, 'Transform');

    if (stats && trait && anim) {
      this.eventBus.emit('unit:selected', { entityId, stats, trait, anim, grid });
    }

    if (!grid || grid.team !== 'player') return;

    const state = this.getGameState();
    if (state.phase === 'combat' && grid.zone === 'board') {
      this.eventBus.emit('ui:toast', {
        message: this.i18n.t('toast.board.combat_locked'),
        type: 'warn'
      });
      return;
    }

    this.draggedEntityId = entityId;
    this.originPos = { x: transform.x, y: transform.y };
    transform.isDragging = true;

    const refund = Math.max(1, stats.cost * stats.starTier);
    this.eventBus.emit('drag:started', { entityId, refund });

    if (event && event.global) {
      const local = this.sceneContainer.toLocal(event.global);
      transform.x = local.x;
      transform.y = local.y;
    }
  }

  onPointerMove(event) {
    if (this.draggedEntityId === null || !this.world) return;
    const transform = this.world.getComponent(this.draggedEntityId, 'Transform');
    if (!transform) return;

    const local = this.sceneContainer.toLocal(event.global);
    transform.x = local.x;
    transform.y = local.y;

    const dropTarget = this.boardCoords.worldToDropTarget(local.x, local.y);
    this.boardCoords.highlightDropTarget(dropTarget);
  }

  onPointerUp(event) {
    if (this.draggedEntityId === null || !this.world) return;
    const entityId = this.draggedEntityId;
    this.draggedEntityId = null;
    this.boardCoords.highlightDropTarget(null);

    const transform = this.world.getComponent(entityId, 'Transform');
    const grid = this.world.getComponent(entityId, 'GridCell');
    const stats = this.world.getComponent(entityId, 'UnitStats');
    if (!transform || !grid || !stats) return;
    transform.isDragging = false;

    // Check if dropped over HTML sell zone button
    const sellEl = document.getElementById('sell-dropzone');
    if (sellEl && event && event.global) {
      const rect = sellEl.getBoundingClientRect();
      const canvasEl = document.getElementById('pixi-canvas-wrap');
      const cRect = canvasEl ? canvasEl.getBoundingClientRect() : { left: 0, top: 0 };
      const clientX = cRect.left + event.global.x;
      const clientY = cRect.top + event.global.y;
      if (
        clientX >= rect.left &&
        clientX <= rect.right &&
        clientY >= rect.top &&
        clientY <= rect.bottom
      ) {
        this.eventBus.emit('drag:ended');
        this.eventBus.emit('cmd:sell_unit', { entityId });
        return;
      }
    }

    const local = this.sceneContainer.toLocal(event.global);
    const target = this.boardCoords.worldToDropTarget(local.x, local.y);
    this.eventBus.emit('drag:ended');

    if (!target) {
      this.snapToCurrentSlot(grid, transform);
      return;
    }

    const state = this.getGameState();
    if (state.phase === 'combat' && target.zone === 'board') {
      this.snapToCurrentSlot(grid, transform);
      return;
    }

    // Find if another player unit occupies the target slot
    const occupantId = this.findOccupant(target, entityId);

    if (target.zone === 'board' && grid.zone === 'bench' && !occupantId) {
      const currentBoardCount = this.countPlayerBoardUnits();
      if (currentBoardCount >= state.level) {
        this.eventBus.emit('ui:toast', {
          message: this.i18n.t('toast.board.full', { max: state.level }),
          type: 'warn'
        });
        this.snapToCurrentSlot(grid, transform);
        return;
      }
    }

    if (occupantId) {
      const occGrid = this.world.getComponent(occupantId, 'GridCell');
      const occTransform = this.world.getComponent(occupantId, 'Transform');
      // Swap grid coordinates
      const prevZone = grid.zone;
      const prevSlot = grid.slotIndex;
      const prevCol = grid.col;
      const prevRow = grid.row;

      this.assignTargetToGrid(grid, transform, target);
      this.assignTargetToGrid(occGrid, occTransform, {
        zone: prevZone,
        slotIndex: prevSlot,
        col: prevCol,
        row: prevRow
      });
    } else {
      this.assignTargetToGrid(grid, transform, target);
    }

    this.eventBus.emit('board:changed');
  }

  assignTargetToGrid(grid, transform, target) {
    if (target.zone === 'bench') {
      grid.zone = 'bench';
      grid.slotIndex = target.slotIndex;
      const pos = this.boardCoords.benchToWorld(target.slotIndex);
      transform.x = pos.x;
      transform.y = pos.y;
      transform.dir = 0; // Face South on bench
    } else {
      grid.zone = 'board';
      grid.col = target.col;
      grid.row = target.row;
      grid.homeCol = target.col;
      grid.homeRow = target.row;
      const pos = this.boardCoords.boardToWorld(target.col, target.row);
      transform.x = pos.x;
      transform.y = pos.y;
      transform.dir = 4; // Face North toward enemy team on board!
    }
  }

  snapToCurrentSlot(grid, transform) {
    if (grid.zone === 'bench') {
      const pos = this.boardCoords.benchToWorld(grid.slotIndex);
      transform.x = pos.x;
      transform.y = pos.y;
    } else {
      const pos = this.boardCoords.boardToWorld(grid.col, grid.row);
      transform.x = pos.x;
      transform.y = pos.y;
    }
  }

  findOccupant(target, ignoreEntityId) {
    const entities = this.world.query(['GridCell']);
    for (const id of entities) {
      if (id === ignoreEntityId) continue;
      const g = this.world.getComponent(id, 'GridCell');
      if (g.team !== 'player') continue;
      if (target.zone === 'bench' && g.zone === 'bench' && g.slotIndex === target.slotIndex) {
        return id;
      }
      if (target.zone === 'board' && g.zone === 'board' && g.col === target.col && g.row === target.row) {
        return id;
      }
    }
    return null;
  }

  countPlayerBoardUnits() {
    let count = 0;
    const entities = this.world.query(['GridCell']);
    for (const id of entities) {
      const g = this.world.getComponent(id, 'GridCell');
      if (g.team === 'player' && g.zone === 'board') count++;
    }
    return count;
  }
}
