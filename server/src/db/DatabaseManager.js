/**
 * DatabaseManager.js
 * Modular PostgreSQL connection pool, non-destructive schema migration, and catalog seeder.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const { Pool } = pg;
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WEB_ROOT = path.resolve(__dirname, '../../../web');
const DB_JSON_PATH = path.resolve(WEB_ROOT, 'assets/data/verified_units_db.json');
const DEFAULT_MESHES_PATH = path.resolve(WEB_ROOT, 'assets/data/default_arena_meshes.json');

const DEFAULT_TRAITS = [
  { key: 'academy', type: 'origin', icon: '🎓', namePtBr: 'Academia Mágica', descPtBr: 'Concede +{bonus} de Mana inicial e +{ap}% de Poder de Habilidade.', thresholds: [2, 4, 6], bonuses: { 2: { bonus: 15, ap: 15 }, 4: { bonus: 30, ap: 35 }, 6: { bonus: 50, ap: 65 } } },
  { key: 'dragon', type: 'origin', icon: '🐲', namePtBr: 'Dracônico', descPtBr: 'Ataques queimam o alvo e concedem +{bonus}% de Dano Crítico.', thresholds: [2, 4, 6], bonuses: { 2: { bonus: 20 }, 4: { bonus: 45 }, 6: { bonus: 80 } } },
  { key: 'beast', type: 'origin', icon: '🐾', namePtBr: 'Fera Selvagem', descPtBr: 'Aumenta a Velocidade de Ataque da equipe em +{bonus}%.', thresholds: [2, 4, 6], bonuses: { 2: { bonus: 18 }, 4: { bonus: 38 }, 6: { bonus: 70 } } },
  { key: 'mech', type: 'origin', icon: '⚙️', namePtBr: 'Mecatrônico', descPtBr: 'Inicia o combate com escudo de +{bonus} HP e +{def} de Armadura.', thresholds: [2, 4, 6], bonuses: { 2: { bonus: 180, def: 20 }, 4: { bonus: 400, def: 45 }, 6: { bonus: 750, def: 80 } } },
  { key: 'spirit', type: 'origin', icon: '🔮', namePtBr: 'Espírito Elemental', descPtBr: 'Regenera +{bonus} de Mana adicional por ataque básico.', thresholds: [2, 4], bonuses: { 2: { bonus: 8 }, 4: { bonus: 18 } } },
  { key: 'nature', type: 'origin', icon: '🌿', namePtBr: 'Natureza Viva', descPtBr: 'Cura {bonus} de Vida a cada 2 segundos durante o combate.', thresholds: [2, 4], bonuses: { 2: { bonus: 65 }, 4: { bonus: 150 } } },
  { key: 'shadow', type: 'origin', icon: '🌑', namePtBr: 'Pacto das Sombras', descPtBr: 'Causa +{bonus}% de dano extra contra inimigos abaixo de 60% de HP.', thresholds: [2, 4], bonuses: { 2: { bonus: 22 }, 4: { bonus: 50 } } },
  { key: 'celestial', type: 'origin', icon: '☀️', namePtBr: 'Celestial', descPtBr: 'Concede {bonus}% de Vampirismo Mágico e Físico para o time.', thresholds: [2, 4], bonuses: { 2: { bonus: 15 }, 4: { bonus: 35 } } },
  { key: 'warrior', type: 'class', icon: '⚔️', namePtBr: 'Guerreiro', descPtBr: 'Guerreiros recebem +{bonus} de Armadura e +{atk} de Ataque Físico.', thresholds: [2, 4, 6], bonuses: { 2: { bonus: 20, atk: 15 }, 4: { bonus: 45, atk: 35 }, 6: { bonus: 80, atk: 65 } } },
  { key: 'mage', type: 'class', icon: '🪄', namePtBr: 'Arcanista', descPtBr: 'Habilidades causam +{bonus}% de Dano Mágico amplificado.', thresholds: [2, 4, 6], bonuses: { 2: { bonus: 25 }, 4: { bonus: 55 }, 6: { bonus: 95 } } },
  { key: 'ranger', type: 'class', icon: '🏹', namePtBr: 'Atirador', descPtBr: 'Ganha +1 de Alcance e +{bonus}% de Velocidade de Disparo.', thresholds: [2, 4], bonuses: { 2: { bonus: 20 }, 4: { bonus: 45 } } },
  { key: 'assassin', type: 'class', icon: '🗡️', namePtBr: 'Assassino', descPtBr: 'Foca a retaguarda e ganha +{bonus}% de Dano de Habilidade.', thresholds: [2, 4], bonuses: { 2: { bonus: 25 }, 4: { bonus: 60 } } },
  { key: 'guardian', type: 'class', icon: '🛡️', namePtBr: 'Bastião', descPtBr: 'Aumenta a Vida Máxima em +{bonus}% e reduz dano recebido.', thresholds: [2, 4], bonuses: { 2: { bonus: 20 }, 4: { bonus: 45 } } },
  { key: 'mystic', type: 'class', icon: '✨', namePtBr: 'Místico', descPtBr: 'Concede +{bonus} de Defesa Mágica e amplifica escudos/curas.', thresholds: [2, 4], bonuses: { 2: { bonus: 25 }, 4: { bonus: 60 } } }
];

const DEFAULT_VFX = [
  { id: '10001', name: 'Explosão Solar Arcana', duration: 0.055, scale: 1.15 },
  { id: '10002', name: 'Ruptura de Gelo Cristalino', duration: 0.055, scale: 1.15 },
  { id: '10003', name: 'Vórtice das Sombras', duration: 0.055, scale: 1.20 },
  { id: '10004', name: 'Chama Dracônica Primordial', duration: 0.055, scale: 1.25 },
  { id: '10005', name: 'Relâmpago Celestial', duration: 0.050, scale: 1.15 },
  { id: '10006', name: 'Impacto Sísmico Bastião', duration: 0.060, scale: 1.20 },
  { id: '10007', name: 'Lâmina de Vento Cortante', duration: 0.050, scale: 1.10 },
  { id: '10008', name: 'Supernova Estelar (Padrão)', duration: 0.055, scale: 1.20 },
  { id: '10009', name: 'Bênção da Natureza Viva', duration: 0.060, scale: 1.15 },
  { id: '10010', name: 'Disparo de Plasma Mecatrônico', duration: 0.050, scale: 1.15 },
  { id: '10011', name: 'Execução Carmesim', duration: 0.055, scale: 1.20 },
  { id: '10015', name: 'Ascensão Dourada Suprema', duration: 0.055, scale: 1.35 }
];

export class DatabaseManager {
  constructor() {
    this.pool = new Pool({
      connectionString:
        process.env.DATABASE_URL ||
        'postgres://mergec:mergec_secret_password@127.0.0.1:5432/mergec_campus'
    });
    this.verifiedUnitsJson = JSON.parse(fs.readFileSync(DB_JSON_PATH, 'utf-8'));
    this.defaultArenaMeshes = fs.existsSync(DEFAULT_MESHES_PATH)
      ? JSON.parse(fs.readFileSync(DEFAULT_MESHES_PATH, 'utf-8'))
      : [];
  }

  async init() {
    const schemaPath = path.resolve(__dirname, '../../db/schema.sql');
    const schemaSql = fs.readFileSync(schemaPath, 'utf-8');
    await this.pool.query(schemaSql);

    // Ensure non-destructive column upgrades on existing databases
    const alterStatements = [
      `ALTER TABLE traits_catalog ADD COLUMN IF NOT EXISTS icon VARCHAR(16) NOT NULL DEFAULT '✨'`,
      `ALTER TABLE traits_catalog ADD COLUMN IF NOT EXISTS bonuses_json TEXT NOT NULL DEFAULT '{"2":{"bonus":20},"4":{"bonus":45},"6":{"bonus":80}}'`,
      `ALTER TABLE units_catalog ADD COLUMN IF NOT EXISTS is_featured_pool BOOLEAN NOT NULL DEFAULT false`,
      `ALTER TABLE units_catalog ADD COLUMN IF NOT EXISTS start_mana INTEGER NOT NULL DEFAULT 20`,
      `ALTER TABLE units_catalog ADD COLUMN IF NOT EXISTS skill_damage INTEGER NOT NULL DEFAULT 250`,
      `ALTER TABLE units_catalog ADD COLUMN IF NOT EXISTS skill_shield INTEGER NOT NULL DEFAULT 150`,
      `ALTER TABLE units_catalog ADD COLUMN IF NOT EXISTS skill_heal INTEGER NOT NULL DEFAULT 150`,
      `ALTER TABLE units_catalog ADD COLUMN IF NOT EXISTS skill_icon VARCHAR(255) NOT NULL DEFAULT 'assets/skills/icons/skill_normal_000001.png'`,
      `ALTER TABLE units_catalog ADD COLUMN IF NOT EXISTS anchor_json VARCHAR(64) NOT NULL DEFAULT '[0.5, 0.9]'`,
      `ALTER TABLE units_catalog ADD COLUMN IF NOT EXISTS feet_y INTEGER NOT NULL DEFAULT 100`,
      `ALTER TABLE units_catalog DROP CONSTRAINT IF EXISTS units_catalog_directions_cnt_check`
    ];
    for (const stmt of alterStatements) {
      await this.pool.query(stmt).catch(() => {});
    }

    await this.seedTraits();
    await this.seedVfx();
    await this.seedUnits();
    await this.seedI18n();
    await this.seedArenaMeshes();
  }

  async seedArenaMeshes(forceOverwrite = false) {
    for (const m of this.defaultArenaMeshes) {
      await this.pool.query(
        `INSERT INTO arena_meshes (
          mesh_id, name_ptbr, mesh_type, enabled, color_hex, alpha, speed, intensity, blend_mode, points_json, params_json
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
        ON CONFLICT (mesh_id) DO ${forceOverwrite ? `UPDATE SET
          name_ptbr = EXCLUDED.name_ptbr,
          mesh_type = EXCLUDED.mesh_type,
          enabled = EXCLUDED.enabled,
          color_hex = EXCLUDED.color_hex,
          alpha = EXCLUDED.alpha,
          speed = EXCLUDED.speed,
          intensity = EXCLUDED.intensity,
          blend_mode = EXCLUDED.blend_mode,
          points_json = EXCLUDED.points_json,
          params_json = EXCLUDED.params_json` : 'NOTHING'}`,
        [
          m.mesh_id,
          m.name_ptbr,
          m.mesh_type,
          Boolean(m.enabled ?? true),
          m.color_hex || '#38bdf8',
          Number(m.alpha ?? 0.65),
          Number(m.speed ?? 1.0),
          Number(m.intensity ?? 1.0),
          m.blend_mode || 'screen',
          JSON.stringify(m.points || []),
          JSON.stringify(m.params || {})
        ]
      );
    }
  }

  async seedTraits() {
    for (const t of DEFAULT_TRAITS) {
      await this.pool.query(
        `INSERT INTO traits_catalog (trait_key, trait_type, icon, i18n_name_key, name_ptbr, i18n_desc_key, desc_ptbr, thresholds_json, bonuses_json)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         ON CONFLICT (trait_key) DO UPDATE SET
           icon = EXCLUDED.icon,
           name_ptbr = CASE WHEN traits_catalog.name_ptbr = UPPER(traits_catalog.trait_key) THEN EXCLUDED.name_ptbr ELSE traits_catalog.name_ptbr END,
           desc_ptbr = CASE WHEN traits_catalog.desc_ptbr = 'Bônus de sinergia {bonus}' THEN EXCLUDED.desc_ptbr ELSE traits_catalog.desc_ptbr END`,
        [
          t.key,
          t.type,
          t.icon,
          `trait.${t.type}.${t.key}.name`,
          t.namePtBr,
          `trait.${t.type}.${t.key}.desc`,
          t.descPtBr,
          JSON.stringify(t.thresholds),
          JSON.stringify(t.bonuses)
        ]
      );
    }
  }

  async seedVfx() {
    for (const v of DEFAULT_VFX) {
      await this.pool.query(
        `INSERT INTO vfx_catalog (vfx_id, name_ptbr, frame_duration, default_scale, blend_mode, atlas_path, thumb_path)
         VALUES ($1, $2, $3, $4, 'ADD', $5, $6)
         ON CONFLICT (vfx_id) DO NOTHING`,
        [
          v.id,
          v.name,
          v.duration,
          v.scale,
          `assets/effects/${v.id}/atlas.json`,
          `assets/effects/${v.id}/thumb.png`
        ]
      );
    }
  }

  async seedUnits() {
    for (const u of this.verifiedUnitsJson) {
      await this.pool.query(
        `INSERT INTO units_catalog (
          unit_id, unit_key, category, i18n_name_key, name_ptbr,
          i18n_skill_key, skill_desc_ptbr, origin_key, class_key,
          cost, is_featured_pool, base_hp, max_mana, start_mana,
          base_atk, base_def, atk_speed, attack_range,
          skill_damage, skill_shield, skill_heal, vfx_id, skill_icon,
          directions_cnt, actions_json, atlas_path, thumb_path, anchor_json, feet_y
        ) VALUES (
          $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,8,$24,$25,$26,$27,$28
        )
        ON CONFLICT (unit_id) DO UPDATE SET
          is_featured_pool = CASE WHEN units_catalog.skill_damage = 250 THEN EXCLUDED.is_featured_pool ELSE units_catalog.is_featured_pool END,
          skill_damage = CASE WHEN units_catalog.skill_damage = 250 THEN EXCLUDED.skill_damage ELSE units_catalog.skill_damage END,
          skill_shield = CASE WHEN units_catalog.skill_shield = 150 THEN EXCLUDED.skill_shield ELSE units_catalog.skill_shield END,
          skill_heal = CASE WHEN units_catalog.skill_heal = 150 THEN EXCLUDED.skill_heal ELSE units_catalog.skill_heal END,
          skill_icon = CASE WHEN units_catalog.skill_icon = 'assets/skills/icons/skill_normal_000001.png' THEN EXCLUDED.skill_icon ELSE units_catalog.skill_icon END`,
        [
          u.id, u.unit_key, u.category, u.i18n_name_key, u.name_ptbr,
          u.i18n_skill_key, u.skill_desc_ptbr, u.origin_key, u.class_key,
          u.cost, Boolean(u.is_featured_pool), u.stats.hp, u.stats.maxMana, u.stats.startMana || 20,
          u.stats.atk, u.stats.def, u.stats.atkSpeed, u.stats.range,
          u.stats.skillDamage || 250, u.stats.skillShield || 150, u.stats.skillHeal || 150,
          u.visual.vfx_id, u.visual.skill_icon,
          JSON.stringify(u.visual.actions), u.visual.atlas_path, u.visual.thumb_path,
          JSON.stringify(u.visual.anchor || [0.5, 0.9]), u.visual.feet_y || 100
        ]
      );
    }
  }

  async seedI18n() {
    const countRes = await this.pool.query('SELECT COUNT(*)::int AS cnt FROM i18n_translations');
    if (countRes.rows[0].cnt > 0) return;

    for (const u of this.verifiedUnitsJson.slice(0, 60)) {
      await this.pool.query(
        `INSERT INTO i18n_translations (i18n_key, locale, text_value, ptbr_reference)
         VALUES ($1, 'pt-BR', $2, $2) ON CONFLICT DO NOTHING`,
        [u.i18n_name_key, u.name_ptbr]
      );
      await this.pool.query(
        `INSERT INTO i18n_translations (i18n_key, locale, text_value, ptbr_reference)
         VALUES ($1, 'pt-BR', $2, $2) ON CONFLICT DO NOTHING`,
        [u.i18n_skill_key, u.skill_desc_ptbr]
      );
    }
  }

  async getGameConfig() {
    const { rows } = await this.pool.query('SELECT * FROM game_config WHERE config_id = 1');
    return rows[0];
  }

  async getAllUnitsFormatted() {
    const { rows } = await this.pool.query('SELECT * FROM units_catalog ORDER BY is_featured_pool DESC, cost ASC, unit_id ASC');
    return rows.map(r => ({
      id: r.unit_id,
      unit_key: r.unit_key,
      category: r.category,
      i18n_name_key: r.i18n_name_key,
      name_ptbr: r.name_ptbr,
      i18n_skill_key: r.i18n_skill_key,
      skill_desc_ptbr: r.skill_desc_ptbr,
      origin_key: r.origin_key,
      class_key: r.class_key,
      cost: Number(r.cost),
      is_featured_pool: Boolean(r.is_featured_pool),
      stats: {
        hp: Number(r.base_hp),
        maxMana: Number(r.max_mana),
        startMana: Number(r.start_mana),
        atk: Number(r.base_atk),
        def: Number(r.base_def),
        atkSpeed: Number(r.atk_speed),
        range: Number(r.attack_range),
        skillDamage: Number(r.skill_damage),
        skillShield: Number(r.skill_shield),
        skillHeal: Number(r.skill_heal)
      },
      visual: {
        atlas_path: r.atlas_path,
        thumb_path: r.thumb_path,
        vfx_id: r.vfx_id,
        skill_icon: r.skill_icon,
        anchor: JSON.parse(r.anchor_json || '[0.5,0.9]'),
        feet_y: Number(r.feet_y || 100),
        directions: Number(r.directions_cnt || 8),
        actions: JSON.parse(r.actions_json || '[0,1,2,3,7]')
      }
    }));
  }

  async getAllTraitsFormatted() {
    const { rows } = await this.pool.query('SELECT * FROM traits_catalog ORDER BY trait_type DESC, trait_key ASC');
    return rows.map(r => ({
      trait_key: r.trait_key,
      trait_type: r.trait_type,
      icon: r.icon,
      i18n_name_key: r.i18n_name_key,
      name_ptbr: r.name_ptbr,
      i18n_desc_key: r.i18n_desc_key,
      desc_ptbr: r.desc_ptbr,
      thresholds: JSON.parse(r.thresholds_json || '[2,4,6]'),
      bonuses: JSON.parse(r.bonuses_json || '{}')
    }));
  }

  async getAllVfx() {
    const { rows } = await this.pool.query('SELECT * FROM vfx_catalog ORDER BY vfx_id ASC');
    return rows.map(r => ({
      vfx_id: r.vfx_id,
      name_ptbr: r.name_ptbr,
      frame_duration: Number(r.frame_duration),
      default_scale: Number(r.default_scale),
      blend_mode: r.blend_mode,
      atlas_path: r.atlas_path,
      thumb_path: r.thumb_path
    }));
  }

  async getAllI18n() {
    const { rows } = await this.pool.query('SELECT * FROM i18n_translations ORDER BY i18n_key ASC, locale ASC LIMIT 500');
    return rows;
  }

  async getRecentMatches() {
    const { rows } = await this.pool.query('SELECT * FROM matches ORDER BY updated_at DESC LIMIT 50');
    return rows;
  }

  async getAllArenaMeshes() {
    const { rows } = await this.pool.query('SELECT * FROM arena_meshes ORDER BY mesh_id ASC');
    return rows.map(r => ({
      mesh_id: r.mesh_id,
      name_ptbr: r.name_ptbr,
      mesh_type: r.mesh_type,
      enabled: Boolean(r.enabled),
      color_hex: r.color_hex,
      alpha: Number(r.alpha),
      speed: Number(r.speed),
      intensity: Number(r.intensity),
      blend_mode: r.blend_mode,
      points: JSON.parse(r.points_json || '[]'),
      params: JSON.parse(r.params_json || '{}')
    }));
  }
}
