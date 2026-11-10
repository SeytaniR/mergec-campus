/**
 * MatchesMonitorTab.js
 * Modular Admin Tab for inspecting and managing online matches in PostgreSQL (matches).
 */
export class MatchesMonitorTab {
  constructor(api, onRefresh, showToast) {
    this.api = api;
    this.onRefresh = onRefresh;
    this.showToast = showToast;
  }

  render(container, matches) {
    const list = Array.isArray(matches) ? matches : [];

    container.innerHTML = `
      <div class="admin-card">
        <div class="card-header">
          <div>
            <h3>📡 Monitor de Partidas Online & Estado Autoritativo (Tabela <code>matches</code>)</h3>
            <p class="card-sub">Acompanhe as sessões salvas no PostgreSQL 16 da VPS Azure em tempo real.</p>
          </div>
          <div class="editor-actions">
            <button id="btn-refresh-matches" class="btn-secondary">🔄 Atualizar</button>
            <button id="btn-clear-matches" class="btn-danger">🧹 Limpar Histórico de Partidas</button>
          </div>
        </div>

        <div class="admin-table-wrap">
          <table class="admin-table">
            <thead>
              <tr>
                <th>🆔 Match ID</th>
                <th>👤 Jogador</th>
                <th>🏁 Rodada</th>
                <th>🪙 Ouro</th>
                <th>🎖️ Nível</th>
                <th>❤️ HP</th>
                <th>🔥 Streak</th>
                <th>🕒 Última Sincronização</th>
              </tr>
            </thead>
            <tbody>
              ${list.length === 0 ? `
                <tr><td colspan="8" style="text-align:center; padding: 24px;">Nenhuma partida registrada no momento.</td></tr>
              ` : list.map(m => `
                <tr>
                  <td><code>${m.match_id}</code></td>
                  <td><b>${m.player_name}</b></td>
                  <td>Rodada ${m.round}</td>
                  <td>🪙 ${m.gold}</td>
                  <td>Nv. ${m.level}</td>
                  <td>❤️ ${m.hp}</td>
                  <td>${m.streak}🔥</td>
                  <td>${new Date(m.updated_at).toLocaleString('pt-BR')}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;

    container.querySelector('#btn-refresh-matches')?.addEventListener('click', () => {
      if (this.onRefresh) this.onRefresh();
    });

    container.querySelector('#btn-clear-matches')?.addEventListener('click', async () => {
      try {
        await this.api.clearMatches();
        this.showToast('🧹 Histórico de partidas limpo no PostgreSQL!', 'info');
        if (this.onRefresh) this.onRefresh();
      } catch (err) {
        this.showToast(`❌ Erro ao limpar partidas: ${err.message}`, 'error');
      }
    });
  }
}
