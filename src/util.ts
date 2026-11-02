export const reducedMotion = (): boolean =>
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export const isCoarsePointer = (): boolean => window.matchMedia("(hover: none)").matches;

export const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));

export const smoothstep = (a: number, b: number, x: number): number => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

export const easeInOut = (t: number): number =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

/** Small seeded generator, so the scattered details land in the same place on every visit. */
export const seeded = (seed: number) => () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const aborted = () => new DOMException("Scene left", "AbortError");

/** Resolves after ms; rejects when the viewer leaves the scene. */
export const wait = (ms: number, signal: AbortSignal): Promise<void> =>
  new Promise((resolve, reject) => {
    if (signal.aborted) return reject(aborted());
    const id = window.setTimeout(resolve, ms);
    signal.addEventListener("abort", () => {
      clearTimeout(id);
      reject(aborted());
    }, { once: true });
  });

/** Runs onFrame with progress 0..1 on each animation frame. */
export const tween = (
  duration: number,
  onFrame: (t: number) => void,
  signal: AbortSignal,
): Promise<void> =>
  new Promise((resolve, reject) => {
    if (signal.aborted) return reject(aborted());
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const t = clamp((now - start) / duration, 0, 1);
      onFrame(t);
      if (t < 1) raf = requestAnimationFrame(tick);
      else resolve();
    };
    raf = requestAnimationFrame(tick);
    signal.addEventListener("abort", () => {
      cancelAnimationFrame(raf);
      reject(aborted());
    }, { once: true });
  });

export const isAbort = (e: unknown): boolean =>
  e instanceof DOMException && e.name === "AbortError";

type Attrs = Record<string, string | number>;

export function html<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className = "",
  text = "",
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}

export function svg<K extends keyof SVGElementTagNameMap>(
  tag: K,
  attrs: Attrs = {},
): SVGElementTagNameMap[K] {
  const node = document.createElementNS("http://www.w3.org/2000/svg", tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, String(v));
  return node;
}

export interface Scene {
  el: HTMLElement;
  enter(signal: AbortSignal): Promise<void>;
  exit(): void;
  refit?(): void;
}

export interface SceneRouter {
  next(): void;
}
