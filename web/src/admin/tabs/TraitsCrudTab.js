/**
 * TraitsCrudTab.js
 * Modular Admin CRUD Tab for Origins & Classes Synergies (traits_catalog).
 */
export class TraitsCrudTab {
  constructor(api, onChanged, showToast) {
    this.api = api;
    this.onChanged = onChanged;
    this.showToast = showToast;
    this.traits = [];
    this.selectedTrait = null;
  }

  render(container, traits) {
    this.traits = Array.isArray(traits) ? traits : [];
    if (!this.selectedTrait && this.traits.length > 0) {
      this.selectedTrait = this.traits[0];
    }

    container.innerHTML = `
      <div class="admin-master-detail">
        <aside class="admin-list-panel">
          <div class="list-toolbar">
            <div class="toolbar-row">
              <strong>✨ Origens & Classes (${this.traits.length})</strong>
              <button id="btn-new-trait" class="btn-secondary">+ Nova Sinergia</button>
            </div>
          </div>
          <div id="traits-crud-list" class="unit-scroll-list"></div>
        </aside>

        <section id="traits-crud-editor" class="admin-detail-panel"></section>
      </div>
    `;

    const newBtn = container.querySelector('#btn-new-trait');
    if (newBtn) {
      newBtn.addEventListener('click', () => {
        this.selectedTrait = {
          trait_key: `custom_trait_${Date.now().toString().slice(-3)}`,
          trait_type: 'origin',
          icon: '🌟',
          i18n_name_key: 'trait.origin.custom.name',
          name_ptbr: 'Nova Origem Mística',
          i18n_desc_key: 'trait.origin.custom.desc',
          desc_ptbr: 'Concede +{bonus} de poder adicional aos aliados.',
          thresholds: [2, 4, 6],
          bonuses: { '2': { bonus: 20 }, '4': { bonus: 45 }, '6': { bonus: 80 } }
        };
        this.renderEditor(container);
      });
    }

    this.renderList(container);
    this.renderEditor(container);
  }

  renderList(container) {
    const listEl = container.querySelector('#traits-crud-list');
    if (!listEl) return;

    listEl.innerHTML = this.traits.map(t => {
      const sel = this.selectedTrait && this.selectedTrait.trait_key === t.trait_key;
      return `
        <div class="unit-list-row ${sel ? 'selected' : ''}" data-select-trait="${t.trait_key}">
          <span class="trait-emoji-lg">${t.icon || '✨'}</span>
          <div class="unit-row-info">
            <div class="unit-row-title">
              <b>${t.name_ptbr}</b>
              <span class="cost-badge">${t.trait_type === 'origin' ? 'Origem' : 'Classe'}</span>
            </div>
            <div class="unit-row-sub">
              <code>${t.trait_key}</code> • Degraus: [${(t.thresholds || []).join(' / ')}]
            </div>
          </div>
        </div>
      `;
    }).join('');

    listEl.querySelectorAll('[data-select-trait]').forEach(row => {
      row.addEventListener('click', () => {
        const key = row.getAttribute('data-select-trait');
        const found = this.traits.find(x => x.trait_key === key);
        if (found) {
          this.selectedTrait = JSON.parse(JSON.stringify(found));
          this.renderList(container);
          this.renderEditor(container);
        }
      });
    });
  }

  renderEditor(container) {
    const ed = container.querySelector('#traits-crud-editor');
    if (!ed || !this.selectedTrait) return;
    const t = this.selectedTrait;

    ed.innerHTML = `
      <div class="editor-head">
        <div>
          <h3>${t.icon || '✨'} ${t.name_ptbr} <span class="badge-id">${t.trait_key}</span></h3>
          <p class="card-sub">Edite os degraus de ativação (ex: 2/4/6) e os multiplicadores de bônus de sinergia.</p>
        </div>
        <div class="editor-actions">
          <button id="btn-delete-trait" class="btn-danger">🗑️ Excluir</button>
          <button id="btn-save-trait" class="btn-primary">💾 Salvar Sinergia no PostgreSQL</button>
        </div>
      </div>

      <div class="admin-subcard">
        <div class="form-grid-2">
          <label class="field">
            <span>Identificador da Sinergia (trait_key)</span>
            <input type="text" id="tr-key" value="${t.trait_key}" />
          </label>
          <label class="field">
            <span>Tipo (trait_type)</span>
            <select id="tr-type">
              <option value="origin" ${t.trait_type === 'origin' ? 'selected' : ''}>Origem (origin)</option>
              <option value="class" ${t.trait_type === 'class' ? 'selected' : ''}>Classe (class)</option>
            </select>
          </label>
          <label class="field">
            <span>Ícone / Emoji (icon)</span>
            <input type="text" id="tr-icon" value="${t.icon || '✨'}" />
          </label>
          <label class="field">
            <span>🇧🇷 Nome em PT-BR (name_ptbr)</span>
            <input type="text" id="tr-name_ptbr" value="${t.name_ptbr || ''}" />
          </label>
          <label class="field">
            <span>🔑 Chave i18n Nome (i18n_name_key)</span>
            <input type="text" id="tr-i18n_name_key" value="${t.i18n_name_key || ''}" />
          </label>
          <label class="field">
            <span>🔑 Chave i18n Descrição (i18n_desc_key)</span>
            <input type="text" id="tr-i18n_desc_key" value="${t.i18n_desc_key || ''}" />
          </label>
          <label class="field">
            <span>🔢 Degraus de Ativação (JSON Array ex: <code>[2, 4, 6]</code>)</span>
            <input type="text" id="tr-thresholds" value='${JSON.stringify(t.thresholds || [2, 4])}' />
          </label>
          <label class="field">
            <span>🇧🇷 Descrição PT-BR (desc_ptbr)</span>
            <input type="text" id="tr-desc_ptbr" value="${t.desc_ptbr || ''}" />
          </label>
        </div>

        <label class="field full-width">
          <span>⚙️ Bônus por Degrau (JSON ex: <code>{"2":{"bonus":20},"4":{"bonus":45}}</code>)</span>
          <textarea id="tr-bonuses" rows="4">${JSON.stringify(t.bonuses || {}, null, 2)}</textarea>
        </label>
      </div>
    `;

    ed.querySelector('#btn-save-trait')?.addEventListener('click', async () => {
      try {
        const thresholds = JSON.parse(ed.querySelector('#tr-thresholds').value);
        const bonuses = JSON.parse(ed.querySelector('#tr-bonuses').value);
        const payload = {
          trait_key: ed.querySelector('#tr-key').value.trim(),
          trait_type: ed.querySelector('#tr-type').value,
          icon: ed.querySelector('#tr-icon').value.trim(),
          i18n_name_key: ed.querySelector('#tr-i18n_name_key').value.trim(),
          name_ptbr: ed.querySelector('#tr-name_ptbr').value.trim(),
          i18n_desc_key: ed.querySelector('#tr-i18n_desc_key').value.trim(),
          desc_ptbr: ed.querySelector('#tr-desc_ptbr').value.trim(),
          thresholds,
          bonuses
        };
        const res = await this.api.saveTrait(payload);
        const idx = this.traits.findIndex(x => x.trait_key === res.trait.trait_key);
        if (idx >= 0) this.traits[idx] = res.trait;
        else this.traits.push(res.trait);
        this.selectedTrait = res.trait;
        this.renderList(container);
        this.showToast(`✅ Sinergia "${res.trait.name_ptbr}" salva no PostgreSQL!`, 'success');
        if (this.onChanged) this.onChanged();
      } catch (err) {
        this.showToast(`❌ Erro ao salvar sinergia: ${err.message}`, 'error');
      }
    });

    ed.querySelector('#btn-delete-trait')?.addEventListener('click', async () => {
      try {
        await this.api.deleteTrait(t.trait_key);
        this.traits = this.traits.filter(x => x.trait_key !== t.trait_key);
        this.selectedTrait = this.traits[0] || null;
        this.renderList(container);
        this.renderEditor(container);
        this.showToast(`🗑️ Sinergia "${t.trait_key}" removida.`, 'info');
        if (this.onChanged) this.onChanged();
      } catch (err) {
        this.showToast(`❌ Erro ao excluir sinergia: ${err.message}`, 'error');
      }
    });
  }
}
