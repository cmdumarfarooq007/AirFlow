// Pooled Obstacle Entities Manager
import { CONFIG } from '../config.js';
import { state } from '../state/gameState.js';

class ObstaclePool {
  constructor() {
    this.poolSize = 25;
    this.pool = [];
    this.initPool();
  }

  // Pre-allocate obstacles in memory
  initPool() {
    this.pool = [];
    for (let i = 0; i < this.poolSize; i++) {
      this.pool.push({
        active: false,
        type: 'bar', // 'bar' (solid block), 'laser' (glowing beam)
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        speed: 0,
        laserTimer: 0 // For flicker warning behaviors
      });
    }
  }

  reset() {
    this.pool.forEach(obs => {
      obs.active = false;
    });
  }

  // Spawns an obstacle from the inactive pool
  spawn(w, h, currentSpeed) {
    const inactiveObs = this.pool.find(obs => !obs.active);
    if (!inactiveObs) return; // Pool full, drop spawn

    const obstacleTypes = ['bar', 'bar', 'bar', 'laser']; // 25% chance of lasers
    const type = obstacleTypes[Math.floor(Math.random() * obstacleTypes.length)];
    
    inactiveObs.active = true;
    inactiveObs.type = type;
    inactiveObs.speed = currentSpeed * (0.9 + Math.random() * 0.3); // detune speed slightly
    
    if (type === 'bar') {
      // Geometric Bar obstacle
      const minW = Math.max(80, w * 0.15);
      const maxW = Math.max(260, w * 0.40);
      inactiveObs.width = minW + Math.random() * (maxW - minW);
      inactiveObs.height = 20 + Math.random() * 10;
      inactiveObs.x = Math.random() * (w - inactiveObs.width);
      inactiveObs.y = -inactiveObs.height - 10;
    } else if (type === 'laser') {
      // Full screen sweeping laser
      inactiveObs.width = w;
      inactiveObs.height = 10;
      inactiveObs.x = 0;
      inactiveObs.y = -20;
      inactiveObs.laserTimer = 0; // Warmup warning timer
      
      // Select slightly slower speed for lasers to give player reaction time
      inactiveObs.speed = currentSpeed * 0.75;
    }
  }

  // Update obstacles positions
  update(h, currentSpeed, dtFactor) {
    const isSlowMo = state.isSlowMoActive;
    const speedMultiplier = isSlowMo ? 0.3 : 1.0;

    this.pool.forEach(obs => {
      if (!obs.active) return;
      
      // Update Y position based on frame delta
      obs.y += obs.speed * speedMultiplier * dtFactor;
      
      // Recycle if off screen
      if (obs.y > h + 50) {
        obs.active = false;
        
        // If avoided obstacle during slow-motion, count for achievement
        if (state.currentState === 'PLAYING' && isSlowMo) {
          state.slowMoDodgeCount++;
          if (state.slowMoDodgeCount >= 5) {
            state.unlockAchievement('chrono_dancer');
          }
        }
      }
    });
  }

  // Check collision between circle (orb) and AABB box (obstacle)
  checkCollisions(orb) {
    let collisionDetected = false;

    this.pool.forEach(obs => {
      if (!obs.active || collisionDetected) return;

      // Circle vs AABB Rect Collision math
      const closestX = Math.max(obs.x, Math.min(orb.x, obs.x + obs.width));
      const closestY = Math.max(obs.y, Math.min(orb.y, obs.y + obs.height));

      const distX = orb.x - closestX;
      const distY = orb.y - closestY;
      const distance = Math.hypot(distX, distY);

      if (distance < orb.radius) {
        // Collided!
        collisionDetected = true;
        obs.active = false; // Destroy obstacle
      }
    });

    return collisionDetected;
  }

  getActiveObstacles() {
    return this.pool.filter(obs => obs.active);
  }
}

export const obstacles = new ObstaclePool();
export { ObstaclePool };
