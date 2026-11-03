import { isCoarsePointer, reducedMotion, seeded } from "./util";

interface Mote {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  a: number;
  phase: number;
  warm: number;
}

interface Spark {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  age: number;
  life: number;
  peak: number;
}

interface Ripple {
  x: number;
  y: number;
  radius: number;
  strength: number;
  age: number;
}

interface Twinkle {
  x: number;
  y: number;
  age: number;
  life: number;
}

// Hard ceilings, so no amount of cursor movement can grow these lists.
const MAX_SPARKS = 44;
const MAX_RIPPLES = 5;
const MAX_TWINKLES = 4;
const RIPPLE_LIFE = 0.8;

/** Stars and drifting motes on two canvases. Stars are drawn once; motes are animated. */
export class Particles {
  private ctx: CanvasRenderingContext2D;
  private motes: Mote[] = [];
  private w = 0;
  private h = 0;
  private dpr = 1;
  private raf = 0;
  private target: { x: number; y: number; strength: number } | null = null;
  private warmth = 0;
  private lastTime = 0;
  private sparks: Spark[] = [];
  private ripples: Ripple[] = [];
  private twinkles: Twinkle[] = [];
  private brightStars: { x: number; y: number }[] = [];
  private pointer: { x: number; y: number } | null = null;
  private starShift = { x: 0, y: 0 };
  private frameHandlers: ((dt: number, now: number) => void)[] = [];

  constructor(
    private starCanvas: HTMLCanvasElement,
    private canvas: HTMLCanvasElement,
  ) {
    this.ctx = canvas.getContext("2d") as CanvasRenderingContext2D;
    this.resize();
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) this.stop();
      else this.start();
    });
  }

  resize() {
    this.w = window.innerWidth;
    this.h = window.innerHeight;
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    for (const c of [this.starCanvas, this.canvas]) {
      c.width = this.w * this.dpr;
      c.height = this.h * this.dpr;
    }
    this.drawStars();
    const count = reducedMotion() ? 14 : isCoarsePointer() ? 34 : 64;
    this.motes = [];
    for (let i = 0; i < count; i++) this.motes.push(this.spawn(Math.random() * this.h));
    if (reducedMotion()) this.draw(0);
  }

  private drawStars() {
    const ctx = this.starCanvas.getContext("2d") as CanvasRenderingContext2D;
    const random = seeded(88);
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, this.w, this.h);
    const count = Math.round((this.w * this.h) / 5200);
    this.brightStars = [];
    for (let i = 0; i < count; i++) {
      const x = random() * this.w;
      const y = Math.pow(random(), 1.5) * this.h * 0.9;
      const big = random() > 0.93;
      if (big) this.brightStars.push({ x, y });
      ctx.fillStyle = big ? "#EAF3FA" : "#8BDCF5";
      ctx.globalAlpha = (big ? 0.75 : 0.32) * (0.45 + random() * 0.55) * (1 - y / this.h);
      ctx.beginPath();
      ctx.arc(x, y, big ? 1.2 : 0.7, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  private spawn(y: number): Mote {
    return {
      x: Math.random() * this.w,
      y,
      vx: (Math.random() - 0.5) * 5,
      vy: -3 - Math.random() * 7,
      r: 0.6 + Math.random() * 1.5,
      a: 0.25 + Math.random() * 0.5,
      phase: Math.random() * 6.28,
      warm: 0,
    };
  }

  start() {
    if (this.raf || reducedMotion()) return;
    this.lastTime = performance.now();
    const loop = (now: number) => {
      const dt = Math.min((now - this.lastTime) / 1000, 0.05);
      for (const handler of this.frameHandlers) handler(dt, now);
      this.draw(dt);
      this.lastTime = now;
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }

  stop() {
    cancelAnimationFrame(this.raf);
    this.raf = 0;
  }

  /** Pulls every mote toward a screen point. Pass null to release them. */
  attract(point: { x: number; y: number } | null, strength = 60) {
    if (this.target && !point) {
      // scatter on release, so the gathered light doesn't linger as a clump
      for (const m of this.motes) {
        m.vx = (Math.random() - 0.5) * 90;
        m.vy = (Math.random() - 0.5) * 90;
      }
    }
    this.target = point ? { ...point, strength } : null;
  }

  setWarmth(t: number) {
    this.warmth = t;
  }

  /** Runs once a frame inside this loop, so effects never need a loop of their own. */
  onFrame(handler: (dt: number, now: number) => void) {
    this.frameHandlers.push(handler);
  }

  /** The cursor, which ambient motes drift gently away from. Null when there is none. */
  setPointer(point: { x: number; y: number } | null) {
    this.pointer = point;
  }

  /** Keeps twinkles lined up with the star layer as it moves in parallax. */
  setStarShift(x: number, y: number) {
    this.starShift = { x, y };
  }

  /** A short-lived blue-white spark left along the cursor's path. */
  spark(x: number, y: number, vx: number, vy: number) {
    if (this.sparks.length >= MAX_SPARKS) return;
    this.sparks.push({
      x: x + (Math.random() - 0.5) * 12,
      y: y + (Math.random() - 0.5) * 12,
      vx: vx + (Math.random() - 0.5) * 16,
      vy: vy + (Math.random() - 0.5) * 16 - 7,
      r: 0.6 + Math.random() * 1.2,
      age: 0,
      life: 0.55 + Math.random() * 0.75,
      peak: 0.4 + Math.random() * 0.45,
    });
  }

  /** An expanding ring of light that fades as it grows. */
  ripple(x: number, y: number, radius: number, strength: number) {
    if (reducedMotion()) return;
    if (this.ripples.length >= MAX_RIPPLES) this.ripples.shift();
    this.ripples.push({ x, y, radius, strength, age: 0 });
  }

  /** Releases a soft burst of light, used when the candle is lit. */
  burst(x: number, y: number, count = 44) {
    if (reducedMotion()) return;
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 20 + Math.random() * 70;
      this.motes.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 26,
        r: 0.8 + Math.random() * 1.8,
        a: 0.5 + Math.random() * 0.5,
        phase: Math.random() * 6.28,
        warm: 1,
      });
    }
  }

  private draw(dt: number) {
    const { ctx, w, h, target } = this;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    const time = performance.now() / 1000;
    const base = this.motes.length;
    for (let i = base - 1; i >= 0; i--) {
      const m = this.motes[i];
      if (target) {
        const dx = target.x - m.x;
        const dy = target.y - m.y;
        const dist = Math.hypot(dx, dy) + 30;
        m.vx += (dx / dist) * target.strength * dt * 2;
        m.vy += (dy / dist) * target.strength * dt * 2;
        m.vx *= 0.985;
        m.vy *= 0.985;
      } else if (m.warm === 1) {
        m.vx *= 0.99;
        m.vy = m.vy * 0.99 - 2 * dt;
      } else {
        m.vx += (Math.sin(time * 0.4 + m.phase) * 3 - m.vx) * dt;
        m.vy += (-4 - m.vy) * dt * 0.5;
        if (this.pointer) {
          const dx = m.x - this.pointer.x;
          const dy = m.y - this.pointer.y;
          const distance = Math.hypot(dx, dy) + 1;
          if (distance < 130) {
            const push = (1 - distance / 130) * 26 * dt;
            m.vx += (dx / distance) * push;
            m.vy += (dy / distance) * push;
          }
        }
      }
      m.x += m.vx * dt;
      m.y += m.vy * dt;
      if (m.warm === 1) m.a -= dt * 0.06;
      if (m.warm === 1 && m.a <= 0) {
        this.motes.splice(i, 1);
        continue;
      }
      if (m.y < -10) Object.assign(m, this.spawn(h + 8));
      if (m.x < -10) m.x = w + 8;
      if (m.x > w + 10) m.x = -8;

      const warm = m.warm === 1 ? 1 : this.warmth;
      ctx.globalAlpha = Math.max(m.a, 0) * (0.65 + 0.35 * Math.sin(time * 1.1 + m.phase));
      ctx.fillStyle = warm > 0.5 ? "#FFE3B8" : "#8BDCF5";
      ctx.beginPath();
      ctx.arc(m.x, m.y, m.r, 0, Math.PI * 2);
      ctx.fill();
    }
    this.drawTwinkles(dt);
    this.drawSparks(dt);
    this.drawRipples(dt);
    ctx.globalAlpha = 1;
  }

  /** Now and then one bright star swells and settles. Most of the sky stays still. */
  private drawTwinkles(dt: number) {
    const { ctx, starShift } = this;
    if (dt > 0 && this.twinkles.length < MAX_TWINKLES && this.brightStars.length && Math.random() < dt * 0.9) {
      const star = this.brightStars[Math.floor(Math.random() * this.brightStars.length)];
      this.twinkles.push({ x: star.x, y: star.y, age: 0, life: 1.8 + Math.random() * 1.8 });
    }
    ctx.fillStyle = "#EAF3FA";
    for (let i = this.twinkles.length - 1; i >= 0; i--) {
      const t = this.twinkles[i];
      t.age += dt;
      if (t.age >= t.life) {
        this.twinkles.splice(i, 1);
        continue;
      }
      const pulse = Math.sin((t.age / t.life) * Math.PI);
      ctx.globalAlpha = pulse * pulse * 0.72;
      ctx.beginPath();
      ctx.arc(t.x + starShift.x, t.y + starShift.y, 1.1 + pulse * 0.9, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  private drawSparks(dt: number) {
    const { ctx } = this;
    ctx.fillStyle = "#C9EEFB";
    for (let i = this.sparks.length - 1; i >= 0; i--) {
      const s = this.sparks[i];
      s.age += dt;
      if (s.age >= s.life) {
        this.sparks.splice(i, 1);
        continue;
      }
      s.vx *= 1 - 1.6 * dt;
      s.vy = s.vy * (1 - 1.6 * dt) - 6 * dt;
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      const t = s.age / s.life;
      const fade = Math.min(t * 6, 1) * (1 - t) * (1 - t);
      ctx.globalAlpha = s.peak * fade;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  private drawRipples(dt: number) {
    const { ctx } = this;
    ctx.strokeStyle = "#8BDCF5";
    for (let i = this.ripples.length - 1; i >= 0; i--) {
      const ripple = this.ripples[i];
      ripple.age += dt;
      const t = ripple.age / RIPPLE_LIFE;
      if (t >= 1) {
        this.ripples.splice(i, 1);
        continue;
      }
      const grown = 1 - (1 - t) * (1 - t) * (1 - t);
      ctx.globalAlpha = ripple.strength * (1 - t) * (1 - t);
      ctx.lineWidth = 1.4 * (1 - t) + 0.4;
      ctx.beginPath();
      ctx.arc(ripple.x, ripple.y, 4 + ripple.radius * grown, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
}
