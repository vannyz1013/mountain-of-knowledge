import { cakeOutline, candleBase, flamePosition, mountainOutline } from "./data/silhouettes";
import { surfaceGlyphs } from "./data/knowledgeData";
import { clamp, html, seeded, smoothstep, svg } from "./util";

export const STAGE_W = 1000;
export const STAGE_H = 800;

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

const asset = (path: string) => `${import.meta.env.BASE_URL}${path}`;

// Parts of the stage each scene wants on screen.
export const VIEW = {
  mountainWide: { x: 0, y: 40, w: 1000, h: 750 },
  mountainNarrow: { x: 140, y: 40, w: 720, h: 750 },
  cake: { x: 95, y: 92, w: 810, h: 712 },
} satisfies Record<string, Rect>;

/**
 * The one world all four scenes share. The mountain, cake and candle all live in
 * a single 1000 x 800 SVG, and scenes only move a camera around it. That shared
 * space is what lets the mountain become the cake rather than be replaced by it.
 */
export class Stage {
  readonly camera = html("div", "camera");
  readonly root = svg("svg", {
    viewBox: `0 0 ${STAGE_W} ${STAGE_H}`,
    width: STAGE_W,
    height: STAGE_H,
    "aria-hidden": "true",
  });
  readonly overlay = svg("g", { class: "overlay" });
  readonly glyphs: SVGGElement[] = [];
  scale = 1;
  tx = 0;
  ty = 0;

  private clip = svg("path");
  private body = svg("g", { "clip-path": "url(#morph-clip)" });
  private mountain = svg("image");
  private cakeNight = svg("image");
  private cakeLit = svg("image");
  private glow = svg("path", { class: "morph-glow" });
  private edge = svg("path", { class: "morph-edge" });
  private candle = svg("g", { class: "candle" });
  private glyphLayer = svg("g", { class: "glyphs" });
  private litState = false;
  private onScale: (() => void)[] = [];

  constructor(parent: HTMLElement) {
    this.build();
    this.camera.append(this.root);
    parent.append(this.camera);
    this.setMorph(0);
  }

  private image(node: SVGImageElement, path: string) {
    node.setAttribute("href", asset(path));
    node.setAttribute("width", String(STAGE_W));
    node.setAttribute("height", String(STAGE_H));
    return node;
  }

  private build() {
    const defs = svg("defs");
    const clipPath = svg("clipPath", { id: "morph-clip" });
    clipPath.append(this.clip);

    const flame = svg("linearGradient", { id: "flame", x1: 0, y1: 1, x2: 0, y2: 0 });
    for (const [offset, color] of [["0", "#FFF6DC"], ["0.45", "#FFD27A"], ["1", "#FF9A3C"]]) {
      flame.append(svg("stop", { offset, "stop-color": color }));
    }
    const halo = svg("radialGradient", { id: "halo" });
    for (const [offset, color, op] of [["0", "#FFE4B0", ".85"], ["0.3", "#FFC97A", ".3"], ["1", "#FFC97A", "0"]]) {
      halo.append(svg("stop", { offset, "stop-color": color, "stop-opacity": op }));
    }
    const candleBody = svg("linearGradient", { id: "candle-body" });
    for (const [offset, color] of [["0", "#BFD6E8"], ["0.45", "#F5F8FC"], ["1", "#7FA3C2"]]) {
      candleBody.append(svg("stop", { offset, "stop-color": color }));
    }
    const pointHalo = svg("radialGradient", { id: "point-halo" });
    for (const [offset, op] of [["0", ".75"], ["0.35", ".24"], ["1", "0"]]) {
      pointHalo.append(svg("stop", { offset, "stop-color": "#8BDCF5", "stop-opacity": op }));
    }
    // The light fades out toward the foot, so it never shows the outline's base as a hard shape.
    const body = svg("linearGradient", { id: "morph-light", gradientUnits: "userSpaceOnUse", x1: 0, y1: 400, x2: 0, y2: 640 });
    for (const [offset, op] of [["0", "1"], ["1", "0"]]) {
      body.append(svg("stop", { offset, "stop-color": "#8BDCF5", "stop-opacity": op }));
    }
    defs.append(clipPath, flame, halo, candleBody, pointHalo, body);

    this.image(this.mountain, "images/mountain/mountain.webp");
    this.image(this.cakeNight, "images/birthday/cake-night.webp");
    this.image(this.cakeLit, "images/birthday/cake-lit.webp");
    this.cakeLit.classList.add("cake-lit");
    this.body.append(this.mountain, this.cakeNight, this.cakeLit, this.glow);

    this.buildCandle();
    this.scatterGlyphs();
    this.root.append(defs, this.body, this.edge, this.glyphLayer, this.overlay, this.candle);
  }

  private buildCandle() {
    const { x } = candleBase;
    const top = flamePosition.y + 30;
    const height = candleBase.y - top;
    const halo = svg("circle", { class: "flame-halo", cx: x, cy: flamePosition.y, r: 190, fill: "url(#halo)" });
    const stem = svg("rect", { x: x - 11, y: top, width: 22, height, rx: 4, fill: "url(#candle-body)" });
    const stripes = svg("g", { "clip-path": "none", class: "candle-stripes" });
    for (let i = 0; i < 4; i++) {
      const y = top + 8 + i * 27;
      stripes.append(svg("path", {
        d: `M${x - 11} ${y + 11} L${x + 11} ${y} v9 L${x - 11} ${y + 20} z`,
        fill: "#36C5F0",
        opacity: 0.62,
      }));
    }
    const wick = svg("line", { x1: x, x2: x, y1: top, y2: top - 11, stroke: "#23201E", "stroke-width": 2.4, "stroke-linecap": "round" });
    const flame = svg("g", { class: "flame" });
    flame.append(
      svg("path", { d: `M${x} ${top - 54} C${x + 16} ${top - 30} ${x + 13} ${top - 7} ${x} ${top - 6} C${x - 13} ${top - 7} ${x - 16} ${top - 30} ${x} ${top - 54}z`, fill: "url(#flame)" }),
      svg("path", { d: `M${x} ${top - 30} C${x + 6} ${top - 20} ${x + 5} ${top - 9} ${x} ${top - 8} C${x - 5} ${top - 9} ${x - 6} ${top - 20} ${x} ${top - 30}z`, fill: "#FFFDF4" }),
    );
    this.candle.append(halo, stem, stripes, wick, flame);
  }

  private scatterGlyphs() {
    const random = seeded(2025);
    const top = (x: number) => {
      let best = STAGE_H;
      for (let i = 0; i < mountainOutline.length; i += 2) {
        if (Math.abs(mountainOutline[i] - x) < 12) best = Math.min(best, mountainOutline[i + 1]);
      }
      return best;
    };
    const placed: { x: number; y: number }[] = [];
    for (let i = 0; placed.length < surfaceGlyphs.length * 2 && i < 2000; i++) {
      const x = 175 + random() * 650;
      const y = 140 + random() * 470;
      if (y < top(x) + 26) continue;
      if (placed.some((p) => Math.hypot((p.x - x) * 0.6, p.y - y) < 44)) continue;
      placed.push({ x, y });
      const label = surfaceGlyphs[placed.length % surfaceGlyphs.length];
      const size = 12 + random() * 8;
      const turn = (random() - 0.5) * 34;
      // The text runs rightward from x, so on the falling right flank its end can
      // leave the rock. Such a spot stays in `placed`, keeping every other glyph put.
      if (y < top(x + [...label].length * size * 0.5) + 14) continue;
      const group = svg("g", { class: "glyph" });
      const text = svg("text", {
        x,
        y,
        "font-size": size,
        transform: `rotate(${turn} ${x} ${y})`,
      });
      text.textContent = label;
      group.append(text);
      group.dataset.x = String(x);
      group.dataset.y = String(y);
      this.glyphLayer.append(group);
      this.glyphs.push(group);
    }
  }

  /** Runs after every camera change, so markers can hold their on-screen size. */
  onCamera(fn: () => void) {
    this.onScale.push(fn);
  }

  /** Moves the camera so `world` fits inside `screen`, in CSS pixels. */
  focus(world: Rect, screen: Rect) {
    const s = Math.min(screen.w / world.w, screen.h / world.h);
    this.scale = s;
    this.tx = screen.x + (screen.w - world.w * s) / 2 - world.x * s;
    this.ty = screen.y + (screen.h - world.h * s) / 2 - world.y * s;
    this.camera.style.transform = `translate3d(${this.tx}px, ${this.ty}px, 0) scale(${s})`;
    this.onScale.forEach((fn) => fn());
  }

  toScreen(x: number, y: number) {
    return { x: this.tx + x * this.scale, y: this.ty + y * this.scale };
  }

  /** The silhouette, the terrain and the lighting all follow one number: 0 mountain, 1 cake. */
  setMorph(t: number) {
    const count = mountainOutline.length / 2;
    // The centre of the outline settles first, so the summit slumps into the top tier
    // while the flanks gather in behind it.
    let d = "";
    for (let i = 0; i < count; i++) {
      const fromCentre = Math.abs(i / (count - 1) - 0.5) * 2;
      const local = smoothstep(fromCentre * 0.28, 0.72 + fromCentre * 0.28, t);
      const x = mountainOutline[i * 2] + (cakeOutline[i * 2] - mountainOutline[i * 2]) * local;
      const y = mountainOutline[i * 2 + 1] + (cakeOutline[i * 2 + 1] - mountainOutline[i * 2 + 1]) * local;
      d += `${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`;
    }
    d += "Z";
    this.clip.setAttribute("d", d);
    this.glow.setAttribute("d", d);
    this.edge.setAttribute("d", d);

    // The terrain settles with the outline instead of being cut by it.
    const squash = 1 - 0.22 * smoothstep(0, 1, t);
    this.mountain.setAttribute("transform", `translate(0 ${STAGE_H * (1 - squash)}) scale(1 ${squash})`);
    this.mountain.style.opacity = String(1 - smoothstep(0.42, 0.86, t));
    this.cakeNight.style.opacity = String(smoothstep(0.34, 0.8, t));

    const hot = Math.sin(clamp(t, 0, 1) * Math.PI);
    this.glow.style.opacity = String(hot * 0.5);
    this.edge.style.opacity = String(smoothstep(0, 0.1, t) * (1 - smoothstep(0.86, 1, t)) * 0.85);
    // The clip only exists during the morph; at rest the artwork keeps its own edges.
    if (t > 0 && t < 1) this.body.setAttribute("clip-path", "url(#morph-clip)");
    else this.body.removeAttribute("clip-path");
  }

  /** Brightens the mountain before the morph; 0 is resting, 1 is fully charged. */
  setCharge(t: number) {
    this.glow.style.opacity = String(t * 0.22);
    this.glow.setAttribute("d", this.clip.getAttribute("d") ?? "");
  }

  setCandle(visible: boolean) {
    this.candle.classList.toggle("candle-in", visible);
  }

  setLit(lit: boolean) {
    this.litState = lit;
    this.candle.classList.toggle("lit", lit);
    this.cakeLit.classList.toggle("on", lit);
  }

  get lit() {
    return this.litState;
  }

  private resetGlyphs() {
    for (const g of this.glyphs) g.getAnimations().forEach((a) => a.cancel());
  }

  showMountain() {
    this.resetGlyphs();
    this.setMorph(0);
    this.setCharge(0);
    this.setCandle(false);
    this.setLit(false);
    this.root.classList.remove("cake-state");
  }

  showCake() {
    this.setMorph(1);
    this.setCandle(true);
    this.root.classList.add("cake-state");
  }
}
