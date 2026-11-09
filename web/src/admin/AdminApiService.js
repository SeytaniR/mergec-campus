/**
 * AdminApiService.js
 * Single-responsibility REST & WebSocket client for the Mergec Campus Authoritative Admin API.
 * Zero God Objects: Handles HTTP requests and error formatting cleanly.
 */
export class AdminApiService {
  constructor() {
    this.baseUrl = this.detectDefaultBaseUrl();
  }

  detectDefaultBaseUrl() {
    if (
      window.location.hostname &&
      !window.location.hostname.includes('github.io') &&
      window.location.protocol.startsWith('http')
    ) {
      return window.location.origin;
    }
    return 'https://40-65-63-193.sslip.io';
  }

  setBaseUrl(url) {
    this.baseUrl = String(url || '').replace(/\/+$/, '');
  }

  getWsUrl() {
    if (this.baseUrl.startsWith('https://')) {
      return this.baseUrl.replace('https://', 'wss://');
    }
    if (this.baseUrl.startsWith('http://')) {
      return this.baseUrl.replace('http://', 'ws://');
    }
    return 'wss://40-65-63-193.sslip.io';
  }

  async request(path, options = {}) {
    const url = `${this.baseUrl}${path}`;
    const res = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {})
      },
      ...options
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.ok === false) {
      throw new Error(data.error || `HTTP ${res.status} em ${path}`);
    }
    return data;
  }

  async fetchBootstrap() {
    return this.request('/api/admin/bootstrap', { method: 'GET', cache: 'no-store' });
  }

  async saveConfig(configPayload) {
    return this.request('/api/admin/config', {
      method: 'PUT',
      body: JSON.stringify(configPayload)
    });
  }

  async saveUnit(unitPayload) {
    return this.request('/api/admin/units', {
      method: 'POST',
      body: JSON.stringify(unitPayload)
    });
  }

  async deleteUnit(unitId) {
    return this.request(`/api/admin/units/${encodeURIComponent(unitId)}`, {
      method: 'DELETE'
    });
  }

  async saveTrait(traitPayload) {
    return this.request('/api/admin/traits', {
      method: 'POST',
      body: JSON.stringify(traitPayload)
    });
  }

  async deleteTrait(traitKey) {
    return this.request(`/api/admin/traits/${encodeURIComponent(traitKey)}`, {
      method: 'DELETE'
    });
  }

  async saveVfx(vfxPayload) {
    return this.request('/api/admin/vfx', {
      method: 'POST',
      body: JSON.stringify(vfxPayload)
    });
  }

  async deleteVfx(vfxId) {
    return this.request(`/api/admin/vfx/${encodeURIComponent(vfxId)}`, {
      method: 'DELETE'
    });
  }

  async saveI18n(i18nPayload) {
    return this.request('/api/admin/i18n', {
      method: 'POST',
      body: JSON.stringify(i18nPayload)
    });
  }

  async deleteI18n(i18nKey, locale) {
    return this.request(
      `/api/admin/i18n?key=${encodeURIComponent(i18nKey)}&locale=${encodeURIComponent(locale)}`,
      { method: 'DELETE' }
    );
  }

  async clearMatches() {
    return this.request('/api/admin/matches', {
      method: 'DELETE'
    });
  }
}
