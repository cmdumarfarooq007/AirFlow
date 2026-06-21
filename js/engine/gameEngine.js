// Core GameLoop, Physics, and Spawning Engine
import { CONFIG } from '../config.js';
import { state } from '../state/gameState.js';
import { input } from './input.js';
import { audio } from './audio.js';
import { renderer } from './renderer.js';
import { orb } from '../game/orb.js';
import { obstacles } from '../game/obstacles.js';
import { fragments } from '../game/fragments.js';
import { powerups } from '../game/powerups.js';
import { background } from '../game/background.js';

class GameEngine {
  constructor() {
    this.lastTime = 0;
    this.frameId = null;
    this.currentSpeed = CONFIG.game.baseSpeed;
    
    // Spawners timers
    this.obstacleTimer = 0;
    this.fragmentTimer = 0;
    this.powerupTimer = 0;
    this.gamePlayTimeTracker = 0; // Total seconds in session
    
    // Particle Pool (Trail effects)
    this.particles = [];
    this.particleLimit = 200;
    this.initParticlePool();

    // Floating Score HUD Pool
    this.floatingScores = [];
    this.scorePoolLimit = 15;
    this.initScorePool();

    // Screen Shake variables
    this.shakeDuration = 0;
    this.shakeIntensity = 0;
    this.shakeX = 0;
    this.shakeY = 0;

    // Direct input hooks
    state.on('swipeDash', (direction) => this.handleSwipeDash(direction));
    state.on('stateChange', ({ newState }) => this.handleStateTransition(newState));
  }

  initParticlePool() {
    this.particles = [];
    for (let i = 0; i < this.particleLimit; i++) {
      this.particles.push({
        active: false,
        x: 0,
        y: 0,
        size: 0,
        vx: 0,
        vy: 0,
        alpha: 1.0,
        decay: 0.05,
        color: '#ffffff'
      });
    }
  }

  initScorePool() {
    this.floatingScores = [];
    for (let i = 0; i < this.scorePoolLimit; i++) {
      this.floatingScores.push({
        active: false,
        x: 0,
        y: 0,
        text: '',
        alpha: 1.0,
        vy: 0,
        color: '#ffffff',
        fontSize: 16
      });
    }
  }

  handleStateTransition(newState) {
    if (newState === 'PLAYING') {
      this.start();
    } else {
      this.stop();
    }
  }

  handleSwipeDash(direction) {
    if (state.currentState !== 'PLAYING') return;
    
    orb.dash(direction);
    audio.playDash();
    this.triggerScreenShake(5, 8); // Quick shake on dash
    
    // Emit particle burst
    this.spawnParticleBurst(orb.x, orb.y, state.settings.colorblindMode ? '#ffffff' : '#00f0ff', 15);
  }

  start() {
    this.currentSpeed = CONFIG.game.baseSpeed;
    this.obstacleTimer = 0;
    this.fragmentTimer = 0;
    this.powerupTimer = 0;
    this.gamePlayTimeTracker = Date.now();
    
    orb.reset();
    obstacles.reset();
    fragments.reset();
    powerups.reset();
    this.initParticlePool();
    this.initScorePool();
    
    background.init(window.innerWidth, window.innerHeight);

    this.lastTime = performance.now();
    this.loop(this.lastTime);
  }

  stop() {
    if (this.frameId) {
      cancelAnimationFrame(this.frameId);
      this.frameId = null;
    }
  }

  loop(timestamp) {
    if (state.currentState !== 'PLAYING') return;

    // 1. Delta-time calculation to support high refresh rates (90 FPS+)
    let dt = timestamp - this.lastTime;
    
    // Cap dt to prevent massive physics leaps when tabs backgrounded
    if (dt > 100) dt = 16.66; 
    
    this.lastTime = timestamp;
    
    // Normalize factor around 60fps (16.67ms = 1.0)
    const dtFactor = dt / 16.67;

    // 2. Perform updates
    this.update(dt, dtFactor);

    // 3. Perform canvas draws (applying screen shakes if active)
    const ctx = renderer.ctx;
    if (ctx) {
      ctx.save();
      this.updateScreenShake();
      ctx.translate(this.shakeX, this.shakeY);
      
      renderer.draw(
        orb, 
        obstacles.getActiveObstacles(), 
        fragments.getActiveGems(), 
        this.particles,
        this.floatingScores
      );
      
      ctx.restore();
    }

    this.frameId = requestAnimationFrame((t) => this.loop(t));
  }

  update(dt, dtFactor) {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const isSlowMo = state.isSlowMoActive;

    // 1. Difficulty ramping (increase speed slowly)
    this.currentSpeed = Math.min(
      CONFIG.game.maxSpeed, 
      this.currentSpeed + CONFIG.game.speedIncreaseRate * dtFactor
    );

    // 2. Accumulate game stats (distance flown)
    const flyDelta = (this.currentSpeed * (isSlowMo ? 0.3 : 1.0) * 0.05) * dtFactor;
    state.distance += flyDelta;
    state.addScore(flyDelta * 1.5); // Slow points for flying

    // 3. Update Entities
    // Fetch input targets
    const inputPos = input.getScaledPosition(w, h);
    orb.update(inputPos.x, inputPos.y, w, h, dtFactor);
    obstacles.update(h, this.currentSpeed, dtFactor);
    fragments.update(orb, h, this.currentSpeed, dtFactor);
    powerups.update(orb, h, this.currentSpeed, dtFactor);
    background.update(w, h, this.currentSpeed, dtFactor);
    
    // Update active gesture status timers
    state.updateAbilityTimers(dt);

    // 4. Collision Checking & Handling
    this.handleCollisions();

    // 5. Spawning Timers Loops
    this.obstacleTimer += dt;
    if (this.obstacleTimer >= CONFIG.game.obstacleSpawnInterval) {
      this.obstacleTimer = 0;
      obstacles.spawn(w, h, this.currentSpeed);
    }

    this.fragmentTimer += dt;
    if (this.fragmentTimer >= CONFIG.game.fragmentSpawnInterval) {
      this.fragmentTimer = 0;
      fragments.spawn(w, h, this.currentSpeed);
    }

    this.powerupTimer += dt;
    if (this.powerupTimer >= 15000) { // Spawn powerup token every 15s
      this.powerupTimer = 0;
      powerups.spawn(w, h, this.currentSpeed);
    }

    // 6. Spawn movement trail particles from player orb
    this.spawnOrbTrails(dtFactor);

    // 7. Update Particles & Floats
    this.updateParticles(dtFactor);
    this.updateFloatingScores(dtFactor);

    // 8. Drain energy passively over time
    // Closed fist uses less energy (precision efficiency)
    const energyMultiplier = state.activeGesture === 'Closed Fist' ? 0.5 : 1.0;
    state.modifyEnergy(-CONFIG.game.energyDepleteRate * energyMultiplier * dtFactor);
  }

  // Spawns trail particles behind the player orb
  spawnOrbTrails(dtFactor) {
    if (state.settings.graphicsQuality === 'low') return; // Skip on low quality
    
    const count = state.settings.graphicsQuality === 'high' ? 2 : 1;
    const gesture = state.activeGesture;
    
    let particleColor = 'rgba(0, 240, 255, 0.4)'; // Cyan
    if (gesture === 'Pinch') particleColor = 'rgba(138, 43, 226, 0.4)'; // Purple
    if (gesture === 'Two-Finger') particleColor = 'rgba(255, 0, 127, 0.4)'; // Pink
    if (gesture === 'Closed Fist') particleColor = 'rgba(255, 255, 255, 0.4)'; // White

    for (let k = 0; k < count; k++) {
      const inactiveP = this.particles.find(p => !p.active);
      if (!inactiveP) break;

      inactiveP.active = true;
      // Spawn at back of orb based on velocity
      inactiveP.x = orb.x + (Math.random() * 8 - 4);
      inactiveP.y = orb.y + (Math.random() * 8 - 4);
      inactiveP.size = Math.random() * 5 + 3;
      inactiveP.vx = -orb.vx * 0.2 + (Math.random() * 1 - 0.5);
      inactiveP.vy = 2.0 + (Math.random() * 1 - 0.5); // flow upwards/backwards
      inactiveP.alpha = 0.6;
      inactiveP.decay = 0.02 + Math.random() * 0.02;
      inactiveP.color = particleColor;
    }
  }

  spawnParticleBurst(x, y, color, count) {
    for (let k = 0; k < count; k++) {
      const inactiveP = this.particles.find(p => !p.active);
      if (!inactiveP) break;

      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 8 + 2;

      inactiveP.active = true;
      inactiveP.x = x;
      inactiveP.y = y;
      inactiveP.size = Math.random() * 4 + 2;
      inactiveP.vx = Math.cos(angle) * speed;
      inactiveP.vy = Math.sin(angle) * speed;
      inactiveP.alpha = 0.9;
      inactiveP.decay = 0.03 + Math.random() * 0.03;
      inactiveP.color = color;
    }
  }

  updateParticles(dtFactor) {
    this.particles.forEach(p => {
      if (!p.active) return;
      
      p.x += p.vx * dtFactor;
      p.y += p.vy * dtFactor;
      p.alpha -= p.decay * dtFactor;
      
      if (p.alpha <= 0) {
        p.active = false;
      }
    });
  }

  // Spawns float points indicators
  addFloatingScore(x, y, text, color) {
    const inactiveScore = this.floatingScores.find(s => !s.active);
    if (!inactiveScore) return;

    inactiveScore.active = true;
    inactiveScore.x = x;
    inactiveScore.y = y;
    inactiveScore.text = text;
    inactiveScore.alpha = 1.0;
    inactiveScore.vy = -1.5;
    inactiveScore.color = color;
    inactiveScore.fontSize = 18;
  }

  updateFloatingScores(dtFactor) {
    this.floatingScores.forEach(s => {
      if (!s.active) return;
      s.y += s.vy * dtFactor;
      s.alpha -= 0.04 * dtFactor;
      if (s.alpha <= 0) {
        s.active = false;
      }
    });
  }

  // Collision handling logic
  handleCollisions() {
    // 1. Check Collectibles Collections
    fragments.checkCollections(orb, (x, y, text, color) => this.addFloatingScore(x, y, text, color));

    // 2. Check Power-ups Collections
    powerups.checkCollections(orb, (x, y, text, color) => this.addFloatingScore(x, y, text, color));

    // 3. Check Obstacles Collisions
    if (obstacles.checkCollisions(orb)) {
      this.handleDamageCollision();
    }
  }

  handleDamageCollision() {
    const isShield = state.isShieldActive;
    
    if (isShield) {
      // Shield absorbs hits!
      state.shieldTimer = 0;
      state.emit('abilityExpire', 'shield');
      state.emit('toast', 'Shield Deflected Obstacle!');
      
      audio.playShield(); // FM synthesizer sound
      this.spawnParticleBurst(orb.x, orb.y, '#ff007f', 20); // Pink impact burst
      state.unlockAchievement('shield_wall');
    } else {
      // Standard damage taken
      state.modifyEnergy(-CONFIG.game.hitDamage);
      state.tookDamageThisGame = true;
      state.resetCombo(); // Wipe multiplier
      
      audio.playDamage();
      this.triggerScreenShake(12, 16); // Big shake on damage
      this.spawnParticleBurst(orb.x, orb.y, '#ff0000', 25); // Red explosion
      
      // Screen damage indicator
      state.emit('toast', 'WARNING: IMPACT DETECTED');
    }
  }

  // Screen shake calculations
  triggerScreenShake(duration, intensity) {
    if (state.settings.reducedMotion) return; // Accessibility check
    this.shakeDuration = duration;
    this.shakeIntensity = intensity;
  }

  updateScreenShake() {
    if (this.shakeDuration > 0) {
      this.shakeX = (Math.random() * 2 - 1) * this.shakeIntensity;
      this.shakeY = (Math.random() * 2 - 1) * this.shakeIntensity;
      this.shakeDuration--;
    } else {
      this.shakeX = 0;
      this.shakeY = 0;
    }
  }
}

export const gameEngine = new GameEngine();
export { GameEngine };
