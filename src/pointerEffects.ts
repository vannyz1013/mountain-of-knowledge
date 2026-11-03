import { Particles } from "./particles";
import { Stage } from "./stage";
import { clamp, reducedMotion } from "./util";

const NEAR_RADIUS = 120; // px from a light at which it starts to respond
const SPARK_SPACING = 26; // px of cursor travel per spark
const EASE_PARALLAX = 3.2; // higher settles faster
const EASE_NEAR = 7;
const RIPPLE_COOLDOWN = 1600; // ms before the same light can ripple again
// Every style write costs a restyle, so a light is only rewritten once its glow has
// moved by a visible amount (0.02 is under 0.3px at the halo's edge), and a layer
// only once its offset has moved by a tenth of a pixel.
const NEAR_STEP = 0.02;
const PARALLAX_PRECISION = 1;

// Maximum travel in px at full cursor offset. Near layers move most, far layers least.
const LAYERS: [string, number][] = [
  ["#stars", 2.5],
  [".moon-glow", 3.5],
  [".ridges", 5],
  ["#world", 8],
  [".fog-a", 12],
  [".fog-b", 15],
];

interface Light {
  el: SVGGElement;
  x: number;
  y: number;
  near: number; // eased every frame
  shown: number; // last value written to the page
  rippleAt: number;
}

/**
 * Everything that answers the cursor: sparks, parallax, and lights that wake up
 * as it approaches. Pointer events only record a position, and the work happens
 * once a frame inside the particle loop, so there is one animation loop in total.
 * It uses the CSS `translate` property, leaving `transform` free for the camera
 * and the fog drift. Only the Story and Mountain scenes respond; the
 * transformation and the birthday scene settle back to rest.
 */
export class PointerEffects {
  private abort = new AbortController();
  private layers: [HTMLElement, number][] = [];
  private written: string[] = [];
  private lights: Light[] = [];
  private cursor: { x: number; y: number } | null = null;
  private last: { x: number; y: number } | null = null;
  private travelled = 0;
  private offsetX = 0;
  private offsetY = 0;
  private world!: [HTMLElement, number];

  constructor(
    private app: HTMLElement,
    private stage: Stage,
    markers: SVGGElement[],
    private particles: Particles,
  ) {
    if (reducedMotion()) return;
    const { signal } = this.abort;

    window.addEventListener("pointerdown", (e) => this.onPress(e), { passive: true, signal });
    window.addEventListener("pagehide", (e) => { if (!e.persisted) this.dispose(); }, { signal });

    // Touch keeps its existing behaviour: no cursor, so nothing below applies.
    if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;

    this.layers = LAYERS.map(([selector, depth]) => [app.querySelector(selector) as HTMLElement, depth]);
    this.world = this.layers.find(([el]) => el.id === "world") as [HTMLElement, number];
    this.lights = markers.map((el) => {
      const dot = el.querySelector(".dot") as SVGCircleElement;
      return { el, x: Number(dot.getAttribute("cx")), y: Number(dot.getAttribute("cy")), near: 0, shown: 0, rippleAt: 0 };
    });
    app.classList.add("parallax");

    window.addEventListener("pointermove", (e) => {
      if (e.pointerType === "mouse") this.cursor = { x: e.clientX, y: e.clientY };
    }, { passive: true, signal });
    document.documentElement.addEventListener("pointerleave", () => { this.cursor = null; }, { signal });
    particles.onFrame((dt, now) => this.frame(dt, now));
  }

  private get scene() {
    return this.app.dataset.scene;
  }

  private onPress(e: PointerEvent) {
    if (this.scene !== "2") return;
    if ((e.target as Element).closest?.(".marker, button")) return;
    this.particles.ripple(e.clientX, e.clientY, 74, 0.42);
  }

  private frame(dt: number, now: number) {
    const live = this.scene === "1" || this.scene === "2";
    this.parallax(dt, live);
    this.sparks(dt, live);
    this.wakeLights(dt, now);
    this.particles.setPointer(live ? this.cursor : null);
  }

  private parallax(dt: number, live: boolean) {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const targetX = live && this.cursor ? clamp(this.cursor.x / w - 0.5, -0.5, 0.5) * -2 : 0;
    const targetY = live && this.cursor ? clamp(this.cursor.y / h - 0.5, -0.5, 0.5) * -2 : 0;
    const ease = 1 - Math.exp(-EASE_PARALLAX * dt);
    const stepX = (targetX - this.offsetX) * ease;
    const stepY = (targetY - this.offsetY) * ease;
    if (Math.abs(stepX) + Math.abs(stepY) < 0.0002) return;
    this.offsetX += stepX;
    this.offsetY += stepY;
    this.layers.forEach(([el, depth], i) => {
      const value = `${(this.offsetX * depth).toFixed(PARALLAX_PRECISION)}px ${(this.offsetY * depth * 0.6).toFixed(PARALLAX_PRECISION)}px`;
      if (value === this.written[i]) return;
      this.written[i] = value;
      el.style.translate = value;
    });
    this.particles.setStarShift(this.offsetX * LAYERS[0][1], this.offsetY * LAYERS[0][1] * 0.6);
  }

  private sparks(dt: number, live: boolean) {
    const now = this.cursor;
    const was = this.last;
    this.last = now;
    if (!live || !now || !was || dt <= 0) return;
    const dx = now.x - was.x;
    const dy = now.y - was.y;
    const distance = Math.hypot(dx, dy);
    if (distance < 1) return;
    this.travelled += distance;
    let count = 0;
    while (this.travelled >= SPARK_SPACING && count < 3) {
      this.travelled -= SPARK_SPACING;
      const along = Math.random();
      this.particles.spark(was.x + dx * along, was.y + dy * along, (dx / dt) * 0.035, (dy / dt) * 0.035);
      count++;
    }
    this.travelled = Math.min(this.travelled, SPARK_SPACING); // a fast flick stays a few sparks
  }

  private wakeLights(dt: number, now: number) {
    const settled = this.scene === "2" && this.stage.root.classList.contains("trail-on");
    const ease = 1 - Math.exp(-EASE_NEAR * dt);
    const [, depth] = this.world;
    const shiftX = this.offsetX * depth;
    const shiftY = this.offsetY * depth * 0.6;

    for (const light of this.lights) {
      let target = 0;
      if (settled && this.cursor) {
        const p = this.stage.toScreen(light.x, light.y);
        const distance = Math.hypot(p.x + shiftX - this.cursor.x, p.y + shiftY - this.cursor.y);
        target = clamp(1 - distance / NEAR_RADIUS, 0, 1);
        target = target * target * (3 - 2 * target);
        if (target > 0.55 && light.near <= 0.55 && now - light.rippleAt > RIPPLE_COOLDOWN) {
          light.rippleAt = now;
          this.particles.ripple(p.x + shiftX, p.y + shiftY, 36, 0.34);
        }
      }
      if (target === light.near) continue;
      const next = light.near + (target - light.near) * ease;
      // close enough lands exactly, so a light always returns fully to rest
      light.near = Math.abs(target - next) < 0.01 ? target : next;
      if (light.near !== target && Math.abs(light.near - light.shown) < NEAR_STEP) continue;
      if (light.near === light.shown) continue;
      if (light.shown === 0) light.el.classList.add("waking");
      light.shown = light.near;
      light.el.style.setProperty("--near", light.near.toFixed(3));
      if (light.near === 0) light.el.classList.remove("waking");
    }
  }

  dispose() {
    this.abort.abort();
    this.app.classList.remove("parallax");
    for (const [el] of this.layers) el.style.translate = "";
    for (const light of this.lights) {
      light.el.style.removeProperty("--near");
      light.el.classList.remove("waking");
    }
    this.particles.setPointer(null);
  }
}
