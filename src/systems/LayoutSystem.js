/**
 * LayoutSystem.js
 * Fluid responsive layout controller that dynamically scales and centers
 * the Pixi.js arena and bench across mobile/desktop & portrait/landscape viewports.
 */
export class LayoutSystem {
  constructor(app, sceneContainer, boardCoords) {
    this.app = app;
    this.sceneContainer = sceneContainer;
    this.boardCoords = boardCoords;
    this.wrapEl = document.getElementById('pixi-canvas-wrap');
  }

  init() {
    this.applyResponsiveFit();

    if (typeof ResizeObserver !== 'undefined' && this.wrapEl) {
      this.observer = new ResizeObserver(() => this.applyResponsiveFit());
      this.observer.observe(this.wrapEl);
    }

    window.addEventListener('resize', () => this.applyResponsiveFit());
    window.addEventListener('orientationchange', () => {
      setTimeout(() => this.applyResponsiveFit(), 120);
    });
  }

  applyResponsiveFit() {
    if (!this.wrapEl || !this.app || !this.app.renderer) return;
    const rect = this.wrapEl.getBoundingClientRect();
    const w = Math.max(240, Math.floor(rect.width));
    const h = Math.max(200, Math.floor(rect.height));

    this.app.renderer.resize(w, h);

    const designW = this.boardCoords.DESIGN_WIDTH;
    const designH = this.boardCoords.DESIGN_HEIGHT;

    const scaleX = (w * 0.98) / designW;
    const scaleY = (h * 0.98) / designH;
    const scale = Math.min(scaleX, scaleY);

    this.sceneContainer.scale.set(scale);
    this.sceneContainer.x = Math.round((w - designW * scale) / 2);
    this.sceneContainer.y = Math.round((h - designH * scale) / 2);
  }
}
