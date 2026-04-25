import "canvas2svg";

const EPSILON = 1e-6;

function patchEllipse(): void {
  const Ctor = (window as any).C2S;
  if (!Ctor?.prototype || Ctor.prototype.ellipse) return;

  Ctor.prototype.ellipse = function (
    cx: number,
    cy: number,
    rx: number,
    ry: number,
    rotation: number,
    sa: number,
    ea: number,
    ccw?: boolean,
  ) {
    const TWO_PI = Math.PI * 2;

    // normalize arc range
    let start = sa;
    let end = ea;
    const span = Math.abs(end - start);
    if (!ccw && end - start >= TWO_PI) {
      end = start + TWO_PI;
    } else if (ccw && start - end >= TWO_PI) {
      end = start - TWO_PI;
    } else if (!ccw && start > end) {
      end = start + (TWO_PI - ((start - end) % TWO_PI));
    } else if (ccw && start < end) {
      end = start - (TWO_PI - ((end - start) % TWO_PI));
    }

    const c = Math.cos(rotation);
    const s = Math.sin(rotation);

    const map = (t: number): [number, number] => {
      const u = Math.cos(t);
      const v = Math.sin(t);
      const px = rx * u;
      const py = ry * v;
      return [cx + px * c - py * s, cy + px * s + py * c];
    };

    const [sx, sy] = map(start);
    this.moveTo(sx, sy);

    const sweep = end - start;
    const pieces = Math.max(1, Math.ceil(Math.abs(sweep) / (Math.PI / 2)));
    const piece = sweep / pieces;

    for (let i = 0; i < pieces; i++) {
      const a1 = start + i * piece;
      const a2 = a1 + piece;
      const k = (4 / 3) * Math.tan((a2 - a1) / 4);

      const [x1, y1] = map(a1);
      const [x2, y2] = map(a2);

      const tx1 = -Math.sin(a1) * rx;
      const ty1 = Math.cos(a1) * ry;
      const tx2 = -Math.sin(a2) * rx;
      const ty2 = Math.cos(a2) * ry;

      this.bezierCurveTo(
        x1 + k * (tx1 * c - ty1 * s),
        y1 + k * (tx1 * s + ty1 * c),
        x2 - k * (tx2 * c - ty2 * s),
        y2 - k * (tx2 * s + ty2 * c),
        x2,
        y2,
      );
    }
  };
}

function patchLineDash(): void {
  const Ctor = (window as any).C2S;
  if (!Ctor?.prototype || Ctor.prototype.setLineDash) return;

  Ctor.prototype.setLineDash = function (segments?: number[]) {
    this.__dashPattern =
      Array.isArray(segments) && segments.length > 0 ? segments : [];
  };

  Ctor.prototype.getLineDash = function (): number[] {
    return Array.isArray(this.__dashPattern) ? [...this.__dashPattern] : [];
  };

  if (!Object.prototype.hasOwnProperty.call(Ctor.prototype, "lineDashOffset")) {
    Object.defineProperty(Ctor.prototype, "lineDashOffset", {
      get() {
        return this.__dashOffset ?? 0;
      },
      set(v: number) {
        this.__dashOffset = Number(v) || 0;
      },
      configurable: true,
    });
  }

  const baseApply = Ctor.prototype.__applyStyleToCurrentElement;
  if (typeof baseApply !== "function") return;

  Ctor.prototype.__applyStyleToCurrentElement = function (kind: string) {
    baseApply.call(this, kind);
    const node = this.__currentElement;
    if (kind !== "stroke" || !node?.setAttribute) return;

    const pattern: number[] = this.__dashPattern;
    if (pattern && pattern.length > 0) {
      node.setAttribute("stroke-dasharray", pattern.join(" "));
      const off = this.__dashOffset ?? 0;
      if (Math.abs(off) > EPSILON) {
        node.setAttribute("stroke-dashoffset", String(off));
      } else {
        node.removeAttribute("stroke-dashoffset");
      }
    } else {
      node.removeAttribute("stroke-dasharray");
      node.removeAttribute("stroke-dashoffset");
    }
  };
}

export function installCanvasPatches(): void {
  patchEllipse();
  patchLineDash();
}
