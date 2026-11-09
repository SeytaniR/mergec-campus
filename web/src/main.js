/**
 * main.js
 * Clean ES6 Module Bootstrapper for Mergec Campus (Pixi.js v7.3.2).
 * Zero God Objects: Instantiates the ECS World, registers single-responsibility Systems,
 * and starts the Pixi.js ticker.
 */
import { EventBus } from './ecs/EventBus.js';
import { World } from './ecs/World.js';
import { I18nService } from './i18n/I18nService.js';
import { AssetCacheSystem } from './systems/AssetCacheSystem.js';
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

async function bootstrapMergecCampus() {
  const eventBus = new EventBus();
  const i18n = new I18nService(eventBus, 'pt-BR');
  const world = new World(eventBus);

  // 1. Load Verified 8-Direction Units Database (with i18n keys + PT-BR reference names)
  const dbRes = await fetch('assets/data/verified_units_db.json');
  const verifiedUnits = await dbRes.json();
  i18n.registerDatabaseCatalog(verifiedUnits);

  const unitsCatalogMap = new Map(verifiedUnits.map(u => [u.id, u]));
  const featuredUnits = verifiedUnits.filter(u => u.is_featured_pool);

  // 2. Initialize Pixi.js Application inside fluid container
  const canvasWrap = document.getElementById('pixi-canvas-wrap');
  const app = new PIXI.Application({
    width: 920,
    height: 720,
    backgroundColor: 0x070b14,
    antialias: true,
    resolution: Math.min(window.devicePixelRatio || 1, 2),
    autoDensity: true
  });
  canvasWrap.appendChild(app.view);

  const sceneContainer = new PIXI.Container();
  const boardLayer = new PIXI.Container();
  const unitLayer = new PIXI.Container();
  const vfxLayer = new PIXI.Container();
  sceneContainer.addChild(boardLayer, unitLayer, vfxLayer);
  app.stage.addChild(sceneContainer);

  // 3. Instantiate Single-Responsibility ECS Systems
  const assetCache = new AssetCacheSystem();
  const boardCoords = new BoardCoordSystem(boardLayer);
  const authBridge = new AuthoritativeBridge(world, boardCoords, eventBus, i18n, verifiedUnits);

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
  world.registerSystem('BoardCoords', boardCoords, 10);
  world.registerSystem('Merge', mergeSystem, 20);
  world.registerSystem('Synergy', synergySystem, 30);
  world.registerSystem('DragDrop', dragDropSystem, 40);
  world.registerSystem('Combat', combatSystem, 50);
  world.registerSystem('Animation', animSystem, 60);
  world.registerSystem('UnitRender', renderSystem, 70);
  world.registerSystem('Layout', layoutSystem, 80);

  // 5. Initialize Authoritative State & UI HUD
  authBridge.init();
  hudSystem.init();

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
