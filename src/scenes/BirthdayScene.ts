import { MusicControl } from "../components/MusicControl";
import { birthdayContent } from "../data/birthdayContent";
import { flamePosition } from "../data/silhouettes";
import { Particles } from "../particles";
import { Stage, VIEW } from "../stage";
import { html, wait, type Scene } from "../util";
import { isShortScreen } from "./layout";

export class BirthdayScene implements Scene {
  readonly el = html("section", "scene birthday");
  private thanks = html("div", "thanks");
  private button = html("button", "primary light-button", "Light the Candle");
  private heading = html("h1", "birthday-heading", birthdayContent.heading);
  private finale = html("div", "finale");

  constructor(
    private stage: Stage,
    private particles: Particles,
    private music: MusicControl,
  ) {
    birthdayContent.thanks.forEach((line, i) => {
      const p = html("p", "thanks-line reveal", line);
      p.style.setProperty("--delay", `${0.5 + i * 0.9}s`);
      this.thanks.append(p);
    });
    this.button.type = "button";
    this.button.style.setProperty("--delay", "3.2s");
    this.button.classList.add("reveal");
    this.button.addEventListener("click", () => this.light());

    const { recipientName, message, signature } = birthdayContent;
    if (recipientName) this.finale.append(html("p", "finale-to", `To ${recipientName}`));
    message.forEach((line) => this.finale.append(html("p", "finale-line", line)));
    if (signature) this.finale.append(html("p", "finale-sign", `— ${signature}`));
    this.finale.append(music.el);

    this.el.append(this.heading, this.thanks, this.button, this.finale);
  }

  private light() {
    const { stage, particles, music } = this;
    this.el.classList.add("celebrating");
    stage.setLit(true);
    music.start();
    this.refit();
    const flame = stage.toScreen(flamePosition.x, flamePosition.y);
    particles.setWarmth(1);
    particles.burst(flame.x, flame.y);
  }

  refit() {
    const w = window.innerWidth;
    if (isShortScreen()) {
      this.stage.focus(VIEW.cake, { x: 8, y: 48, w: w / 2 - 12, h: window.innerHeight - 54 });
      return;
    }
    const celebrating = this.el.classList.contains("celebrating");
    const pad = 12;
    if (celebrating) {
      // offset* gives the resting layout; these elements are still animating in at this point
      const y = this.heading.offsetTop + this.heading.offsetHeight + 4;
      this.stage.focus(VIEW.cake, { x: pad, y, w: w - pad * 2, h: Math.max(this.finale.offsetTop - y - 6, 120) });
    } else {
      const top = this.thanks.getBoundingClientRect();
      const bottom = this.button.getBoundingClientRect();
      const y = top.bottom + 4;
      this.stage.focus(VIEW.cake, { x: pad, y, w: w - pad * 2, h: Math.max(bottom.top - y - 10, 120) });
    }
  }

  async enter(signal: AbortSignal) {
    this.stage.showCake();
    this.stage.setLit(false);
    this.particles.setWarmth(1);
    this.el.closest("#app")?.classList.add("warm");
    this.refit();
    await wait(0, signal);
  }

  exit() {
    this.el.classList.remove("celebrating");
    this.music.reset();
    this.stage.setLit(false);
    this.particles.setWarmth(0);
    this.el.closest("#app")?.classList.remove("warm");
  }
}
