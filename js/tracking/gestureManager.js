// Gesture Classification and Signal Smoothing Engine
import { CONFIG } from '../config.js';
import { state } from '../state/gameState.js';

// One Euro Filter implementation for high-quality coordinates smoothing
class OneEuroFilter {
  constructor(minCutoff = 1.0, beta = 0.05, dCutoff = 1.0) {
    this.minCutoff = minCutoff;
    this.beta = beta;
    this.dCutoff = dCutoff;
    
    this.xPrev = null;
    this.dxPrev = null;
    this.tPrev = null;
  }

  reset() {
    this.xPrev = null;
    this.dxPrev = null;
    this.tPrev = null;
  }

  filter(x, t) {
    if (this.tPrev === null) {
      this.xPrev = x;
      this.dxPrev = 0;
      this.tPrev = t;
      return x;
    }

    const dt = (t - this.tPrev) / 1000.0;
    if (dt <= 0) return this.xPrev;
    
    this.tPrev = t;

    // Estimate derivative
    const dx = (x - this.xPrev) / dt;
    const dAlpha = this.getAlpha(dt, this.dCutoff);
    const dxFiltered = this.dxPrev + dAlpha * (dx - this.dxPrev);
    this.dxPrev = dxFiltered;

    // Filter value
    const cutoff = this.minCutoff + this.beta * Math.abs(dxFiltered);
    const alpha = this.getAlpha(dt, cutoff);
    const xFiltered = this.xPrev + alpha * (x - this.xPrev);
    this.xPrev = xFiltered;

    return xFiltered;
  }

  getAlpha(dt, cutoff) {
    const tau = 1.0 / (2 * Math.PI * cutoff);
    return 1.0 / (1.0 + tau / dt);
  }
}

class GestureManager {
  constructor() {
    // 3D Filters for primary coordinates (wrist/hand center)
    this.filterX = new OneEuroFilter(CONFIG.tracking.filterMinCutoff, CONFIG.tracking.filterBeta, CONFIG.tracking.filterDcutoff);
    this.filterY = new OneEuroFilter(CONFIG.tracking.filterMinCutoff, CONFIG.tracking.filterBeta, CONFIG.tracking.filterDcutoff);
    
    // Position history for swipe tracking
    this.history = [];
    this.lastDashTime = 0;
    this.smoothedX = 0.5;
    this.smoothedY = 0.5;
    
    // Bind listeners
    state.on('trackingUpdate', (data) => this.update(data));
    state.on('trackingLost', () => this.handleTrackingLost());
    state.on('stateChange', ({ newState }) => {
      if (newState === 'PLAYING') this.resetFilters();
    });
  }

  resetFilters() {
    this.filterX.reset();
    this.filterY.reset();
    this.history = [];
    this.smoothedX = 0.5;
    this.smoothedY = 0.5;
  }

  handleTrackingLost() {
    state.setGesture('Open Palm'); // Fallback to default
  }

  // Update on each tracking frame
  update({ landmarks }) {
    const timestamp = performance.now();
    
    // 1. Smooth Hand Center Coordinates (Landmark 9 - Middle Finger MCP)
    const rawCenter = landmarks[9];
    this.smoothedX = this.filterX.filter(rawCenter.x, timestamp);
    this.smoothedY = this.filterY.filter(rawCenter.y, timestamp);

    // 2. Classify Gesture Shape
    const gesture = this.classifyHandShape(landmarks);
    state.setGesture(gesture);
    
    // 3. Track Swipe Gestures
    this.trackSwipe(this.smoothedX, this.smoothedY, timestamp);

    // 4. Emit smoothed tracking position
    state.emit('positionUpdate', {
      x: this.smoothedX,
      y: this.smoothedY,
      rawX: rawCenter.x,
      rawY: rawCenter.y
    });
  }

  // Calculate distance in 3D space
  getDistance(p1, p2) {
    return Math.hypot(p1.x - p2.x, p1.y - p2.y, p1.z - p2.z);
  }

  classifyHandShape(landmarks) {
    const wrist = landmarks[0];
    const thumbTip = landmarks[4];
    const indexTip = landmarks[8];
    const indexPip = landmarks[6];
    const middleTip = landmarks[12];
    const middlePip = landmarks[10];
    const ringTip = landmarks[16];
    const ringPip = landmarks[14];
    const pinkyTip = landmarks[20];
    const pinkyPip = landmarks[18];
    const pinkyMcp = landmarks[17];
    const thumbMcp = landmarks[2];

    // Rotation-invariant checks: Is finger tip further from wrist than its joint
    const isFingerExtended = (tip, pip) => {
      return this.getDistance(wrist, tip) > this.getDistance(wrist, pip) * 1.15;
    };

    const isIndex = isFingerExtended(indexTip, indexPip);
    const isMiddle = isFingerExtended(middleTip, middlePip);
    const isRing = isFingerExtended(ringTip, ringPip);
    const isPinky = isFingerExtended(pinkyTip, pinkyPip);
    
    // For thumb: extended if tip is far from pinky base knuckles (outer palm boundary)
    const isThumb = this.getDistance(thumbTip, pinkyMcp) > this.getDistance(thumbMcp, pinkyMcp) * 1.12;

    // --- Gesture Decision Tree ---

    // 1. Pinch Detection (Thumb tip close to Index tip)
    const indexThumbDist = this.getDistance(thumbTip, indexTip);
    if (indexThumbDist < CONFIG.tracking.pinchDistanceThreshold) {
      return 'Pinch'; // Active Magnet
    }

    // 2. Closed Fist (All 5 folded)
    if (!isIndex && !isMiddle && !isRing && !isPinky) {
      return 'Closed Fist'; // Active Precision
    }

    // 3. Two-Finger (Index and Middle extended, Ring and Pinky folded)
    if (isIndex && isMiddle && !isRing && !isPinky) {
      return 'Two-Finger'; // Active Shield
    }

    // 4. Three-Finger (Index, Middle, Ring extended, Pinky folded)
    if (isIndex && isMiddle && isRing && !isPinky) {
      return 'Three-Finger'; // Active Slow-mo
    }

    // 5. Open Palm (All extended)
    if (isIndex && isMiddle && isRing && isPinky) {
      return 'Open Palm'; // Normal flow
    }

    // Fallback default
    return 'Open Palm';
  }

  // Detect swipe velocity and trigger dash
  trackSwipe(x, y, timestamp) {
    this.history.push({ x, y, t: timestamp });
    
    // Keep sliding window size
    if (this.history.length > CONFIG.tracking.swipeFrameWindow) {
      this.history.shift();
    }
    
    if (this.history.length < CONFIG.tracking.swipeFrameWindow) return;
    
    const start = this.history[0];
    const end = this.history[this.history.length - 1];
    const dt = (end.t - start.t) / 1000.0; // In seconds
    
    if (dt <= 0) return;
    
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const velocity = Math.hypot(dx, dy) / dt; // screen width per second
    
    // Check if dash is available and speed exceeds threshold
    if (velocity > CONFIG.tracking.swipeVelocityThreshold * 150) {
      const now = Date.now();
      if (now - this.lastDashTime > CONFIG.tracking.gestureCooldown) {
        this.lastDashTime = now;
        
        // Determine Swipe Direction
        let direction = '';
        if (Math.abs(dx) > Math.abs(dy)) {
          // Since webcam mirrored:
          // Moving hand right = dx decrease in mirrored layout
          direction = dx > 0 ? 'LEFT' : 'RIGHT';
        } else {
          direction = dy > 0 ? 'DOWN' : 'UP';
        }
        
        state.emit('swipeDash', direction);
      }
    }
  }
}

export const gestureManager = new GestureManager();
export { OneEuroFilter };
