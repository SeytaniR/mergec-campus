/**
 * I18nCrudTab.js
 * Modular Admin CRUD Tab for Translation Keys & PT-BR Reference Strings (i18n_translations).
 */
export class I18nCrudTab {
  constructor(api, onChanged, showToast) {
    this.api = api;
    this.onChanged = onChanged;
    this.showToast = showToast;
    this.rows = [];
    this.search = '';
    this.localeFilter = 'all';
  }

  render(container, rows) {
    this.rows = Array.isArray(rows) ? rows : [];

    container.innerHTML = `
      <div class="admin-card">
        <div class="card-header">
          <div>
            <h3>🌐 Dicionário i18n & Referência PT-BR (Tabela <code>i18n_translations</code>)</h3>
            <p class="card-sub">Gerencie chaves de tradução, variáveis <code>{damage}</code> / <code>{shield}</code> e textos de referência em Português.</p>
          </div>
        </div>

        <!-- Formulário de Adição / Edição Rápida -->
        <div class="i18n-quick-form">
          <input type="text" id="i18n-key" placeholder="Chave i18n (ex: unit.char.011001001.name)" />
          <select id="i18n-locale">
            <option value="pt-BR">🇧🇷 pt-BR</option>
            <option value="en-US">🇺🇸 en-US</option>
            <option value="es-ES">🇪🇸 es-ES</option>
          </select>
          <input type="text" id="i18n-text" placeholder="Texto traduzido (com {variaveis})" />
          <input type="text" id="i18n-ref" placeholder="Referência original PT-BR" />
          <button id="btn-save-i18n" class="btn-primary">💾 Salvar Chave</button>
        </div>

        <div class="toolbar-row" style="margin: 12px 0;">
          <input type="search" id="i18n-search" placeholder="Filtrar por chave i18n ou texto..." value="${this.search}" />
          <div class="filter-pills">
            <button class="pill-btn ${this.localeFilter === 'all' ? 'active' : ''}" data-loc="all">Todos (${this.rows.length})</button>
            <button class="pill-btn ${this.localeFilter === 'pt-BR' ? 'active' : ''}" data-loc="pt-BR">🇧🇷 pt-BR</button>
            <button class="pill-btn ${this.localeFilter === 'en-US' ? 'active' : ''}" data-loc="en-US">🇺🇸 en-US</button>
          </div>
        </div>

        <div class="admin-table-wrap">
          <table class="admin-table">
            <thead>
              <tr>
                <th>🔑 Chave i18n</th>
                <th>🌍 Idioma</th>
                <th>💬 Texto Traduzido</th>
                <th>🇧🇷 Referência PT-BR</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody id="i18n-table-body"></tbody>
          </table>
        </div>
      </div>
    `;

    container.querySelector('#i18n-search')?.addEventListener('input', (e) => {
      this.search = e.target.value.trim().toLowerCase();
      this.renderTableBody(container);
    });

    container.querySelectorAll('[data-loc]').forEach(btn => {
      btn.addEventListener('click', () => {
        this.localeFilter = btn.getAttribute('data-loc');
        container.querySelectorAll('[data-loc]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.renderTableBody(container);
      });
    });

    container.querySelector('#btn-save-i18n')?.addEventListener('click', async () => {
      const i18n_key = container.querySelector('#i18n-key').value.trim();
      const locale = container.querySelector('#i18n-locale').value;
      const text_value = container.querySelector('#i18n-text').value.trim();
      const ptbr_reference = container.querySelector('#i18n-ref').value.trim();
      if (!i18n_key) {
        this.showToast('⚠️ Informe a chave i18n.', 'error');
        return;
      }
      try {
        const res = await this.api.saveI18n({ i18n_key, locale, text_value, ptbr_reference });
        const idx = this.rows.findIndex(r => r.i18n_key === i18n_key && r.locale === locale);
        if (idx >= 0) this.rows[idx] = res.i18n;
        else this.rows.unshift(res.i18n);
        this.renderTableBody(container);
        this.showToast(`✅ Tradução "${i18n_key}" (${locale}) salva!`, 'success');
        if (this.onChanged) this.onChanged();
      } catch (err) {
        this.showToast(`❌ Erro ao salvar tradução: ${err.message}`, 'error');
      }
    });

    this.renderTableBody(container);
  }

  renderTableBody(container) {
    const tbody = container.querySelector('#i18n-table-body');
    if (!tbody) return;

    const filtered = this.rows.filter(r => {
      if (this.localeFilter !== 'all' && r.locale !== this.localeFilter) return false;
      if (!this.search) return true;
      return (
        (r.i18n_key || '').toLowerCase().includes(this.search) ||
        (r.text_value || '').toLowerCase().includes(this.search) ||
        (r.ptbr_reference || '').toLowerCase().includes(this.search)
      );
    });

    tbody.innerHTML = filtered.slice(0, 120).map((r, i) => `
      <tr>
        <td><code>${r.i18n_key}</code></td>
        <td><span class="cost-badge">${r.locale}</span></td>
        <td>${r.text_value}</td>
        <td class="muted-cell">${r.ptbr_reference || '—'}</td>
        <td>
          <button class="btn-mini" data-edit-i18n="${i}">✏️ Editar</button>
          <button class="btn-mini danger" data-del-key="${r.i18n_key}" data-del-loc="${r.locale}">🗑️</button>
        </td>
      </tr>
    `).join('');

    tbody.querySelectorAll('[data-edit-i18n]').forEach(btn => {
      btn.addEventListener('click', () => {
        const row = filtered[Number(btn.getAttribute('data-edit-i18n'))];
        if (!row) return;
        container.querySelector('#i18n-key').value = row.i18n_key;
        container.querySelector('#i18n-locale').value = row.locale;
        container.querySelector('#i18n-text').value = row.text_value;
        container.querySelector('#i18n-ref').value = row.ptbr_reference || '';
      });
    });

    tbody.querySelectorAll('[data-del-key]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const key = btn.getAttribute('data-del-key');
        const loc = btn.getAttribute('data-del-loc');
        try {
          await this.api.deleteI18n(key, loc);
          this.rows = this.rows.filter(r => !(r.i18n_key === key && r.locale === loc));
          this.renderTableBody(container);
          this.showToast(`🗑️ Tradução ${key} (${loc}) excluída.`, 'info');
        } catch (err) {
          this.showToast(`❌ Erro: ${err.message}`, 'error');
        }
      });
    });
  }
}
