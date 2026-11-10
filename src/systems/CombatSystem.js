/**
 * CombatSystem.js
 * Deterministic-style tactical auto-battler simulation in 8 directions.
 * Zero God Objects: Operates exclusively on Transform, GridCell, UnitStats, SpriteAnim, and CombatAI.
 */
import { calculateDirection8, createTransformComponent } from '../components/TransformComponent.js';
import { createGridCellComponent } from '../components/GridCellComponent.js';
import { createUnitStatsComponent } from '../components/UnitStatsComponent.js';
import { createTraitComponent } from '../components/TraitComponent.js';
import { createSpriteAnimComponent } from '../components/SpriteAnimComponent.js';
import { createCombatAIStateComponent } from '../components/CombatAIStateComponent.js';

export class CombatSystem {
  constructor(boardCoords, synergySystem, eventBus, i18n, featuredUnits, getGameState) {
    this.boardCoords = boardCoords;
    this.synergySystem = synergySystem;
    this.eventBus = eventBus;
    this.i18n = i18n;
    this.featuredUnits = featuredUnits;
    this.getGameState = getGameState;

    this.world = null;
    this.natureHealTimer = 0;
    this.roundEndTimer = 0;
    this.isResolvingEnd = false;
  }

  init(world) {
    this.world = world;
  }

  /**
   * Start a combat round: buff player units and spawn wave enemies on rows 0..2.
   */
  startCombatRound() {
    if (!this.world) return;
    const state = this.getGameState();
    if (state.phase === 'combat') return;

    // Ensure at least 1 player unit is on the board; if not, auto-deploy from bench
    const boardPlayers = this.getBoardUnits('player');
    if (boardPlayers.length === 0) {
      const benchPlayers = this.getBenchUnits();
      if (benchPlayers.length > 0) {
        const firstId = benchPlayers[0];
        const g = this.world.getComponent(firstId, 'GridCell');
        const t = this.world.getComponent(firstId, 'Transform');
        g.zone = 'board';
        g.col = 3;
        g.row = 4;
        g.homeCol = 3;
        g.homeRow = 4;
        const pos = this.boardCoords.boardToWorld(3, 4);
        t.x = pos.x;
        t.y = pos.y;
        t.dir = 4;
        this.eventBus.emit('board:changed');
      }
    }

    state.phase = 'combat';
    this.isResolvingEnd = false;
    this.natureHealTimer = 0;

    // Save home positions and apply synergy buffs
    for (const id of this.getBoardUnits('player')) {
      const g = this.world.getComponent(id, 'GridCell');
      const ai = this.world.getComponent(id, 'CombatAI');
      g.homeCol = g.col;
      g.homeRow = g.row;
      if (ai) {
        ai.state = 'IDLE';
        ai.attackTimer = 0;
      }
    }

    this.synergySystem.applyCombatBuffs(this.world);
    this.spawnEnemyWave(state.round);
    this.eventBus.emit('state:updated');
  }

  /**
   * Spawn enemy squad scaled to current round on rows 0..2.
   */
  spawnEnemyWave(round) {
    const enemyCount = Math.min(6, 2 + Math.floor(round / 2));
    const usedCells = new Set();

    for (let i = 0; i < enemyCount; i++) {
      const unitDef = this.featuredUnits[(round * 3 + i * 5) % this.featuredUnits.length];
      const starTier = round >= 6 && i === 0 ? 2 : 1;

      let col = (i * 2 + 1) % this.boardCoords.COLS;
      let row = i < 3 ? 1 : 0;
      while (usedCells.has(`${col},${row}`)) {
        col = (col + 1) % this.boardCoords.COLS;
      }
      usedCells.add(`${col},${row}`);

      const pos = this.boardCoords.boardToWorld(col, row);
      const entityId = this.world.createEntity();

      this.world.addComponent(entityId, 'Transform', createTransformComponent({
        x: pos.x,
        y: pos.y,
        dir: 0 // Face South toward player squad
      }));
      this.world.addComponent(entityId, 'GridCell', createGridCellComponent({
        zone: 'board',
        col,
        row,
        team: 'enemy'
      }));
      this.world.addComponent(entityId, 'UnitStats', createUnitStatsComponent(unitDef, starTier));
      this.world.addComponent(entityId, 'Trait', createTraitComponent({
        originKey: unitDef.origin_key,
        classKey: unitDef.class_key
      }));
      this.world.addComponent(entityId, 'SpriteAnim', createSpriteAnimComponent(unitDef.visual));
      this.world.addComponent(entityId, 'CombatAI', createCombatAIStateComponent());
    }
  }

  update(dt, world) {
    const state = this.getGameState();
    if (state.phase !== 'combat') return;

    if (this.isResolvingEnd) {
      this.roundEndTimer -= dt;
      if (this.roundEndTimer <= 0) {
        this.finishCombatRound();
      }
      return;
    }

    const activePlayers = this.getLivingBoardUnits('player');
    const activeEnemies = this.getLivingBoardUnits('enemy');

    if (activePlayers.length === 0 || activeEnemies.length === 0) {
      this.isResolvingEnd = true;
      this.roundEndTimer = 1.25;
      const playerWon = activePlayers.length > 0;
      this.onBattleOutcome(playerWon, activeEnemies.length);
      return;
    }

    // Periodic Nature synergy heal
    const cfg = state.config || {};
    const healInterval = Number(cfg.nature_heal_interval_sec) || 2.0;
    this.natureHealTimer += dt;
    if (this.natureHealTimer >= healInterval) {
      this.natureHealTimer = 0;
      const natureSyn = this.synergySystem.activeSynergies.find(
        s => s.type === 'origin' && s.key === 'nature' && s.activeTier > 0
      );
      if (natureSyn) {
        const healAmt = natureSyn.bonusVars.bonus || 65;
        for (const pid of activePlayers) {
          const st = world.getComponent(pid, 'UnitStats');
          const tr = world.getComponent(pid, 'Transform');
          if (st.hp < st.maxHp) {
            st.hp = Math.min(st.maxHp, st.hp + healAmt);
            this.eventBus.emit('combat:floating_text', {
              x: tr.x,
              y: tr.y,
              text: `+${healAmt}🌿`,
              color: 0x4ade80,
              scale: 0.9
            });
          }
        }
      }
    }

    const allCombatants = [...activePlayers, ...activeEnemies];
    for (const id of allCombatants) {
      this.updateUnitCombatAI(id, dt, world);
    }
  }

  updateUnitCombatAI(id, dt, world) {
    const stats = world.getComponent(id, 'UnitStats');
    const grid = world.getComponent(id, 'GridCell');
    const transform = world.getComponent(id, 'Transform');
    const anim = world.getComponent(id, 'SpriteAnim');
    const ai = world.getComponent(id, 'CombatAI');
    if (!stats || !stats.alive || !ai) return;

    // Handle smooth cell-to-cell movement
    if (ai.state === 'MOVING') {
      ai.moveTimer += dt;
      const t = Math.min(1, ai.moveTimer / ai.moveDuration);
      transform.x = ai.startX + (ai.destX - ai.startX) * t;
      transform.y = ai.startY + (ai.destY - ai.startY) * t;
      if (t >= 1) {
        ai.state = 'IDLE';
        anim.action = 0;
      }
      return;
    }

    // Acquire nearest living enemy
    const targetId = this.findNearestEnemy(id, grid.team);
    if (!targetId) {
      anim.action = 0;
      return;
    }

    const targetGrid = world.getComponent(targetId, 'GridCell');
    const targetTransform = world.getComponent(targetId, 'Transform');
    const targetStats = world.getComponent(targetId, 'UnitStats');

    // Calculate 8-direction facing angle toward target
    const dx = targetTransform.x - transform.x;
    const dy = targetTransform.y - transform.y;
    transform.dir = calculateDirection8(dx, dy);

    const cellDist = Math.max(
      Math.abs(targetGrid.col - grid.col),
      Math.abs(targetGrid.row - grid.row)
    );

    if (cellDist <= stats.range) {
      // Within attack range
      ai.attackTimer += dt;
      const interval = 1 / Math.max(0.25, stats.atkSpeed);
      if (ai.attackTimer >= interval) {
        ai.attackTimer = 0;
        if (stats.mana >= stats.maxMana) {
          this.executeUltimateSkill(id, targetId, stats, transform, anim, targetStats, targetTransform);
        } else {
          this.executeBasicAttack(id, targetId, stats, transform, anim, targetStats, targetTransform);
        }
      }
    } else {
      // Step toward target on discrete grid
      const nextCell = this.findStepCellToward(grid.col, grid.row, targetGrid.col, targetGrid.row);
      if (nextCell) {
        grid.col = nextCell.col;
        grid.row = nextCell.row;
        const dest = this.boardCoords.boardToWorld(nextCell.col, nextCell.row);
        ai.state = 'MOVING';
        ai.moveTimer = 0;
        ai.startX = transform.x;
        ai.startY = transform.y;
        ai.destX = dest.x;
        ai.destY = dest.y;
        transform.dir = calculateDirection8(dest.x - transform.x, dest.y - transform.y);
        anim.action = 1; // Action 1 = Walk in 8 directions
        anim.loop = true;
      }
    }
  }

  executeBasicAttack(attackerId, targetId, stats, transform, anim, targetStats, targetTransform) {
    const cfg = this.getGameState()?.config || {};
    const manaGain = Number(cfg.mana_per_attack ?? 15);
    const armorK = Number(cfg.armor_mitigation_k ?? 100);
    const minBasic = Number(cfg.min_basic_damage ?? 12);

    anim.action = 3; // Action 3 = Physical Attack
    anim.frameIdx = 0;
    anim.loop = false;
    anim.returnAction = 0;

    stats.mana = Math.min(stats.maxMana, stats.mana + manaGain);

    const rawDmg = Math.max(minBasic, Math.round(stats.atk * (armorK / (armorK + targetStats.def))));
    this.applyDamage(targetId, targetStats, targetTransform, rawDmg, 0xffffff);
  }

  executeUltimateSkill(casterId, targetId, stats, transform, anim, targetStats, targetTransform) {
    const cfg = this.getGameState()?.config || {};
    const armorK = Number(cfg.armor_mitigation_k ?? 100);
    const armorPen = Number(cfg.skill_armor_pen_factor ?? 0.6);
    const minSkill = Number(cfg.min_skill_damage ?? 35);
    const shieldRatio = Number(cfg.skill_shield_ratio ?? 0.4);

    stats.mana = 0;
    anim.action = 7; // Action 7 = Magic Cast
    anim.frameIdx = 0;
    anim.loop = false;
    anim.returnAction = 0;

    // Trigger authentic Magic Campus WebP VFX explosion at target
    this.eventBus.emit('vfx:spawn', {
      vfxId: anim.vfxId || '10008',
      x: targetTransform.x,
      y: targetTransform.y,
      scale: 1.15
    });

    const skillDmg = Math.max(minSkill, Math.round(stats.skillDamage * (armorK / (armorK + targetStats.def * armorPen))));
    this.applyDamage(targetId, targetStats, targetTransform, skillDmg, 0x38bdf8, '💥');

    // Apply self shield or heal if part of unit archetype
    if (stats.skillShield > 0) {
      stats.shield += Math.round(stats.skillShield * shieldRatio);
    }
    if (stats.skillHeal > 0) {
      stats.hp = Math.min(stats.maxHp, stats.hp + Math.round(stats.skillHeal * shieldRatio));
    }
  }

  applyDamage(targetId, targetStats, targetTransform, amount, color = 0xffffff, prefix = '-') {
    const cfg = this.getGameState()?.config || {};
    const manaOnHit = Number(cfg.mana_on_hit_taken ?? 6);

    let remaining = amount;
    if (targetStats.shield > 0) {
      const absorbed = Math.min(targetStats.shield, remaining);
      targetStats.shield -= absorbed;
      remaining -= absorbed;
    }

    targetStats.hp = Math.max(0, targetStats.hp - remaining);
    targetStats.mana = Math.min(targetStats.maxMana, targetStats.mana + manaOnHit);

    const targetAnim = this.world.getComponent(targetId, 'SpriteAnim');
    if (targetStats.hp <= 0 && targetStats.alive) {
      targetStats.alive = false;
      if (targetAnim) {
        targetAnim.action = 4; // Action 4 = Dead
        targetAnim.frameIdx = 0;
        targetAnim.loop = false;
      }
    } else if (targetAnim && targetAnim.action === 0) {
      targetAnim.action = 5; // Action 5 = Hurt
      targetAnim.frameIdx = 0;
      targetAnim.loop = false;
      targetAnim.returnAction = 0;
    }

    this.eventBus.emit('combat:floating_text', {
      x: targetTransform.x,
      y: targetTransform.y,
      text: `${prefix}${amount}`,
      color,
      scale: prefix === '💥' ? 1.2 : 1.0
    });
  }

  onBattleOutcome(playerWon, survivingEnemiesCount) {
    const state = this.getGameState();
    const cfg = state.config || {};
    const winGold = Number(cfg.round_win_gold ?? 5);
    const lossGold = Number(cfg.round_loss_gold ?? 4);
    const maxInterest = Number(cfg.max_interest_gold ?? 5);
    const interestPer10 = Number(cfg.interest_per_10_gold ?? 1);
    const streakThreshold = Number(cfg.streak_threshold ?? 3);
    const streakBonus = Number(cfg.streak_bonus_gold ?? 2);

    if (playerWon) {
      state.streak++;
      const interest = Math.min(maxInterest, Math.floor(state.gold / 10) * interestPer10);
      const reward = winGold + interest + (state.streak >= streakThreshold ? streakBonus : 0);
      state.gold += reward;

      this.eventBus.emit('ui:toast', {
        message: this.i18n.t('toast.combat.victory', { round: state.round, gold: reward }),
        type: 'victory'
      });
    } else {
      state.streak = 0;
      const hpLoss = Math.max(2, survivingEnemiesCount * 3);
      state.hp = Math.max(1, state.hp - hpLoss);
      state.gold += lossGold;

      this.eventBus.emit('ui:toast', {
        message: this.i18n.t('toast.combat.defeat', { round: state.round, dmg: hpLoss }),
        type: 'defeat'
      });
    }
  }

  finishCombatRound() {
    const state = this.getGameState();
    // Destroy all enemy entities
    const entities = this.world.query(['GridCell']);
    for (const id of entities) {
      const g = this.world.getComponent(id, 'GridCell');
      if (g.team === 'enemy') {
        this.world.destroyEntity(id);
      }
    }

    // Restore all player board units to homeCol, homeRow and full HP
    for (const id of this.getBoardUnits('player')) {
      const g = this.world.getComponent(id, 'GridCell');
      const t = this.world.getComponent(id, 'Transform');
      const s = this.world.getComponent(id, 'UnitStats');
      const a = this.world.getComponent(id, 'SpriteAnim');
      const ai = this.world.getComponent(id, 'CombatAI');

      g.col = g.homeCol;
      g.row = g.homeRow;
      const pos = this.boardCoords.boardToWorld(g.col, g.row);
      t.x = pos.x;
      t.y = pos.y;
      t.dir = 4;
      s.alive = true;
      s.hp = s.baseMaxHp;
      s.maxHp = s.baseMaxHp;
      s.shield = 0;
      s.mana = s.startMana;
      if (a) {
        a.action = 0;
        a.loop = true;
      }
      if (ai) {
        ai.state = 'IDLE';
      }
    }

    state.round++;
    state.phase = 'prep';
    this.eventBus.emit('round:completed');
    this.eventBus.emit('state:updated');
  }

  findNearestEnemy(myId, myTeam) {
    const myTransform = this.world.getComponent(myId, 'Transform');
    let bestId = null;
    let bestDistSq = Infinity;

    const entities = this.world.query(['GridCell', 'UnitStats', 'Transform']);
    for (const id of entities) {
      if (id === myId) continue;
      const g = this.world.getComponent(id, 'GridCell');
      const s = this.world.getComponent(id, 'UnitStats');
      if (g.zone !== 'board' || g.team === myTeam || !s.alive) continue;

      const t = this.world.getComponent(id, 'Transform');
      const dx = t.x - myTransform.x;
      const dy = t.y - myTransform.y;
      const dSq = dx * dx + dy * dy;
      if (dSq < bestDistSq) {
        bestDistSq = dSq;
        bestId = id;
      }
    }
    return bestId;
  }

  findStepCellToward(col, row, targetCol, targetRow) {
    const occupied = new Set();
    for (const id of this.world.query(['GridCell', 'UnitStats'])) {
      const g = this.world.getComponent(id, 'GridCell');
      const s = this.world.getComponent(id, 'UnitStats');
      if (g.zone === 'board' && s.alive) {
        occupied.add(`${g.col},${g.row}`);
      }
    }

    let bestCell = null;
    let bestDist = Infinity;

    for (let dc = -1; dc <= 1; dc++) {
      for (let dr = -1; dr <= 1; dr++) {
        if (dc === 0 && dr === 0) continue;
        const nc = col + dc;
        const nr = row + dr;
        if (nc < 0 || nc >= this.boardCoords.COLS || nr < 0 || nr >= this.boardCoords.ROWS) continue;
        if (occupied.has(`${nc},${nr}`)) continue;

        const dist = Math.hypot(targetCol - nc, targetRow - nr);
        if (dist < bestDist) {
          bestDist = dist;
          bestCell = { col: nc, row: nr };
        }
      }
    }
    return bestCell;
  }

  getBoardUnits(team) {
    const res = [];
    for (const id of this.world.query(['GridCell'])) {
      const g = this.world.getComponent(id, 'GridCell');
      if (g.zone === 'board' && g.team === team) res.push(id);
    }
    return res;
  }

  getLivingBoardUnits(team) {
    const res = [];
    for (const id of this.world.query(['GridCell', 'UnitStats'])) {
      const g = this.world.getComponent(id, 'GridCell');
      const s = this.world.getComponent(id, 'UnitStats');
      if (g.zone === 'board' && g.team === team && s.alive) res.push(id);
    }
    return res;
  }

  getBenchUnits() {
    const res = [];
    for (const id of this.world.query(['GridCell'])) {
      const g = this.world.getComponent(id, 'GridCell');
      if (g.zone === 'bench' && g.team === 'player') res.push(id);
    }
    return res;
  }
}
