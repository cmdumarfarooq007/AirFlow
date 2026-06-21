// LocalStorage Save & Stats Persistence System
import { CONFIG } from '../config.js';
import { state } from './gameState.js';

const SAVE_KEY = 'airflow_game_profile_v1';

class SaveSystem {
  constructor() {
    this.saveData = {
      settings: { ...CONFIG.defaults.settings },
      stats: { ...CONFIG.defaults.stats },
      achievements: []
    };
  }

  // Load profile from LocalStorage
  load() {
    try {
      const stored = localStorage.getItem(SAVE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        this.saveData = {
          settings: { ...CONFIG.defaults.settings, ...parsed.settings },
          stats: { ...CONFIG.defaults.stats, ...parsed.stats },
          achievements: parsed.achievements || []
        };
      } else {
        this.saveData = {
          settings: { ...CONFIG.defaults.settings },
          stats: { ...CONFIG.defaults.stats },
          achievements: []
        };
      }
      
      // Inject loaded values into global gameState
      state.loadFromSave(this.saveData);
      return this.saveData;
    } catch (e) {
      console.error('Failed to load save profile:', e);
      return this.saveData;
    }
  }

  // Save current gameState values back to storage
  save() {
    try {
      this.saveData.settings = { ...state.settings };
      this.saveData.stats = { ...state.stats };
      this.saveData.achievements = [ ...state.unlockedAchievements ];
      
      // Ensure high score is synchronized
      if (state.score > this.saveData.stats.highScore) {
        this.saveData.stats.highScore = state.score;
      }
      
      localStorage.setItem(SAVE_KEY, JSON.stringify(this.saveData));
    } catch (e) {
      console.error('Failed to write save profile:', e);
    }
  }

  // Sync settings when they change in the UI
  saveSettings() {
    this.saveData.settings = { ...state.settings };
    this.save();
  }

  // Add stats from the current completed run
  recordCompletedRun(score, distance, gemsCollected) {
    this.saveData.stats.gamesPlayed += 1;
    this.saveData.stats.totalDistance += Math.round(distance);
    this.saveData.stats.fragmentsCollected += gemsCollected;
    
    if (score > this.saveData.stats.highScore) {
      this.saveData.stats.highScore = score;
    }
    
    // Sync into gameState stats
    state.stats = { ...this.saveData.stats };
    state.highScore = this.saveData.stats.highScore;
    
    this.save();
  }

  // Record active play time duration
  addPlayTime(seconds) {
    this.saveData.stats.timePlayed += Math.round(seconds);
    state.stats.timePlayed = this.saveData.stats.timePlayed;
    this.save();
  }

  // Clear all data
  resetProgress() {
    this.saveData = {
      settings: { ...CONFIG.defaults.settings },
      stats: { ...CONFIG.defaults.stats },
      achievements: []
    };
    localStorage.removeItem(SAVE_KEY);
    state.loadFromSave(this.saveData);
  }
}

export const saveSystem = new SaveSystem();
