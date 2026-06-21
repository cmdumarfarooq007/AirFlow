// Player Orb Entity Controller
import { CONFIG } from '../config.js';
import { state } from '../state/gameState.js';

class PlayerOrb {
  constructor() {
    this.x = window.innerWidth / 2;
    this.y = window.innerHeight * 0.7;
    this.vx = 0;
    this.vy = 0;
    this.radius = CONFIG.game.orbRadius;
    this.targetRadius = CONFIG.game.orbRadius;
    
    // Boundary offsets
    this.margin = 30;
  }

  reset() {
    this.x = window.innerWidth / 2;
    this.y = window.innerHeight * 0.7;
    this.vx = 0;
    this.vy = 0;
    this.radius = CONFIG.game.orbRadius;
    this.targetRadius = CONFIG.game.orbRadius;
  }

  // Swipe Dash impulse trigger
  dash(direction) {
    const dashImpulse = 28; // Pixels per frame delta
    
    if (direction === 'LEFT') {
      this.vx = -dashImpulse;
    } else if (direction === 'RIGHT') {
      this.vx = dashImpulse;
    } else if (direction === 'UP') {
      this.vy = -dashImpulse * 0.8;
    } else if (direction === 'DOWN') {
      this.vy = dashImpulse * 0.8;
    }

    state.dashCountThisGame++;
    
    // Check Dash achievement
    if (state.dashCountThisGame >= 10) {
      state.unlockAchievement('clean_sweep');
    }
  }

  // Update loop
  update(targetX, targetY, w, h, dtFactor) {
    const gesture = state.activeGesture;
    
    // 1. Set target radius based on gesture (Precision shrinks orb)
    if (gesture === 'Closed Fist') {
      this.targetRadius = CONFIG.game.orbRadius * 0.65;
    } else {
      this.targetRadius = CONFIG.game.orbRadius;
    }
    
    // Smooth radius scaling
    this.radius += (this.targetRadius - this.radius) * 0.2 * dtFactor;

    // 2. Core Movement Interpolation (Tracking Lag compensation)
    let interpolation = 0.22; // Quick tracking response
    
    if (gesture === 'Closed Fist') {
      // Precision Mode: Slows down tracking reaction to navigate narrow spaces
      interpolation = 0.09;
    }

    // Target displacement force
    const tx = targetX;
    const ty = targetY;
    
    // Integrate velocity with target attraction
    const targetVx = (tx - this.x) * interpolation;
    const targetVy = (ty - this.y) * interpolation;
    
    // Add velocity impulses (for dash) and friction decay
    this.vx += (targetVx - this.vx) * 0.4 * dtFactor;
    this.vy += (targetVy - this.vy) * 0.4 * dtFactor;
    
    // Decay active dash speeds quickly
    this.vx *= Math.pow(0.85, dtFactor);
    this.vy *= Math.pow(0.85, dtFactor);

    // Update positions
    this.x += (targetVx + this.vx) * dtFactor;
    this.y += (targetVy + this.vy) * dtFactor;

    // 3. Keep Player bounded on screen
    const minX = this.margin;
    const maxX = w - this.margin;
    const minY = this.margin;
    const maxY = h - this.margin;
    
    if (this.x < minX) { this.x = minX; this.vx = 0; }
    if (this.x > maxX) { this.x = maxX; this.vx = 0; }
    if (this.y < minY) { this.y = minY; this.vy = 0; }
    if (this.y > maxY) { this.y = maxY; this.vy = 0; }
  }
}

export const orb = new PlayerOrb();
export { PlayerOrb };
