import { html } from "../util";

const ICONS = {
  play: "M8 5v14l11-7z",
  pause: "M7 5h4v14H7zM13 5h4v14h-4z",
  sound: "M4 9v6h4l5 4V5L8 9zM16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12",
  muted: "M4 9v6h4l5 4V5L8 9zM16.5 9.5l5 5M21.5 9.5l-5 5",
  replay: "M12 5V2L7 6l5 4V7a5.5 5.5 0 1 1-5.5 5.5H4.5A7.5 7.5 0 1 0 12 5z",
};

function iconButton(label: string): { button: HTMLButtonElement; set: (icon: keyof typeof ICONS, label: string) => void } {
  const button = html("button", "icon-button");
  button.type = "button";
  const set = (icon: keyof typeof ICONS, text: string) => {
    button.setAttribute("aria-label", text);
    button.title = text;
    button.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${ICONS[icon]}"/></svg>`;
  };
  set("play", label);
  return { button, set };
}

/**
 * One <audio> element for the life of the page. Nothing loads until the first
 * start(), so there is no download and no sound before the candle is lit.
 * If the file is missing, the scene carries on and these controls step aside.
 */
export class MusicControl {
  readonly el = html("div", "music-control");
  private audio = html("audio");
  private play = iconButton("Play");
  private mute = iconButton("Mute");
  private replay = iconButton("Replay");
  private manual = html("button", "manual-play", "Play the birthday song");
  private note = html("p", "music-note");
  private loaded = false;
  private failed = false;

  constructor(private src: string) {
    this.audio.preload = "none";
    this.replay.set("replay", "Replay");
    this.mute.set("sound", "Mute");
    this.manual.type = "button";
    this.manual.hidden = true;
    this.note.hidden = true;

    const row = html("div", "music-row");
    row.append(this.play.button, this.mute.button, this.replay.button);
    this.el.append(row, this.manual, this.note, this.audio);

    this.play.button.addEventListener("click", () => {
      if (this.audio.paused) void this.attempt();
      else this.audio.pause();
    });
    this.mute.button.addEventListener("click", () => {
      this.audio.muted = !this.audio.muted;
      this.syncMute();
    });
    this.replay.button.addEventListener("click", () => {
      this.audio.currentTime = 0;
      void this.attempt();
    });
    this.manual.addEventListener("click", () => void this.attempt());

    this.audio.addEventListener("play", () => this.syncPlay());
    this.audio.addEventListener("pause", () => this.syncPlay());
    this.audio.addEventListener("ended", () => this.syncPlay());
    this.audio.addEventListener("error", () => this.fail());
  }

  /** Called from the Light the Candle click, so browsers allow playback. */
  start() {
    this.el.classList.add("visible");
    if (this.failed) return;
    if (!this.loaded) {
      this.audio.src = this.src;
      this.loaded = true;
    }
    this.audio.currentTime = 0;
    void this.attempt();
  }

  /** Silences the song when the viewer leaves the birthday scene. */
  reset() {
    this.el.classList.remove("visible");
    this.manual.hidden = true;
    if (!this.loaded) return;
    this.audio.pause();
    if (!this.failed) this.audio.currentTime = 0;
  }

  get isPlaying() {
    return !this.audio.paused;
  }

  private async attempt() {
    try {
      await this.audio.play();
      this.manual.hidden = true;
    } catch (error) {
      if (this.failed) return;
      if (error instanceof DOMException && error.name === "AbortError") return;
      if (error instanceof DOMException && error.name === "NotSupportedError") {
        this.fail();
        return;
      }
      this.manual.hidden = false;
    }
  }

  private fail() {
    this.failed = true;
    this.manual.hidden = true;
    this.play.button.hidden = true;
    this.mute.button.hidden = true;
    this.replay.button.hidden = true;
    this.note.textContent = "The song couldn't be loaded, but the wishes still stand.";
    this.note.hidden = false;
  }

  private syncPlay() {
    if (this.audio.paused) this.play.set("play", "Play");
    else this.play.set("pause", "Pause");
  }

  private syncMute() {
    if (this.audio.muted) this.mute.set("muted", "Unmute");
    else this.mute.set("sound", "Mute");
  }
}
