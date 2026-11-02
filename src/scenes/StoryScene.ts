import { storyContent } from "../data/birthdayContent";
import { Stage, VIEW } from "../stage";
import { html, type Scene, type SceneRouter } from "../util";

export class StoryScene implements Scene {
  readonly el = html("section", "scene story");

  constructor(private stage: Stage, router: SceneRouter) {
    const lines = storyContent.lines.map((line, i) => {
      const p = html("p", "story-line reveal", line);
      p.style.setProperty("--delay", `${0.5 + i * 2.1}s`);
      return p;
    });
    const title = html("h1", "story-title reveal", storyContent.title);
    title.style.setProperty("--delay", "4.5s");
    const button = html("button", "primary reveal", "Continue");
    button.type = "button";
    button.style.setProperty("--delay", "5.2s");
    button.addEventListener("click", (e) => {
      e.stopPropagation();
      router.next();
    });

    const copy = html("div", "story-copy");
    copy.append(...lines, title, button);
    this.el.append(copy);
    // Viewers who have read this before can tap once to skip the pacing.
    this.el.addEventListener("click", () => this.el.classList.add("skip"));
  }

  refit() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.stage.focus(VIEW.mountainWide, { x: w * 0.12, y: h * 0.62, w: w * 0.76, h: h * 0.46 });
  }

  async enter() {
    this.stage.showMountain();
    this.refit();
  }

  exit() {
    this.el.classList.remove("skip");
  }
}
