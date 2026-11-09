/**
 * VfxCrudTab.js
 * Modular Admin CRUD Tab for Special Effects (vfx_catalog).
 */
export class VfxCrudTab {
  constructor(api, onChanged, showToast) {
    this.api = api;
    this.onChanged = onChanged;
    this.showToast = showToast;
    this.vfxList = [];
    this.selectedVfx = null;
  }

  render(container, vfxList) {
    this.vfxList = Array.isArray(vfxList) ? vfxList : [];
    if (!this.selectedVfx && this.vfxList.length > 0) {
      this.selectedVfx = this.vfxList[0];
    }

    container.innerHTML = `
      <div class="admin-master-detail">
        <aside class="admin-list-panel">
          <div class="list-toolbar">
            <div class="toolbar-row">
              <strong>🎆 Efeitos Especiais (${this.vfxList.length})</strong>
              <button id="btn-new-vfx" class="btn-secondary">+ Novo VFX</button>
            </div>
          </div>
          <div id="vfx-crud-list" class="unit-scroll-list"></div>
        </aside>

        <section id="vfx-crud-editor" class="admin-detail-panel"></section>
      </div>
    `;

    container.querySelector('#btn-new-vfx')?.addEventListener('click', () => {
      this.selectedVfx = {
        vfx_id: `100${Math.floor(30 + Math.random() * 60)}`,
        name_ptbr: 'Novo Efeito Especial Arcano',
        sheet_path: 'assets/vfx/10008/sheet.webp',
        frame_count: 14,
        frame_duration: 75,
        default_scale: 1.25,
        blend_mode: 'screen'
      };
      this.renderEditor(container);
    });

    this.renderList(container);
    this.renderEditor(container);
  }

  renderList(container) {
    const listEl = container.querySelector('#vfx-crud-list');
    if (!listEl) return;

    listEl.innerHTML = this.vfxList.map(v => {
      const sel = this.selectedVfx && this.selectedVfx.vfx_id === v.vfx_id;
      return `
        <div class="unit-list-row ${sel ? 'selected' : ''}" data-select-vfx="${v.vfx_id}">
          <span class="trait-emoji-lg">💥</span>
          <div class="unit-row-info">
            <div class="unit-row-title">
              <b>${v.name_ptbr}</b>
              <span class="cost-badge">ID ${v.vfx_id}</span>
            </div>
            <div class="unit-row-sub">
              ${v.frame_count} frames • ${v.frame_duration}ms/frame • Escala ${v.default_scale}x
            </div>
          </div>
        </div>
      `;
    }).join('');

    listEl.querySelectorAll('[data-select-vfx]').forEach(row => {
      row.addEventListener('click', () => {
        const id = row.getAttribute('data-select-vfx');
        const found = this.vfxList.find(x => x.vfx_id === id);
        if (found) {
          this.selectedVfx = { ...found };
          this.renderList(container);
          this.renderEditor(container);
        }
      });
    });
  }

  renderEditor(container) {
    const ed = container.querySelector('#vfx-crud-editor');
    if (!ed || !this.selectedVfx) return;
    const v = this.selectedVfx;

    ed.innerHTML = `
      <div class="editor-head">
        <div>
          <h3>🎆 ${v.name_ptbr} <span class="badge-id">VFX ID: ${v.vfx_id}</span></h3>
          <p class="card-sub">Configure velocidade de quadros (ms), escala de explosão, blend mode e spritesheet WebP.</p>
        </div>
        <div class="editor-actions">
          <button id="btn-delete-vfx" class="btn-danger">🗑️ Excluir</button>
          <button id="btn-save-vfx" class="btn-primary">💾 Salvar Efeito no PostgreSQL</button>
        </div>
      </div>

      <div class="admin-subcard">
        <div class="form-grid-2">
          <label class="field">
            <span>ID do Efeito (vfx_id)</span>
            <input type="text" id="vfx-id" value="${v.vfx_id}" />
          </label>
          <label class="field">
            <span>🇧🇷 Nome em PT-BR (name_ptbr)</span>
            <input type="text" id="vfx-name" value="${v.name_ptbr || ''}" />
          </label>
          <label class="field">
            <span>🖼️ Caminho da Spritesheet WebP (sheet_path)</span>
            <input type="text" id="vfx-sheet" value="${v.sheet_path || ''}" />
          </label>
          <label class="field">
            <span>🎞️ Total de Quadros (frame_count)</span>
            <input type="number" id="vfx-frames" value="${v.frame_count ?? 12}" min="1" max="120" />
          </label>
          <label class="field">
            <span>⏱️ Velocidade por Quadro em ms (frame_duration)</span>
            <input type="number" id="vfx-duration" value="${v.frame_duration ?? 75}" min="16" max="500" />
          </label>
          <label class="field">
            <span>🔍 Escala Padrão na Arena (default_scale)</span>
            <input type="number" step="0.05" id="vfx-scale" value="${v.default_scale ?? 1.2}" min="0.2" max="5.0" />
          </label>
          <label class="field">
            <span>✨ Modo de Mesclagem (blend_mode)</span>
            <select id="vfx-blend">
              <option value="screen" ${v.blend_mode === 'screen' ? 'selected' : ''}>Screen (Brilho Mágico)</option>
              <option value="add" ${v.blend_mode === 'add' ? 'selected' : ''}>Add (Aditivo Intenso)</option>
              <option value="normal" ${v.blend_mode === 'normal' ? 'selected' : ''}>Normal (Opaco)</option>
            </select>
          </label>
        </div>
        <div class="vfx-preview-strip">
          <span>Pré-visualização da Spritesheet WebP (<code>${v.sheet_path}</code>):</span>
          <img src="${v.sheet_path}" class="vfx-sheet-img" alt="${v.name_ptbr}" />
        </div>
      </div>
    `;

    ed.querySelector('#btn-save-vfx')?.addEventListener('click', async () => {
      try {
        const payload = {
          vfx_id: ed.querySelector('#vfx-id').value.trim(),
          name_ptbr: ed.querySelector('#vfx-name').value.trim(),
          sheet_path: ed.querySelector('#vfx-sheet').value.trim(),
          frame_count: Number(ed.querySelector('#vfx-frames').value) || 12,
          frame_duration: Number(ed.querySelector('#vfx-duration').value) || 75,
          default_scale: Number(ed.querySelector('#vfx-scale').value) || 1.2,
          blend_mode: ed.querySelector('#vfx-blend').value
        };
        const res = await this.api.saveVfx(payload);
        const idx = this.vfxList.findIndex(x => x.vfx_id === res.vfx.vfx_id);
        if (idx >= 0) this.vfxList[idx] = res.vfx;
        else this.vfxList.push(res.vfx);
        this.selectedVfx = res.vfx;
        this.renderList(container);
        this.renderEditor(container);
        this.showToast(`✅ Efeito "${res.vfx.name_ptbr}" salvo no PostgreSQL!`, 'success');
        if (this.onChanged) this.onChanged();
      } catch (err) {
        this.showToast(`❌ Erro ao salvar VFX: ${err.message}`, 'error');
      }
    });

    ed.querySelector('#btn-delete-vfx')?.addEventListener('click', async () => {
      try {
        await this.api.deleteVfx(v.vfx_id);
        this.vfxList = this.vfxList.filter(x => x.vfx_id !== v.vfx_id);
        this.selectedVfx = this.vfxList[0] || null;
        this.renderList(container);
        this.renderEditor(container);
        this.showToast(`🗑️ Efeito "${v.vfx_id}" removido.`, 'info');
        if (this.onChanged) this.onChanged();
      } catch (err) {
        this.showToast(`❌ Erro ao excluir VFX: ${err.message}`, 'error');
      }
    });
  }
}
