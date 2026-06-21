// Main Entry Point, UI Event Bindings, Screen Routing & Bootstrapper
import { CONFIG } from './config.js';
import { state } from './state/gameState.js';
import { saveSystem } from './state/saveSystem.js';
import { handTracker } from './tracking/handTracker.js';
import { gestureManager } from './tracking/gestureManager.js';
import { calibration } from './tracking/calibration.js';
import { input } from './engine/input.js';
import { audio } from './engine/audio.js';
import { gameEngine } from './engine/gameEngine.js';
import { renderer } from './engine/renderer.js';

class AppController {
  constructor() {
    this.domScreens = {};
    this.playTimeTrackerInterval = null;
  }

  async init() {
    // 1. Load profiles and settings from Save System
    saveSystem.load();

    // 2. Setup DOM screen bindings
    this.cacheDomElements();
    this.setupEventListeners();
    this.setupStateSubscriptions();

    // 3. Initialize Renderer Canvas and inputs fallbacks
    const canvas = document.getElementById('game-canvas');
    renderer.init(canvas);
    input.init(canvas);

    // Bind hand tracker camera preview elements
    handTracker.bindElements('#webcam', '#landmark-canvas');

    // 4. Preload MediaPipe WASM and update Loader status
    try {
      await handTracker.initialize();
      // Shift from SPLASH to CAMERA PERMISSION request screen
      state.setState('PERMISSION');
    } catch (e) {
      console.error("Initialization issue, loading mouse-fallback mode:", e);
      state.setState('PERMISSION');
      
      const splashStatus = document.getElementById('splash-status');
      if (splashStatus) {
        splashStatus.textContent = "Tracker Loading Failed. Camera input unavailable.";
      }
    }

    // 5. Build Achievements DOM grid
    this.buildAchievementsUI();

    // 6. Launch lifetime play session timer
    this.startSessionTimer();
  }

  cacheDomElements() {
    // Collect screen sections
    const screens = ['splash', 'permission', 'calibration', 'menu', 'settings', 'stats', 'leaderboard', 'pause', 'gameover'];
    screens.forEach(s => {
      this.domScreens[s] = document.getElementById(`screen-${s}`);
    });

    // HUD overlays
    this.hudElement = document.getElementById('game-hud');
  }

  setupEventListeners() {
    // --- 1. Camera Permissions & Fallbacks ---
    document.getElementById('btn-request-permission').addEventListener('click', async () => {
      audio.init(); // Initialize audio context on first interaction
      audio.playMenuClick();
      
      try {
        await handTracker.startCamera();
        state.setState('CALIBRATION');
        calibration.startCalibration();
      } catch (err) {
        state.emit('toast', 'Webcam inaccessible. Reverting to mouse control.');
        state.setState('MENU');
      }
    });

    document.getElementById('btn-fallback-input').addEventListener('click', () => {
      audio.init();
      audio.playMenuClick();
      state.setState('MENU');
      state.emit('toast', 'Mouse/Touch Controls Active');
    });

    // --- 2. Calibration Screen ---
    document.getElementById('btn-skip-calibration').addEventListener('click', () => {
      audio.playMenuClick();
      calibration.skipCalibration();
    });

    // --- 3. Main Menu Navigation ---
    document.getElementById('btn-start-game').addEventListener('click', () => {
      audio.playMenuClick();
      audio.resume();
      state.setState('PLAYING');
    });

    document.getElementById('btn-open-settings').addEventListener('click', () => {
      audio.playMenuClick();
      state.setState('SETTINGS');
    });

    document.getElementById('btn-open-stats').addEventListener('click', () => {
      audio.playMenuClick();
      this.buildStatsUI();
      state.setState('STATS');
    });

    document.getElementById('btn-open-leaderboard').addEventListener('click', () => {
      audio.playMenuClick();
      this.buildLeaderboardsUI();
      state.setState('LEADERBOARD');
    });

    // --- 4. Settings Updates ---
    document.getElementById('btn-settings-back').addEventListener('click', () => {
      audio.playMenuClick();
      saveSystem.saveSettings();
      state.setState('MENU');
    });

    // Binding settings selectors & sliders
    const musicSlider = document.getElementById('slider-music');
    const musicVal = document.getElementById('val-music');
    musicSlider.addEventListener('input', (e) => {
      const val = parseInt(e.target.value);
      musicVal.textContent = `${val}%`;
      state.updateSetting('volumeMusic', val);
    });

    const sfxSlider = document.getElementById('slider-sfx');
    const sfxVal = document.getElementById('val-sfx');
    sfxSlider.addEventListener('input', (e) => {
      const val = parseInt(e.target.value);
      sfxVal.textContent = `${val}%`;
      state.updateSetting('volumeSfx', val);
    });

    const sensSlider = document.getElementById('slider-sensitivity');
    const sensVal = document.getElementById('val-sensitivity');
    sensSlider.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value) / 10;
      sensVal.textContent = `${val.toFixed(1)}x`;
      state.updateSetting('sensitivity', val);
    });

    // Quality buttons
    document.querySelectorAll('#quality-selector .btn-toggle').forEach(btn => {
      btn.addEventListener('click', (e) => {
        audio.playMenuClick();
        const quality = e.target.dataset.quality;
        document.querySelectorAll('#quality-selector .btn-toggle').forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        state.updateSetting('graphicsQuality', quality);
      });
    });

    // Accessibility Switches
    const colorblindSwitch = document.getElementById('toggle-colorblind');
    colorblindSwitch.addEventListener('change', (e) => {
      state.updateSetting('colorblindMode', e.target.checked);
      document.getElementById('app').className = e.target.checked ? 'theme-highcontrast' : 'theme-default';
    });

    const leftHandedSwitch = document.getElementById('toggle-left-handed');
    leftHandedSwitch.addEventListener('change', (e) => {
      state.updateSetting('leftHandedMode', e.target.checked);
      document.getElementById('game-hud').classList.toggle('flipped-hud', e.target.checked);
    });

    const reducedMotionSwitch = document.getElementById('toggle-reduced-motion');
    reducedMotionSwitch.addEventListener('change', (e) => {
      state.updateSetting('reducedMotion', e.target.checked);
    });

    // --- 5. Stats Tab Switching ---
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        audio.playMenuClick();
        const tab = e.target.dataset.tab;
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        e.target.classList.add('active');
        document.getElementById(tab).classList.add('active');
      });
    });

    document.getElementById('btn-stats-back').addEventListener('click', () => {
      audio.playMenuClick();
      state.setState('MENU');
    });

    document.getElementById('btn-leaderboard-back').addEventListener('click', () => {
      audio.playMenuClick();
      state.setState('MENU');
    });

    // --- 6. HUD elements ---
    document.getElementById('btn-hud-pause').addEventListener('click', () => {
      audio.playMenuClick();
      state.setState('PAUSED');
    });

    // --- 7. Pause Controls ---
    document.getElementById('btn-pause-resume').addEventListener('click', () => {
      audio.playMenuClick();
      state.setState('PLAYING');
    });

    document.getElementById('btn-pause-restart').addEventListener('click', () => {
      audio.playMenuClick();
      state.setState('PLAYING');
    });

    document.getElementById('btn-pause-settings').addEventListener('click', () => {
      audio.playMenuClick();
      state.setState('SETTINGS'); // Settings back button will return to MENU, but we hook it to track lastState
    });

    document.getElementById('btn-pause-quit').addEventListener('click', () => {
      audio.playMenuClick();
      state.setState('MENU');
    });

    // --- 8. Game Over Screen ---
    document.getElementById('btn-go-retry').addEventListener('click', () => {
      audio.playMenuClick();
      
      // Save pilot name to leaderboards if entered
      this.recordLeaderboardEntry();
      
      state.setState('PLAYING');
    });

    document.getElementById('btn-go-menu').addEventListener('click', () => {
      audio.playMenuClick();
      
      // Save pilot name to leaderboards if entered
      this.recordLeaderboardEntry();
      
      state.setState('MENU');
    });

    // COLLAPSIBLE camera tracker feed overlay toggle
    document.getElementById('btn-toggle-preview').addEventListener('click', (e) => {
      const card = document.getElementById('tracking-preview-card');
      card.classList.toggle('collapsed');
      e.target.textContent = card.classList.contains('collapsed') ? '▲' : '▼';
    });
  }

  setupStateSubscriptions() {
    // Update active screens on state transitions
    state.on('stateChange', ({ oldState, newState }) => {
      // Hide all overlays
      Object.keys(this.domScreens).forEach(key => {
        this.domScreens[key].classList.remove('active');
      });
      
      // Activate specific layout
      const key = newState.toLowerCase();
      if (this.domScreens[key]) {
        this.domScreens[key].classList.add('active');
      }

      // Hide or show HUD overlay
      if (newState === 'PLAYING' || newState === 'PAUSED') {
        this.hudElement.classList.add('active');
      } else {
        this.hudElement.classList.remove('active');
      }

      // Music trigger controls
      if (newState === 'PLAYING') {
        audio.startMusic();
      } else if (newState !== 'PAUSED') {
        audio.stopMusic();
      }

      // Sync settings panel inputs with current variables if navigating there
      if (newState === 'SETTINGS') {
        this.syncSettingsUI();
      }

      // Record achievements unlocked at GameOver state
      if (newState === 'GAMEOVER') {
        audio.playDamage(); // Bass sweep
        
        // Save current flight metrics
        saveSystem.recordCompletedRun(state.score, state.distance, state.magnetCollectedCount);
        
        // Check final score achievements
        if (state.score >= 100000) state.unlockAchievement('centurion');
        
        // Unlocked first session achievement
        state.unlockAchievement('first_flight');
        
        // Update Game Over display texts
        document.getElementById('go-score').textContent = Math.round(state.score).toLocaleString();
        document.getElementById('go-distance').textContent = `${Math.round(state.distance)}m`;
        document.getElementById('go-combo').textContent = `x${state.multiplier.toFixed(1)}`;
        
        // Display new high score badge if score topped high score
        const newRecordTag = document.getElementById('new-high-score-tag');
        if (state.score >= state.highScore && state.score > 0) {
          newRecordTag.classList.remove('hidden');
        } else {
          newRecordTag.classList.add('hidden');
        }
      }
    });

    // Update HUD labels on score events
    const scoreVal = document.getElementById('hud-score');
    state.on('scoreChange', (val) => {
      scoreVal.textContent = Math.round(val).toLocaleString('en-US', { minimumIntegerDigits: 6, useGrouping: true });
    });

    // Energy meter updating
    const energyFill = document.getElementById('hud-energy-bar');
    state.on('energyChange', (val) => {
      energyFill.style.width = `${val}%`;
      if (val < 25) {
        energyFill.style.background = CONFIG.danger;
      } else {
        energyFill.style.background = `linear-gradient(90deg, var(--cyan) 0%, var(--purple) 100%)`;
      }
    });

    // Multiplier meters updating
    const multVal = document.getElementById('hud-multiplier');
    const multProgress = document.getElementById('hud-multiplier-progress');
    state.on('multiplierChange', ({ multiplier, progress }) => {
      multVal.textContent = `x${multiplier.toFixed(1)}`;
      multProgress.style.width = `${progress}%`;
    });

    // Active power-up indicators HUD updates
    state.on('abilityTrigger', ({ name, duration }) => {
      const activeDiv = document.getElementById('hud-active-ability');
      const iconSpan = document.getElementById('ability-icon');
      const nameSpan = document.getElementById('ability-name');
      const timerSpan = document.getElementById('ability-timer');
      
      activeDiv.classList.remove('hidden');
      nameSpan.textContent = name.toUpperCase();
      
      if (name === 'magnet') iconSpan.textContent = '🔮';
      else if (name === 'shield') iconSpan.textContent = '🛡️';
      else if (name === 'slowMo') iconSpan.textContent = '🌀';
      
      // Update Timer countdown overlay in real-time
      const updateTimerDisplay = () => {
        let isExpired = false;
        let pct = 0;

        if (name === 'shield') {
          isExpired = state.shieldTimer <= 0;
          pct = Math.round((state.shieldTimer / state.shieldDuration) * 100);
        } else if (name === 'slowMo') {
          isExpired = state.slowMoTimer <= 0;
          pct = Math.round((state.slowMoTimer / state.slowMoDuration) * 100);
        } else if (name === 'magnet') {
          isExpired = state.magnetTimer <= 0;
          pct = Math.round((state.magnetTimer / 8000) * 100);
        }

        if (isExpired) {
          activeDiv.classList.add('hidden');
          return;
        }
        
        timerSpan.textContent = `${pct}%`;
        requestAnimationFrame(updateTimerDisplay);
      };
      
      requestAnimationFrame(updateTimerDisplay);
    });

    // Show floating notifications in HUD (Shield active, Combo Lost)
    state.on('toast', (msg) => {
      this.showToast(msg);
    });

    // Setup Gesture Text badges overlay updates
    const badge = document.getElementById('tracking-gesture-name');
    state.on('gestureChange', ({ newGesture }) => {
      badge.textContent = newGesture;
      
      // Trigger special triggers linked to gestures
      if (state.currentState === 'PLAYING') {
        if (newGesture === 'Pinch') {
          state.triggerAbility('magnet');
        } else if (newGesture === 'Two-Finger') {
          state.triggerAbility('shield');
        } else if (newGesture === 'Three-Finger') {
          state.triggerAbility('slowMo');
        }
      }
    });

    // Calibration markers update loop
    const calibMarker = document.getElementById('calib-target');
    const calibIndicator = document.getElementById('calib-hand-indicator');
    const calibInstruction = document.getElementById('calib-instruction');
    const calibProgress = document.getElementById('calibration-progress');
    
    state.on('calibrationStep', ({ step, progress, handPos }) => {
      // Position targets visually
      calibMarker.className = `calib-marker active ${step.toLowerCase().replace('_', '-')}`;
      
      if (step === 'TOP_LEFT') {
        calibInstruction.textContent = "Hold your hand still in the TOP-LEFT Reach limit";
      } else if (step === 'BOTTOM_RIGHT') {
        calibInstruction.textContent = "Hold your hand still in the BOTTOM-RIGHT Reach limit";
      }
      
      calibProgress.style.width = `${progress}%`;

      if (handPos) {
        calibIndicator.classList.add('visible');
        calibIndicator.style.left = `${handPos.x * 100}%`;
        calibIndicator.style.top = `${handPos.y * 100}%`;
      } else {
        calibIndicator.classList.remove('visible');
      }
    });
  }

  showToast(msg) {
    const toast = document.getElementById('hud-toast');
    toast.textContent = msg;
    toast.classList.remove('hidden');
    
    // Clear and reset CSS animation trigger
    toast.style.animation = 'none';
    void toast.offsetWidth; // trigger reflow
    toast.style.animation = 'toastFade 2.5s forwards';
    
    setTimeout(() => {
      toast.classList.add('hidden');
    }, 2500);
  }

  syncSettingsUI() {
    document.getElementById('slider-music').value = state.settings.volumeMusic;
    document.getElementById('val-music').textContent = `${state.settings.volumeMusic}%`;

    document.getElementById('slider-sfx').value = state.settings.volumeSfx;
    document.getElementById('val-sfx').textContent = `${state.settings.volumeSfx}%`;

    document.getElementById('slider-sensitivity').value = state.settings.sensitivity * 10;
    document.getElementById('val-sensitivity').textContent = `${state.settings.sensitivity.toFixed(1)}x`;

    // Quality buttons active class
    document.querySelectorAll('#quality-selector .btn-toggle').forEach(b => {
      b.classList.toggle('active', b.dataset.quality === state.settings.graphicsQuality);
    });

    document.getElementById('toggle-colorblind').checked = state.settings.colorblindMode;
    document.getElementById('toggle-left-handed').checked = state.settings.leftHandedMode;
    document.getElementById('toggle-reduced-motion').checked = state.settings.reducedMotion;
  }

  // --- Statistics dashboard & Achievements ---
  buildStatsUI() {
    document.getElementById('stat-high-score').textContent = Math.round(state.stats.highScore).toLocaleString();
    document.getElementById('stat-total-distance').textContent = `${Math.round(state.stats.totalDistance).toLocaleString()}m`;
    document.getElementById('stat-fragments-collected').textContent = state.stats.fragmentsCollected.toLocaleString();
    
    // Build hours:minutes display
    const mins = Math.floor(state.stats.timePlayed / 60);
    const hrs = Math.floor(mins / 60);
    const remainingMins = mins % 60;
    document.getElementById('stat-time-played').textContent = `${hrs}h ${remainingMins}m`;

    // Rebuild Achievements locked/unlocked classes
    CONFIG.achievements.forEach(ach => {
      const card = document.getElementById(`ach-card-${ach.id}`);
      if (card) {
        const isUnlocked = state.unlockedAchievements.includes(ach.id);
        card.className = `achievement-item ${isUnlocked ? 'unlocked' : ''}`;
      }
    });
  }

  buildAchievementsUI() {
    const list = document.getElementById('achievements-list');
    list.innerHTML = '';
    
    CONFIG.achievements.forEach(ach => {
      const div = document.createElement('div');
      div.id = `ach-card-${ach.id}`;
      div.className = 'achievement-item';
      
      div.innerHTML = `
        <div class="ach-icon-box">${ach.icon}</div>
        <div class="ach-info">
          <span class="ach-title">${ach.title}</span>
          <span class="ach-desc">${ach.desc}</span>
        </div>
      `;
      
      list.appendChild(div);
    });
  }

  // --- Leaderboards Management ---
  buildLeaderboardsUI() {
    const body = document.getElementById('leaderboard-body');
    body.innerHTML = '';
    
    const records = this.getLeaderboardRecords();
    
    if (records.length === 0) {
      body.innerHTML = `<tr><td colspan="4" style="text-align: center; color: var(--silver);">No flights recorded yet. Start a journey!</td></tr>`;
      return;
    }

    records.forEach((rec, index) => {
      const tr = document.createElement('tr');
      
      // Top 3 trophy decoration
      let rankText = `${index + 1}`;
      if (index === 0) rankText = '🥇';
      else if (index === 1) rankText = '🥈';
      else if (index === 2) rankText = '🥉';
      
      tr.innerHTML = `
        <td>${rankText}</td>
        <td><strong>${rec.name}</strong></td>
        <td>${Math.round(rec.score).toLocaleString()}</td>
        <td>x${rec.combo.toFixed(1)}</td>
      `;
      body.appendChild(tr);
    });
  }

  getLeaderboardRecords() {
    try {
      const records = localStorage.getItem('airflow_leaderboard_v1');
      return records ? JSON.parse(records) : [];
    } catch(e) {
      return [];
    }
  }

  recordLeaderboardEntry() {
    const inputField = document.getElementById('player-name-input');
    const pilotName = (inputField.value || 'PIL').trim().toUpperCase().substring(0, 3);
    
    const record = {
      name: pilotName,
      score: state.score,
      combo: state.multiplier,
      timestamp: Date.now()
    };

    try {
      const list = this.getLeaderboardRecords();
      list.push(record);
      // Sort descending by score
      list.sort((a, b) => b.score - a.score);
      // Keep top 10
      const clampedList = list.slice(0, 10);
      localStorage.setItem('airflow_leaderboard_v1', JSON.stringify(clampedList));
    } catch(e) {
      console.error('Failed to write leaderboard records:', e);
    }
  }

  // --- Lifetime session timers ---
  startSessionTimer() {
    let lastTick = Date.now();
    
    setInterval(() => {
      const now = Date.now();
      const delta = (now - lastTick) / 1000;
      lastTick = now;
      
      if (state.currentState === 'PLAYING') {
        saveSystem.addPlayTime(delta);
      }
    }, 1000);
  }
}

// Instantiate controller and bootstrap
const app = new AppController();
window.addEventListener('DOMContentLoaded', () => {
  app.init();
});
