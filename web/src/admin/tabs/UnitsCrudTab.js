/**
 * UnitsCrudTab.js
 * Modular Admin CRUD Tab for Character, Pet, and NPC Balancing, Skills, and VFX assignment
 * in PostgreSQL (units_catalog).
 */
export class UnitsCrudTab {
  constructor(api, onChanged, showToast) {
    this.api = api;
    this.onChanged = onChanged;
    this.showToast = showToast;
    this.units = [];
    this.traits = [];
    this.vfxList = [];
    this.searchQuery = '';
    this.categoryFilter = 'all';
    this.selectedUnit = null;
  }

  render(container, { units, traits, vfx }) {
    this.units = Array.isArray(units) ? units : [];
    this.traits = Array.isArray(traits) ? traits : [];
    this.vfxList = Array.isArray(vfx) ? vfx : [];
    if (!this.selectedUnit && this.units.length > 0) {
      this.selectedUnit = this.units[0];
    }

    container.innerHTML = `
      <div class="admin-master-detail">
        <!-- Coluna Esquerda: Lista & Filtros dos 298 Modelos 8-Dir -->
        <aside class="admin-list-panel">
          <div class="list-toolbar">
            <div class="toolbar-row">
              <input type="search" id="unit-crud-search" placeholder="Buscar por nome PT-BR, chave i18n ou ID..." value="${this.searchQuery}" />
              <button id="btn-new-unit" class="btn-secondary" title="Criar nova unidade">+ Novo</button>
            </div>
            <div class="filter-pills">
              <button class="pill-btn ${this.categoryFilter === 'all' ? 'active' : ''}" data-ucat="all">Todos (${this.units.length})</button>
              <button class="pill-btn ${this.categoryFilter === 'featured' ? 'active' : ''}" data-ucat="featured">⭐ Loja (${this.units.filter(u => u.is_featured_pool).length})</button>
              <button class="pill-btn ${this.categoryFilter === 'characters' ? 'active' : ''}" data-ucat="characters">Heróis</button>
              <button class="pill-btn ${this.categoryFilter === 'monsters' ? 'active' : ''}" data-ucat="monsters">Pets/Monstros</button>
              <button class="pill-btn ${this.categoryFilter === 'npcs' ? 'active' : ''}" data-ucat="npcs">NPCs</button>
            </div>
          </div>
          <div id="unit-crud-table-list" class="unit-scroll-list"></div>
        </aside>

        <!-- Coluna Direita: Formulário Completo de Balanceamento de Personagem & Skill -->
        <section id="unit-crud-editor" class="admin-detail-panel"></section>
      </div>
    `;

    const searchEl = container.querySelector('#unit-crud-search');
    if (searchEl) {
      searchEl.addEventListener('input', (e) => {
        this.searchQuery = e.target.value.trim().toLowerCase();
        this.renderUnitList(container);
      });
    }

    container.querySelectorAll('[data-ucat]').forEach(btn => {
      btn.addEventListener('click', () => {
        this.categoryFilter = btn.getAttribute('data-ucat');
        container.querySelectorAll('[data-ucat]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.renderUnitList(container);
      });
    });

    const newBtn = container.querySelector('#btn-new-unit');
    if (newBtn) {
      newBtn.addEventListener('click', () => {
        const template = this.units[0] || {};
        this.selectedUnit = {
          id: `custom_${Date.now().toString().slice(-4)}`,
          unit_key: `unit_custom_${Date.now().toString().slice(-4)}`,
          category: 'characters',
          model_id: '011001001',
          i18n_name_key: 'unit.custom.new.name',
          name_ptbr: 'Novo Campeão Customizado',
          i18n_skill_key: 'unit.custom.new.skill',
          skill_desc_ptbr: 'Desfere um golpe arcano causando {damage} de dano mágico e recebendo {shield} de escudo.',
          origin_key: 'academy',
          class_key: 'mage',
          cost: 3,
          is_featured_pool: true,
          stats: {
            hp: 750,
            maxMana: 80,
            startMana: 20,
            atk: 68,
            def: 35,
            atkSpeed: 0.8,
            range: 3,
            skillDamage: 280,
            skillShield: 160,
            skillHeal: 120
          },
          visual: template.visual ? { ...template.visual } : {
            sheet_path: 'assets/sprites/characters/011001001/sheet.webp',
            atlas_path: 'assets/sprites/characters/011001001/atlas.json',
            thumb_path: 'assets/sprites/characters/011001001/thumb.png',
            directions: 8,
            actions: [0, 1, 2, 3, 4, 5, 6, 7],
            skill_icon: 'assets/icons/skills/s_1001.png',
            vfx_id: '10008'
          }
        };
        this.renderEditor(container);
      });
    }

    this.renderUnitList(container);
    this.renderEditor(container);
  }

  renderUnitList(container) {
    const listEl = container.querySelector('#unit-crud-table-list');
    if (!listEl) return;

    const filtered = this.units.filter(u => {
      if (this.categoryFilter === 'featured' && !u.is_featured_pool) return false;
      if (this.categoryFilter !== 'all' && this.categoryFilter !== 'featured' && u.category !== this.categoryFilter) {
        return false;
      }
      if (!this.searchQuery) return true;
      return (
        (u.name_ptbr || '').toLowerCase().includes(this.searchQuery) ||
        (u.i18n_name_key || '').toLowerCase().includes(this.searchQuery) ||
        (u.id || '').toLowerCase().includes(this.searchQuery)
      );
    });

    listEl.innerHTML = filtered.slice(0, 120).map(u => {
      const isSelected = this.selectedUnit && this.selectedUnit.id === u.id;
      return `
        <div class="unit-list-row ${isSelected ? 'selected' : ''}" data-select-unit="${u.id}">
          <img src="${u.visual?.thumb_path || ''}" class="unit-row-thumb" alt="${u.name_ptbr}" loading="lazy" />
          <div class="unit-row-info">
            <div class="unit-row-title">
              <b>${u.name_ptbr}</b>
              <span class="cost-badge tier-${u.cost}">${u.cost}🪙</span>
            </div>
            <div class="unit-row-sub">
              <code>${u.id}</code> • ${u.origin_key} / ${u.class_key}
              ${u.is_featured_pool ? '<span class="featured-tag">⭐ Loja</span>' : ''}
            </div>
          </div>
        </div>
      `;
    }).join('');

    listEl.querySelectorAll('[data-select-unit]').forEach(row => {
      row.addEventListener('click', () => {
        const id = row.getAttribute('data-select-unit');
        const found = this.units.find(x => x.id === id);
        if (found) {
          this.selectedUnit = JSON.parse(JSON.stringify(found));
          this.renderUnitList(container);
          this.renderEditor(container);
        }
      });
    });
  }

  renderEditor(container) {
    const editorEl = container.querySelector('#unit-crud-editor');
    if (!editorEl) return;
    if (!this.selectedUnit) {
      editorEl.innerHTML = `<div class="empty-state">Selecione um personagem à esquerda para editar atributos, habilidades e efeitos especiais.</div>`;
      return;
    }

    const u = this.selectedUnit;
    const s = u.stats || {};
    const vis = u.visual || {};

    const origins = this.traits.filter(t => t.trait_type === 'origin');
    const classes = this.traits.filter(t => t.trait_type === 'class');

    const originOptions = (origins.length > 0 ? origins : [
      { trait_key: 'academy', name_ptbr: 'Academia Mágica' },
      { trait_key: 'dragon', name_ptbr: 'Dracônico' },
      { trait_key: 'beast', name_ptbr: 'Fera Selvagem' },
      { trait_key: 'mech', name_ptbr: 'Mecatrônico' },
      { trait_key: 'spirit', name_ptbr: 'Espírito Elemental' },
      { trait_key: 'nature', name_ptbr: 'Natureza Viva' },
      { trait_key: 'shadow', name_ptbr: 'Pacto das Sombras' },
      { trait_key: 'celestial', name_ptbr: 'Celestial' }
    ]).map(o => `<option value="${o.trait_key}" ${u.origin_key === o.trait_key ? 'selected' : ''}>${o.icon || ''} ${o.name_ptbr} (${o.trait_key})</option>`).join('');

    const classOptions = (classes.length > 0 ? classes : [
      { trait_key: 'warrior', name_ptbr: 'Guerreiro' },
      { trait_key: 'mage', name_ptbr: 'Arcanista' },
      { trait_key: 'ranger', name_ptbr: 'Atirador' },
      { trait_key: 'assassin', name_ptbr: 'Assassino' },
      { trait_key: 'guardian', name_ptbr: 'Bastião' },
      { trait_key: 'mystic', name_ptbr: 'Místico' }
    ]).map(c => `<option value="${c.trait_key}" ${u.class_key === c.trait_key ? 'selected' : ''}>${c.icon || ''} ${c.name_ptbr} (${c.trait_key})</option>`).join('');

    const vfxOptions = (this.vfxList.length > 0 ? this.vfxList : [
      { vfx_id: '10008', name_ptbr: 'Explosão Arcana Solar' },
      { vfx_id: '10010', name_ptbr: 'Impacto Astral' },
      { vfx_id: '10012', name_ptbr: 'Chama Dracônica' },
      { vfx_id: '10014', name_ptbr: 'Tormenta de Gelo' },
      { vfx_id: '10016', name_ptbr: 'Raio Celestial' },
      { vfx_id: '10018', name_ptbr: 'Vórtice das Sombras' }
    ]).map(v => `<option value="${v.vfx_id}" ${(vis.vfx_id || '10008') === v.vfx_id ? 'selected' : ''}>✨ ${v.vfx_id} — ${v.name_ptbr}</option>`).join('');

    editorEl.innerHTML = `
      <div class="editor-head">
        <div class="editor-unit-banner">
          <img src="${vis.thumb_path || ''}" class="editor-thumb-lg" alt="${u.name_ptbr}" />
          <div>
            <h3>${u.name_ptbr} <span class="badge-id">ID: ${u.id}</span></h3>
            <p class="card-sub">🔑 Chave Nome: <code>${u.i18n_name_key}</code> • 🔑 Chave Skill: <code>${u.i18n_skill_key}</code></p>
          </div>
        </div>
        <div class="editor-actions">
          <button id="btn-delete-unit" class="btn-danger">🗑️ Excluir</button>
          <button id="btn-save-unit" class="btn-primary">💾 Salvar Personagem no PostgreSQL</button>
        </div>
      </div>

      <div class="admin-grid-2col">
        <!-- Identidade, Custos, Sinergias e i18n PT-BR -->
        <div class="admin-subcard">
          <h4>🪪 Identidade, Sinergias & Referência PT-BR (i18n)</h4>
          <div class="form-grid-2">
            <label class="field">
              <span>ID Único (id)</span>
              <input type="text" id="u-id" value="${u.id}" />
            </label>
            <label class="field">
              <span>Categoria 8-Dir</span>
              <select id="u-category">
                <option value="characters" ${u.category === 'characters' ? 'selected' : ''}>Heróis (characters)</option>
                <option value="monsters" ${u.category === 'monsters' ? 'selected' : ''}>Pets & Monstros (monsters)</option>
                <option value="npcs" ${u.category === 'npcs' ? 'selected' : ''}>NPCs (npcs)</option>
              </select>
            </label>
            <label class="field">
              <span>🇧🇷 Nome em PT-BR (name_ptbr)</span>
              <input type="text" id="u-name_ptbr" value="${u.name_ptbr || ''}" />
            </label>
            <label class="field">
              <span>🔑 Chave i18n Nome (i18n_name_key)</span>
              <input type="text" id="u-i18n_name_key" value="${u.i18n_name_key || ''}" />
            </label>
            <label class="field">
              <span> Origem (origin_key)</span>
              <select id="u-origin_key">${originOptions}</select>
            </label>
            <label class="field">
              <span>⚔️ Classe (class_key)</span>
              <select id="u-class_key">${classOptions}</select>
            </label>
            <label class="field">
              <span>🪙 Custo na Loja (Tier 1 a 5)</span>
              <input type="number" id="u-cost" value="${u.cost ?? 1}" min="1" max="5" />
            </label>
            <label class="field checkbox-field">
              <input type="checkbox" id="u-is_featured_pool" ${u.is_featured_pool ? 'checked' : ''} />
              <span>⭐ Ativo na Loja & Waves (is_featured_pool)</span>
            </label>
          </div>
        </div>

        <!-- Atributos Base de Combate -->
        <div class="admin-subcard">
          <h4>📊 Atributos Base de Combate (Nível ★1)</h4>
          <div class="form-grid-2">
            <label class="field">
              <span>❤️ Vida Base (hp)</span>
              <input type="number" id="u-hp" value="${s.hp ?? 600}" min="50" max="20000" />
            </label>
            <label class="field">
              <span>⚔️ Ataque Físico Base (atk)</span>
              <input type="number" id="u-atk" value="${s.atk ?? 55}" min="5" max="2000" />
            </label>
            <label class="field">
              <span>🛡️ Defesa / Armadura (def)</span>
              <input type="number" id="u-def" value="${s.def ?? 30}" min="0" max="1000" />
            </label>
            <label class="field">
              <span>⚡ Velocidade de Ataque (atkSpeed)</span>
              <input type="number" step="0.05" id="u-atkSpeed" value="${s.atkSpeed ?? 0.75}" min="0.2" max="5.0" />
            </label>
            <label class="field">
              <span>🎯 Alcance em Células (range)</span>
              <input type="number" id="u-range" value="${s.range ?? 1}" min="1" max="8" />
            </label>
            <label class="field">
              <span>💧 Mana Inicial / Mana Máxima</span>
              <div class="inline-pair">
                <input type="number" id="u-startMana" value="${s.startMana ?? 20}" min="0" max="200" title="Mana Inicial" />
                <input type="number" id="u-maxMana" value="${s.maxMana ?? 80}" min="10" max="300" title="Mana Máxima" />
              </div>
            </label>
          </div>
        </div>
      </div>

      <!-- Habilidade Suprema (Ultimate Skill) & Efeitos Especiais (VFX) -->
      <div class="admin-subcard skill-subcard">
        <h4>💥 Balanceamento de Habilidade Suprema (Ultimate) & Efeito Especial (VFX)</h4>
        <div class="form-grid-3">
          <label class="field">
            <span>💥 Dano Base da Skill ({damage})</span>
            <input type="number" id="u-skillDamage" value="${s.skillDamage ?? 220}" min="0" max="9999" />
          </label>
          <label class="field">
            <span>🛡️ Escudo da Skill ({shield})</span>
            <input type="number" id="u-skillShield" value="${s.skillShield ?? 140}" min="0" max="9999" />
          </label>
          <label class="field">
            <span>💚 Cura da Skill ({heal})</span>
            <input type="number" id="u-skillHeal" value="${s.skillHeal ?? 150}" min="0" max="9999" />
          </label>
          <label class="field">
            <span>✨ Efeito Visual Especial (vfx_id)</span>
            <select id="u-vfx_id">${vfxOptions}</select>
          </label>
          <label class="field">
            <span>🖼️ Ícone da Habilidade (skill_icon)</span>
            <input type="text" id="u-skill_icon" value="${vis.skill_icon || 'assets/icons/skills/s_1001.png'}" />
          </label>
          <label class="field">
            <span>🔑 Chave i18n da Skill (i18n_skill_key)</span>
            <input type="text" id="u-i18n_skill_key" value="${u.i18n_skill_key || ''}" />
          </label>
        </div>

        <label class="field full-width">
          <span>🇧🇷 Descrição PT-BR da Habilidade com Variáveis Dinâmicas (use <code>{damage}</code>, <code>{shield}</code>, <code>{heal}</code>)</span>
          <textarea id="u-skill_desc_ptbr" rows="2">${u.skill_desc_ptbr || ''}</textarea>
        </label>

        <div id="unit-skill-live-preview" class="skill-preview-banner"></div>
      </div>
    `;

    editorEl.querySelectorAll('input, select, textarea').forEach(el => {
      el.addEventListener('input', () => this.updateSkillPreview(editorEl));
    });

    const saveBtn = editorEl.querySelector('#btn-save-unit');
    if (saveBtn) {
      saveBtn.addEventListener('click', () => this.handleSaveUnit(container, editorEl));
    }

    const delBtn = editorEl.querySelector('#btn-delete-unit');
    if (delBtn) {
      delBtn.addEventListener('click', () => this.handleDeleteUnit(container));
    }

    this.updateSkillPreview(editorEl);
  }

  collectEditorUnit(editorEl) {
    const val = (id) => editorEl.querySelector(`#${id}`)?.value ?? '';
    const num = (id, def) => {
      const n = Number(val(id));
      return Number.isFinite(n) ? n : def;
    };

    const current = this.selectedUnit || {};
    const curVis = current.visual || {};

    return {
      ...current,
      id: val('u-id').trim(),
      unit_key: current.unit_key || `unit_${val('u-id').trim()}`,
      category: val('u-category'),
      model_id: current.model_id || '011001001',
      i18n_name_key: val('u-i18n_name_key').trim(),
      name_ptbr: val('u-name_ptbr').trim(),
      i18n_skill_key: val('u-i18n_skill_key').trim(),
      skill_desc_ptbr: val('u-skill_desc_ptbr').trim(),
      origin_key: val('u-origin_key'),
      class_key: val('u-class_key'),
      cost: num('u-cost', 1),
      is_featured_pool: Boolean(editorEl.querySelector('#u-is_featured_pool')?.checked),
      stats: {
        hp: num('u-hp', 600),
        maxMana: num('u-maxMana', 80),
        startMana: num('u-startMana', 20),
        atk: num('u-atk', 55),
        def: num('u-def', 30),
        atkSpeed: num('u-atkSpeed', 0.75),
        range: num('u-range', 1),
        skillDamage: num('u-skillDamage', 220),
        skillShield: num('u-skillShield', 140),
        skillHeal: num('u-skillHeal', 150)
      },
      visual: {
        ...curVis,
        skill_icon: val('u-skill_icon').trim(),
        vfx_id: val('u-vfx_id')
      }
    };
  }

  updateSkillPreview(editorEl) {
    const u = this.collectEditorUnit(editorEl);
    const previewEl = editorEl.querySelector('#unit-skill-live-preview');
    if (!previewEl) return;

    const interpolated = (u.skill_desc_ptbr || '')
      .replaceAll('{damage}', `<b>${u.stats.skillDamage}</b>`)
      .replaceAll('{shield}', `<b>${u.stats.skillShield}</b>`)
      .replaceAll('{heal}', `<b>${u.stats.skillHeal}</b>`);

    previewEl.innerHTML = `
      <img src="${u.visual.skill_icon}" class="skill-prev-icon" alt="Skill Icon" />
      <div>
        <div><b>Preview Renderizado no Jogo (★1 / ★★2 / ★★★3):</b> ${interpolated}</div>
        <div class="skill-prev-stars">
          ★1: ❤️ ${u.stats.hp} HP | ⚔️ ${u.stats.atk} ATK | 💥 ${u.stats.skillDamage} Skill
          &nbsp;•&nbsp;
          ★★2: ❤️ ${Math.round(u.stats.hp * 1.8)} HP | ⚔️ ${Math.round(u.stats.atk * 1.8)} ATK | 💥 ${Math.round(u.stats.skillDamage * 1.8)} Skill
          &nbsp;•&nbsp;
          ★★★3: ❤️ ${Math.round(u.stats.hp * 3.24)} HP | ⚔️ ${Math.round(u.stats.atk * 3.24)} ATK | 💥 ${Math.round(u.stats.skillDamage * 3.24)} Skill
        </div>
      </div>
    `;
  }

  async handleSaveUnit(container, editorEl) {
    try {
      const payload = this.collectEditorUnit(editorEl);
      const res = await this.api.saveUnit(payload);
      const saved = res.unit;
      const idx = this.units.findIndex(x => x.id === saved.id);
      if (idx >= 0) {
        this.units[idx] = saved;
      } else {
        this.units.unshift(saved);
      }
      this.selectedUnit = saved;
      this.renderUnitList(container);
      this.showToast(`✅ Personagem "${saved.name_ptbr}" salvo no PostgreSQL!`, 'success');
      if (this.onChanged) this.onChanged();
    } catch (err) {
      this.showToast(`❌ Erro ao salvar personagem: ${err.message}`, 'error');
    }
  }

  async handleDeleteUnit(container) {
    if (!this.selectedUnit) return;
    const id = this.selectedUnit.id;
    try {
      await this.api.deleteUnit(id);
      this.units = this.units.filter(x => x.id !== id);
      this.selectedUnit = this.units[0] || null;
      this.renderUnitList(container);
      this.renderEditor(container);
      this.showToast(`🗑️ Unidade "${id}" removida do PostgreSQL.`, 'info');
      if (this.onChanged) this.onChanged();
    } catch (err) {
      this.showToast(`❌ Erro ao excluir: ${err.message}`, 'error');
    }
  }
}
