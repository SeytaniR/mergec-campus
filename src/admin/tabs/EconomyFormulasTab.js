/**
 * EconomyFormulasTab.js
 * Modular Admin Tab for editing Economy, Match Rules, Damage Calculation Formulas,
 * Mana Generation, and Merge Star Multipliers in PostgreSQL (game_config).
 */
export class EconomyFormulasTab {
  constructor(api, onSaved, showToast) {
    this.api = api;
    this.onSaved = onSaved;
    this.showToast = showToast;
    this.config = {};
  }

  render(container, configData) {
    this.config = { ...(configData || {}) };
    container.innerHTML = `
      <div class="admin-grid-2col">
        <!-- Card 1: Economia & Progressão de Partida -->
        <section class="admin-card">
          <div class="card-header">
            <h3>💰 Economia & Regras de Partida (Tabela <code>game_config</code>)</h3>
            <p class="card-sub">Controle o ouro inicial, custos de loja/XP, juros compostos e recompensas por rodada.</p>
          </div>
          <div class="form-grid-2">
            <label class="field">
              <span>🪙 Ouro Inicial (starting_gold)</span>
              <input type="number" id="cfg-starting_gold" value="${this.config.starting_gold ?? 16}" min="0" max="999" />
            </label>
            <label class="field">
              <span>❤️ HP Inicial do Jogador (starting_player_hp)</span>
              <input type="number" id="cfg-starting_player_hp" value="${this.config.starting_player_hp ?? 100}" min="1" max="9999" />
            </label>
            <label class="field">
              <span>🎲 Custo de Reroll da Loja (reroll_cost)</span>
              <input type="number" id="cfg-reroll_cost" value="${this.config.reroll_cost ?? 2}" min="0" max="50" />
            </label>
            <label class="field">
              <span>⬆️ Custo de Compra de XP (xp_buy_cost)</span>
              <input type="number" id="cfg-xp_buy_cost" value="${this.config.xp_buy_cost ?? 4}" min="1" max="50" />
            </label>
            <label class="field">
              <span>✨ XP Ganho por Compra (xp_buy_amount)</span>
              <input type="number" id="cfg-xp_buy_amount" value="${this.config.xp_buy_amount ?? 4}" min="1" max="50" />
            </label>
            <label class="field">
              <span>🏆 Ouro Base por Vitória (round_win_gold)</span>
              <input type="number" id="cfg-round_win_gold" value="${this.config.round_win_gold ?? 5}" min="0" max="100" />
            </label>
            <label class="field">
              <span>🛡️ Ouro Base por Derrota (round_loss_gold)</span>
              <input type="number" id="cfg-round_loss_gold" value="${this.config.round_loss_gold ?? 4}" min="0" max="100" />
            </label>
            <label class="field">
              <span>📈 Juros a cada 10 de Ouro (interest_per_10_gold)</span>
              <input type="number" id="cfg-interest_per_10_gold" value="${this.config.interest_per_10_gold ?? 1}" min="0" max="20" />
            </label>
            <label class="field">
              <span>🏦 Teto Máximo de Juros (max_interest_gold)</span>
              <input type="number" id="cfg-max_interest_gold" value="${this.config.max_interest_gold ?? 5}" min="0" max="50" />
            </label>
            <label class="field">
              <span>🔥 Rodadas p/ Bônus de Sequência (streak_threshold)</span>
              <input type="number" id="cfg-streak_threshold" value="${this.config.streak_threshold ?? 3}" min="1" max="20" />
            </label>
            <label class="field">
              <span>💰 Ouro Extra de Sequência (streak_bonus_gold)</span>
              <input type="number" id="cfg-streak_bonus_gold" value="${this.config.streak_bonus_gold ?? 2}" min="0" max="50" />
            </label>
            <label class="field">
              <span>🎖️ Nível Inicial / Nível Máximo</span>
              <div class="inline-pair">
                <input type="number" id="cfg-starting_level" value="${this.config.starting_level ?? 3}" min="1" max="15" title="Nível Inicial" />
                <input type="number" id="cfg-max_level" value="${this.config.max_level ?? 9}" min="1" max="20" title="Nível Máximo" />
              </div>
            </label>
          </div>
        </section>

        <!-- Card 2: Fórmulas de Dano, Mana & Merge -->
        <section class="admin-card">
          <div class="card-header">
            <h3>⚔️ Cálculos de Dano, Mana & Fórmulas de Merge</h3>
            <p class="card-sub">Altere a matemática de combate e os multiplicadores de estrelas ★★ e ★★★ em tempo real.</p>
          </div>
          <div class="form-grid-2">
            <label class="field">
              <span>⭐⭐ Multiplicador Merge 2-Estrelas (star2_multiplier)</span>
              <input type="number" step="0.05" id="cfg-star2_multiplier" value="${this.config.star2_multiplier ?? 1.8}" />
            </label>
            <label class="field">
              <span>⭐⭐⭐ Multiplicador Merge 3-Estrelas (star3_multiplier)</span>
              <input type="number" step="0.05" id="cfg-star3_multiplier" value="${this.config.star3_multiplier ?? 3.24}" />
            </label>
            <label class="field">
              <span>🛡️ Escala de DEF por Estrela (star_def_scale)</span>
              <input type="number" step="0.05" id="cfg-star_def_scale" value="${this.config.star_def_scale ?? 0.35}" />
            </label>
            <label class="field">
              <span>💧 Mana Ganha por Ataque (mana_per_attack)</span>
              <input type="number" id="cfg-mana_per_attack" value="${this.config.mana_per_attack ?? 15}" />
            </label>
            <label class="field">
              <span>💥 Mana ao Receber Dano (mana_on_hit_taken)</span>
              <input type="number" id="cfg-mana_on_hit_taken" value="${this.config.mana_on_hit_taken ?? 6}" />
            </label>
            <label class="field">
              <span>📐 Constante K de Mitigação de Armadura (armor_mitigation_k)</span>
              <input type="number" id="cfg-armor_mitigation_k" value="${this.config.armor_mitigation_k ?? 100}" />
            </label>
            <label class="field">
              <span>🔮 Fator de Armadura vs Habilidade (skill_armor_pen_factor)</span>
              <input type="number" step="0.05" id="cfg-skill_armor_pen_factor" value="${this.config.skill_armor_pen_factor ?? 0.6}" />
            </label>
            <label class="field">
              <span>🗡️ Dano Básico Mínimo Garantido (min_basic_damage)</span>
              <input type="number" id="cfg-min_basic_damage" value="${this.config.min_basic_damage ?? 12}" />
            </label>
            <label class="field">
              <span>✨ Dano de Skill Mínimo Garantido (min_skill_damage)</span>
              <input type="number" id="cfg-min_skill_damage" value="${this.config.min_skill_damage ?? 35}" />
            </label>
            <label class="field">
              <span>🛡️ Conversão de Escudo/Cura de Skill (skill_shield_ratio)</span>
              <input type="number" step="0.05" id="cfg-skill_shield_ratio" value="${this.config.skill_shield_ratio ?? 0.4}" />
            </label>
            <label class="field">
              <span>🌿 Intervalo de Cura Sinergia Natureza (s)</span>
              <input type="number" step="0.1" id="cfg-nature_heal_interval_sec" value="${this.config.nature_heal_interval_sec ?? 2.0}" />
            </label>
          </div>
        </section>
      </div>

      <!-- Simulador Ao Vivo de Fórmulas -->
      <section class="admin-card sim-card">
        <div class="card-header">
          <div>
            <h3>🧮 Simulador Matemático em Tempo Real (Preview de Balanceamento)</h3>
            <p class="card-sub">Veja imediatamente como suas fórmulas afetam um personagem exemplo (Base: 700 HP, 70 ATK, 35 DEF, 260 Skill Dmg contra Alvo com 50 DEF).</p>
          </div>
          <button id="btn-save-economy-config" class="btn-primary">💾 Salvar Economia & Fórmulas no PostgreSQL</button>
        </div>
        <div id="formula-sim-output" class="sim-metrics-row"></div>
      </section>
    `;

    const inputs = container.querySelectorAll('input');
    inputs.forEach(inp => {
      inp.addEventListener('input', () => this.updateSimulator(container));
    });

    const saveBtn = container.querySelector('#btn-save-economy-config');
    if (saveBtn) {
      saveBtn.addEventListener('click', () => this.handleSave(container));
    }

    this.updateSimulator(container);
  }

  collectFormValues(container) {
    const getNum = (id, fallback) => {
      const el = container.querySelector(`#cfg-${id}`);
      if (!el) return fallback;
      const v = Number(el.value);
      return Number.isFinite(v) ? v : fallback;
    };

    return {
      starting_gold: getNum('starting_gold', 16),
      starting_player_hp: getNum('starting_player_hp', 100),
      reroll_cost: getNum('reroll_cost', 2),
      xp_buy_cost: getNum('xp_buy_cost', 4),
      xp_buy_amount: getNum('xp_buy_amount', 4),
      round_win_gold: getNum('round_win_gold', 5),
      round_loss_gold: getNum('round_loss_gold', 4),
      interest_per_10_gold: getNum('interest_per_10_gold', 1),
      max_interest_gold: getNum('max_interest_gold', 5),
      streak_threshold: getNum('streak_threshold', 3),
      streak_bonus_gold: getNum('streak_bonus_gold', 2),
      starting_level: getNum('starting_level', 3),
      max_level: getNum('max_level', 9),
      star2_multiplier: getNum('star2_multiplier', 1.8),
      star3_multiplier: getNum('star3_multiplier', 3.24),
      star_def_scale: getNum('star_def_scale', 0.35),
      mana_per_attack: getNum('mana_per_attack', 15),
      mana_on_hit_taken: getNum('mana_on_hit_taken', 6),
      armor_mitigation_k: getNum('armor_mitigation_k', 100),
      skill_armor_pen_factor: getNum('skill_armor_pen_factor', 0.6),
      min_basic_damage: getNum('min_basic_damage', 12),
      min_skill_damage: getNum('min_skill_damage', 35),
      skill_shield_ratio: getNum('skill_shield_ratio', 0.4),
      nature_heal_interval_sec: getNum('nature_heal_interval_sec', 2.0)
    };
  }

  updateSimulator(container) {
    const v = this.collectFormValues(container);
    const out = container.querySelector('#formula-sim-output');
    if (!out) return;

    const baseHp = 700;
    const baseAtk = 70;
    const baseSkill = 260;
    const targetDef = 50;

    const hp2 = Math.round(baseHp * v.star2_multiplier);
    const hp3 = Math.round(baseHp * v.star3_multiplier);
    const atk3 = Math.round(baseAtk * v.star3_multiplier);

    const basicDmg1 = Math.max(
      v.min_basic_damage,
      Math.round(baseAtk * (v.armor_mitigation_k / (v.armor_mitigation_k + targetDef)))
    );
    const skillDmg1 = Math.max(
      v.min_skill_damage,
      Math.round(baseSkill * (v.armor_mitigation_k / (v.armor_mitigation_k + targetDef * v.skill_armor_pen_factor)))
    );
    const attacksToCast = Math.ceil((80 - 20) / Math.max(1, v.mana_per_attack));

    out.innerHTML = `
      <div class="sim-pill">
        <span>⭐1 → ⭐⭐2 → ⭐⭐⭐3 HP</span>
        <b>${baseHp} → ${hp2} → ${hp3} HP</b>
      </div>
      <div class="sim-pill">
        <span>⚔️ ATK em ⭐⭐⭐3</span>
        <b>${baseAtk} → ${atk3} ATK</b>
      </div>
      <div class="sim-pill">
        <span>🗡️ Dano Básico vs 50 DEF</span>
        <b>${basicDmg1} dano <code>ATK * (${v.armor_mitigation_k}/(${v.armor_mitigation_k}+DEF))</code></b>
      </div>
      <div class="sim-pill">
        <span>💥 Dano Ultimate vs 50 DEF</span>
        <b>${skillDmg1} dano <code>PenFator=${v.skill_armor_pen_factor}</code></b>
      </div>
      <div class="sim-pill">
        <span>💧 Ataques p/ Conjurar Ultimate</span>
        <b>${attacksToCast} ataques (+${v.mana_per_attack} mana/hit)</b>
      </div>
    `;
  }

  async handleSave(container) {
    try {
      const payload = this.collectFormValues(container);
      const res = await this.api.saveConfig(payload);
      this.showToast('✅ Economia e Fórmulas de Dano salvas no PostgreSQL e sincronizadas ao vivo!', 'success');
      if (this.onSaved) this.onSaved(res.config);
    } catch (err) {
      this.showToast(`❌ Erro ao salvar configuração: ${err.message}`, 'error');
    }
  }
}
