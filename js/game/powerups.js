// Spawning and Collection of Floating Power-ups
import { CONFIG } from '../config.js';
import { state } from '../state/gameState.js';
import { audio } from '../engine/audio.js';

class PowerupPool {
  constructor() {
    this.poolSize = 5;
    this.pool = [];
    this.types = ['shield', 'magnet', 'slowMo', 'double', 'boost', 'invincible'];
    this.initPool();
  }

  initPool() {
    this.pool = [];
    for (let i = 0; i < this.poolSize; i++) {
      this.pool.push({
        active: false,
        type: 'shield', // 'shield', 'magnet', 'slowMo', 'double', 'boost', 'invincible'
        x: 0,
        y: 0,
        size: 14,
        speed: 0,
        color: '#ff007f'
      });
    }
  }

  reset() {
    this.pool.forEach(p => p.active = false);
  }

  spawn(w, h, currentSpeed) {
    const inactiveP = this.pool.find(p => !p.active);
    if (!inactiveP) return;

    const type = this.types[Math.floor(Math.random() * this.types.length)];
    
    inactiveP.active = true;
    inactiveP.type = type;
    inactiveP.x = 40 + Math.random() * (w - 80);
    inactiveP.y = -30;
    inactiveP.speed = currentSpeed * 0.7; // Power-ups drift slightly slower
    
    // Choose visual color identity
    switch (type) {
      case 'shield': inactiveP.color = '#ff007f'; break; // Pink
      case 'magnet': inactiveP.color = '#8a2be2'; break; // Purple
      case 'slowMo': inactiveP.color = '#00ffaa'; break; // Green-Cyan
      case 'double': inactiveP.color = '#ffaa00'; break; // Gold
      case 'boost': inactiveP.color = '#00f0ff'; break;  // Cyan
      case 'invincible': inactiveP.color = '#ffffff'; break; // White
    }
  }

  update(orb, h, currentSpeed, dtFactor) {
    const isSlowMo = state.isSlowMoActive;
    const speedMultiplier = isSlowMo ? 0.3 : 1.0;

    this.pool.forEach(p => {
      if (!p.active) return;
      
      // Move downward
      p.y += p.speed * speedMultiplier * dtFactor;

      // Magnet pull can also apply to powerups!
      if (state.isMagnetActive) {
        const dx = orb.x - p.x;
        const dy = orb.y - p.y;
        const dist = Math.hypot(dx, dy);
        if (dist < 160) {
          p.x += (dx / dist) * 6.0 * dtFactor;
          p.y += (dy / dist) * 6.0 * dtFactor;
        }
      }

      // Recycle if off screen
      if (p.y > h + 30) {
        p.active = false;
      }
    });
  }

  checkCollections(orb, addFloatingScoreCallback) {
    this.pool.forEach(p => {
      if (!p.active) return;

      const dist = Math.hypot(orb.x - p.x, orb.y - p.y);
      if (dist < orb.radius + p.size + 4) {
        p.active = false;
        
        // Play sound
        audio.playShield(); // High chime
        
        // Trigger power-up benefits
        this.activatePowerup(p.type);

        if (addFloatingScoreCallback) {
          addFloatingScoreCallback(
            p.x, 
            p.y, 
            p.type.toUpperCase() + '!', 
            p.color
          );
        }
      }
    });
  }

  activatePowerup(type) {
    state.emit('toast', `Collected: ${type.toUpperCase()}`);
    
    switch (type) {
      case 'shield':
        state.triggerAbility('shield');
        break;
      case 'magnet':
        state.triggerAbility('magnet');
        break;
      case 'slowMo':
        state.triggerAbility('slowMo');
        break;
      case 'boost':
        state.modifyEnergy(40); // Restore massive health/energy
        break;
      case 'double':
        // Custom temporary double multiplier event
        state.incrementCombo(50); // Instantly gain 4 combo levels
        break;
      case 'invincible':
        // Trigger shield for full duration
        state.triggerAbility('shield');
        break;
    }
  }

  getActivePowerups() {
    return this.pool.filter(p => p.active);
  }
}

export const powerups = new PowerupPool();
export { PowerupPool };
