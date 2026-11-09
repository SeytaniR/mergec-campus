/**
 * AdminApp.js
 * Clean ES6 Module Coordinator for Mergec Campus Admin Studio.
 * Zero God Objects: Delegates each database table to its dedicated Tab module.
 */
import { AdminApiService } from './AdminApiService.js';
import { EconomyFormulasTab } from './tabs/EconomyFormulasTab.js';
import { UnitsCrudTab } from './tabs/UnitsCrudTab.js';
import { TraitsCrudTab } from './tabs/TraitsCrudTab.js';
import { VfxCrudTab } from './tabs/VfxCrudTab.js';
import { ArenaMeshCrudTab } from './tabs/ArenaMeshCrudTab.js';
import { I18nCrudTab } from './tabs/I18nCrudTab.js';
import { MatchesMonitorTab } from './tabs/MatchesMonitorTab.js';

class AdminStudioCoordinator {
  constructor() {
    this.api = new AdminApiService();
    this.activeTab = 'economy';
    this.data = {
      config: {},
      units: [],
      traits: [],
      vfx: [],
      arenaMeshes: [],
      i18n: [],
      matches: []
    };

    const showToast = (msg, type) => this.showToast(msg, type);
    const refresh = () => this.loadAllData();

    this.tabs = {
      economy: new EconomyFormulasTab(this.api, (cfg) => { this.data.config = cfg; }, showToast),
      units: new UnitsCrudTab(this.api, refresh, showToast),
      traits: new TraitsCrudTab(this.api, refresh, showToast),
      vfx: new VfxCrudTab(this.api, refresh, showToast),
      arenaMeshes: new ArenaMeshCrudTab(this.api, refresh, showToast),
      i18n: new I18nCrudTab(this.api, refresh, showToast),
      matches: new MatchesMonitorTab(this.api, refresh, showToast)
    };
  }

  async init() {
    this.bindNavTabs();
    await this.loadAllData();
    this.connectLiveWebSocket();
  }

  bindNavTabs() {
    document.querySelectorAll('[data-admin-tab]').forEach(btn => {
      btn.addEventListener('click', () => {
        this.activeTab = btn.getAttribute('data-admin-tab');
        document.querySelectorAll('[data-admin-tab]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.renderActiveTab();
      });
    });

    const reloadBtn = document.getElementById('btn-reload-db');
    if (reloadBtn) {
      reloadBtn.addEventListener('click', () => this.loadAllData(true));
    }
  }

  async loadAllData(announce = false) {
    const statusEl = document.getElementById('admin-db-status');
    try {
      const bootstrap = await this.api.fetchBootstrap();
      this.data = {
        config: bootstrap.config || {},
        units: bootstrap.units || [],
        traits: bootstrap.traits || [],
        vfx: bootstrap.vfx || [],
        arenaMeshes: bootstrap.arenaMeshes || [],
        i18n: bootstrap.i18n || [],
        matches: bootstrap.matches || []
      };

      this.updateCountsBadge();
      if (statusEl) {
        statusEl.textContent = `🟢 PostgreSQL Online (${this.data.units.length} Unidades • ${this.data.arenaMeshes.length} Malhas 2.5D)`;
        statusEl.className = 'db-status-pill online';
      }
      if (announce) {
        this.showToast('🔄 Dados recarregados do PostgreSQL!', 'info');
      }
      this.renderActiveTab();
    } catch (err) {
      if (statusEl) {
        statusEl.textContent = `🔴 Erro de Conexão (${err.message})`;
        statusEl.className = 'db-status-pill offline';
      }
      this.showToast(`❌ Falha ao carregar banco: ${err.message}`, 'error');
    }
  }

  updateCountsBadge() {
    const setBadge = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.textContent = val;
    };
    setBadge('badge-count-units', this.data.units.length);
    setBadge('badge-count-traits', this.data.traits.length);
    setBadge('badge-count-vfx', this.data.vfx.length);
    setBadge('badge-count-arena-meshes', this.data.arenaMeshes.length);
    setBadge('badge-count-i18n', this.data.i18n.length);
    setBadge('badge-count-matches', this.data.matches.length);
  }

  renderActiveTab() {
    const container = document.getElementById('admin-tab-viewport');
    if (!container) return;

    if (this.activeTab === 'economy') {
      this.tabs.economy.render(container, this.data.config);
    } else if (this.activeTab === 'units') {
      this.tabs.units.render(container, {
        units: this.data.units,
        traits: this.data.traits,
        vfx: this.data.vfx
      });
    } else if (this.activeTab === 'traits') {
      this.tabs.traits.render(container, this.data.traits);
    } else if (this.activeTab === 'vfx') {
      this.tabs.vfx.render(container, this.data.vfx);
    } else if (this.activeTab === 'arenaMeshes') {
      this.tabs.arenaMeshes.render(container, this.data.arenaMeshes);
    } else if (this.activeTab === 'i18n') {
      this.tabs.i18n.render(container, this.data.i18n);
    } else if (this.activeTab === 'matches') {
      this.tabs.matches.render(container, this.data.matches);
    }
  }

  connectLiveWebSocket() {
    try {
      const ws = new WebSocket(this.api.getWsUrl());
      ws.onmessage = (ev) => {
        try {
          const pkt = JSON.parse(ev.data);
          if (pkt.type === 'LIVE_CONFIG_UPDATED' && pkt.config) {
            this.data.config = pkt.config;
          }
        } catch (_e) {}
      };
    } catch (_err) {}
  }

  showToast(message, type = 'info') {
    const wrap = document.getElementById('admin-toast-wrap');
    if (!wrap) return;
    const item = document.createElement('div');
    item.className = `admin-toast ${type}`;
    item.textContent = message;
    wrap.appendChild(item);
    setTimeout(() => {
      item.classList.add('hide');
      setTimeout(() => item.remove(), 280);
    }, 3200);
  }
}

const app = new AdminStudioCoordinator();
app.init();
window.__MERGEC_ADMIN__ = app;
