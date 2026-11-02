import { html } from "../util";

/** The Back button and the four-dot progress marker. */
export class SceneNavigation {
  readonly el = html("nav", "scene-nav");
  private back = html("button", "back-button", "Back");
  private dots: HTMLSpanElement[] = [];

  constructor(count: number, onBack: () => void) {
    this.el.setAttribute("aria-label", "Story progress");
    this.back.type = "button";
    this.back.addEventListener("click", onBack);

    const progress = html("div", "progress");
    for (let i = 0; i < count; i++) {
      const dot = html("span", "progress-dot");
      this.dots.push(dot);
      progress.append(dot);
    }
    this.el.append(this.back, progress);
  }

  update(index: number) {
    this.back.classList.toggle("hidden", index === 0);
    this.back.tabIndex = index === 0 ? -1 : 0;
    this.dots.forEach((dot, i) => {
      dot.classList.toggle("current", i === index);
      dot.classList.toggle("done", i < index);
    });
    this.el.setAttribute("aria-label", `Scene ${index + 1} of ${this.dots.length}`);
  }
}
