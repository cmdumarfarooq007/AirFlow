// Input Reach Space Calibration Manager
import { state } from '../state/gameState.js';

class CalibrationManager {
  constructor() {
    // Default raw tracker boundaries (normalized camera coords)
    this.bounds = {
      minX: 0.15,
      maxX: 0.85,
      minY: 0.15,
      maxY: 0.85
    };
    
    this.isCalibrating = false;
    this.step = 'TOP_LEFT'; // 'TOP_LEFT', 'BOTTOM_RIGHT', 'COMPLETE'
    this.stepProgress = 0; // 0 to 100%
    this.stabilizeTimer = 0;
    
    // Position samples container
    this.samples = [];
    
    // Bind updates
    state.on('positionUpdate', (pos) => this.handlePositionUpdate(pos));
  }

  startCalibration() {
    this.isCalibrating = true;
    this.step = 'TOP_LEFT';
    this.stepProgress = 0;
    this.samples = [];
    this.stabilizeTimer = 0;
    
    state.emit('calibrationStep', { step: this.step, progress: 0 });
  }

  skipCalibration() {
    // Reset to defaults
    this.bounds = {
      minX: 0.20,
      maxX: 0.80,
      minY: 0.20,
      maxY: 0.80
    };
    this.isCalibrating = false;
    this.step = 'COMPLETE';
    state.setState('MENU');
  }

  handlePositionUpdate({ rawX, rawY }) {
    if (!this.isCalibrating) return;

    // Collect raw tracking position samples
    this.samples.push({ x: rawX, y: rawY });
    
    // Keep last 15 frames for averaging
    if (this.samples.length > 15) {
      this.samples.shift();
    } else {
      return; // Wait for enough samples to stabilize
    }

    // Verify stability (variance)
    const avg = this.samples.reduce((acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y }), { x: 0, y: 0 });
    avg.x /= this.samples.length;
    avg.y /= this.samples.length;

    const variance = this.samples.reduce((acc, p) => acc + Math.hypot(p.x - avg.x, p.y - avg.y), 0) / this.samples.length;

    // If hand is stable (low variance), build calibration progress
    if (variance < 0.015) {
      this.stepProgress += 3.5; // Progress increment
      
      state.emit('calibrationStep', { 
        step: this.step, 
        progress: Math.min(100, Math.round(this.stepProgress)),
        handPos: { x: rawX, y: rawY }
      });

      if (this.stepProgress >= 100) {
        this.saveStepValue(avg.x, avg.y);
      }
    } else {
      // Degrade progress if hand is shaking/moving rapidly
      this.stepProgress = Math.max(0, this.stepProgress - 1.5);
      state.emit('calibrationStep', { 
        step: this.step, 
        progress: Math.round(this.stepProgress),
        handPos: { x: rawX, y: rawY }
      });
    }
  }

  saveStepValue(x, y) {
    this.samples = [];
    this.stepProgress = 0;

    if (this.step === 'TOP_LEFT') {
      // Save top-left raw values
      this.bounds.minX = x;
      this.bounds.minY = y;
      
      this.step = 'BOTTOM_RIGHT';
      state.emit('calibrationStep', { step: this.step, progress: 0 });
    } else if (this.step === 'BOTTOM_RIGHT') {
      // Save bottom-right raw values
      this.bounds.maxX = x;
      this.bounds.maxY = y;
      
      // Rectify bounds (min must be smaller than max)
      if (this.bounds.minX > this.bounds.maxX) {
        const temp = this.bounds.minX;
        this.bounds.minX = this.bounds.maxX;
        this.bounds.maxX = temp;
      }
      if (this.bounds.minY > this.bounds.maxY) {
        const temp = this.bounds.minY;
        this.bounds.minY = this.bounds.maxY;
        this.bounds.maxY = temp;
      }

      // Add a buffer boundary margin of 10%
      const width = this.bounds.maxX - this.bounds.minX;
      const height = this.bounds.maxY - this.bounds.minY;
      this.bounds.minX = Math.max(0, this.bounds.minX - width * 0.05);
      this.bounds.maxX = Math.min(1, this.bounds.maxX + width * 0.05);
      this.bounds.minY = Math.max(0, this.bounds.minY - height * 0.05);
      this.bounds.maxY = Math.min(1, this.bounds.maxY + height * 0.05);

      this.isCalibrating = false;
      this.step = 'COMPLETE';
      
      state.emit('toast', 'Calibration Successful!');
      state.setState('MENU');
    }
  }

  // Maps raw tracking coordinates (0-1) to game screen space (0-1)
  mapCoordinates(x, y) {
    let px = (x - this.bounds.minX) / (this.bounds.maxX - this.bounds.minX);
    let py = (y - this.bounds.minY) / (this.bounds.maxY - this.bounds.minY);
    
    // Clamp to boundaries
    px = Math.max(0, Math.min(1, px));
    py = Math.max(0, Math.min(1, py));
    
    // HandLandmarker coordinates has (0,0) in top-left.
    // In mirrored display, moving hand to left (raw x is higher since mirror) should map to left.
    // Let's ensure raw coordinates map properly.
    if (state.settings.leftHandedMode) {
      return { x: px, y: py };
    }
    
    // Default mirrored: raw X coordinate is inverted for natural mirroring control
    return { x: 1 - px, y: py };
  }
}

export const calibration = new CalibrationManager();
