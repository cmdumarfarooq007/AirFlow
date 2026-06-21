// MediaPipe Hands and Camera Capture Manager
import { CONFIG } from '../config.js';
import { state } from '../state/gameState.js';

class HandTracker {
  constructor() {
    this.videoElement = null;
    this.canvasElement = null;
    this.canvasCtx = null;
    
    this.handLandmarker = null;
    this.wasmLoaded = false;
    this.active = false;
    this.stream = null;
    
    this.lastVideoTime = -1;
    this.trackingFps = 0;
    this.fpsLastTime = 0;
    this.fpsFrameCount = 0;
    
    // Joint connections for drawing hand skeletons (MediaPipe indexes)
    this.CONNECTIONS = [
      [0, 1], [1, 2], [2, 3], [3, 4], // Thumb
      [0, 5], [5, 6], [6, 7], [7, 8], // Index
      [5, 9], [9, 10], [10, 11], [11, 12], // Middle
      [9, 13], [13, 14], [14, 15], [15, 16], // Ring
      [13, 17], [17, 18], [18, 19], [19, 20], // Pinky
      [0, 17] // Palm Base
    ];
  }

  // Asynchronously bootstrap the MediaPipe HandLandmarker WASM files
  async initialize() {
    if (this.wasmLoaded) return;
    
    const statusMsg = document.getElementById('splash-status');
    
    try {
      if (statusMsg) statusMsg.textContent = "Loading WebAssembly Resolvers...";
      
      // Import MediaPipe Task Vision dependencies dynamically from CDN
      const visionModule = await import(
        /* webpackIgnore: true */
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.8/vision_bundle.mjs'
      );
      
      const { FilesetResolver, HandLandmarker } = visionModule;
      
      if (statusMsg) statusMsg.textContent = "Downloading AI Hand Tracker Model...";
      
      const vision = await FilesetResolver.forVisionTasks(CONFIG.tracking.wasmLoaderPath);
      
      this.handLandmarker = await HandLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: CONFIG.tracking.modelAssetPath,
          delegate: "GPU"
        },
        runningMode: "VIDEO",
        numHands: CONFIG.tracking.numHands,
        minHandDetectionConfidence: CONFIG.tracking.minDetectionConfidence,
        minHandPresenceConfidence: CONFIG.tracking.minPresenceConfidence,
        minHandTrackingConfidence: CONFIG.tracking.minTrackingConfidence
      });
      
      this.wasmLoaded = true;
      if (statusMsg) statusMsg.textContent = "Trackers Operational!";
      console.log("MediaPipe HandLandmarker loaded successfully.");
    } catch (error) {
      console.error("Critical error in MediaPipe Initialization:", error);
      if (statusMsg) {
        statusMsg.style.color = CONFIG.danger;
        statusMsg.textContent = "Initialization Failed. Network/WebGL issues.";
      }
      throw error;
    }
  }

  // Setup DOM elements and bind stream
  bindElements(videoSelector, canvasSelector) {
    this.videoElement = document.querySelector(videoSelector);
    this.canvasElement = document.querySelector(canvasSelector);
    if (this.canvasElement) {
      this.canvasCtx = this.canvasElement.getContext('2d');
    }
  }

  // Request camera and start capturing stream
  async startCamera() {
    if (!this.wasmLoaded) await this.initialize();
    
    if (this.stream) return;
    
    const constraints = {
      video: {
        width: { ideal: 640 },
        height: { ideal: 480 },
        facingMode: "user", // Front camera
        frameRate: { ideal: 30 }
      },
      audio: false
    };

    try {
      this.stream = await navigator.mediaDevices.getUserMedia(constraints);
      if (this.videoElement) {
        this.videoElement.srcObject = this.stream;
        // Wait for video metadata to play
        await new Promise((resolve) => {
          this.videoElement.onloadedmetadata = () => {
            this.videoElement.play();
            resolve();
          };
        });
        
        // Resize visual feedback canvas matching camera aspect
        if (this.canvasElement) {
          this.canvasElement.width = this.videoElement.videoWidth;
          this.canvasElement.height = this.videoElement.videoHeight;
        }
      }
      
      this.active = true;
      this.startTrackingLoop();
      console.log("Webcam feeds linked successfully.");
      
      const badge = document.getElementById('menu-tracking-status');
      if (badge) {
        badge.className = "badge badge-success";
        badge.textContent = "Camera Connected";
      }
    } catch (err) {
      console.error("Camera access denied or unavailable:", err);
      const badge = document.getElementById('menu-tracking-status');
      if (badge) {
        badge.className = "badge badge-warning";
        badge.textContent = "Mouse/Touch Control";
      }
      throw err;
    }
  }

  // Stop camera capturing
  stopCamera() {
    this.active = false;
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }
    if (this.videoElement) {
      this.videoElement.srcObject = null;
    }
    console.log("Webcam streams closed.");
  }

  // The tracking execution loop
  startTrackingLoop() {
    const run = async () => {
      if (!this.active) return;
      
      if (this.videoElement && this.videoElement.readyState >= 2) {
        const timestamp = performance.now();
        
        // Only trigger landmarker if we have a fresh new video frame
        if (this.videoElement.currentTime !== this.lastVideoTime) {
          this.lastVideoTime = this.videoElement.currentTime;
          
          try {
            const results = this.handLandmarker.detectForVideo(this.videoElement, timestamp);
            
            // Calculate model inference FPS
            this.calculateFps(timestamp);
            
            // Pass results to game controllers
            this.processTrackingResults(results);
          } catch (e) {
            console.error("Inference failure in tracking loop:", e);
          }
        }
      }
      
      requestAnimationFrame(run);
    };
    
    requestAnimationFrame(run);
  }

  // Smooth FPS calculations
  calculateFps(now) {
    this.fpsFrameCount++;
    if (now - this.fpsLastTime >= 1000) {
      this.trackingFps = Math.round((this.fpsFrameCount * 1000) / (now - this.fpsLastTime));
      this.fpsFrameCount = 0;
      this.fpsLastTime = now;
      
      const fpsBadge = document.getElementById('tracking-fps');
      if (fpsBadge) {
        fpsBadge.textContent = `FPS: ${this.trackingFps}`;
      }
    }
  }

  // Dispatch results and draw landmarks on HUD preview
  processTrackingResults(results) {
    const hasHand = results.landmarks && results.landmarks.length > 0;
    
    // Clear HUD landmark drawing canvas
    if (this.canvasCtx) {
      this.canvasCtx.clearRect(0, 0, this.canvasElement.width, this.canvasElement.height);
    }
    
    if (hasHand) {
      const landmarks = results.landmarks[0]; // Process dominant hand
      
      // Draw wireframe overlay in preview box
      if (this.canvasCtx && state.settings.graphicsQuality !== 'low') {
        this.drawSkeletalWireframe(landmarks);
      }
      
      // Emit tracking data for gestureManager and calibration
      state.emit('trackingUpdate', {
        landmarks,
        handedness: results.handedness ? results.handedness[0] : null
      });
    } else {
      state.emit('trackingLost');
    }
  }

  // Skeleton UI rendering logic
  drawSkeletalWireframe(landmarks) {
    const ctx = this.canvasCtx;
    const w = this.canvasElement.width;
    const h = this.canvasElement.height;
    
    ctx.lineWidth = 3;
    ctx.strokeStyle = state.settings.colorblindMode ? '#ffaa00' : '#00f0ff';
    ctx.shadowBlur = 8;
    ctx.shadowColor = ctx.strokeStyle;

    // Draw joints lines
    this.CONNECTIONS.forEach(([start, end]) => {
      const pt1 = landmarks[start];
      const pt2 = landmarks[end];
      
      ctx.beginPath();
      ctx.moveTo(pt1.x * w, pt1.y * h);
      ctx.lineTo(pt2.x * w, pt2.y * h);
      ctx.stroke();
    });

    // Draw joint nodes
    ctx.shadowBlur = 4;
    ctx.fillStyle = '#ffffff';
    landmarks.forEach((pt) => {
      ctx.beginPath();
      ctx.arc(pt.x * w, pt.y * h, 4, 0, 2 * Math.PI);
      ctx.fill();
    });
    
    // Reset shadow properties for next cycles
    ctx.shadowBlur = 0;
  }
}

export const handTracker = new HandTracker();
