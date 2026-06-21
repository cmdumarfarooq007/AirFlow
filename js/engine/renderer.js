// Hardware-Accelerated 2D Canvas Renderer
import { state } from '../state/gameState.js';
import { CONFIG } from '../config.js';
import { background } from '../game/background.js';

class GameRenderer {
  constructor() {
    this.canvas = null;
    this.ctx = null;
  }

  init(canvasElement) {
    this.canvas = canvasElement;
    this.ctx = this.canvas.getContext('2d');
    this.resizeCanvas();
    
    window.addEventListener('resize', () => this.resizeCanvas());
  }

  resizeCanvas() {
    if (!this.canvas) return;
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
    background.init(this.canvas.width, this.canvas.height);
  }

  // Master Render call
  draw(orb, obstacles, fragments, activeParticles, floatingScores) {
    if (!this.ctx || !this.canvas) return;
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;
    const quality = state.settings.graphicsQuality;

    // 1. Draw Background (Parallax stars & glowing Grid)
    this.drawBackground(ctx, w, h, quality, orb);

    // 2. Draw Floating score popups
    this.drawFloatingScores(ctx, floatingScores);

    // 3. Draw Collectibles (Energy Fragments)
    this.drawFragments(ctx, fragments, quality);

    // 4. Draw Obstacles
    this.drawObstacles(ctx, obstacles, quality);

    // 5. Draw Particle trails
    this.drawParticles(ctx, activeParticles);

    // 6. Draw Player Orb and active ability layers
    this.drawPlayer(ctx, orb, quality);
    
    // 7. Draw Screen Filters (Slow Motion desaturation, chromatic aberration, or damage flashes)
    this.drawFilters(ctx, w, h);
  }

  // Draw Background Grid
  drawBackground(ctx, w, h, quality, orb) {
    // Clear screen with deep dark color
    ctx.fillStyle = '#07070c';
    ctx.fillRect(0, 0, w, h);

    // Draw Parallax Stars (Background layer)
    ctx.fillStyle = '#ffffff';
    background.stars.forEach(star => {
      ctx.beginPath();
      ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
      ctx.fill();
    });

    if (quality === 'low') return; // Skip grid drawing on low devices for max FPS

    // Draw Cybernetic Grid Line Overlay
    ctx.lineWidth = 0.5;
    ctx.strokeStyle = state.settings.colorblindMode ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 240, 255, 0.05)';
    
    // Horizontal lines
    for (let y = background.gridY; y < h; y += 60) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }
    
    // Vertical lines
    const colWidth = 60;
    const centerOffset = (orb ? (w / 2 - orb.x) * 0.05 : 0); // Gentle shift on horizontal orb motion
    for (let x = centerOffset; x < w; x += colWidth) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }
  }

  // Draw Gems
  drawFragments(ctx, fragments, quality) {
    fragments.forEach(gem => {
      if (!gem.active) return;
      
      const themeColor = state.settings.colorblindMode ? '#ffbb00' : '#00f0ff';
      ctx.save();
      
      if (quality === 'high') {
        ctx.shadowBlur = 12;
        ctx.shadowColor = themeColor;
      }
      
      ctx.fillStyle = themeColor;
      ctx.beginPath();
      
      // Draw diamond shape
      ctx.moveTo(gem.x, gem.y - gem.size);
      ctx.lineTo(gem.x + gem.size, gem.y);
      ctx.lineTo(gem.x, gem.y + gem.size);
      ctx.lineTo(gem.x - gem.size, gem.y);
      ctx.closePath();
      ctx.fill();
      
      // Sub-glowing ring
      if (quality !== 'low') {
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
        ctx.lineWidth = 1;
        ctx.stroke();
      }
      
      ctx.restore();
    });
  }

  // Draw Obstacles
  drawObstacles(ctx, obstacles, quality) {
    obstacles.forEach(obs => {
      if (!obs.active) return;

      const baseColor = state.settings.colorblindMode ? '#0077ff' : '#ff007f';
      ctx.save();

      if (quality === 'high') {
        ctx.shadowBlur = 15;
        ctx.shadowColor = baseColor;
      }

      ctx.fillStyle = baseColor;
      ctx.strokeStyle = '#ffffff';

      if (obs.type === 'bar') {
        // Horizontal wall
        ctx.beginPath();
        ctx.roundRect(obs.x, obs.y, obs.width, obs.height, 6);
        ctx.fill();
        if (quality !== 'low') {
          ctx.lineWidth = 1.5;
          ctx.stroke();
        }
      } else if (obs.type === 'laser') {
        // Laser barrier
        ctx.lineWidth = obs.height;
        ctx.strokeStyle = baseColor;
        ctx.beginPath();
        ctx.moveTo(obs.x, obs.y + obs.height / 2);
        ctx.lineTo(obs.x + obs.width, obs.y + obs.height / 2);
        ctx.stroke();
        
        // Inside white core
        ctx.lineWidth = obs.height / 3;
        ctx.strokeStyle = '#ffffff';
        ctx.beginPath();
        ctx.moveTo(obs.x, obs.y + obs.height / 2);
        ctx.lineTo(obs.x + obs.width, obs.y + obs.height / 2);
        ctx.stroke();
      }

      ctx.restore();
    });
  }

  // Draw Emitter trail particles
  drawParticles(ctx, particles) {
    particles.forEach(p => {
      if (!p.active) return;
      ctx.fillStyle = p.color;
      ctx.globalAlpha = p.alpha;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.globalAlpha = 1.0; // Reset
  }

  // Draw Player Orb & Active Gestures Visual Cues
  drawPlayer(ctx, orb, quality) {
    const gesture = state.activeGesture;
    const isShield = state.isShieldActive;
    const isMagnet = state.isMagnetActive;
    
    ctx.save();
    
    // --- 1. Draw Ability fields (Magnet Ring, Shield Bubble) ---
    
    // Magnet Ring (Pinch)
    if (isMagnet) {
      const gradient = ctx.createRadialGradient(orb.x, orb.y, orb.radius, orb.x, orb.y, 160);
      gradient.addColorStop(0, 'rgba(138, 43, 226, 0.15)');
      gradient.addColorStop(1, 'rgba(138, 43, 226, 0.0)');
      
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(orb.x, orb.y, 160, 0, Math.PI * 2);
      ctx.fill();
      
      // Draw dashed field border
      ctx.strokeStyle = 'rgba(138, 43, 226, 0.4)';
      ctx.lineWidth = 1;
      ctx.setLineDash([5, 8]);
      ctx.beginPath();
      ctx.arc(orb.x, orb.y, 160, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]); // reset
    }

    // Shield Force Field (Two-Finger)
    if (isShield) {
      const radius = orb.radius * 2.2;
      
      // Outer bubble
      ctx.strokeStyle = '#ff007f';
      ctx.lineWidth = 3;
      
      if (quality === 'high') {
        ctx.shadowBlur = 20;
        ctx.shadowColor = '#ff007f';
      }
      
      ctx.beginPath();
      // Draw neat hexagonal circle
      const sides = 6;
      const angle = (Math.PI * 2) / sides;
      for (let i = 0; i < sides; i++) {
        const x = orb.x + radius * Math.cos(angle * i + performance.now() * 0.002);
        const y = orb.y + radius * Math.sin(angle * i + performance.now() * 0.002);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.stroke();
      
      // Hexagonal internal shading fill
      ctx.fillStyle = 'rgba(255, 0, 127, 0.1)';
      ctx.fill();
    }

    // --- 2. Draw Main Orb ---
    let orbColor = '#00f0ff';
    let drawRadius = orb.radius;
    let isPrecision = false;
    
    if (gesture === 'Pinch') {
      orbColor = '#8a2be2'; // Purple
    } else if (gesture === 'Two-Finger') {
      orbColor = '#ff007f'; // Pink
    } else if (gesture === 'Closed Fist') {
      orbColor = '#ffffff'; // White
      drawRadius = orb.radius * 0.65; // Contract size!
      isPrecision = true;
    } else if (gesture === 'Three-Finger') {
      orbColor = '#00ffaa'; // Cyan-green
    }

    // Draw orb tail stretch if dashing (motion blur effect)
    if (quality !== 'low' && orb.vx !== 0) {
      ctx.strokeStyle = orbColor;
      ctx.globalAlpha = 0.25;
      ctx.lineWidth = drawRadius * 2;
      ctx.beginPath();
      ctx.moveTo(orb.x - orb.vx * 1.5, orb.y - orb.vy * 1.5);
      ctx.lineTo(orb.x, orb.y);
      ctx.stroke();
      ctx.globalAlpha = 1.0;
    }

    // Orb Glow
    if (quality === 'high') {
      ctx.shadowBlur = 22;
      ctx.shadowColor = orbColor;
    }
    
    // Core circle
    const coreGrad = ctx.createRadialGradient(orb.x, orb.y, 1, orb.x, orb.y, drawRadius);
    coreGrad.addColorStop(0, '#ffffff');
    coreGrad.addColorStop(0.3, orbColor);
    coreGrad.addColorStop(1, 'rgba(0, 0, 0, 0.2)');
    
    ctx.fillStyle = coreGrad;
    ctx.beginPath();
    ctx.arc(orb.x, orb.y, drawRadius, 0, Math.PI * 2);
    ctx.fill();

    // Precision mode reticle lines
    if (isPrecision) {
      ctx.strokeStyle = 'rgba(255,255,255,0.4)';
      ctx.lineWidth = 1;
      ctx.setLineDash([2, 4]);
      
      ctx.beginPath();
      ctx.arc(orb.x, orb.y, orb.radius * 1.6, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    ctx.restore();
  }

  // Draw floating points overlays (+100, etc.)
  drawFloatingScores(ctx, scores) {
    scores.forEach(s => {
      if (!s.active) return;
      ctx.fillStyle = s.color;
      ctx.font = `600 ${s.fontSize}px 'Outfit'`;
      ctx.textAlign = 'center';
      ctx.globalAlpha = s.alpha;
      ctx.fillText(s.text, s.x, s.y);
    });
    ctx.globalAlpha = 1.0;
  }

  // Chromatic Aberration & Slow Motion Filters
  drawFilters(ctx, w, h) {
    // 1. Slow Motion Chromatic Aberration filter
    if (state.isSlowMoActive) {
      ctx.save();
      // Draw soft vintage matrix border overlay
      ctx.strokeStyle = 'rgba(0, 255, 170, 0.08)';
      ctx.lineWidth = 20;
      ctx.strokeRect(0, 0, w, h);
      ctx.restore();
    }
    
    // 2. Health damage indicator flash
    if (state.currentState === 'PLAYING' && state.energy < 25) {
      ctx.save();
      ctx.strokeStyle = `rgba(255, 0, 0, ${0.15 + 0.1 * Math.sin(performance.now() * 0.01)})`;
      ctx.lineWidth = 15;
      ctx.strokeRect(0, 0, w, h);
      ctx.restore();
    }
  }
}

export const renderer = new GameRenderer();
