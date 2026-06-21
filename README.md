# AirFlow

An elegant, browser-based hand-controlled obstacle navigation and collection game. Powered by real-time hand landmark computer vision and procedural Web Audio synthesis.

AirFlow combines premium Apple-inspired minimalist visual aesthetics with state-of-the-art browser tracking, targeting a stable **90 FPS** on capable high-refresh-rate hardware and **60 FPS** on standard mobile/desktop devices.

🔗 **Live Demo**: [airflow-hand.vercel.app](https://airflow-hand.vercel.app)


---

## 🌟 Key Features

*   **Real-time Camera Hand Tracking**: Links with webcams to trace full 21-point 3D hand coordinates. Utilizes Google MediaPipe Tasks-Vision running on WebAssembly with hardware-accelerated WebGL delegates.
*   **One Euro Adaptive Smoothing Filter**: Implements a first-order low-pass filter with adaptive cutoff frequencies. At rest, it filters aggressively to remove tracking jitter and hand-shake; at high speeds, it bypasses filtering to minimize latency below **20ms**.
*   **Continuous Hold-to-Activate Gestures**: Real-time knuckle angle checks enable natural hold-actions. Pinching index/thumb activates the vacuum Magnet continuously; closing the fist into a Closed Fist immediately contracts the orb into a high-visibility point and scales down movement sensitivity.
*   **Procedural Synth Audio Engine**: Features a zero-asset audio engine running on the **Web Audio API**. Background ambient pads shift chord structures, plucks pan dynamically based on horizontal game positioning, and noise sweeps create wind-whooshes on dashes.
*   **Object-Pooled Game Loops**: Pre-allocates memory for obstacles, gems, and particle trails at launch. Activating and recycling entities prevents garbage collection CPU spikes, eliminating frame drops.
*   **Apple-Inspired Minimalist UI**: Uses translucent frosted glass card overlays (`backdrop-filter: blur`), curated HSL color systems, and modern custom typography.
*   **Security & Privacy-First**: 100% of webcam feeds are processed locally inside the browser's WebAssembly sandbox. No camera images, video buffers, or landmark coordinates are ever sent, saved, or uploaded to external servers.

---

## 🎮 Controls & Gesture Guide

| Gesture | Finger/Landmark Rule | In-Game Ability | Visual Indicator |
| :--- | :--- | :--- | :--- |
| **Open Palm** | All 5 fingers extended | **Normal Flight**: Maps mapped hand center to orb position. | Translucent cyan orb, trailing cyan particles. |
| **Pinch** | Thumb and Index tips touch | **Magnet (Hold)**: Pulls nearby energy fragments in a $160\text{px}$ radius. | Pulsing purple outer ring, particle vortex. |
| **Closed Fist** | All 5 fingers folded | **Precision (Hold)**: Contracts orb size by 35% and drops sensitivity for narrow gaps. | Orb shrinks, displays dashed fine reticle. |
| **Two-Finger** | Index and Middle extended | **Force Shield (Trigger)**: Temporary bubble shields damage (4s duration, 10s cooldown). | Hexagonal pink force shield wrapper. |
| **Three-Finger**| Index, Mid, Ring extended | **Chrono Slow-Mo (Trigger)**: Halves speed of obstacles (5s duration, 12s cooldown). | Chromatic desaturated matrix overlay filter. |
| **Swipe** | Fast hand knuckle velocity | **Swipe Dash**: Boosts speed instantly in direction of the swipe (0.6s cooldown). | Orb stretches into motion-blurred comet. |

*Note: In the event of a missing or disabled webcam, the game automatically switches to mouse/touch coordinates, allowing clicks to act as gesture overrides.*

---

## 🛠️ Project Structure

The project follows a modular, object-oriented structure:

```
airflow/
├── index.html                  # Core markup, overlays, and canvas definitions
├── package.json                # Project dependencies and Vite build scripts
├── vite.config.js              # Vite server settings with cross-origin headers for WASM
├── css/
│   └── styles.css              # Apple-inspired design tokens, animations, and variables
├── js/
│   ├── main.js                 # App entry controller and screen router bindings
│   ├── config.js               # Global configuration constants and achievements
│   ├── state/
│   │   ├── gameState.js        # Event-driven State Machine and flat timers
│   │   └── saveSystem.js       # LocalStorage profile save/load coordinator
│   ├── tracking/
│   │   ├── handTracker.js      # Webcam feeds listener and MediaPipe WASM drawer
│   │   ├── gestureManager.js   # One Euro coordinates filter and hand shape classifier
│   │   └── calibration.js      # User reach boundary mapping calibration
│   ├── engine/
│   │   ├── gameEngine.js       # Spawning, collision checks, delta-timed game loops
│   │   ├── renderer.js         # Double-buffered Canvas drawings and particle managers
│   │   ├── audio.js            # Web Audio API synthesizers and ambient tracks
│   │   └── input.js            # Unifies tracking positions with pointer fallbacks
│   └── game/
│       ├── orb.js              # Player orb physics, speeds, and bounds clamping
│       ├── obstacles.js        # Pre-allocated pooled obstacles
│       ├── fragments.js        # Pre-allocated pooled gems with vector pull mechanics
│       ├── powerups.js         # Spawning, drift, and collection of status capsules
│       └── background.js       # Starfield parallax updates
└── assets/                     # Optional asset configurations
```

---

## 🚀 Installation & Running Locally

### Prerequisites

Verify that you have [Node.js](https://nodejs.org/) installed (v18.0.0+ recommended).

### 1. Install Dependencies
Clone the repository and install Vite:
```bash
npm install
```

### 2. Start the Development Server
Launch the local dev server:
```bash
npm run dev
```
Open **[http://localhost:3000](http://localhost:3000)** in your browser of choice.

### 3. Build for Production
To bundle and compile optimized static files into the `dist/` directory:
```bash
npm run build
```

---

## 🔒 Security & Privacy Statement

AirFlow runs entirely client-side. The application does not store, transmit, or share any image data from the user's camera feed. 

*   Webcam access is requested solely to feed frames into the local MediaPipe WebAssembly solver.
*   Once hand landmarker coordinates are calculated, the image buffers are immediately discarded from memory.
*   No tracking coordinate data is saved outside of local volatility.
