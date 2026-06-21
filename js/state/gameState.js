// Event-driven Game State Manager
import { CONFIG } from '../config.js';

class GameStateManager {
  constructor() {
    this.listeners = {};
    
    // Core game state variables
    this.currentState = 'SPLASH'; // 'SPLASH', 'PERMISSION', 'CALIBRATION', 'MENU', 'PLAYING', 'PAUSED', 'GAMEOVER'
    
    // Stats for current run
    this.score = 0;
    this.highScore = 0;
    this.distance = 0;
    this.multiplier = 1.0;
    this.multiplierProgress = 0; // 0 to 100 before scaling
    this.energy = CONFIG.game.baseEnergy;
    
    // Flat ability timers (in milliseconds)
    this.shieldTimer = 0;
    this.slowMoTimer = 0;
    this.magnetTimer = 0;
    
    this.shieldDuration = 4000;
    this.shieldCooldown = 10000;
    this.lastShieldUsed = 0;

    this.slowMoDuration = 5000;
    this.slowMoCooldown = 12000;
    this.lastSlowMoUsed = 0;

    // User settings and total lifetime statistics
    this.settings = { ...CONFIG.defaults.settings };
    this.stats = { ...CONFIG.defaults.stats };
    this.unlockedAchievements = [];
    
    // Active gameplay variables
    this.activeGesture = 'Open Palm';
    this.gestureHistoryThisGame = new Set();
    this.dashCountThisGame = 0;
    this.magnetCollectedCount = 0;
    this.slowMoDodgeCount = 0;
    this.tookDamageThisGame = false;
  }

  // Getters for hold-to-activate and triggered statuses
  get isMagnetActive() {
    return this.activeGesture === 'Pinch' || this.magnetTimer > 0;
  }

  get isShieldActive() {
    return this.shieldTimer > 0;
  }

  get isSlowMoActive() {
    return this.slowMoTimer > 0;
  }

  get isPrecisionActive() {
    return this.activeGesture === 'Closed Fist';
  }

  // Event Emitter subscription
  on(event, callback) {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    this.listeners[event].push(callback);
  }

  off(event, callback) {
    if (!this.listeners[event]) return;
    this.listeners[event] = this.listeners[event].filter(cb => cb !== callback);
  }

  emit(event, data) {
    if (!this.listeners[event]) return;
    this.listeners[event].forEach(callback => {
      try {
        callback(data);
      } catch (e) {
        console.error(`Error in event listener for ${event}:`, e);
      }
    });
  }

  // Set the current screen state
  setState(newState) {
    if (this.currentState === newState) return;
    const oldState = this.currentState;
    this.currentState = newState;
    
    // Reset session parameters on start
    if (newState === 'PLAYING' && oldState !== 'PAUSED') {
      this.resetSession();
    }
    
    this.emit('stateChange', { oldState, newState });
  }

  // Initialize values at the start of a session
  resetSession() {
    this.score = 0;
    this.distance = 0;
    this.multiplier = 1.0;
    this.multiplierProgress = 0;
    this.energy = CONFIG.game.baseEnergy;
    this.gestureHistoryThisGame.clear();
    this.dashCountThisGame = 0;
    this.magnetCollectedCount = 0;
    this.slowMoDodgeCount = 0;
    this.tookDamageThisGame = false;
    
    // Reset flat timers
    this.shieldTimer = 0;
    this.slowMoTimer = 0;
    this.magnetTimer = 0;
    this.lastShieldUsed = 0;
    this.lastSlowMoUsed = 0;

    this.emit('scoreChange', this.score);
    this.emit('energyChange', this.energy);
    this.emit('multiplierChange', { multiplier: this.multiplier, progress: this.multiplierProgress });
  }

  // Increment score with multiplier calculation
  addScore(points) {
    const gained = Math.round(points * this.multiplier);
    this.score += gained;
    this.emit('scoreChange', this.score);
    
    // Update high score instantly
    if (this.score > this.highScore) {
      this.highScore = this.score;
      this.emit('highScoreChange', this.highScore);
    }
  }

  // Update combo progression
  incrementCombo(amount = 15) {
    this.multiplierProgress += amount;
    
    if (this.multiplierProgress >= 100) {
      this.multiplierProgress = 0;
      this.multiplier = Math.min(15.0, parseFloat((this.multiplier + 1.0).toFixed(1)));
      this.emit('multiplierChange', { multiplier: this.multiplier, progress: this.multiplierProgress });
      this.emit('toast', `Multiplier Up! x${this.multiplier.toFixed(1)}`);
      
      if (this.multiplier >= 15.0) {
        this.unlockAchievement('untouchable');
      }
    } else {
      this.emit('multiplierChange', { multiplier: this.multiplier, progress: this.multiplierProgress });
    }
  }

  resetCombo() {
    if (this.multiplier > 1.0) {
      this.multiplier = 1.0;
      this.multiplierProgress = 0;
      this.emit('multiplierChange', { multiplier: this.multiplier, progress: this.multiplierProgress });
      this.emit('toast', 'Combo Lost!');
    }
  }

  // Energy mechanics
  modifyEnergy(amount) {
    this.energy = Math.max(0, Math.min(CONFIG.game.baseEnergy, this.energy + amount));
    this.emit('energyChange', this.energy);
    
    if (this.energy <= 0 && this.currentState === 'PLAYING') {
      this.setState('GAMEOVER');
    }
  }

  // Gesture selection & triggers
  setGesture(gestureName) {
    if (this.activeGesture === gestureName) return;
    const oldGesture = this.activeGesture;
    this.activeGesture = gestureName;
    
    this.emit('gestureChange', { oldGesture, newGesture: gestureName });
    
    if (this.currentState === 'PLAYING') {
      this.gestureHistoryThisGame.add(gestureName);
      if (this.gestureHistoryThisGame.size >= 5) {
        this.unlockAchievement('grandmaster');
      }
    }
  }

  // Ability Management
  triggerAbility(abilityName) {
    if (this.currentState !== 'PLAYING') return false;
    const now = Date.now();

    if (abilityName === 'shield') {
      if (now - this.lastShieldUsed < this.shieldCooldown) return false;
      this.shieldTimer = this.shieldDuration;
      this.lastShieldUsed = now;
      this.emit('abilityTrigger', { name: 'shield', duration: this.shieldDuration });
      this.emit('toast', 'Force Shield Engaged');
      return true;
    }
    
    if (abilityName === 'slowMo') {
      if (now - this.lastSlowMoUsed < this.slowMoCooldown) return false;
      this.slowMoTimer = this.slowMoDuration;
      this.lastSlowMoUsed = now;
      this.emit('abilityTrigger', { name: 'slowMo', duration: this.slowMoDuration });
      this.emit('toast', 'Chrono Warp Engaged');
      return true;
    }

    if (abilityName === 'magnet') {
      this.magnetTimer = 8000;
      this.emit('abilityTrigger', { name: 'magnet', duration: 8000 });
      return true;
    }
    
    return false;
  }

  updateAbilityTimers(dt) {
    if (this.shieldTimer > 0) {
      this.shieldTimer -= dt;
      if (this.shieldTimer <= 0) {
        this.shieldTimer = 0;
        this.emit('abilityExpire', 'shield');
        this.emit('toast', 'SHIELD Expired');
      }
    }
    if (this.slowMoTimer > 0) {
      this.slowMoTimer -= dt;
      if (this.slowMoTimer <= 0) {
        this.slowMoTimer = 0;
        this.emit('abilityExpire', 'slowMo');
        this.emit('toast', 'SLOW-MO Expired');
      }
    }
    if (this.magnetTimer > 0) {
      this.magnetTimer -= dt;
      if (this.magnetTimer <= 0) {
        this.magnetTimer = 0;
        this.emit('abilityExpire', 'magnet');
        this.emit('toast', 'MAGNET Expired');
      }
    }
  }

  // Achievement unlock triggers
  unlockAchievement(id) {
    if (this.unlockedAchievements.includes(id)) return;
    
    const ach = CONFIG.achievements.find(a => a.id === id);
    if (!ach) return;
    
    this.unlockedAchievements.push(id);
    this.emit('achievementUnlocked', ach);
    this.emit('toast', `🏆 Trophy: ${ach.title}`);
  }

  // Update Settings locally and dispatch
  updateSetting(key, value) {
    this.settings[key] = value;
    this.emit('settingChanged', { key, value });
  }

  // Load state from local save
  loadFromSave(savedData) {
    if (savedData.settings) this.settings = { ...this.settings, ...savedData.settings };
    if (savedData.stats) {
      this.stats = { ...this.stats, ...savedData.stats };
      this.highScore = this.stats.highScore;
    }
    if (savedData.achievements) this.unlockedAchievements = [...savedData.achievements];
    
    this.emit('settingsLoaded', this.settings);
    this.emit('highScoreChange', this.highScore);
  }
}

// Single instance singleton
export const state = new GameStateManager();
