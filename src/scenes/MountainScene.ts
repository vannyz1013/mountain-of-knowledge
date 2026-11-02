import { KnowledgeLayer } from "../components/KnowledgePoint";
import { mountainContent } from "../data/birthdayContent";
import { Stage, VIEW } from "../stage";
import { html, isCoarsePointer, wait, type Scene, type SceneRouter } from "../util";
import { isShortScreen } from "./layout";

export class MountainScene implements Scene {
  readonly el = html("section", "scene mountain");
  private hint = html("p", "mountain-hint");

  constructor(private stage: Stage, private knowledge: KnowledgeLayer, router: SceneRouter) {
    const footer = html("div", "scene-footer");
    const tagline = html("p", "tagline", mountainContent.tagline);
    const button = html("button", "primary", "Continue");
    button.type = "button";
    button.addEventListener("click", () => router.next());
    footer.append(this.hint, tagline, button);
    this.el.append(footer);
  }

  refit() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const portrait = w / h < 0.95;
    const bottom = isShortScreen() ? 74 : portrait ? 158 : 150;
    this.stage.focus(portrait ? VIEW.mountainNarrow : VIEW.mountainWide, {
      x: 0,
      y: 40,
      w,
      h: h - bottom - 40,
    });
  }

  async enter(signal: AbortSignal) {
    this.stage.showMountain();
    this.refit();
    this.hint.textContent = isCoarsePointer() ? mountainContent.hint.touch : mountainContent.hint.hover;
    await wait(2200, signal);
    this.stage.root.classList.add("trail-on");
  }

  exit() {
    this.knowledge.clear();
    this.stage.root.classList.remove("trail-on");
  }
}
