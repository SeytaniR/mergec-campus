/**
 * HudUiSystem.js
 * Binds the responsive DOM HUD, Shop, Synergy badges, Unit Inspector,
 * Language Switcher, and 298 Verified 8-Direction Codex Modal via EventBus & I18nService.
 */
import { ORIGINS_REGISTRY, CLASSES_REGISTRY } from '../data/TraitRegistry.js';

export class HudUiSystem {
  constructor(eventBus, i18n, allVerifiedUnits, getGameState, onStartCombat, getBoardCount) {
    this.eventBus = eventBus;
    this.i18n = i18n;
    this.allVerifiedUnits = allVerifiedUnits;
    this.getGameState = getGameState;
    this.onStartCombat = onStartCombat;
    this.getBoardCount = getBoardCount;

    this.selectedUnit = null;
    this.lastSynergies = [];
    this.codexCategory = 'all';
    this.codexSearch = '';
  }

  init() {
    this.bindDomControls();
    this.bindEvents();
    this.renderAll();
  }

  bindDomControls() {
    const btnStart = document.getElementById('btn-start-combat');
    if (btnStart) {
      btnStart.addEventListener('click', () => this.onStartCombat());
    }

    const btnReroll = document.getElementById('btn-reroll');
    if (btnReroll) {
      btnReroll.addEventListener('click', () => this.eventBus.emit('cmd:reroll_shop'));
    }

    const btnBuyXp = document.getElementById('btn-buy-xp');
    if (btnBuyXp) {
      btnBuyXp.addEventListener('click', () => this.eventBus.emit('cmd:buy_xp'));
    }

    const btnLock = document.getElementById('btn-lock-shop');
    if (btnLock) {
      btnLock.addEventListener('click', () => this.eventBus.emit('cmd:toggle_lock'));
    }

    const btnLangPt = document.getElementById('btn-lang-pt');
    const btnLangEn = document.getElementById('btn-lang-en');
    if (btnLangPt && btnLangEn) {
      btnLangPt.addEventListener('click', () => this.i18n.setLocale('pt-BR'));
      btnLangEn.addEventListener('click', () => this.i18n.setLocale('en-US'));
    }

    // Codex Modal controls
    const btnOpenCodex = document.getElementById('btn-open-codex');
    const btnCloseCodex = document.getElementById('btn-close-codex');
    const codexModal = document.getElementById('modal-codex');
    if (btnOpenCodex && codexModal) {
      btnOpenCodex.addEventListener('click', () => {
        codexModal.classList.add('open');
        this.renderCodexModal();
      });
    }
    if (btnCloseCodex && codexModal) {
      btnCloseCodex.addEventListener('click', () => {
        codexModal.classList.remove('open');
      });
    }

    const searchInput = document.getElementById('codex-search-input');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.codexSearch = e.target.value.trim().toLowerCase();
        this.renderCodexGrid();
      });
    }

    document.querySelectorAll('[data-codex-cat]').forEach(btn => {
      btn.addEventListener('click', () => {
        this.codexCategory = btn.getAttribute('data-codex-cat');
        document.querySelectorAll('[data-codex-cat]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.renderCodexGrid();
      });
    });
  }

  bindEvents() {
    this.eventBus.on('state:updated', () => this.renderAll());
    this.eventBus.on('board:changed', () => this.renderTopStatus());
    this.eventBus.on('i18n:changed', () => {
      this.renderAll();
      const codexModal = document.getElementById('modal-codex');
      if (codexModal && codexModal.classList.contains('open')) {
        this.renderCodexModal();
      }
    });

    this.eventBus.on('synergies:updated', ({ synergies }) => {
      this.lastSynergies = synergies;
      this.renderSynergies();
    });

    this.eventBus.on('unit:selected', (payload) => {
      this.selectedUnit = payload;
      this.renderInspector();
    });

    this.eventBus.on('drag:started', ({ refund }) => {
      const sellEl = document.getElementById('sell-dropzone');
      if (sellEl) {
        sellEl.textContent = this.i18n.t('ui.btn.sell_zone', { refund });
        sellEl.classList.add('visible');
      }
    });

    this.eventBus.on('drag:ended', () => {
      const sellEl = document.getElementById('sell-dropzone');
      if (sellEl) {
        sellEl.classList.remove('visible');
      }
    });

    this.eventBus.on('ui:toast', ({ message, type = 'info' }) => {
      this.showToast(message, type);
    });
  }

  renderAll() {
    this.updateLanguageButtons();
    this.renderTopStatus();
    this.renderSynergies();
    this.renderInspector();
    this.renderShop();
  }

  updateLanguageButtons() {
    const pt = document.getElementById('btn-lang-pt');
    const en = document.getElementById('btn-lang-en');
    if (pt) pt.classList.toggle('active', this.i18n.locale === 'pt-BR');
    if (en) en.classList.toggle('active', this.i18n.locale === 'en-US');
  }

  renderTopStatus() {
    const s = this.getGameState();
    const boardCurrent = this.getBoardCount();

    this.setText('hud-round', this.i18n.t('ui.hud.round', { round: s.round }));
    this.setText(
      'hud-phase',
      s.phase === 'combat'
        ? this.i18n.t('ui.hud.phase.combat')
        : this.i18n.t('ui.hud.phase.prep')
    );
    this.setText('hud-gold', this.i18n.t('ui.hud.gold', { gold: s.gold }));
    this.setText('hud-level', this.i18n.t('ui.hud.level', { level: s.level }));
    this.setText('hud-xp', this.i18n.t('ui.hud.xp', { xp: s.xp, nextXp: s.nextXp }));
    this.setText('hud-board-cap', this.i18n.t('ui.hud.board_cap', { current: boardCurrent, max: s.level }));
    this.setText('hud-hp', this.i18n.t('ui.hud.hp', { hp: s.hp }));
    this.setText('hud-streak', this.i18n.t('ui.hud.streak', { streak: s.streak }));

    this.setText(
      'hud-server-status',
      s.serverMode === 'remote'
        ? this.i18n.t('ui.hud.server_mode.remote', { url: s.serverUrl })
        : this.i18n.t('ui.hud.server_mode.local')
    );

    const btnStart = document.getElementById('btn-start-combat');
    if (btnStart) {
      btnStart.disabled = s.phase === 'combat';
      btnStart.textContent = s.phase === 'combat'
        ? this.i18n.t('ui.btn.in_combat')
        : this.i18n.t('ui.btn.start_combat');
    }

    this.setText('btn-reroll', this.i18n.t('ui.btn.reroll', { cost: 2 }));
    this.setText('btn-buy-xp', this.i18n.t('ui.btn.buy_xp', { cost: 4 }));
    this.setText('btn-open-codex', this.i18n.t('ui.btn.codex', { count: this.allVerifiedUnits.length }));
    this.setText(
      'btn-lock-shop',
      s.shopLocked ? this.i18n.t('ui.shop.locked') : this.i18n.t('ui.shop.unlocked')
    );
  }

  renderSynergies() {
    const titleEl = document.getElementById('synergies-title');
    if (titleEl) titleEl.textContent = this.i18n.t('ui.panel.synergies');

    const listEl = document.getElementById('synergies-list');
    if (!listEl) return;

    if (!this.lastSynergies || this.lastSynergies.length === 0) {
      listEl.innerHTML = `<div class="empty-hint">${this.i18n.t('ui.panel.synergies.empty')}</div>`;
      return;
    }

    listEl.innerHTML = this.lastSynergies.map(syn => {
      const name = this.i18n.t(syn.i18nNameKey, {}, syn.namePtBr);
      const desc = this.i18n.t(syn.i18nDescKey, syn.bonusVars);
      const threshStr = syn.thresholds.join('/');
      const activeClass = syn.activeTier > 0 ? 'synergy-pill active' : 'synergy-pill';
      return `
        <div class="${activeClass}" title="${desc}">
          <span class="syn-icon">${syn.icon}</span>
          <div class="syn-info">
            <span class="syn-name">${name}</span>
            <span class="syn-tier">${syn.count} (${threshStr})</span>
          </div>
        </div>
      `;
    }).join('');
  }

  renderInspector() {
    const titleEl = document.getElementById('inspector-title');
    if (titleEl) titleEl.textContent = this.i18n.t('ui.panel.inspector');

    const bodyEl = document.getElementById('inspector-body');
    if (!bodyEl) return;

    if (!this.selectedUnit || !this.selectedUnit.stats) {
      bodyEl.innerHTML = `<div class="empty-hint">${this.i18n.t('ui.panel.inspector.empty')}</div>`;
      return;
    }

    const { stats, trait, anim } = this.selectedUnit;
    const unitName = this.i18n.t(stats.i18nNameKey, {}, stats.namePtBr);
    const originDef = ORIGINS_REGISTRY[trait.originKey];
    const classDef = CLASSES_REGISTRY[trait.classKey];
    const originName = originDef ? this.i18n.t(originDef.i18nNameKey, {}, originDef.namePtBr) : trait.originKey;
    const className = classDef ? this.i18n.t(classDef.i18nNameKey, {}, classDef.namePtBr) : trait.classKey;

    const skillDesc = this.i18n.t(
      stats.i18nSkillKey,
      {
        damage: stats.skillDamage,
        shield: stats.skillShield,
        heal: stats.skillHeal,
        duration: 1.5,
        buff: 25,
        mana: 20
      },
      stats.skillDescPtBr
    );

    bodyEl.innerHTML = `
      <div class="insp-header">
        <img src="${anim.thumbPath}" class="insp-thumb" alt="${unitName}" />
        <div class="insp-meta">
          <div class="insp-name">${unitName} <span class="insp-stars">${'⭐'.repeat(stats.starTier)}</span></div>
          <div class="insp-traits">
            <span class="insp-tag">${originDef ? originDef.icon : ''} ${originName}</span>
            <span class="insp-tag">${classDef ? classDef.icon : ''} ${className}</span>
          </div>
          <div class="insp-i18n-key">🔑 <code>${stats.i18nNameKey}</code></div>
        </div>
      </div>
      <div class="insp-stats-grid">
        <span>❤️ HP: <b>${stats.hp}/${stats.maxHp}</b></span>
        <span>💧 Mana: <b>${stats.mana}/${stats.maxMana}</b></span>
        <span>⚔️ ATK: <b>${stats.atk}</b></span>
        <span>🛡️ DEF: <b>${stats.def}</b></span>
        <span>⚡ ASPD: <b>${stats.atkSpeed}</b></span>
        <span>🎯 Alcance: <b>${stats.range}</b></span>
      </div>
      <div class="insp-skill-box">
        <img src="${anim.skillIcon}" class="insp-skill-icon" alt="Skill" />
        <p class="insp-skill-desc">${skillDesc}</p>
      </div>
    `;
  }

  renderShop() {
    const shopContainer = document.getElementById('shop-cards-container');
    if (!shopContainer) return;
    const s = this.getGameState();

    shopContainer.innerHTML = s.shopSlots.map((slot, idx) => {
      const u = slot.unitDef;
      if (!u) return '';
      const name = this.i18n.t(u.i18n_name_key, {}, u.name_ptbr);
      const originDef = ORIGINS_REGISTRY[u.origin_key];
      const classDef = CLASSES_REGISTRY[u.class_key];
      const originName = originDef ? this.i18n.t(originDef.i18nNameKey, {}, originDef.namePtBr) : u.origin_key;
      const className = classDef ? this.i18n.t(classDef.i18nNameKey, {}, classDef.namePtBr) : u.class_key;
      const copiesOwned = this.countOwnedCopiesInDom(u.id);
      const mergeReadyBadge = copiesOwned >= 2 ? `<span class="shop-merge-badge">✨ MERGE!</span>` : '';

      return `
        <button class="shop-card cost-tier-${u.cost} ${slot.purchased ? 'purchased' : ''}"
                data-shop-slot="${idx}"
                ${slot.purchased ? 'disabled' : ''}>
          ${mergeReadyBadge}
          <div class="shop-card-top">
            <img src="${u.visual.thumb_path}" class="shop-card-thumb" alt="${name}" loading="lazy" />
            <div class="shop-card-traits">
              <span>${originDef ? originDef.icon : ''} ${originName}</span>
              <span>${classDef ? classDef.icon : ''} ${className}</span>
            </div>
          </div>
          <div class="shop-card-bottom">
            <span class="shop-card-name">${name}</span>
            <span class="shop-card-cost">${slot.purchased ? this.i18n.t('ui.shop.sold') : this.i18n.t('ui.shop.cost', { cost: u.cost })}</span>
          </div>
        </button>
      `;
    }).join('');

    shopContainer.querySelectorAll('[data-shop-slot]').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.getAttribute('data-shop-slot'), 10);
        this.eventBus.emit('cmd:buy_shop_slot', { slotIndex: idx });
      });
    });
  }

  countOwnedCopiesInDom() {
    return 0;
  }

  renderCodexModal() {
    this.setText('codex-modal-title', this.i18n.t('ui.codex.title', { count: this.allVerifiedUnits.length }));
    this.setText('codex-modal-subtitle', this.i18n.t('ui.codex.subtitle'));

    const searchInput = document.getElementById('codex-search-input');
    if (searchInput) {
      searchInput.placeholder = this.i18n.t('ui.codex.search_placeholder');
    }

    const countChars = this.allVerifiedUnits.filter(u => u.category === 'characters').length;
    const countMonsters = this.allVerifiedUnits.filter(u => u.category === 'monsters').length;
    const countNpcs = this.allVerifiedUnits.filter(u => u.category === 'npcs').length;

    this.setText('codex-tab-all', this.i18n.t('ui.codex.filter.all', { count: this.allVerifiedUnits.length }));
    this.setText('codex-tab-characters', this.i18n.t('ui.codex.filter.characters', { count: countChars }));
    this.setText('codex-tab-monsters', this.i18n.t('ui.codex.filter.monsters', { count: countMonsters }));
    this.setText('codex-tab-npcs', this.i18n.t('ui.codex.filter.npcs', { count: countNpcs }));

    this.renderCodexGrid();
  }

  renderCodexGrid() {
    const gridEl = document.getElementById('codex-grid');
    if (!gridEl) return;

    const filtered = this.allVerifiedUnits.filter(u => {
      if (this.codexCategory !== 'all' && u.category !== this.codexCategory) return false;
      if (!this.codexSearch) return true;
      const translated = this.i18n.t(u.i18n_name_key, {}, u.name_ptbr).toLowerCase();
      return (
        u.name_ptbr.toLowerCase().includes(this.codexSearch) ||
        translated.includes(this.codexSearch) ||
        u.i18n_name_key.toLowerCase().includes(this.codexSearch) ||
        u.id.toLowerCase().includes(this.codexSearch)
      );
    });

    const slice = filtered.slice(0, 60);
    gridEl.innerHTML = slice.map(u => {
      const name = this.i18n.t(u.i18n_name_key, {}, u.name_ptbr);
      const originDef = ORIGINS_REGISTRY[u.origin_key];
      const classDef = CLASSES_REGISTRY[u.class_key];
      return `
        <div class="codex-card cost-tier-${u.cost}">
          <div class="codex-card-head">
            <img src="${u.visual.thumb_path}" class="codex-thumb" alt="${name}" loading="lazy" />
            <div class="codex-meta">
              <div class="codex-name">${name}</div>
              <div class="codex-ptbr-ref">🇧🇷 Ref DB: <b>${u.name_ptbr}</b></div>
              <div class="codex-key">🔑 <code>${u.i18n_name_key}</code></div>
              <div class="codex-badges">
                <span>8-Dir ✔</span>
                <span>Ações: ${u.visual.actions.join(',')}</span>
                <span>${originDef ? originDef.icon : ''} ${classDef ? classDef.icon : ''}</span>
              </div>
            </div>
          </div>
          <button class="codex-spawn-btn" data-spawn-unit="${u.id}">
            ${this.i18n.t('ui.codex.spawn_btn')}
          </button>
        </div>
      `;
    }).join('');

    gridEl.querySelectorAll('[data-spawn-unit]').forEach(btn => {
      btn.addEventListener('click', () => {
        const unitId = btn.getAttribute('data-spawn-unit');
        this.eventBus.emit('cmd:spawn_unit_by_id', { unitId });
        const codexModal = document.getElementById('modal-codex');
        if (codexModal) codexModal.classList.remove('open');
      });
    });
  }

  showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const el = document.createElement('div');
    el.className = `toast-banner toast-${type}`;
    el.textContent = message;
    container.appendChild(el);
    setTimeout(() => {
      el.classList.add('fade-out');
      setTimeout(() => el.remove(), 300);
    }, 2600);
  }

  setText(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  }
}
