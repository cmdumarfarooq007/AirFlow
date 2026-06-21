// Pooled Energy Fragment Gems Manager
import { CONFIG } from '../config.js';
import { state } from '../state/gameState.js';
import { audio } from '../engine/audio.js';

class FragmentPool {
  constructor() {
    this.poolSize = 80;
    this.pool = [];
    this.initPool();
  }

  // Pre-allocate memory structures
  initPool() {
    this.pool = [];
    for (let i = 0; i < this.poolSize; i++) {
      this.pool.push({
        active: false,
        x: 0,
        y: 0,
        size: 7,
        speed: 0
      });
    }
  }

  reset() {
    this.pool.forEach(gem => {
      gem.active = false;
    });
  }

  // Spawn gem from pool
  spawn(w, h, currentSpeed) {
    const inactiveGem = this.pool.find(gem => !gem.active);
    if (!inactiveGem) return;

    inactiveGem.active = true;
    inactiveGem.x = 20 + Math.random() * (w - 40);
    inactiveGem.y = -15;
    inactiveGem.size = 6 + Math.random() * 3;
    inactiveGem.speed = currentSpeed * 0.9;
  }

  // Update gems position and apply magnet physics
  update(orb, h, currentSpeed, dtFactor) {
    const isSlowMo = state.isSlowMoActive;
    const isMagnet = state.isMagnetActive;
    
    const speedMultiplier = isSlowMo ? 0.3 : 1.0;
    
    this.pool.forEach(gem => {
      if (!gem.active) return;

      // 1. Check Magnet Pull Force (Pinch)
      if (isMagnet) {
        const dx = orb.x - gem.x;
        const dy = orb.y - gem.y;
        const dist = Math.hypot(dx, dy);
        const magnetRange = 160; // Pull radius

        if (dist < magnetRange) {
          // Calculate vector pull
          const pullIntensity = (1 - dist / magnetRange) * 8.5; // Stronger pull when closer
          gem.x += (dx / dist) * pullIntensity * dtFactor;
          gem.y += (dy / dist) * pullIntensity * dtFactor;
        }
      }

      // 2. Normal scroll descent
      gem.y += gem.speed * speedMultiplier * dtFactor;

      // Recycle if off screen
      if (gem.y > h + 20) {
        gem.active = false;
      }
    });
  }

  // Check collections
  checkCollections(orb, addFloatingScoreCallback) {
    let collectedCount = 0;
    const w = window.innerWidth;

    this.pool.forEach(gem => {
      if (!gem.active) return;

      const dx = orb.x - gem.x;
      const dy = orb.y - gem.y;
      const dist = Math.hypot(dx, dy);
      
      // Colllision radius check
      if (dist < orb.radius + gem.size + 4) {
        gem.active = false;
        collectedCount++;
        
        // Dynamic scoring based on combo
        const points = 100;
        state.addScore(points);
        state.incrementCombo(12); // Progress combo
        state.modifyEnergy(CONFIG.game.gemEnergyGain); // Restore energy
        
        // Check magnet specific stats for achievements
        if (state.isMagnetActive) {
          state.magnetCollectedCount++;
          if (state.magnetCollectedCount >= 100) {
            state.unlockAchievement('magnet_master');
          }
        }

        // Play spatial audio pluck based on screen X position (-1.0 left to 1.0 right)
        const panValue = (gem.x / w) * 2 - 1;
        audio.playCollect(panValue);

        // Add float HUD score indicator
        if (addFloatingScoreCallback) {
          addFloatingScoreCallback(
            gem.x, 
            gem.y, 
            `+${Math.round(points * state.multiplier)}`, 
            state.settings.colorblindMode ? '#ffbb00' : '#00f0ff'
          );
        }
      }
    });

    return collectedCount;
  }

  getActiveGems() {
    return this.pool.filter(gem => gem.active);
  }
}

export const fragments = new FragmentPool();
export { FragmentPool };
