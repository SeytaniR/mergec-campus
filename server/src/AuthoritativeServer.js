/**
 * AuthoritativeServer.js
 * Production ES6 Authoritative HTTP + WebSocket Server for Mergec Campus.
 * - Connects to PostgreSQL and seeds the 298 verified 8-direction units (PT-BR reference + i18n keys)
 * - Serves WebSocket authoritative state (/ws) and REST health/catalog endpoints (/api/health, /api/units)
 * - Serves the static web client on Port 80/3001
 */
import http from 'node:http';
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

// Optional PostgreSQL Pool
const pool = process.env.DATABASE_URL
  ? new Pool({ connectionString: process.env.DATABASE_URL })
  : null;

async function initDatabase() {
  if (!pool) return;
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
      console.log('[DB] Seed completed successfully!');
    }
  } catch (err) {
    console.warn('[DB] PostgreSQL initialization warning:', err.message);
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
    let dbCount = verifiedUnits.length;
    let dbStatus = 'memory_ready';
    if (pool) {
      try {
        const r = await pool.query('SELECT COUNT(*)::int AS cnt FROM units_catalog');
        dbCount = r.rows[0].cnt;
        dbStatus = 'postgres_connected';
      } catch (e) {
        dbStatus = 'postgres_error';
      }
    }
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({
      ok: true,
      service: 'mergec-campus-authoritative-vps',
      dbStatus,
      verified8DirUnitsInDb: dbCount,
      activeConnections: wss.clients.size,
      timestamp: new Date().toISOString()
    }));
    return;
  }

  // Serve static files from web/
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

wss.on('connection', (ws) => {
  const sessionState = {
    round: 1,
    phase: 'prep',
    gold: 16,
    level: 3,
    xp: 0,
    nextXp: 4,
    hp: 100,
    streak: 0,
    shopLocked: false,
    shopSlots: rollServerShop(3)
  };

  ws.send(JSON.stringify({ type: 'STATE_SYNC', state: sessionState }));

  ws.on('message', (raw) => {
    try {
      const cmd = JSON.parse(raw.toString());
      handleClientCommand(sessionState, cmd);
      ws.send(JSON.stringify({ type: 'STATE_SYNC', state: sessionState }));
    } catch (err) {
      ws.send(JSON.stringify({ type: 'ERROR', message: err.message }));
    }
  });
});

function rollServerShop(level) {
  const maxCost = Math.min(5, level);
  const poolUnits = featuredPool.filter(u => u.cost <= maxCost);
  const slots = [];
  for (let i = 0; i < 5; i++) {
    const pick = poolUnits[Math.floor(Math.random() * poolUnits.length)];
    slots.push({ unitDef: pick, purchased: false });
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
    default:
      break;
  }
}

initDatabase().then(() => {
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`[Mergec Campus Authoritative Server] Listening on http://0.0.0.0:${PORT}`);
  });
});
