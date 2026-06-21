// Unified Input System (Camera Tracking + Mouse/Touch Fallback)
import { state } from '../state/gameState.js';
import { calibration } from '../tracking/calibration.js';

class InputManager {
  constructor() {
    this.canvas = null;
    
    // Normalized coordinates (0 to 1)
    this.x = 0.5;
    this.y = 0.7;
    
    this.isTracking = false;
    this.fallbackActive = false;
    
    // Bind hand tracking position updates
    state.on('positionUpdate', (pos) => this.handleTrackingUpdate(pos));
    state.on('trackingLost', () => {
      this.isTracking = false;
    });
  }

  init(canvasElement) {
    this.canvas = canvasElement;
    this.setupFallbackListeners();
  }

  // Camera tracking input
  handleTrackingUpdate({ x, y }) {
    this.isTracking = true;
    this.fallbackActive = false;
    
    // Map calibration coordinates
    const mapped = calibration.mapCoordinates(x, y);
    
    this.x = mapped.x;
    this.y = mapped.y;
    
    state.emit('inputMove', { x: this.x, y: this.y });
  }

  // Setup mouse and touch listeners for fallback control
  setupFallbackListeners() {
    if (!this.canvas) return;

    const handlePointer = (clientX, clientY) => {
      if (this.isTracking) return; // Prioritize camera tracking
      
      this.fallbackActive = true;
      const rect = this.canvas.getBoundingClientRect();
      
      // Calculate normalized positions
      let px = (clientX - rect.left) / rect.width;
      let py = (clientY - rect.top) / rect.height;
      
      // Clamp coordinates
      this.x = Math.max(0, Math.min(1, px));
      this.y = Math.max(0, Math.min(1, py));
      
      state.emit('inputMove', { x: this.x, y: this.y });
    };

    // Mouse Move
    window.addEventListener('mousemove', (e) => {
      if (state.currentState !== 'PLAYING') return;
      handlePointer(e.clientX, e.clientY);
    });

    // Touch Support
    window.addEventListener('touchmove', (e) => {
      if (state.currentState !== 'PLAYING') return;
      if (e.touches.length > 0) {
        handlePointer(e.touches[0].clientX, e.touches[0].clientY);
      }
      e.preventDefault(); // Stop mobile scrolling
    }, { passive: false });

    // Handle touch/click triggers for capabilities (e.g. clicking can act as gesture activates for testing)
    window.addEventListener('mousedown', (e) => {
      if (state.currentState !== 'PLAYING' || this.isTracking) return;
      
      // Left click = Pinch (Magnet)
      // Right click = Victory (Shield)
      if (e.button === 0) {
        state.setGesture('Pinch');
      } else if (e.button === 2) {
        state.setGesture('Two-Finger');
      }
    });

    window.addEventListener('mouseup', () => {
      if (state.currentState !== 'PLAYING' || this.isTracking) return;
      state.setGesture('Open Palm');
    });

    // Disable right click menu in game to allow shield binds
    window.addEventListener('contextmenu', (e) => {
      if (state.currentState === 'PLAYING') {
        e.preventDefault();
      }
    });
  }

  // Get coordinates scaled to canvas width/height
  getScaledPosition(width, height) {
    // Left-handed mode flips visual positioning
    return {
      x: this.x * width,
      y: this.y * height
    };
  }
}

export const input = new InputManager();
