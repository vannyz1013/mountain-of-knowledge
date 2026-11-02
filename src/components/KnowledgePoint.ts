import type { KnowledgePoint } from "../data/knowledgeData";
import { STAGE_H, STAGE_W, Stage } from "../stage";
import { svg } from "../util";
import { InfoCard } from "./InfoCard";

const HIT_RADIUS_PX = 21;
const DOT_RADIUS_PX = 3.6;

/** The lights on the mountain, the trail that joins them, and their hover and tap behaviour. */
export class KnowledgeLayer {
  readonly group = svg("g", { class: "knowledge" });
  readonly markers: SVGGElement[] = [];
  private trail = svg("path", { class: "trail" });
  private spark = svg("path", { class: "trail-spark" });
  private selected: SVGGElement | null = null;
  private lastPointer = "mouse";

  constructor(
    points: KnowledgePoint[],
    private stage: Stage,
    private card: InfoCard,
  ) {
    const xy = points.map((p) => [(p.x / 100) * STAGE_W, (p.y / 100) * STAGE_H]);
    const d = xy.reduce((acc, [x, y], i) => {
      if (i === 0) return `M${x} ${y}`;
      const [px, py] = xy[i - 1];
      return `${acc}Q${px + (x - px) * 0.5} ${py + (y - py) * 0.5 + 16} ${x} ${y}`;
    }, "");
    this.trail.setAttribute("d", d);
    this.spark.setAttribute("d", d);
    this.trail.setAttribute("pathLength", "1");
    this.spark.setAttribute("pathLength", "1");
    this.group.append(this.trail, this.spark);

    points.forEach((p, i) => this.group.append(this.createMarker(p, xy[i][0], xy[i][1], i)));
    stage.overlay.append(this.group);
    stage.onCamera(() => this.resize());
    this.resize();

    document.addEventListener("pointerdown", (e) => {
      this.lastPointer = e.pointerType;
      const onMarker = (e.target as Element).closest?.(".marker");
      if (!onMarker && e.pointerType !== "mouse") this.clear();
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") this.clear();
    });
  }

  private createMarker(point: KnowledgePoint, x: number, y: number, index: number) {
    const marker = svg("g", {
      class: `marker ${index % 5 === 2 ? "breathes" : ""}`,
      role: "button",
      tabindex: 0,
      "aria-label": point.title,
    });
    marker.style.setProperty("--order", String(index));
    marker.append(
      svg("circle", { class: "hit", cx: x, cy: y }),
      svg("circle", { class: "halo", cx: x, cy: y, fill: "url(#point-halo)" }),
      svg("circle", { class: "dot", cx: x, cy: y }),
    );

    marker.addEventListener("pointerenter", (e) => {
      if (e.pointerType === "mouse") this.select(marker, point);
    });
    marker.addEventListener("pointerleave", (e) => {
      if (e.pointerType === "mouse") this.clear();
    });
    marker.addEventListener("click", () => {
      if (this.lastPointer === "mouse") return;
      if (this.selected === marker) this.clear();
      else this.select(marker, point);
    });
    marker.addEventListener("focus", () => {
      if (marker.matches('[data-scene="2"] :focus-visible')) this.select(marker, point);
    });
    marker.addEventListener("blur", () => this.clear());
    marker.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        this.select(marker, point);
      }
    });
    this.markers.push(marker);
    return marker;
  }

  private select(marker: SVGGElement, point: KnowledgePoint) {
    this.selected?.classList.remove("active");
    this.selected = marker;
    marker.classList.add("active");
    this.card.show(point, marker.querySelector(".dot") as SVGCircleElement);
  }

  clear() {
    this.selected?.classList.remove("active");
    this.selected = null;
    this.card.hide();
  }

  /** Keeps tap targets and lights the same on-screen size at any camera zoom. */
  private resize() {
    const s = this.stage.scale || 1;
    for (const marker of this.markers) {
      marker.querySelector(".hit")?.setAttribute("r", String(HIT_RADIUS_PX / s));
      marker.querySelector(".dot")?.setAttribute("r", String(DOT_RADIUS_PX / s));
      marker.querySelector(".halo")?.setAttribute("r", String(17 / s));
    }
  }
}
