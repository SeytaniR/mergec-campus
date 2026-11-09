/**
 * AuthoritativeBridge.js
 * Modular Authoritative Game State & Command Dispatcher.
 * Connects to the remote WebSocket VPS Server when configured, or runs the identical
 * authoritative validation rules in local loopback mode for GitHub Pages.
 */
import { createTransformComponent } from '../components/TransformComponent.js';
import { createGridCellComponent } from '../components/GridCellComponent.js';
import { createUnitStatsComponent } from '../components/UnitStatsComponent.js';
import { createTraitComponent } from '../components/TraitComponent.js';
import { createSpriteAnimComponent } from '../components/SpriteAnimComponent.js';
import { createCombatAIStateComponent } from '../components/CombatAIStateComponent.js';

export class AuthoritativeBridge {
  constructor(world, boardCoords, eventBus, i18n, allVerifiedUnits) {
    this.world = world;
    this.boardCoords = boardCoords;
    this.eventBus = eventBus;
    this.i18n = i18n;
    this.allVerifiedUnits = allVerifiedUnits;
    this.featuredPool = allVerifiedUnits.filter(u => u.is_featured_pool);

    this.state = {
      round: 1,
      phase: 'prep', // 'prep' | 'combat'
      gold: 16,
      level: 3,
      xp: 0,
      nextXp: 4,
      hp: 100,
      streak: 0,
      shopLocked: false,
      shopSlots: [], // Array of 5 { unitDef, purchased }
      serverMode: 'local',
      serverUrl: ''
    };

    this.ws = null;
  }

  init() {
    this.bindCommandEvents();
    this.rollShop(true);
    this.spawnStarterSquad();
    this.eventBus.emit('state:updated');
  }

  /**
   * Optional connection to remote Authoritative WebSocket Server (e.g. Azure VPS).
   * @param {string} wsUrl
   */
  connectRemoteServer(wsUrl) {
    try {
      this.ws = new WebSocket(wsUrl);
      this.ws.onopen = () => {
        this.state.serverMode = 'remote';
        this.state.serverUrl = wsUrl;
        this.eventBus.emit('state:updated');
      };
      this.ws.onmessage = (msg) => {
        try {
          const packet = JSON.parse(msg.data);
          if (packet.type === 'STATE_SYNC' && packet.state) {
            Object.assign(this.state, packet.state);
            this.eventBus.emit('state:updated');
          }
        } catch (err) {
          console.warn('[AuthoritativeBridge] Invalid WS packet:', err);
        }
      };
      this.ws.onclose = () => {
        this.state.serverMode = 'local';
        this.eventBus.emit('state:updated');
      };
    } catch (err) {
      this.state.serverMode = 'local';
    }
  }

  bindCommandEvents() {
    this.eventBus.on('cmd:buy_shop_slot', ({ slotIndex }) => {
      this.handleBuyShopSlot(slotIndex);
    });

    this.eventBus.on('cmd:reroll_shop', () => {
      this.handleRerollShop();
    });

    this.eventBus.on('cmd:buy_xp', () => {
      this.handleBuyXp();
    });

    this.eventBus.on('cmd:toggle_lock', () => {
      this.state.shopLocked = !this.state.shopLocked;
      this.eventBus.emit('state:updated');
    });

    this.eventBus.on('cmd:sell_unit', ({ entityId }) => {
      this.handleSellUnit(entityId);
    });

    this.eventBus.on('cmd:spawn_unit_by_id', ({ unitId }) => {
      const def = this.allVerifiedUnits.find(u => u.id === unitId);
      if (def) {
        this.spawnUnitOnBench(def, 1);
      }
    });

    this.eventBus.on('round:completed', () => {
      if (!this.state.shopLocked) {
        this.rollShop(true);
      }
      this.gainXp(2);
    });
  }

  spawnStarterSquad() {
    const hero1 = this.featuredPool[0] || this.allVerifiedUnits[0];
    const hero2 = this.featuredPool[1] || this.allVerifiedUnits[1];

    // Deploy 2 starter units onto player board
    this.spawnUnitOnBoard(hero1, 1, 2, 4);
    this.spawnUnitOnBoard(hero2, 1, 4, 4);

    // Put 1 copy of each on the bench (2 copies owned total -> 1 click away from 2-Star Merge!)
    this.spawnUnitOnBench(hero1, 1);
    this.spawnUnitOnBench(hero2, 1);

    // Offer the 3rd copy in Shop Slots 0 and 1 with ✨ MERGE! badge
    if (this.state.shopSlots.length >= 2) {
      this.state.shopSlots[0] = { unitDef: hero1, purchased: false };
      this.state.shopSlots[1] = { unitDef: hero2, purchased: false };
    }

    this.eventBus.emit('board:changed');
  }

  rollShop(free = false) {
    const slots = [];
    for (let i = 0; i < 5; i++) {
      const maxTierAllowed = Math.min(5, this.state.level);
      const candidates = this.featuredPool.filter(u => u.cost <= maxTierAllowed);
      const pool = candidates.length > 0 ? candidates : this.featuredPool;
      const pick = pool[Math.floor(Math.random() * pool.length)];
      slots.push({
        unitDef: pick,
        purchased: false
      });
    }
    this.state.shopSlots = slots;
    this.eventBus.emit('state:updated');
  }

  handleRerollShop() {
    const cost = 2;
    if (this.state.gold < cost) {
      this.eventBus.emit('ui:toast', {
        message: this.i18n.t('toast.shop.no_gold', { cost }),
        type: 'warn'
      });
      return;
    }
    this.state.gold -= cost;
    this.rollShop(true);
  }

  handleBuyXp() {
    const cost = 4;
    if (this.state.gold < cost) {
      this.eventBus.emit('ui:toast', {
        message: this.i18n.t('toast.shop.no_gold', { cost }),
        type: 'warn'
      });
      return;
    }
    this.state.gold -= cost;
    this.gainXp(4);
    this.eventBus.emit('state:updated');
  }

  gainXp(amount) {
    if (this.state.level >= 9) return;
    this.state.xp += amount;
    while (this.state.xp >= this.state.nextXp && this.state.level < 9) {
      this.state.xp -= this.state.nextXp;
      this.state.level++;
      this.state.nextXp = Math.round(this.state.nextXp * 1.5 + 2);
    }
  }

  handleBuyShopSlot(slotIndex) {
    const slot = this.state.shopSlots[slotIndex];
    if (!slot || slot.purchased) return;

    const unitDef = slot.unitDef;
    if (this.state.gold < unitDef.cost) {
      this.eventBus.emit('ui:toast', {
        message: this.i18n.t('toast.shop.no_gold', { cost: unitDef.cost }),
        type: 'warn'
      });
      return;
    }

    // Check if buying this unit will immediately trigger a 3-of-a-kind merge even if bench is full
    const canAutoMerge = this.countPlayerCopies(unitDef.id, 1) >= 2;
    const freeBenchSlot = this.findFreeBenchSlot();

    if (freeBenchSlot === -1 && !canAutoMerge) {
      this.eventBus.emit('ui:toast', {
        message: this.i18n.t('toast.bench.full'),
        type: 'warn'
      });
      return;
    }

    this.state.gold -= unitDef.cost;
    slot.purchased = true;
    this.spawnUnitOnBench(unitDef, 1, freeBenchSlot !== -1 ? freeBenchSlot : 0);
    this.eventBus.emit('state:updated');
  }

  handleSellUnit(entityId) {
    const stats = this.world.getComponent(entityId, 'UnitStats');
    const grid = this.world.getComponent(entityId, 'GridCell');
    if (!stats || !grid || grid.team !== 'player') return;

    const refund = Math.max(1, stats.cost * stats.starTier);
    this.state.gold += refund;
    this.world.destroyEntity(entityId);
    this.eventBus.emit('board:changed');
    this.eventBus.emit('state:updated');
  }

  spawnUnitOnBench(unitDef, starTier = 1, forcedSlot = null) {
    const slotIndex = forcedSlot !== null ? forcedSlot : this.findFreeBenchSlot();
    if (slotIndex === -1) {
      this.eventBus.emit('ui:toast', {
        message: this.i18n.t('toast.bench.full'),
        type: 'warn'
      });
      return null;
    }

    const pos = this.boardCoords.benchToWorld(slotIndex);
    const entityId = this.world.createEntity();

    this.world.addComponent(entityId, 'Transform', createTransformComponent({
      x: pos.x,
      y: pos.y,
      dir: 0
    }));
    this.world.addComponent(entityId, 'GridCell', createGridCellComponent({
      zone: 'bench',
      slotIndex,
      team: 'player'
    }));
    this.world.addComponent(entityId, 'UnitStats', createUnitStatsComponent(unitDef, starTier));
    this.world.addComponent(entityId, 'Trait', createTraitComponent({
      originKey: unitDef.origin_key,
      classKey: unitDef.class_key
    }));
    this.world.addComponent(entityId, 'SpriteAnim', createSpriteAnimComponent(unitDef.visual));
    this.world.addComponent(entityId, 'CombatAI', createCombatAIStateComponent());

    this.eventBus.emit('unit:check_merge');
    return entityId;
  }

  spawnUnitOnBoard(unitDef, starTier, col, row) {
    const pos = this.boardCoords.boardToWorld(col, row);
    const entityId = this.world.createEntity();

    this.world.addComponent(entityId, 'Transform', createTransformComponent({
      x: pos.x,
      y: pos.y,
      dir: 4 // Face North toward enemy team
    }));
    this.world.addComponent(entityId, 'GridCell', createGridCellComponent({
      zone: 'board',
      col,
      row,
      team: 'player'
    }));
    this.world.addComponent(entityId, 'UnitStats', createUnitStatsComponent(unitDef, starTier));
    this.world.addComponent(entityId, 'Trait', createTraitComponent({
      originKey: unitDef.origin_key,
      classKey: unitDef.class_key
    }));
    this.world.addComponent(entityId, 'SpriteAnim', createSpriteAnimComponent(unitDef.visual));
    this.world.addComponent(entityId, 'CombatAI', createCombatAIStateComponent());
    return entityId;
  }

  findFreeBenchSlot() {
    const occupied = new Set();
    for (const id of this.world.query(['GridCell'])) {
      const g = this.world.getComponent(id, 'GridCell');
      if (g.team === 'player' && g.zone === 'bench') {
        occupied.add(g.slotIndex);
      }
    }
    for (let i = 0; i < this.boardCoords.BENCH_SLOTS; i++) {
      if (!occupied.has(i)) return i;
    }
    return -1;
  }

  countPlayerCopies(unitId, starTier) {
    let count = 0;
    for (const id of this.world.query(['UnitStats', 'GridCell'])) {
      const g = this.world.getComponent(id, 'GridCell');
      const s = this.world.getComponent(id, 'UnitStats');
      if (g.team === 'player' && s.unitId === unitId && s.starTier === starTier) {
        count++;
      }
    }
    return count;
  }
}
