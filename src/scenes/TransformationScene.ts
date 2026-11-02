import { KnowledgeLayer } from "../components/KnowledgePoint";
import { transformationContent } from "../data/birthdayContent";
import { Particles } from "../particles";
import { Stage, VIEW } from "../stage";
import { easeInOut, html, reducedMotion, tween, wait, type Scene, type SceneRouter } from "../util";
import { isShortScreen } from "./layout";

const GATHER = { x: 500, y: 430 };

export class TransformationScene implements Scene {
  readonly el = html("section", "scene transformation");
  private lines: HTMLParagraphElement[];
  private button = html("button", "primary", "Continue");

  constructor(
    private stage: Stage,
    private knowledge: KnowledgeLayer,
    private particles: Particles,
    router: SceneRouter,
  ) {
    this.lines = transformationContent.lines.map((line) => html("p", "caption", line));
    this.button.type = "button";
    this.button.addEventListener("click", () => router.next());
    const footer = html("div", "scene-footer");
    footer.append(...this.lines, this.button);
    this.el.append(footer);
  }

  refit() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    if (isShortScreen()) this.stage.focus(VIEW.cake, { x: 8, y: 48, w: w / 2 - 12, h: h - 54 });
    else this.stage.focus(VIEW.cake, { x: 12, y: 44, w: w - 24, h: h - 190 - 44 });
  }

  private frameMountain() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const bottom = isShortScreen() ? 74 : 190;
    this.stage.focus(w / h < 0.95 ? VIEW.mountainNarrow : VIEW.mountainWide, { x: 0, y: 40, w, h: h - bottom - 40 });
  }

  /** Symbols and lights lift off the rock and drift toward the centre, each in its own time. */
  private release(signal: AbortSignal) {
    const elements: { el: SVGGElement; x: number; y: number }[] = [
      ...this.stage.glyphs.map((el) => ({ el, x: Number(el.dataset.x), y: Number(el.dataset.y) })),
      ...this.knowledge.markers.map((el) => {
        const dot = el.querySelector(".dot") as SVGCircleElement;
        return { el, x: Number(dot.getAttribute("cx")), y: Number(dot.getAttribute("cy")) };
      }),
    ];
    for (const { el, x, y } of elements) {
      const dx = GATHER.x - x;
      const dy = GATHER.y - y;
      const reach = Math.hypot(dx, dy);
      const float = 16 + Math.random() * 26;
      const motion = el.animate(
        [
          { transform: "translate(0, 0) scale(1)", opacity: 1 },
          { transform: `translate(${dx * 0.1}px, ${dy * 0.1 - float}px) scale(1.15)`, opacity: 1, offset: 0.34 },
          { transform: `translate(${dx}px, ${dy}px) scale(0.2)`, opacity: 0 },
        ],
        {
          duration: 2800 + Math.random() * 900,
          delay: 120 + (800 - Math.min(reach, 800)) * 0.9 + Math.random() * 500,
          easing: "cubic-bezier(.5,.02,.42,1)",
          fill: "forwards",
        },
      );
      signal.addEventListener("abort", () => motion.cancel(), { once: true });
    }
  }

  private show(line: HTMLElement) {
    line.classList.add("in");
  }

  private async playReduced(signal: AbortSignal) {
    this.stage.root.classList.add("released");
    this.stage.showCake();
    this.stage.root.classList.add("fade-swap");
    this.lines.forEach((line) => this.show(line));
    await wait(600, signal);
    this.show(this.button);
    this.el.closest("#app")?.classList.add("warm");
  }

  async enter(signal: AbortSignal) {
    const { stage, particles } = this;
    const app = this.el.closest("#app");
    stage.showMountain();
    stage.setCandle(false);
    app?.classList.remove("warm");
    this.lines.forEach((l) => l.classList.remove("in"));
    this.button.classList.remove("in");
    stage.root.classList.remove("released", "glow-points", "cake-state", "fade-swap");
    this.frameMountain();

    if (reducedMotion()) return this.playReduced(signal);

    // 1 and 2: the mountain charges up and its lights brighten
    stage.root.classList.add("glow-points");
    void tween(1500, (t) => stage.setCharge(easeInOut(t)), signal).catch(() => {});
    await wait(900, signal);
    this.show(this.lines[0]);
    await wait(900, signal);

    // 3 and 4: knowledge lifts away and gathers at the centre
    this.release(signal);
    const gather = stage.toScreen(GATHER.x, GATHER.y);
    particles.attract(gather, 70);
    await wait(2000, signal);

    // 5, 6 and 7: the silhouette itself changes, and cool light turns warm
    this.refit();
    app?.classList.add("warm");
    await tween(6000, (t) => {
      const eased = (1 - Math.cos(t * Math.PI)) / 2;
      stage.setMorph(eased);
      particles.setWarmth(eased);
    }, signal);
    stage.showCake();
    stage.root.classList.remove("glow-points");
    particles.attract(null);

    // 8: the candle
    stage.setCandle(true);
    await wait(500, signal);
    this.lines[0].classList.remove("in");
    await wait(500, signal);
    this.show(this.lines[1]);
    await wait(1500, signal);
    this.show(this.button);
  }

  exit() {
    this.particles.attract(null);
    this.particles.setWarmth(0);
    this.stage.root.classList.remove("released", "glow-points", "fade-swap");
    this.el.closest("#app")?.classList.remove("warm");
  }
}
