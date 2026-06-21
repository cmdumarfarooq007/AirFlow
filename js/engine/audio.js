// Procedural Synthesizer Audio Engine (Web Audio API)
import { state } from '../state/gameState.js';

class AudioEngine {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.musicGain = null;
    this.sfxGain = null;
    
    this.musicInterval = null;
    this.musicNodes = [];
    this.isPlayingMusic = false;
    
    // Ambient Sequencer settings
    this.currentChord = 0;
    this.chords = [
      [110.00, 130.81, 164.81, 196.00], // Am7 (A2, C3, E3, G3)
      [87.31, 130.81, 174.61, 220.00],  // Fmaj7 (F2, C3, F3, A3)
      [130.81, 164.81, 196.00, 261.63], // Cmaj7 (C3, E3, G3, C4)
      [98.00, 146.83, 196.00, 246.94]   // G6 (G2, D3, G3, B3)
    ];

    // Settings listeners
    state.on('settingChanged', ({ key, value }) => this.handleVolumeChange(key, value));
  }

  // Initialize context on first user interaction
  async init() {
    if (this.ctx) return;
    
    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioContextClass();
      
      // Node chain setup: Oscillator -> PanNode -> Volume Node -> Master -> Destination
      this.masterGain = this.ctx.createGain();
      this.masterGain.connect(this.ctx.destination);
      
      this.musicGain = this.ctx.createGain();
      this.musicGain.connect(this.masterGain);
      
      this.sfxGain = this.ctx.createGain();
      this.sfxGain.connect(this.masterGain);
      
      // Set default volume levels
      this.musicGain.gain.setValueAtTime(state.settings.volumeMusic, this.ctx.currentTime);
      this.sfxGain.gain.setValueAtTime(state.settings.volumeSfx, this.ctx.currentTime);
      
      console.log("Web Audio API Initialized.");
    } catch (e) {
      console.error("Web Audio API not supported on this platform:", e);
    }
  }

  // Resume context if suspended (browser security)
  resume() {
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  handleVolumeChange(key, value) {
    if (!this.ctx) return;
    
    if (key === 'volumeMusic') {
      this.musicGain.gain.setTargetAtTime(value / 100, this.ctx.currentTime, 0.1);
    } else if (key === 'volumeSfx') {
      this.sfxGain.gain.setTargetAtTime(value / 100, this.ctx.currentTime, 0.1);
    }
  }

  // --- Procedural Sound Effects ---

  // Soft Pluck (Energy Collect)
  playCollect(panValue = 0) {
    if (!this.ctx) return;
    this.resume();

    const now = this.ctx.currentTime;
    
    // Synthesize pluck
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const pan = this.ctx.createStereoPanner();
    
    osc.type = 'triangle';
    
    // Play pentatonic scale notes based on combo multiplier
    const scale = [261.63, 293.66, 329.63, 392.00, 440.00, 523.25, 587.33, 659.25, 783.99, 880.00];
    const index = Math.min(scale.length - 1, Math.floor(state.multiplier - 1));
    const frequency = scale[index] + (Math.random() * 8 - 4); // Subtle detune
    
    osc.frequency.setValueAtTime(frequency, now);
    
    // Quick gain envelope: instant attack, exponential decay
    gain.gain.setValueAtTime(0.0, now);
    gain.gain.linearRampToValueAtTime(0.35, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
    
    pan.pan.setValueAtTime(panValue, now);

    osc.connect(gain);
    gain.connect(pan);
    pan.connect(this.sfxGain);
    
    osc.start(now);
    osc.stop(now + 0.35);
  }

  // FM Chime (Shield Activation)
  playShield() {
    if (!this.ctx) return;
    this.resume();

    const now = this.ctx.currentTime;
    
    // FM synthesis: Modulator modulates carrier frequency
    const carrier = this.ctx.createOscillator();
    const modulator = this.ctx.createOscillator();
    const modGain = this.ctx.createGain();
    const gain = this.ctx.createGain();
    
    carrier.type = 'sine';
    carrier.frequency.setValueAtTime(440, now);
    
    modulator.type = 'sine';
    modulator.frequency.setValueAtTime(220, now);
    
    modGain.gain.setValueAtTime(300, now);
    modGain.gain.exponentialRampToValueAtTime(1, now + 0.8);
    
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.4, now + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.9);
    
    modulator.connect(modGain);
    modGain.connect(carrier.frequency);
    carrier.connect(gain);
    gain.connect(this.sfxGain);
    
    modulator.start(now);
    carrier.start(now);
    
    modulator.stop(now + 1.0);
    carrier.stop(now + 1.0);
  }

  // Sweep Swoosh (Swipe Dash)
  playDash() {
    if (!this.ctx) return;
    this.resume();

    const now = this.ctx.currentTime;
    const duration = 0.25;

    // Synthesize noise whoosh
    const bufferSize = this.ctx.sampleRate * duration;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    
    // Fill buffer with white noise
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    
    const noiseNode = this.ctx.createBufferSource();
    noiseNode.buffer = buffer;
    
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    
    // Sweep bandpass frequency upwards rapidly
    filter.frequency.setValueAtTime(150, now);
    filter.frequency.exponentialRampToValueAtTime(1600, now + duration);
    filter.Q.setValueAtTime(3.0, now);
    
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.5, now + 0.04);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    
    noiseNode.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGain);
    
    noiseNode.start(now);
    noiseNode.stop(now + duration);
  }

  // Low Frequency Explode (Damage taken)
  playDamage() {
    if (!this.ctx) return;
    this.resume();

    const now = this.ctx.currentTime;
    
    const osc = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();
    
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(120, now);
    osc.frequency.linearRampToValueAtTime(40, now + 0.4);
    
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(300, now);
    
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.5, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
    
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGain);
    
    osc.start(now);
    osc.stop(now + 0.5);
  }

  // Simple interface click
  playMenuClick() {
    if (!this.ctx) return;
    this.resume();

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    
    osc.type = 'sine';
    osc.frequency.setValueAtTime(500, now);
    
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.15, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
    
    osc.connect(gain);
    gain.connect(this.sfxGain);
    
    osc.start(now);
    osc.stop(now + 0.1);
  }

  // --- Background Ambient Music Loops ---

  startMusic() {
    if (this.isPlayingMusic) return;
    this.isPlayingMusic = true;
    
    const playSequencerStep = () => {
      if (!this.isPlayingMusic) return;
      
      const now = this.ctx.currentTime;
      const notes = this.chords[this.currentChord];
      
      // Set duration of chords (2.5 seconds per chord)
      const chordDuration = 2.4;
      
      // Clean previous nodes
      this.musicNodes = this.musicNodes.filter(node => {
        if (node.stopTime < now) return false;
        return true;
      });

      // Play pad nodes
      notes.forEach((freq, i) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        const filter = this.ctx.createBiquadFilter();
        
        osc.type = i === 0 ? 'sine' : 'triangle'; // sine sub, triangle upper harmonics
        
        // Detune slightly for lush chorus effect
        const detuneValue = (i * 4) - 6;
        osc.frequency.setValueAtTime(freq, now);
        osc.detune.setValueAtTime(detuneValue, now);
        
        // Soft slow attack & release chord envelope
        gain.gain.setValueAtTime(0.0, now);
        gain.gain.linearRampToValueAtTime(0.08, now + 0.6); // slow attack
        gain.gain.exponentialRampToValueAtTime(0.001, now + chordDuration); // fade out
        
        // Modulate filter cutoff for slow filter sweeps
        filter.type = 'lowpass';
        
        // If slow-motion active, lower pitch and filter cutoff dynamically!
        const isSlowMo = state.activeAbilities.slowMo.active;
        const cutoffFreq = isSlowMo ? 350 : 800;
        osc.frequency.setValueAtTime(isSlowMo ? freq * 0.75 : freq, now);
        
        filter.frequency.setValueAtTime(150, now);
        filter.frequency.exponentialRampToValueAtTime(cutoffFreq, now + 1.2);
        
        osc.connect(filter);
        filter.connect(gain);
        gain.connect(this.musicGain);
        
        osc.start(now);
        osc.stop(now + chordDuration);
        
        this.musicNodes.push({ osc, gain, stopTime: now + chordDuration });
      });
      
      // Advance to next chord in cycle
      this.currentChord = (this.currentChord + 1) % this.chords.length;
      
      // Schedule next chord sweep
      this.musicInterval = setTimeout(playSequencerStep, chordDuration * 1000);
    };

    // Trigger loop
    playSequencerStep();
  }

  stopMusic() {
    this.isPlayingMusic = false;
    if (this.musicInterval) {
      clearTimeout(this.musicInterval);
      this.musicInterval = null;
    }
    
    // Stop all active music oscillator nodes
    const now = this.ctx ? this.ctx.currentTime : 0;
    this.musicNodes.forEach(node => {
      try {
        node.osc.stop(now);
      } catch(e) {}
    });
    this.musicNodes = [];
  }
}

export const audio = new AudioEngine();
