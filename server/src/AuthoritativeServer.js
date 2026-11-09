/**
 * AuthoritativeServer.js
 * Modular ES6 Authoritative HTTP + WebSocket Server for Mergec Campus.
 * Zero God Objects: Delegates DB operations to DatabaseManager and CRUD routes to AdminCrudController.
 */
import http from 'node:http';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';
import { DatabaseManager } from './db/DatabaseManager.js';
import { AdminCrudController } from './controllers/AdminCrudController.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 3001);
const WEB_ROOT = path.resolve(__dirname, '../../web');

const db = new DatabaseManager();
let liveConfig = null;
let liveUnits = [];
let liveFeaturedPool = [];

async function refreshLiveCacheAndBroadcast() {
  liveConfig = await db.getGameConfig();
  liveUnits = await db.getAllUnitsFormatted();
  liveFeaturedPool = liveUnits.filter(u => u.is_featured_pool);
  if (liveFeaturedPool.length === 0) liveFeaturedPool = liveUnits.slice(0, 25);

  const traits = await db.getAllTraitsFormatted();
  const vfx = await db.getAllVfx();

  const packet = JSON.stringify({
    type: 'LIVE_CONFIG_UPDATED',
    config: liveConfig,
    units: liveUnits,
    traits,
    vfx
  });

  for (const client of wss.clients) {
    if (client.readyState === 1) {
      client.send(packet);
    }
  }
}

const adminController = new AdminCrudController(db, refreshLiveCacheAndBroadcast);

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon'
};

const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const urlObj = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = urlObj.pathname;

  // 1. Admin CRUD API endpoints
  if (pathname.startsWith('/api/admin/')) {
    return adminController.handleRequest(req, res, pathname);
  }

  // 2. Public Health Endpoint
  if (pathname === '/api/health') {
    const matches = await db.getRecentMatches();
    const traits = await db.getAllTraitsFormatted();
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({
      ok: true,
      service: 'mergec-campus-azure-vps',
      region: 'Azure West US (Standard B2pts_v2 ARM64)',
      publicIp: '40.65.63.193',
      adminUrl: 'https://40-65-63-193.sslip.io/admin',
      dbStatus: 'connected',
      postgresCatalog: {
        verified8DirUnits: liveUnits.length,
        traits: traits.length,
        persistedMatches: matches.length
      },
      activeWsClients: wss.clients.size,
      timestamp: new Date().toISOString()
    }, null, 2));
    return;
  }

  // 3. Route /admin or /admin/ to web/admin.html
  let safePath = path.normalize(pathname).replace(/^(\.\.[/\\])+/, '');
  if (safePath === '/' || safePath === '\\') safePath = '/index.html';
  if (safePath === '/admin' || safePath === '\\admin' || safePath === '/admin/') {
    safePath = '/admin.html';
  }

  const filePath = path.join(WEB_ROOT, safePath);
  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] || 'application/octet-stream' });
    fs.createReadStream(filePath).pipe(res);
  } else {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('404 Not Found');
  }
});

const wss = new WebSocketServer({ server });

wss.on('connection', async (ws) => {
  const matchId = 'match_' + crypto.randomUUID().slice(0, 8);
  const playerId = 'player_' + crypto.randomUUID().slice(0, 6);
  const cfg = liveConfig || { starting_gold: 16, starting_level: 3, starting_player_hp: 100 };

  const sessionState = {
    matchId,
    round: 1,
    phase: 'prep',
    gold: Number(cfg.starting_gold || 16),
    level: Number(cfg.starting_level || 3),
    xp: 0,
    nextXp: 4,
    hp: Number(cfg.starting_player_hp || 100),
    streak: 0,
    shopLocked: false,
    shopSlots: rollServerShop(Number(cfg.starting_level || 3), true)
  };

  await persistMatch(matchId, playerId, sessionState);
  ws.send(JSON.stringify({
    type: 'STATE_SYNC',
    state: sessionState,
    config: liveConfig,
    serverInfo: 'Azure VPS 40.65.63.193 (PostgreSQL)'
  }));

  ws.on('message', async (raw) => {
    try {
      const cmd = JSON.parse(raw.toString());
      handleClientCommand(sessionState, cmd);
      await persistMatch(matchId, playerId, sessionState);
      ws.send(JSON.stringify({
        type: 'STATE_SYNC',
        state: sessionState,
        config: liveConfig,
        serverInfo: 'Azure VPS 40.65.63.193 (PostgreSQL)'
      }));
    } catch (err) {
      ws.send(JSON.stringify({ type: 'ERROR', message: err.message }));
    }
  });
});

function rollServerShop(level, isStarter = false) {
  const maxCost = Math.min(5, level);
  const poolUnits = liveFeaturedPool.filter(u => u.cost <= maxCost);
  const activePool = poolUnits.length > 0 ? poolUnits : liveFeaturedPool;
  const slots = [];
  for (let i = 0; i < 5; i++) {
    const pick = activePool[Math.floor(Math.random() * activePool.length)];
    slots.push({ unitDef: pick, purchased: false });
  }
  if (isStarter && activePool.length >= 2) {
    slots[0] = { unitDef: activePool[0], purchased: false };
    slots[1] = { unitDef: activePool[1], purchased: false };
  }
  return slots;
}

function handleClientCommand(state, cmd) {
  const rerollCost = Number(liveConfig?.reroll_cost ?? 2);
  const xpCost = Number(liveConfig?.xp_buy_cost ?? 4);
  const xpGain = Number(liveConfig?.xp_buy_amount ?? 4);
  const maxLv = Number(liveConfig?.max_level ?? 9);

  switch (cmd.type) {
    case 'CMD_REROLL':
      if (state.gold >= rerollCost) {
        state.gold -= rerollCost;
        state.shopSlots = rollServerShop(state.level);
      }
      break;
    case 'CMD_BUY_XP':
      if (state.gold >= xpCost && state.level < maxLv) {
        state.gold -= xpCost;
        state.xp += xpGain;
        while (state.xp >= state.nextXp && state.level < maxLv) {
          state.xp -= state.nextXp;
          state.level++;
          state.nextXp = Math.round(state.nextXp * 1.5 + 2);
        }
      }
      break;
    case 'CMD_SYNC_STATE':
      if (typeof cmd.gold === 'number') state.gold = cmd.gold;
      if (typeof cmd.round === 'number') state.round = cmd.round;
      if (typeof cmd.level === 'number') state.level = cmd.level;
      if (typeof cmd.xp === 'number') state.xp = cmd.xp;
      if (typeof cmd.hp === 'number') state.hp = cmd.hp;
      if (typeof cmd.streak === 'number') state.streak = cmd.streak;
      break;
    default:
      break;
  }
}

async function persistMatch(matchId, playerId, state) {
  try {
    await db.pool.query(
      `INSERT INTO matches (match_id, player_id, round_num, phase, gold, player_level, xp, hp, streak, shop_json, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, CURRENT_TIMESTAMP)
       ON CONFLICT (match_id) DO UPDATE SET
         round_num = EXCLUDED.round_num,
         phase = EXCLUDED.phase,
         gold = EXCLUDED.gold,
         player_level = EXCLUDED.player_level,
         xp = EXCLUDED.xp,
         hp = EXCLUDED.hp,
         streak = EXCLUDED.streak,
         shop_json = EXCLUDED.shop_json,
         updated_at = CURRENT_TIMESTAMP`,
      [
        matchId,
        playerId,
        state.round,
        state.phase,
        state.gold,
        state.level,
        state.xp,
        state.hp,
        state.streak,
        JSON.stringify(state.shopSlots.map(s => ({ id: s.unitDef?.id, purchased: s.purchased })))
      ]
    );
  } catch (err) {
    console.warn('[DB] Match persist warning:', err.message);
  }
}

db.init()
  .then(() => refreshLiveCacheAndBroadcast())
  .then(() => {
    server.listen(PORT, '0.0.0.0', () => {
      console.log(`[Mergec Campus Authoritative Server] Listening on http://0.0.0.0:${PORT}`);
    });
  });
