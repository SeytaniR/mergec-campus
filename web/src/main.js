/**
 * main.js
 * Clean ES6 Module Bootstrapper for Mergec Campus (Pixi.js v7.3.2).
 * Zero God Objects: Instantiates the ECS World, registers single-responsibility Systems,
 * and starts the Pixi.js ticker.
 */
import { EventBus } from './ecs/EventBus.js';
import { World } from './ecs/World.js';
import { I18nService } from './i18n/I18nService.js';
import { syncTraitsFromDatabase } from './data/TraitRegistry.js';
import { AssetCacheSystem } from './systems/AssetCacheSystem.js';
import { ArenaEnvironmentSystem } from './systems/ArenaEnvironmentSystem.js';
import { BoardCoordSystem } from './systems/BoardCoordSystem.js';
import { UnitRenderSystem } from './systems/UnitRenderSystem.js';
import { AnimationSystem } from './systems/AnimationSystem.js';
import { MergeSystem } from './systems/MergeSystem.js';
import { SynergySystem } from './systems/SynergySystem.js';
import { DragDropSystem } from './systems/DragDropSystem.js';
import { CombatSystem } from './systems/CombatSystem.js';
import { LayoutSystem } from './systems/LayoutSystem.js';
import { HudUiSystem } from './systems/HudUiSystem.js';
import { AuthoritativeBridge } from './network/AuthoritativeBridge.js';

function getApiBaseUrl() {
  if (
    window.location.hostname &&
    !window.location.hostname.includes('github.io') &&
    window.location.protocol.startsWith('http')
  ) {
    return window.location.origin;
  }
  return 'https://40-65-63-193.sslip.io';
}

async function fetchBootstrapCatalog() {
  const apiBase = getApiBaseUrl();
  try {
    const res = await fetch(`${apiBase}/api/admin/bootstrap`, { cache: 'no-store' });
    if (res.ok) {
      const data = await res.json();
      if (data && Array.isArray(data.units) && data.units.length > 0) {
        return data;
      }
    }
  } catch (err) {
    console.warn('[MergecCampus] Falling back to static JSON catalog:', err);
  }
  const [dbRes, meshesRes] = await Promise.all([
    fetch('assets/data/verified_units_db.json'),
    fetch('assets/data/default_arena_meshes.json').catch(() => null)
  ]);
  const verifiedUnits = await dbRes.json();
  const arenaMeshes = meshesRes && meshesRes.ok ? await meshesRes.json() : [];
  return { config: null, units: verifiedUnits, traits: [], i18n: [], arenaMeshes };
}

async function bootstrapMergecCampus() {
  const eventBus = new EventBus();
  const i18n = new I18nService(eventBus, 'pt-BR');
  const world = new World(eventBus);

  // 1. Load Live PostgreSQL Catalog (or fallback to verified_units_db.json)
  const bootstrapData = await fetchBootstrapCatalog();
  let verifiedUnits = bootstrapData.units;
  i18n.registerDatabaseCatalog(verifiedUnits);
  if (Array.isArray(bootstrapData.traits) && bootstrapData.traits.length > 0) {
    syncTraitsFromDatabase(bootstrapData.traits, i18n);
  }
  if (Array.isArray(bootstrapData.i18n)) {
    for (const row of bootstrapData.i18n) {
      if (i18n.dictionaries[row.locale]) {
        i18n.dictionaries[row.locale][row.i18n_key] = row.text_value;
      }
    }
  }

  const unitsCatalogMap = new Map(verifiedUnits.map(u => [u.id, u]));
  const featuredUnits = verifiedUnits.filter(u => u.is_featured_pool);

  // 2. Initialize Pixi.js Application inside fluid container
  const canvasWrap = document.getElementById('pixi-canvas-wrap');
  const app = new PIXI.Application({
    width: 1376,
    height: 768,
    backgroundColor: 0x070b14,
    antialias: true,
    resolution: Math.min(window.devicePixelRatio || 1, 2),
    autoDensity: true
  });
  canvasWrap.appendChild(app.view);

  const sceneContainer = new PIXI.Container();
  const arenaLayer = new PIXI.Container();
  const boardLayer = new PIXI.Container();
  const unitLayer = new PIXI.Container();
  const vfxLayer = new PIXI.Container();
  sceneContainer.addChild(arenaLayer, boardLayer, unitLayer, vfxLayer);
  app.stage.addChild(sceneContainer);

  // 3. Instantiate Single-Responsibility ECS Systems
  const assetCache = new AssetCacheSystem();
  const boardCoords = new BoardCoordSystem(boardLayer);
  const authBridge = new AuthoritativeBridge(world, boardCoords, eventBus, i18n, verifiedUnits);
  const arenaSystem = new ArenaEnvironmentSystem(arenaLayer, eventBus, () => authBridge.state);

  const renderSystem = new UnitRenderSystem(unitLayer, vfxLayer, eventBus);
  const animSystem = new AnimationSystem(assetCache, renderSystem, vfxLayer, eventBus);
  const mergeSystem = new MergeSystem(eventBus, i18n, unitsCatalogMap);
  const synergySystem = new SynergySystem(eventBus);

  const dragDropSystem = new DragDropSystem(
    app.stage,
    sceneContainer,
    boardCoords,
    eventBus,
    i18n,
    () => authBridge.state
  );

  const combatSystem = new CombatSystem(
    boardCoords,
    synergySystem,
    eventBus,
    i18n,
    featuredUnits,
    () => authBridge.state
  );

  const layoutSystem = new LayoutSystem(app, sceneContainer, boardCoords);

  const hudSystem = new HudUiSystem(
    eventBus,
    i18n,
    verifiedUnits,
    () => authBridge.state,
    () => combatSystem.startCombatRound(),
    () => dragDropSystem.countPlayerBoardUnits()
  );

  hudSystem.countOwnedCopiesInDom = (unitId) => authBridge.countPlayerCopies(unitId, 1);

  // 4. Register Systems in ECS Pipeline Order
  world.registerSystem('ArenaEnvironment', arenaSystem, 5);
  world.registerSystem('BoardCoords', boardCoords, 10);
  world.registerSystem('Merge', mergeSystem, 20);
  world.registerSystem('Synergy', synergySystem, 30);
  world.registerSystem('DragDrop', dragDropSystem, 40);
  world.registerSystem('Combat', combatSystem, 50);
  world.registerSystem('Animation', animSystem, 60);
  world.registerSystem('UnitRender', renderSystem, 70);
  world.registerSystem('Layout', layoutSystem, 80);

  // Apply initial 2.5D Arena Meshes & Perspective Grid before spawning starter units
  if (Array.isArray(bootstrapData.arenaMeshes) && bootstrapData.arenaMeshes.length > 0) {
    boardCoords.syncFromArenaMeshes(bootstrapData.arenaMeshes);
    arenaSystem.syncMeshes(bootstrapData.arenaMeshes);
  } else {
    const fallbackRes = await fetch('assets/data/default_arena_meshes.json').catch(() => null);
    if (fallbackRes && fallbackRes.ok) {
      const defMeshes = await fallbackRes.json();
      boardCoords.syncFromArenaMeshes(defMeshes);
      arenaSystem.syncMeshes(defMeshes);
    }
  }

  // 5. Initialize Authoritative State & UI HUD
  if (bootstrapData.config) {
    authBridge.applyLiveConfig(bootstrapData.config);
    authBridge.state.gold = Number(bootstrapData.config.starting_gold ?? 16);
    authBridge.state.hp = Number(bootstrapData.config.starting_player_hp ?? 100);
    authBridge.state.level = Number(bootstrapData.config.starting_level ?? 3);
  }
  authBridge.init();
  hudSystem.init();

  // Hot-reload live database edits from Admin Studio over WebSocket
  eventBus.on('live:db_changed', async () => {
    const fresh = await fetchBootstrapCatalog();
    if (fresh.units && fresh.units.length > 0) {
      verifiedUnits.length = 0;
      verifiedUnits.push(...fresh.units);
      unitsCatalogMap.clear();
      for (const u of fresh.units) unitsCatalogMap.set(u.id, u);
      authBridge.featuredPool = fresh.units.filter(u => u.is_featured_pool);
      combatSystem.featuredUnits = authBridge.featuredPool;
      i18n.registerDatabaseCatalog(fresh.units);
    }
    if (Array.isArray(fresh.traits) && fresh.traits.length > 0) {
      syncTraitsFromDatabase(fresh.traits, i18n);
      synergySystem.recalculate();
    }
    if (Array.isArray(fresh.i18n)) {
      for (const row of fresh.i18n) {
        if (i18n.dictionaries[row.locale]) {
          i18n.dictionaries[row.locale][row.i18n_key] = row.text_value;
        }
      }
    }
    if (Array.isArray(fresh.arenaMeshes) && fresh.arenaMeshes.length > 0) {
      boardCoords.syncFromArenaMeshes(fresh.arenaMeshes);
      arenaSystem.syncMeshes(fresh.arenaMeshes);
      // Reposition units in prep mode to match updated 2.5D grid/bench coordinates
      if (authBridge.state.phase === 'prep') {
        for (const id of world.query(['GridCell', 'Transform'])) {
          const g = world.getComponent(id, 'GridCell');
          const t = world.getComponent(id, 'Transform');
          const pos = g.zone === 'bench'
            ? boardCoords.benchToWorld(g.slotIndex)
            : boardCoords.boardToWorld(g.col, g.row);
          t.x = pos.x;
          t.y = pos.y;
        }
      }
    }
    eventBus.emit('state:updated');
    eventBus.emit('ui:toast', {
      message: '⚡ Banco de dados e Malhas 2.5D atualizados ao vivo via Admin!',
      type: 'merge'
    });
  });

  const params = new URLSearchParams(window.location.search);
  const wsParam = params.get('ws') || window.DEFAULT_VPS_WS_URL;
  if (wsParam) {
    authBridge.connectRemoteServer(wsParam);
  } else if (
    window.location.hostname &&
    !window.location.hostname.includes('github.io') &&
    window.location.protocol.startsWith('http')
  ) {
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    authBridge.connectRemoteServer(`${proto}//${window.location.host}`);
  } else {
    // Default Azure VPS Authoritative Server (WSS with Let's Encrypt via sslip.io)
    authBridge.connectRemoteServer('wss://40-65-63-193.sslip.io');
  }

  // 6. Start ECS Main Loop
  app.ticker.add(() => {
    const dt = Math.min(0.1, app.ticker.deltaMS / 1000);
    world.update(dt);
  });

  window.__MERGEC_ECS__ = {
    world,
    eventBus,
    i18n,
    authBridge,
    combatSystem,
    verifiedUnitsCount: verifiedUnits.length
  };
}

bootstrapMergecCampus().catch(err => {
  console.error('[MergecCampus] Bootstrap error:', err);
});
