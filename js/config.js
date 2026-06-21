// AirFlow Configuration Constants

export const CONFIG = {
  // Game Physics & Dynamics
  game: {
    baseSpeed: 3.5,            // Starting scroll speed (pixels per frame at 60fps)
    maxSpeed: 10.0,            // Speed limit after scaling
    speedIncreaseRate: 0.0005,  // Speed increase increment per game frame
    gravity: 0.0,             // Space-like fluid mechanics
    friction: 0.92,            // Movement dampening for mouse/orb movement
    orbRadius: 18,             // Default radius of the player orb
    obstacleSpawnInterval: 1800,// Milliseconds between obstacles
    fragmentSpawnInterval: 450, // Milliseconds between fragment spawns
    difficultyIncreaseInterval: 10000, // Speed scales up every 10 seconds
    baseEnergy: 100,           // Starting energy
    energyDepleteRate: 0.04,   // Default health drain per frame
    hitDamage: 25,             // Damage taken on obstacle collision
    gemEnergyGain: 8,          // Energy recovered per gem collected
  },

  // Hand Tracking & Gesture Recognition Thresholds
  tracking: {
    // Model URL pointing to the float16 model
    modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',
    wasmLoaderPath: 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.8/wasm',
    
    // Detection Options
    numHands: 1,               // Single hand tracking for lower resource consumption
    minDetectionConfidence: 0.5,
    minPresenceConfidence: 0.5,
    minTrackingConfidence: 0.5,
    
    // Gesture Thresholds
    pinchDistanceThreshold: 0.04,  // Distance between thumb and index tips
    fistDistanceRatio: 1.15,      // Ratio of tip-wrist distance to PIP-wrist distance
    swipeVelocityThreshold: 0.025, // Minimum normalized speed to trigger a dash
    swipeFrameWindow: 4,          // Number of historic frames tracked to detect swipe
    gestureCooldown: 600,         // Cooldown between dashes in milliseconds
    
    // One Euro Filter Defaults
    filterMinCutoff: 1.0,         // Hz (Lower = smoother at rest, higher = less lag)
    filterBeta: 0.05,             // Velocity coefficient (Higher = less lag at high speeds)
    filterDcutoff: 1.0,           // Hz
  },

  // Save System Defaults
  defaults: {
    settings: {
      volumeMusic: 0.6,
      volumeSfx: 0.7,
      sensitivity: 1.5,
      graphicsQuality: 'medium', // 'low', 'medium', 'high'
      colorblindMode: false,
      leftHandedMode: false,
      reducedMotion: false
    },
    stats: {
      highScore: 0,
      totalDistance: 0,
      fragmentsCollected: 0,
      timePlayed: 0, // In seconds
      gamesPlayed: 0
    }
  },

  // Achievements Definition List
  achievements: [
    { id: 'first_flight', title: 'First Flight', desc: 'Conclude your first flight session.', icon: '🚀' },
    { id: 'centurion', title: 'Centurion', desc: 'Reach a score of 100,000 points.', icon: '💯' },
    { id: 'magnet_master', title: 'Magnet Master', desc: 'Collect 100 energy fragments in a single game using Magnet Pinch.', icon: '🧲' },
    { id: 'shield_wall', title: 'Shield Deflector', desc: 'Survive an obstacle collision using the Two-Finger Shield.', icon: '🛡️' },
    { id: 'chrono_dancer', title: 'Chrono Dancer', desc: 'Evade 5 obstacles while Slow Motion is active.', icon: '🌀' },
    { id: 'grandmaster', title: 'Grandmaster', desc: 'Perform all 5 distinct gestures in a single game.', icon: '👑' },
    { id: 'untouchable', title: 'Untouchable', desc: 'Achieve a 15x Combo Multiplier.', icon: '⚡' },
    { id: 'clean_sweep', title: 'Dashing Pilot', desc: 'Perform 10 Swipe Dashes in a single flight.', icon: '💨' }
  ]
};
