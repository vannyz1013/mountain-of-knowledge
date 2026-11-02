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
    for (let i = 0; i < count; i++) {
      const x = random() * this.w;
      const y = Math.pow(random(), 1.5) * this.h * 0.9;
      const big = random() > 0.93;
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
      this.draw(Math.min((now - this.lastTime) / 1000, 0.05));
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
    ctx.globalAlpha = 1;
  }
}
