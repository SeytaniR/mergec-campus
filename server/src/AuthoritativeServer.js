/**
 * AuthoritativeServer.js
 * Lightweight ES6 Authoritative WebSocket Server for Mergec Campus.
 * Designed to run on a 1 vCPU / 1 GB RAM Free Tier VPS (Azure B1s / Oracle Always Free).
 */
import { WebSocketServer } from 'ws';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3001;

const dbPath = path.resolve(__dirname, '../../web/assets/data/verified_units_db.json');
const verifiedUnits = JSON.parse(fs.readFileSync(dbPath, 'utf-8'));
const featuredPool = verifiedUnits.filter(u => u.is_featured_pool);

const wss = new WebSocketServer({ port: PORT });

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
  const pool = featuredPool.filter(u => u.cost <= maxCost);
  const slots = [];
  for (let i = 0; i < 5; i++) {
    const pick = pool[Math.floor(Math.random() * pool.length)];
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

console.log(`[Mergec Campus Authoritative Server] Listening on ws://0.0.0.0:${PORT}`);
