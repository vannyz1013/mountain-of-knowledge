import "./styles/global.css";
import "./styles/scenes.css";
import "./styles/animations.css";

import { InfoCard } from "./components/InfoCard";
import { KnowledgeLayer } from "./components/KnowledgePoint";
import { MusicControl } from "./components/MusicControl";
import { SceneNavigation } from "./components/SceneNavigation";
import { knowledgePoints } from "./data/knowledgeData";
import { Particles } from "./particles";
import { BirthdayScene } from "./scenes/BirthdayScene";
import { MountainScene } from "./scenes/MountainScene";
import { StoryScene } from "./scenes/StoryScene";
import { TransformationScene } from "./scenes/TransformationScene";
import { Stage } from "./stage";
import { isAbort, type Scene } from "./util";

const app = document.querySelector("#app") as HTMLElement;
const world = document.querySelector("#world") as HTMLElement;
const interfaceLayer = document.querySelector("#interface") as HTMLElement;

const stage = new Stage(world);
const particles = new Particles(
  document.querySelector("#stars") as HTMLCanvasElement,
  document.querySelector("#motes") as HTMLCanvasElement,
);
const card = new InfoCard();
const knowledge = new KnowledgeLayer(knowledgePoints, stage, card);
const music = new MusicControl(`${import.meta.env.BASE_URL}audio/happy-birthday.mp3`);

let index = -1;
let controller = new AbortController();

const router = { next: () => goTo(index + 1) };
const scenes: Scene[] = [
  new StoryScene(stage, router),
  new MountainScene(stage, knowledge, router),
  new TransformationScene(stage, knowledge, particles, router),
  new BirthdayScene(stage, particles, music),
];

const navigation = new SceneNavigation(scenes.length, () => goTo(index - 1));
interfaceLayer.append(...scenes.map((s) => s.el), navigation.el, card.el);

function goTo(next: number) {
  if (next < 0 || next >= scenes.length || next === index) return;
  controller.abort();
  controller = new AbortController();
  scenes[index]?.exit();
  scenes[index]?.el.classList.remove("active");

  index = next;
  app.dataset.scene = String(index + 1);
  navigation.update(index);
  const scene = scenes[index];
  scene.el.classList.add("active");
  scene.enter(controller.signal).catch((error) => {
    if (!isAbort(error)) console.error(error);
  });
}

let resizeTimer = 0;
window.addEventListener("resize", () => {
  clearTimeout(resizeTimer);
  resizeTimer = window.setTimeout(() => {
    particles.resize();
    knowledge.clear();
    scenes[index]?.refit?.();
  }, 120);
});

goTo(0);
particles.start();
