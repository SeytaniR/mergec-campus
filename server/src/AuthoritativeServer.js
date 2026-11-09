/**
 * AuthoritativeServer.js
 * Production ES6 Authoritative HTTP + WebSocket Server for Mergec Campus on Azure VPS.
 * - Connects to PostgreSQL (mergec_campus) and seeds the 298 verified 8-direction units
 *   with PT-BR reference names and i18n keys
 * - Persists live player matches into PostgreSQL table `matches`
 * - Serves WebSocket authoritative state and REST endpoints (/api/health, /api/matches)
 */
import http from 'node:http';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';
import pg from 'pg';

const { Pool } = pg;
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 3001);
const WEB_ROOT = path.resolve(__dirname, '../../web');
const DB_JSON_PATH = path.resolve(WEB_ROOT, 'assets/data/verified_units_db.json');

const verifiedUnits = JSON.parse(fs.readFileSync(DB_JSON_PATH, 'utf-8'));
const featuredPool = verifiedUnits.filter(u => u.is_featured_pool);

const pool = new Pool({
  connectionString:
    process.env.DATABASE_URL ||
    'postgres://mergec:mergec_secret_password@127.0.0.1:5432/mergec_campus'
});

async function initDatabase() {
  try {
    const schemaPath = path.resolve(__dirname, '../db/schema.sql');
    const schemaSql = fs.readFileSync(schemaPath, 'utf-8');
    await pool.query(schemaSql);

    const { rows } = await pool.query('SELECT COUNT(*)::int AS cnt FROM units_catalog');
    if (rows[0].cnt === 0) {
      console.log(`[DB] Seeding ${verifiedUnits.length} verified 8-direction units with PT-BR references...`);
      const traitsInserted = new Set();
      for (const u of verifiedUnits) {
        for (const [tKey, tType] of [[u.origin_key, 'origin'], [u.class_key, 'class']]) {
          if (!traitsInserted.has(tKey)) {
            traitsInserted.add(tKey);
            await pool.query(
              `INSERT INTO traits_catalog (trait_key, trait_type, i18n_name_key, name_ptbr, i18n_desc_key, desc_ptbr)
               VALUES ($1, $2, $3, $4, $5, $6)
               ON CONFLICT (trait_key) DO NOTHING`,
              [tKey, tType, `trait.${tType}.${tKey}.name`, tKey.toUpperCase(), `trait.${tType}.${tKey}.desc`, 'Bônus de sinergia {bonus}']
            );
          }
        }

        await pool.query(
          `INSERT INTO units_catalog (
            unit_id, unit_key, category, i18n_name_key, name_ptbr,
            i18n_skill_key, skill_desc_ptbr, origin_key, class_key,
            cost, base_hp, max_mana, base_atk, base_def, atk_speed, attack_range,
            vfx_id, directions_cnt, actions_json, atlas_path, thumb_path
          ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,8,$18,$19,$20)
          ON CONFLICT (unit_id) DO NOTHING`,
          [
            u.id, u.unit_key, u.category, u.i18n_name_key, u.name_ptbr,
            u.i18n_skill_key, u.skill_desc_ptbr, u.origin_key, u.class_key,
            u.cost, u.stats.hp, u.stats.maxMana, u.stats.atk, u.stats.def,
            u.stats.atkSpeed, u.stats.range, u.visual.vfx_id,
            JSON.stringify(u.visual.actions), u.visual.atlas_path, u.visual.thumb_path
          ]
        );
      }
      console.log('[DB] Seed of 298 verified 8-direction units completed!');
    }
  } catch (err) {
    console.error('[DB] PostgreSQL initialization error:', err.message);
  }
}

async function persistMatch(matchId, playerId, state) {
  try {
    await pool.query(
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
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const urlObj = new URL(req.url, `http://${req.headers.host || 'localhost'}`);

  if (urlObj.pathname === '/api/health') {
    let dbUnitsCount = 0;
    let dbMatchesCount = 0;
    let dbTraitsCount = 0;
    let dbStatus = 'connected';
    try {
      const r1 = await pool.query('SELECT COUNT(*)::int AS cnt FROM units_catalog');
      const r2 = await pool.query('SELECT COUNT(*)::int AS cnt FROM matches');
      const r3 = await pool.query('SELECT COUNT(*)::int AS cnt FROM traits_catalog');
      dbUnitsCount = r1.rows[0].cnt;
      dbMatchesCount = r2.rows[0].cnt;
      dbTraitsCount = r3.rows[0].cnt;
    } catch (e) {
      dbStatus = 'error: ' + e.message;
    }

    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({
      ok: true,
      service: 'mergec-campus-azure-vps',
      region: 'Azure West US (Standard B2pts_v2 ARM64)',
      publicIp: '40.65.63.193',
      dbStatus,
      postgresCatalog: {
        verified8DirUnits: dbUnitsCount,
        traits: dbTraitsCount,
        persistedMatches: dbMatchesCount
      },
      activeWsClients: wss.clients.size,
      timestamp: new Date().toISOString()
    }, null, 2));
    return;
  }

  let safePath = path.normalize(urlObj.pathname).replace(/^(\.\.[/\\])+/, '');
  if (safePath === '/' || safePath === '\\') safePath = '/index.html';
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

  const sessionState = {
    matchId,
    round: 1,
    phase: 'prep',
    gold: 16,
    level: 3,
    xp: 0,
    nextXp: 4,
    hp: 100,
    streak: 0,
    shopLocked: false,
    shopSlots: rollServerShop(3, true)
  };

  await persistMatch(matchId, playerId, sessionState);
  ws.send(JSON.stringify({
    type: 'STATE_SYNC',
    state: sessionState,
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
        serverInfo: 'Azure VPS 40.65.63.193 (PostgreSQL)'
      }));
    } catch (err) {
      ws.send(JSON.stringify({ type: 'ERROR', message: err.message }));
    }
  });
});

function rollServerShop(level, isStarter = false) {
  const maxCost = Math.min(5, level);
  const poolUnits = featuredPool.filter(u => u.cost <= maxCost);
  const slots = [];
  for (let i = 0; i < 5; i++) {
    const pick = poolUnits[Math.floor(Math.random() * poolUnits.length)];
    slots.push({ unitDef: pick, purchased: false });
  }
  if (isStarter && featuredPool.length >= 2) {
    slots[0] = { unitDef: featuredPool[0], purchased: false };
    slots[1] = { unitDef: featuredPool[1], purchased: false };
  }
  return slots;
}

function handleClientCommand(state, cmd) {
  switch (cmd.type) {
    case 'CMD_REROLL':
      if (state.gold >= 2) {
        state.gold -= 2;
        state.shopSlots = rollServerShop(state.level);
      }
      break;
    case 'CMD_BUY_XP':
      if (state.gold >= 4 && state.level < 9) {
        state.gold -= 4;
        state.xp += 4;
        while (state.xp >= state.nextXp && state.level < 9) {
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

initDatabase().then(() => {
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`[Mergec Campus Authoritative Server] Listening on http://0.0.0.0:${PORT}`);
  });
});
