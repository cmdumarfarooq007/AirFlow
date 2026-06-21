// Background Starfield & Grid Data Manager
import { CONFIG } from '../config.js';
import { state } from '../state/gameState.js';

class ParallaxBackground {
  constructor() {
    this.stars = [];
    this.gridY = 0;
  }

  // Preload coordinates based on viewport sizing
  init(w, h) {
    this.stars = [];
    const count = 50;
    for (let i = 0; i < count; i++) {
      this.stars.push({
        x: Math.random() * w,
        y: Math.random() * h,
        size: Math.random() * 2 + 0.5,
        speed: Math.random() * 0.4 + 0.15
      });
    }
  }

  update(w, h, currentSpeed, dtFactor) {
    const isSlowMo = state.isSlowMoActive;
    const nowSpeed = currentSpeed * (isSlowMo ? 0.3 : 1.0);
    
    this.gridY = (this.gridY + nowSpeed * dtFactor) % 60;
    
    // Update star positions
    this.stars.forEach(star => {
      star.y += nowSpeed * star.speed * dtFactor;
      if (star.y > h) {
        star.y = 0;
        star.x = Math.random() * w;
      }
    });
  }
}

export const background = new ParallaxBackground();
export { ParallaxBackground };
