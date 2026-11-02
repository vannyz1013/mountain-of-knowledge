import type { KnowledgePoint } from "../data/knowledgeData";
import { clamp, html } from "../util";

const MARGIN = 12;
const GAP = 18;

/** Turns "x^2 + a_n" style shorthand into DOM nodes, so formulas stay plain strings in the data file. */
export function renderFormula(source: string): DocumentFragment {
  const out = document.createDocumentFragment();
  let i = 0;
  let buffer = "";

  const flush = () => {
    if (buffer) out.append(buffer);
    buffer = "";
  };
  const readToken = (): string => {
    if (source[i] === "{") {
      const end = source.indexOf("}", i);
      const token = source.slice(i + 1, end);
      i = end + 1;
      return token;
    }
    return source[i++] ?? "";
  };

  while (i < source.length) {
    const c = source[i];
    if (c !== "_" && c !== "^") {
      buffer += c;
      i++;
      continue;
    }
    flush();
    i++;
    const first = readToken();
    const paired = source[i] === (c === "_" ? "^" : "_");
    if (paired) {
      i++;
      const second = readToken();
      const stack = html("span", "script-stack");
      stack.append(html("sup", "", c === "^" ? first : second), html("sub", "", c === "_" ? first : second));
      out.append(stack);
    } else {
      out.append(html(c === "^" ? "sup" : "sub", "", first));
    }
  }
  flush();
  return out;
}

/** The floating card. Positioned from the live marker, and always kept inside the viewport. */
export class InfoCard {
  readonly el = html("aside", "info-card");
  private topic = html("p", "card-topic");
  private title = html("h2", "card-title");
  private text = html("p", "card-text");
  private formula = html("p", "card-formula");
  private source = html("p", "card-source");

  constructor() {
    this.el.setAttribute("role", "status");
    this.el.append(this.topic, this.title, this.text, this.formula, this.source);
  }

  show(point: KnowledgePoint, anchor: Element) {
    this.topic.textContent = point.topic;
    this.title.textContent = point.title;
    this.text.textContent = point.description;
    this.formula.replaceChildren(point.formula ? renderFormula(point.formula) : "");
    this.formula.hidden = !point.formula;
    this.source.textContent = point.source ?? "";
    this.source.hidden = !point.source;

    const a = anchor.getBoundingClientRect();
    const box = this.el.getBoundingClientRect();
    const width = this.el.offsetWidth || box.width;
    const height = this.el.offsetHeight || box.height;
    const vw = document.documentElement.clientWidth;
    const vh = window.innerHeight;
    const cx = a.left + a.width / 2;
    const cy = a.top + a.height / 2;

    const fitsAbove = cy - GAP - height >= MARGIN;
    const fitsBelow = cy + GAP + height <= vh - MARGIN;
    const top = fitsAbove || !fitsBelow ? cy - GAP - height : cy + GAP;

    this.el.style.left = `${clamp(cx - width / 2, MARGIN, vw - width - MARGIN)}px`;
    this.el.style.top = `${clamp(top, MARGIN, vh - height - MARGIN)}px`;
    this.el.classList.add("visible");
  }

  hide() {
    this.el.classList.remove("visible");
  }
}
