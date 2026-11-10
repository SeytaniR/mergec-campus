/**
 * ArenaMeshCrudTab.js
 * Interactive Visual 2.5D Arena Mesh & VFX Zone Editor for Mergec Campus Admin Studio.
 * Allows dragging polygon/quad vertices directly on the 1376x768 Arena Canvas
 * and persists changes to PostgreSQL (`arena_meshes`) with live WebSocket hot-reload.
 */
export class ArenaMeshCrudTab {
  constructor(api, onChanged, showToast) {
    this.api = api;
    this.onChanged = onChanged;
    this.showToast = showToast;
    this.meshes = [];
    this.selectedMesh = null;
    this.draggingPointIdx = -1;
    this.arenaImg = new Image();
    this.arenaImgLoaded = false;
    this.arenaImg.onload = () => {
      this.arenaImgLoaded = true;
      this.drawCanvas();
    };
    this.arenaImg.src = 'assets/arena/arena_campus_25d.webp';
    this.canvas = null;
  }

  render(container, meshes) {
    this.meshes = Array.isArray(meshes) ? meshes : [];
    if (!this.selectedMesh && this.meshes.length > 0) {
      this.selectedMesh = JSON.parse(JSON.stringify(this.meshes[0]));
    } else if (this.selectedMesh) {
      const updated = this.meshes.find(m => m.mesh_id === this.selectedMesh.mesh_id);
      if (updated) this.selectedMesh = JSON.parse(JSON.stringify(updated));
    }

    container.innerHTML = `
      <div class="admin-master-detail">
        <!-- Lista de Malhas 2.5D da Arena -->
        <aside class="admin-list-panel">
          <div class="list-toolbar">
            <div class="toolbar-row">
              <strong>🏟️ Malhas 2.5D (${this.meshes.length})</strong>
              <div style="display:flex; gap:4px;">
                <button id="btn-new-mesh" class="btn-secondary" title="Criar nova malha 2.5D">+ Nova</button>
                <button id="btn-reset-meshes" class="btn-mini" title="Restaurar calibração padrão">🔄 Padrão</button>
              </div>
            </div>
            <p class="card-sub" style="margin-top:4px;">Clique em uma malha e arraste os vértices <code>P0, P1...</code> direto na imagem da Arena!</p>
          </div>
          <div id="arena-meshes-list" class="unit-scroll-list"></div>
        </aside>

        <!-- Editor Visual Interativo + Parâmetros da Malha -->
        <section id="arena-mesh-editor" class="admin-detail-panel"></section>
      </div>
    `;

    container.querySelector('#btn-new-mesh')?.addEventListener('click', () => {
      this.selectedMesh = {
        mesh_id: `custom_mesh_${Date.now().toString().slice(-4)}`,
        name_ptbr: 'Nova Zona de Efeito 2.5D',
        mesh_type: 'lantern_halo',
        enabled: true,
        color_hex: '#38bdf8',
        alpha: 0.7,
        speed: 1.2,
        intensity: 1.2,
        blend_mode: 'screen',
        points: [
          { x: 600, y: 320 },
          { x: 776, y: 320 },
          { x: 776, y: 440 },
          { x: 600, y: 440 }
        ],
        params: {}
      };
      this.renderList(container);
      this.renderEditor(container);
    });

    container.querySelector('#btn-reset-meshes')?.addEventListener('click', async () => {
      try {
        const res = await this.api.resetArenaMeshes();
        this.meshes = res.arenaMeshes || [];
        this.selectedMesh = this.meshes[0] ? JSON.parse(JSON.stringify(this.meshes[0])) : null;
        this.renderList(container);
        this.renderEditor(container);
        this.showToast('🔄 Calibração padrão das 12 malhas 2.5D restaurada no PostgreSQL!', 'info');
        if (this.onChanged) this.onChanged();
      } catch (err) {
        this.showToast(`❌ Erro ao restaurar malhas: ${err.message}`, 'error');
      }
    });

    this.renderList(container);
    this.renderEditor(container);
  }

  renderList(container) {
    const listEl = container.querySelector('#arena-meshes-list');
    if (!listEl) return;

    const typeIcons = {
      board_grid: '📐',
      bench_pedestals: '🪨',
      water_caustics: '🌊',
      portal_vortex: '🌀',
      brazier_fire: '🔥',
      rune_circle: '🔯',
      lantern_halo: '🏮',
      crystal_glow: '💎'
    };

    listEl.innerHTML = this.meshes.map(m => {
      const sel = this.selectedMesh && this.selectedMesh.mesh_id === m.mesh_id;
      const icon = typeIcons[m.mesh_type] || '✨';
      return `
        <div class="unit-list-row ${sel ? 'selected' : ''}" data-select-mesh="${m.mesh_id}">
          <span class="trait-emoji-lg">${icon}</span>
          <div class="unit-row-info">
            <div class="unit-row-title">
              <b>${m.name_ptbr}</b>
              <span class="cost-badge" style="color:${m.color_hex};">${m.enabled ? 'ATIVO' : 'OFF'}</span>
            </div>
            <div class="unit-row-sub">
              <code>${m.mesh_id}</code> • ${m.mesh_type} (${(m.points || []).length} pts)
            </div>
          </div>
        </div>
      `;
    }).join('');

    listEl.querySelectorAll('[data-select-mesh]').forEach(row => {
      row.addEventListener('click', () => {
        const id = row.getAttribute('data-select-mesh');
        const found = this.meshes.find(x => x.mesh_id === id);
        if (found) {
          this.selectedMesh = JSON.parse(JSON.stringify(found));
          this.renderList(container);
          this.renderEditor(container);
        }
      });
    });
  }

  renderEditor(container) {
    const ed = container.querySelector('#arena-mesh-editor');
    if (!ed || !this.selectedMesh) return;
    const m = this.selectedMesh;

    ed.innerHTML = `
      <div class="editor-head">
        <div>
          <h3>🏟️ ${m.name_ptbr} <span class="badge-id">${m.mesh_id}</span></h3>
          <p class="card-sub">Arraste os pontos diretamente sobre o canvas 1376×768 abaixo ou ajuste os controles numéricos.</p>
        </div>
        <div class="editor-actions">
          <button id="btn-add-vertex" class="btn-secondary">+ Vértice</button>
          <button id="btn-del-vertex" class="btn-secondary">- Último Vértice</button>
          <button id="btn-delete-mesh" class="btn-danger">🗑️ Excluir</button>
          <button id="btn-save-mesh" class="btn-primary">💾 Salvar Malha no PostgreSQL</button>
        </div>
      </div>

      <!-- Interactive 1376x768 Arena Mesh Canvas -->
      <div class="arena-canvas-editor-wrap">
        <canvas id="admin-arena-mesh-canvas" width="1376" height="768"></canvas>
      </div>

      <div class="admin-grid-2col">
        <div class="admin-subcard">
          <h4>⚙️ Configuração da Malha & Shader 2.5D</h4>
          <div class="form-grid-2">
            <label class="field">
              <span>ID da Malha (mesh_id)</span>
              <input type="text" id="m-id" value="${m.mesh_id}" />
            </label>
            <label class="field">
              <span>🇧🇷 Nome em PT-BR (name_ptbr)</span>
              <input type="text" id="m-name" value="${m.name_ptbr || ''}" />
            </label>
            <label class="field">
              <span>Tipo de Malha / Efeito 2.5D (mesh_type)</span>
              <select id="m-type">
                <option value="board_grid" ${m.mesh_type === 'board_grid' ? 'selected' : ''}>📐 Grade Perspectiva 2.5D do Tabuleiro (7x6)</option>
                <option value="bench_pedestals" ${m.mesh_type === 'bench_pedestals' ? 'selected' : ''}>🪨 9 Pedestais Rúnicos do Banco (Bench)</option>
                <option value="water_caustics" ${m.mesh_type === 'water_caustics' ? 'selected' : ''}>🌊 Água Hidrodinâmica & Cáusticas</option>
                <option value="portal_vortex" ${m.mesh_type === 'portal_vortex' ? 'selected' : ''}>🌀 Vórtice Dimensional do Portal</option>
                <option value="brazier_fire" ${m.mesh_type === 'brazier_fire' ? 'selected' : ''}>🔥 Pira de Fogo Arcano & Brasas</option>
                <option value="rune_circle" ${m.mesh_type === 'rune_circle' ? 'selected' : ''}>🔯 Círculo Rúnico Giratório 2.5D</option>
                <option value="lantern_halo" ${m.mesh_type === 'lantern_halo' ? 'selected' : ''}>🏮 Halo Volumétrico de Lampião</option>
                <option value="crystal_glow" ${m.mesh_type === 'crystal_glow' ? 'selected' : ''}>💎 Cristais Flutuantes (Pontos de Luz)</option>
              </select>
            </label>
            <label class="field">
              <span>🎨 Cor Principal (color_hex)</span>
              <div class="inline-pair">
                <input type="color" id="m-color-picker" value="${m.color_hex || '#38bdf8'}" style="height:36px; padding:2px;" />
                <input type="text" id="m-color" value="${m.color_hex || '#38bdf8'}" />
              </div>
            </label>
            <label class="field">
              <span>💧 Opacidade / Alpha (0.0 a 1.0)</span>
              <input type="number" step="0.05" min="0" max="1" id="m-alpha" value="${m.alpha ?? 0.65}" />
            </label>
            <label class="field">
              <span>⚡ Velocidade da Animação (speed)</span>
              <input type="number" step="0.1" min="0.1" max="5" id="m-speed" value="${m.speed ?? 1.0}" />
            </label>
            <label class="field">
              <span>💥 Intensidade / Escala (intensity)</span>
              <input type="number" step="0.05" min="0.2" max="3" id="m-intensity" value="${m.intensity ?? 1.0}" />
            </label>
            <label class="field checkbox-field">
              <input type="checkbox" id="m-enabled" ${m.enabled ? 'checked' : ''} />
              <span>✅ Malha Ativa na Arena</span>
            </label>
          </div>
        </div>

        <div class="admin-subcard">
          <h4>📍 Coordenadas dos Vértices no Espaço 1376×768 (points_json)</h4>
          <label class="field full-width">
            <span>JSON de Vértices <code>[{"x": 388, "y": 236}, ...]</code> (atualiza automaticamente ao arrastar no canvas)</span>
            <textarea id="m-points" rows="7">${JSON.stringify(m.points || [], null, 2)}</textarea>
          </label>
        </div>
      </div>
    `;

    this.canvas = ed.querySelector('#admin-arena-mesh-canvas');
    this.bindCanvasEvents(ed);
    this.drawCanvas();

    const colorPicker = ed.querySelector('#m-color-picker');
    const colorText = ed.querySelector('#m-color');
    colorPicker?.addEventListener('input', () => {
      colorText.value = colorPicker.value;
      this.syncFormToSelected(ed);
    });
    colorText?.addEventListener('input', () => {
      colorPicker.value = colorText.value;
      this.syncFormToSelected(ed);
    });

    ed.querySelectorAll('#m-id, #m-name, #m-type, #m-alpha, #m-speed, #m-intensity, #m-enabled').forEach(el => {
      el.addEventListener('input', () => this.syncFormToSelected(ed));
    });

    ed.querySelector('#m-points')?.addEventListener('input', (e) => {
      try {
        const parsed = JSON.parse(e.target.value);
        if (Array.isArray(parsed)) {
          this.selectedMesh.points = parsed;
          this.drawCanvas();
        }
      } catch (_err) {}
    });

    ed.querySelector('#btn-add-vertex')?.addEventListener('click', () => {
      const pts = this.selectedMesh.points || [];
      const last = pts[pts.length - 1] || { x: 688, y: 384 };
      pts.push({ x: Math.min(1350, last.x + 45), y: Math.min(740, last.y + 35) });
      this.selectedMesh.points = pts;
      ed.querySelector('#m-points').value = JSON.stringify(pts, null, 2);
      this.drawCanvas();
    });

    ed.querySelector('#btn-del-vertex')?.addEventListener('click', () => {
      const pts = this.selectedMesh.points || [];
      if (pts.length > 1) {
        pts.pop();
        this.selectedMesh.points = pts;
        ed.querySelector('#m-points').value = JSON.stringify(pts, null, 2);
        this.drawCanvas();
      }
    });

    ed.querySelector('#btn-save-mesh')?.addEventListener('click', async () => {
      try {
        this.syncFormToSelected(ed);
        const res = await this.api.saveArenaMesh(this.selectedMesh);
        if (Array.isArray(res.arenaMeshes)) {
          this.meshes = res.arenaMeshes;
        }
        this.selectedMesh = res.mesh || this.selectedMesh;
        this.renderList(container);
        this.drawCanvas();
        this.showToast(`✅ Malha "${this.selectedMesh.name_ptbr}" salva no PostgreSQL e atualizada no jogo!`, 'success');
        if (this.onChanged) this.onChanged();
      } catch (err) {
        this.showToast(`❌ Erro ao salvar malha: ${err.message}`, 'error');
      }
    });

    ed.querySelector('#btn-delete-mesh')?.addEventListener('click', async () => {
      try {
        const id = this.selectedMesh.mesh_id;
        const res = await this.api.deleteArenaMesh(id);
        this.meshes = res.arenaMeshes || this.meshes.filter(x => x.mesh_id !== id);
        this.selectedMesh = this.meshes[0] ? JSON.parse(JSON.stringify(this.meshes[0])) : null;
        this.renderList(container);
        this.renderEditor(container);
        this.showToast(`🗑️ Malha "${id}" removida.`, 'info');
        if (this.onChanged) this.onChanged();
      } catch (err) {
        this.showToast(`❌ Erro ao excluir malha: ${err.message}`, 'error');
      }
    });
  }

  syncFormToSelected(ed) {
    if (!this.selectedMesh) return;
    this.selectedMesh.mesh_id = ed.querySelector('#m-id').value.trim();
    this.selectedMesh.name_ptbr = ed.querySelector('#m-name').value.trim();
    this.selectedMesh.mesh_type = ed.querySelector('#m-type').value;
    this.selectedMesh.color_hex = ed.querySelector('#m-color').value.trim();
    this.selectedMesh.alpha = Number(ed.querySelector('#m-alpha').value) || 0.65;
    this.selectedMesh.speed = Number(ed.querySelector('#m-speed').value) || 1.0;
    this.selectedMesh.intensity = Number(ed.querySelector('#m-intensity').value) || 1.0;
    this.selectedMesh.enabled = Boolean(ed.querySelector('#m-enabled').checked);
    this.drawCanvas();
  }

  bindCanvasEvents(ed) {
    if (!this.canvas) return;

    const getCanvasCoords = (evt) => {
      const rect = this.canvas.getBoundingClientRect();
      const scaleX = this.canvas.width / rect.width;
      const scaleY = this.canvas.height / rect.height;
      return {
        x: Math.round((evt.clientX - rect.left) * scaleX),
        y: Math.round((evt.clientY - rect.top) * scaleY)
      };
    };

    this.canvas.addEventListener('pointerdown', (evt) => {
      if (!this.selectedMesh || !Array.isArray(this.selectedMesh.points)) return;
      const pos = getCanvasCoords(evt);
      const pts = this.selectedMesh.points;

      // Check if clicking near an existing vertex handle
      let bestIdx = -1;
      let bestDist = 26;
      for (let i = 0; i < pts.length; i++) {
        const d = Math.hypot(pos.x - pts[i].x, pos.y - pts[i].y);
        if (d < bestDist) {
          bestDist = d;
          bestIdx = i;
        }
      }

      if (bestIdx !== -1) {
        this.draggingPointIdx = bestIdx;
        this.canvas.setPointerCapture(evt.pointerId);
      }
    });

    this.canvas.addEventListener('pointermove', (evt) => {
      if (this.draggingPointIdx === -1 || !this.selectedMesh) return;
      const pos = getCanvasCoords(evt);
      const pts = this.selectedMesh.points;
      if (pts[this.draggingPointIdx]) {
        pts[this.draggingPointIdx].x = Math.max(0, Math.min(1376, pos.x));
        pts[this.draggingPointIdx].y = Math.max(0, Math.min(768, pos.y));
        const ptsArea = ed.querySelector('#m-points');
        if (ptsArea) ptsArea.value = JSON.stringify(pts, null, 2);
        this.drawCanvas();
      }
    });

    const stopDrag = () => {
      this.draggingPointIdx = -1;
    };
    this.canvas.addEventListener('pointerup', stopDrag);
    this.canvas.addEventListener('pointercancel', stopDrag);
  }

  drawCanvas() {
    if (!this.canvas) return;
    const ctx = this.canvas.getContext('2d');
    ctx.clearRect(0, 0, 1376, 768);

    // 1. Draw 1376x768 Arena Background
    if (this.arenaImgLoaded) {
      ctx.drawImage(this.arenaImg, 0, 0, 1376, 768);
    } else {
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, 0, 1376, 768);
    }

    // 2. Draw all other enabled meshes faintly so user sees full context
    for (const m of this.meshes) {
      if (!m.enabled || (this.selectedMesh && m.mesh_id === this.selectedMesh.mesh_id)) continue;
      this.drawSingleMeshOverlay(ctx, m, false);
    }

    // 3. Draw currently selected mesh highlighted with draggable vertex handles
    if (this.selectedMesh) {
      this.drawSingleMeshOverlay(ctx, this.selectedMesh, true);
    }
  }

  drawSingleMeshOverlay(ctx, m, isSelected) {
    const pts = Array.isArray(m.points) ? m.points : [];
    if (pts.length === 0) return;

    const color = m.color_hex || '#38bdf8';
    ctx.save();

    if (m.mesh_type === 'board_grid' && pts.length >= 4) {
      // Draw 7x6 perspective grid subdivisions
      const [tl, tr, br, bl] = pts;
      const lerpQuad = (u, v) => {
        const tx = tl.x + (tr.x - tl.x) * u;
        const ty = tl.y + (tr.y - tl.y) * u;
        const bx = bl.x + (br.x - bl.x) * u;
        const by = bl.y + (br.y - bl.y) * u;
        return { x: tx + (bx - tx) * v, y: ty + (by - ty) * v };
      };

      ctx.strokeStyle = color;
      ctx.lineWidth = isSelected ? 2.2 : 1.1;
      ctx.globalAlpha = isSelected ? 0.85 : 0.35;

      for (let c = 0; c <= 7; c++) {
        const p0 = lerpQuad(c / 7, 0);
        const p1 = lerpQuad(c / 7, 1);
        ctx.beginPath();
        ctx.moveTo(p0.x, p0.y);
        ctx.lineTo(p1.x, p1.y);
        ctx.stroke();
      }
      for (let r = 0; r <= 6; r++) {
        const p0 = lerpQuad(0, r / 6);
        const p1 = lerpQuad(1, r / 6);
        ctx.beginPath();
        ctx.moveTo(p0.x, p0.y);
        ctx.lineTo(p1.x, p1.y);
        ctx.stroke();
      }
    } else if (m.mesh_type === 'bench_pedestals' && pts.length >= 2) {
      const [start, end] = pts;
      ctx.strokeStyle = color;
      ctx.lineWidth = isSelected ? 2.5 : 1.5;
      ctx.globalAlpha = isSelected ? 0.9 : 0.4;
      for (let i = 0; i < 9; i++) {
        const t = i / 8;
        const x = start.x + (end.x - start.x) * t;
        const y = start.y + (end.y - start.y) * t;
        ctx.beginPath();
        ctx.ellipse(x, y - 4, 36, 24, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
    } else if (m.mesh_type === 'crystal_glow') {
      ctx.strokeStyle = color;
      ctx.fillStyle = color;
      for (const p of pts) {
        ctx.globalAlpha = isSelected ? 0.45 : 0.2;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 26, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = isSelected ? 0.95 : 0.45;
        ctx.stroke();
      }
    } else {
      // Standard Polygon Mesh (water_caustics, portal_vortex, brazier_fire, rune_circle, lantern_halo)
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) {
        ctx.lineTo(pts[i].x, pts[i].y);
      }
      ctx.closePath();
      ctx.fillStyle = color;
      ctx.globalAlpha = isSelected ? 0.28 : 0.12;
      ctx.fill();
      ctx.lineWidth = isSelected ? 2.8 : 1.4;
      ctx.strokeStyle = isSelected ? '#facc15' : color;
      ctx.globalAlpha = isSelected ? 0.95 : 0.45;
      ctx.stroke();
    }

    // Draw draggable vertex handles when selected
    if (isSelected) {
      ctx.globalAlpha = 1;
      for (let i = 0; i < pts.length; i++) {
        const p = pts[i];
        ctx.beginPath();
        ctx.arc(p.x, p.y, 10, 0, Math.PI * 2);
        ctx.fillStyle = '#facc15';
        ctx.fill();
        ctx.lineWidth = 2.5;
        ctx.strokeStyle = '#070b14';
        ctx.stroke();

        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 13px Segoe UI, sans-serif';
        ctx.fillText(`P${i} (${p.x},${p.y})`, p.x + 13, p.y + 4);
      }
    }

    ctx.restore();
  }
}
