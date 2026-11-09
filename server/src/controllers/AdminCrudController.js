/**
 * AdminCrudController.js
 * Modular REST CRUD Controller for Mergec Campus Admin Studio.
 * Zero God Objects: Handles HTTP request parsing, SQL CRUD operations, and triggers live WS broadcast.
 */
export class AdminCrudController {
  constructor(db, onLiveConfigChanged) {
    this.db = db;
    this.onLiveConfigChanged = onLiveConfigChanged;
  }

  async handleRequest(req, res, pathname) {
    try {
      // 1. GET /api/admin/bootstrap -> Full snapshot of all game tables
      if (req.method === 'GET' && pathname === '/api/admin/bootstrap') {
        const [config, units, traits, vfx, i18n, matches] = await Promise.all([
          this.db.getGameConfig(),
          this.db.getAllUnitsFormatted(),
          this.db.getAllTraitsFormatted(),
          this.db.getAllVfx(),
          this.db.getAllI18n(),
          this.db.getRecentMatches()
        ]);
        return this.sendJson(res, 200, { ok: true, config, units, traits, vfx, i18n, matches });
      }

      // 2. PUT /api/admin/config -> Update Economy & Damage/Merge Calculation Formulas
      if (req.method === 'PUT' && pathname === '/api/admin/config') {
        const body = await this.readJsonBody(req);
        await this.db.pool.query(
          `UPDATE game_config SET
            starting_gold = $1,
            reroll_cost = $2,
            xp_buy_cost = $3,
            xp_buy_amount = $4,
            round_win_gold = $5,
            round_loss_gold = $6,
            interest_per_10_gold = $7,
            max_interest_gold = $8,
            streak_threshold = $9,
            streak_bonus_gold = $10,
            starting_player_hp = $11,
            starting_level = $12,
            max_level = $13,
            star2_multiplier = $14,
            star3_multiplier = $15,
            star_def_scale = $16,
            mana_per_attack = $17,
            mana_on_hit_taken = $18,
            armor_mitigation_k = $19,
            skill_armor_pen_factor = $20,
            min_basic_damage = $21,
            min_skill_damage = $22,
            skill_shield_ratio = $23,
            nature_heal_interval_sec = $24,
            updated_at = CURRENT_TIMESTAMP
           WHERE config_id = 1`,
          [
            Number(body.starting_gold ?? 16),
            Number(body.reroll_cost ?? 2),
            Number(body.xp_buy_cost ?? 4),
            Number(body.xp_buy_amount ?? 4),
            Number(body.round_win_gold ?? 5),
            Number(body.round_loss_gold ?? 4),
            Number(body.interest_per_10_gold ?? 1),
            Number(body.max_interest_gold ?? 5),
            Number(body.streak_threshold ?? 3),
            Number(body.streak_bonus_gold ?? 2),
            Number(body.starting_player_hp ?? 100),
            Number(body.starting_level ?? 3),
            Number(body.max_level ?? 9),
            Number(body.star2_multiplier ?? 1.8),
            Number(body.star3_multiplier ?? 3.24),
            Number(body.star_def_scale ?? 0.35),
            Number(body.mana_per_attack ?? 15),
            Number(body.mana_on_hit_taken ?? 6),
            Number(body.armor_mitigation_k ?? 100),
            Number(body.skill_armor_pen_factor ?? 0.6),
            Number(body.min_basic_damage ?? 12),
            Number(body.min_skill_damage ?? 35),
            Number(body.skill_shield_ratio ?? 0.4),
            Number(body.nature_heal_interval_sec ?? 2.0)
          ]
        );
        const updatedConfig = await this.db.getGameConfig();
        await this.onLiveConfigChanged();
        return this.sendJson(res, 200, { ok: true, config: updatedConfig });
      }

      // 3. POST /api/admin/units or PUT /api/admin/units/:id -> Create or Update Unit & Skill
      if ((req.method === 'POST' && pathname === '/api/admin/units') ||
          (req.method === 'PUT' && pathname.startsWith('/api/admin/units/'))) {
        const body = await this.readJsonBody(req);
        const unitId = pathname.startsWith('/api/admin/units/')
          ? decodeURIComponent(pathname.replace('/api/admin/units/', ''))
          : body.id;

        await this.db.pool.query(
          `INSERT INTO units_catalog (
            unit_id, unit_key, category, i18n_name_key, name_ptbr,
            i18n_skill_key, skill_desc_ptbr, origin_key, class_key,
            cost, is_featured_pool, base_hp, max_mana, start_mana,
            base_atk, base_def, atk_speed, attack_range,
            skill_damage, skill_shield, skill_heal, vfx_id, skill_icon,
            directions_cnt, actions_json, atlas_path, thumb_path
          ) VALUES (
            $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,8,$24,$25,$26
          )
          ON CONFLICT (unit_id) DO UPDATE SET
            name_ptbr = EXCLUDED.name_ptbr,
            i18n_name_key = EXCLUDED.i18n_name_key,
            skill_desc_ptbr = EXCLUDED.skill_desc_ptbr,
            i18n_skill_key = EXCLUDED.i18n_skill_key,
            origin_key = EXCLUDED.origin_key,
            class_key = EXCLUDED.class_key,
            cost = EXCLUDED.cost,
            is_featured_pool = EXCLUDED.is_featured_pool,
            base_hp = EXCLUDED.base_hp,
            max_mana = EXCLUDED.max_mana,
            start_mana = EXCLUDED.start_mana,
            base_atk = EXCLUDED.base_atk,
            base_def = EXCLUDED.base_def,
            atk_speed = EXCLUDED.atk_speed,
            attack_range = EXCLUDED.attack_range,
            skill_damage = EXCLUDED.skill_damage,
            skill_shield = EXCLUDED.skill_shield,
            skill_heal = EXCLUDED.skill_heal,
            vfx_id = EXCLUDED.vfx_id,
            skill_icon = EXCLUDED.skill_icon`,
          [
            unitId,
            body.unit_key || unitId.toLowerCase(),
            body.category || 'characters',
            body.i18n_name_key || `unit.${unitId.toLowerCase()}.name`,
            body.name_ptbr,
            body.i18n_skill_key || `unit.${unitId.toLowerCase()}.skill_desc`,
            body.skill_desc_ptbr,
            body.origin_key || 'academy',
            body.class_key || 'warrior',
            Number(body.cost ?? 1),
            Boolean(body.is_featured_pool),
            Number(body.stats?.hp ?? body.base_hp ?? 600),
            Number(body.stats?.maxMana ?? body.max_mana ?? 80),
            Number(body.stats?.startMana ?? body.start_mana ?? 20),
            Number(body.stats?.atk ?? body.base_atk ?? 50),
            Number(body.stats?.def ?? body.base_def ?? 25),
            Number(body.stats?.atkSpeed ?? body.atk_speed ?? 0.8),
            Number(body.stats?.range ?? body.attack_range ?? 1),
            Number(body.stats?.skillDamage ?? body.skill_damage ?? 240),
            Number(body.stats?.skillShield ?? body.skill_shield ?? 140),
            Number(body.stats?.skillHeal ?? body.skill_heal ?? 140),
            body.visual?.vfx_id || body.vfx_id || '10008',
            body.visual?.skill_icon || body.skill_icon || 'assets/skills/icons/skill_normal_000001.png',
            JSON.stringify(body.visual?.actions || [0, 1, 2, 3, 7]),
            body.visual?.atlas_path || `assets/characters/${unitId}/atlas.json`,
            body.visual?.thumb_path || `assets/characters/${unitId}/thumb.webp`
          ]
        );
        await this.onLiveConfigChanged();
        return this.sendJson(res, 200, { ok: true, unitId });
      }

      // 4. DELETE /api/admin/units/:id -> Delete unit
      if (req.method === 'DELETE' && pathname.startsWith('/api/admin/units/')) {
        const unitId = decodeURIComponent(pathname.replace('/api/admin/units/', ''));
        await this.db.pool.query('DELETE FROM units_catalog WHERE unit_id = $1', [unitId]);
        await this.onLiveConfigChanged();
        return this.sendJson(res, 200, { ok: true, deleted: unitId });
      }

      // 5. POST or PUT /api/admin/traits -> Create or Update Synergy Trait
      if ((req.method === 'POST' || req.method === 'PUT') && pathname.startsWith('/api/admin/traits')) {
        const body = await this.readJsonBody(req);
        const traitKey = body.trait_key;
        await this.db.pool.query(
          `INSERT INTO traits_catalog (trait_key, trait_type, icon, i18n_name_key, name_ptbr, i18n_desc_key, desc_ptbr, thresholds_json, bonuses_json)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
           ON CONFLICT (trait_key) DO UPDATE SET
             trait_type = EXCLUDED.trait_type,
             icon = EXCLUDED.icon,
             name_ptbr = EXCLUDED.name_ptbr,
             desc_ptbr = EXCLUDED.desc_ptbr,
             thresholds_json = EXCLUDED.thresholds_json,
             bonuses_json = EXCLUDED.bonuses_json`,
          [
            traitKey,
            body.trait_type || 'origin',
            body.icon || '✨',
            body.i18n_name_key || `trait.${body.trait_type || 'origin'}.${traitKey}.name`,
            body.name_ptbr,
            body.i18n_desc_key || `trait.${body.trait_type || 'origin'}.${traitKey}.desc`,
            body.desc_ptbr,
            typeof body.thresholds === 'string' ? body.thresholds : JSON.stringify(body.thresholds || [2, 4, 6]),
            typeof body.bonuses === 'string' ? body.bonuses : JSON.stringify(body.bonuses || {})
          ]
        );
        await this.onLiveConfigChanged();
        return this.sendJson(res, 200, { ok: true, traitKey });
      }

      // 6. DELETE /api/admin/traits/:key
      if (req.method === 'DELETE' && pathname.startsWith('/api/admin/traits/')) {
        const key = decodeURIComponent(pathname.replace('/api/admin/traits/', ''));
        await this.db.pool.query('DELETE FROM traits_catalog WHERE trait_key = $1', [key]);
        await this.onLiveConfigChanged();
        return this.sendJson(res, 200, { ok: true, deleted: key });
      }

      // 7. PUT /api/admin/vfx/:id -> Update VFX parameters
      if (req.method === 'PUT' && pathname.startsWith('/api/admin/vfx/')) {
        const vfxId = decodeURIComponent(pathname.replace('/api/admin/vfx/', ''));
        const body = await this.readJsonBody(req);
        await this.db.pool.query(
          `UPDATE vfx_catalog SET
            name_ptbr = $1,
            frame_duration = $2,
            default_scale = $3,
            blend_mode = $4
           WHERE vfx_id = $5`,
          [
            body.name_ptbr,
            Number(body.frame_duration ?? 0.055),
            Number(body.default_scale ?? 1.15),
            body.blend_mode || 'ADD',
            vfxId
          ]
        );
        await this.onLiveConfigChanged();
        return this.sendJson(res, 200, { ok: true, vfxId });
      }

      // 8. PUT /api/admin/i18n -> Upsert i18n key translation
      if (req.method === 'PUT' && pathname === '/api/admin/i18n') {
        const body = await this.readJsonBody(req);
        await this.db.pool.query(
          `INSERT INTO i18n_translations (i18n_key, locale, text_value, ptbr_reference)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (i18n_key, locale) DO UPDATE SET
             text_value = EXCLUDED.text_value,
             ptbr_reference = EXCLUDED.ptbr_reference`,
          [body.i18n_key, body.locale || 'pt-BR', body.text_value, body.ptbr_reference || '']
        );
        await this.onLiveConfigChanged();
        return this.sendJson(res, 200, { ok: true });
      }

      // 9. DELETE /api/admin/matches/:id -> Delete match record
      if (req.method === 'DELETE' && pathname.startsWith('/api/admin/matches/')) {
        const matchId = decodeURIComponent(pathname.replace('/api/admin/matches/', ''));
        if (matchId === 'ALL') {
          await this.db.pool.query('DELETE FROM matches');
        } else {
          await this.db.pool.query('DELETE FROM matches WHERE match_id = $1', [matchId]);
        }
        return this.sendJson(res, 200, { ok: true, deleted: matchId });
      }

      return this.sendJson(res, 404, { ok: false, error: 'Admin endpoint not found' });
    } catch (err) {
      console.error('[AdminCrudController] Error:', err);
      return this.sendJson(res, 500, { ok: false, error: err.message });
    }
  }

  readJsonBody(req) {
    return new Promise((resolve, reject) => {
      let data = '';
      req.on('data', chunk => {
        data += chunk;
      });
      req.on('end', () => {
        try {
          resolve(data ? JSON.parse(data) : {});
        } catch (err) {
          reject(err);
        }
      });
      req.on('error', reject);
    });
  }

  sendJson(res, status, payload) {
    res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(payload));
  }
}
