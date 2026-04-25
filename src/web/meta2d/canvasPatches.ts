import "canvas2svg";

export function fixEllipseRendering(): void {
  const C2S = (window as any).C2S;
  if (!C2S || C2S.prototype.ellipse) return;
  C2S.prototype.ellipse = function (
    x: number,
    y: number,
    rx: number,
    ry: number,
    rotation: number,
    startAngle: number,
    endAngle: number,
    anticlockwise?: boolean,
  ) {
    const TAU = Math.PI * 2;
    let s = startAngle;
    let e = endAngle;
    if (!anticlockwise && e - s >= TAU) {
      e = s + TAU;
    } else if (anticlockwise && s - e >= TAU) {
      e = s - TAU;
    } else if (!anticlockwise && s > e) {
      e = s + (TAU - ((s - e) % TAU));
    } else if (anticlockwise && s < e) {
      e = s - (TAU - ((e - s) % TAU));
    }

    const cos = Math.cos(rotation);
    const sin = Math.sin(rotation);
    const pointAt = (t: number): [number, number] => {
      const cx = Math.cos(t);
      const sy = Math.sin(t);
      const px = rx * cx;
      const py = ry * sy;
      return [x + px * cos - py * sin, y + px * sin + py * cos];
    };

    const [sx, syPt] = pointAt(s);
    this.moveTo(sx, syPt);

    const totalDelta = e - s;
    const segCount = Math.max(1, Math.ceil(Math.abs(totalDelta) / (Math.PI / 2)));
    const segDelta = totalDelta / segCount;

    for (let i = 0; i < segCount; i++) {
      const t1 = s + i * segDelta;
      const t2 = t1 + segDelta;
      const alpha = (4 / 3) * Math.tan((t2 - t1) / 4);

      const [p1x, p1y] = pointAt(t1);
      const [p2x, p2y] = pointAt(t2);

      const tan1x = -Math.sin(t1) * rx;
      const tan1y = Math.cos(t1) * ry;
      const tan2x = -Math.sin(t2) * rx;
      const tan2y = Math.cos(t2) * ry;

      const c1x = p1x + alpha * (tan1x * cos - tan1y * sin);
      const c1y = p1y + alpha * (tan1x * sin + tan1y * cos);
      const c2x = p2x - alpha * (tan2x * cos - tan2y * sin);
      const c2y = p2y - alpha * (tan2x * sin + tan2y * cos);

      this.bezierCurveTo(c1x, c1y, c2x, c2y, p2x, p2y);
    }
  };
}

export function fixDashPatternSupport(): void {
  const C2S = (window as any).C2S;
  if (!C2S?.prototype || C2S.prototype.setLineDash) return;

  C2S.prototype.setLineDash = function (segments: number[] | undefined) {
    this.lineDash =
      Array.isArray(segments) && segments.length > 0 ? segments : [];
    if (this.__ctx && typeof this.__ctx.setLineDash === "function") {
      this.__ctx.setLineDash(this.lineDash);
    }
  };

  C2S.prototype.getLineDash = function (): number[] {
    return Array.isArray(this.lineDash) ? [...this.lineDash] : [];
  };

  if (!Object.prototype.hasOwnProperty.call(C2S.prototype, "lineDashOffset")) {
    Object.defineProperty(C2S.prototype, "lineDashOffset", {
      get(this: any) {
        return this._lineDashOffset ?? 0;
      },
      set(this: any, v: number) {
        this._lineDashOffset = Number(v) || 0;
        if (this.__ctx && "lineDashOffset" in this.__ctx) {
          (this.__ctx as CanvasRenderingContext2D).lineDashOffset =
            this._lineDashOffset;
        }
      },
      configurable: true,
    });
  }

  const orig = C2S.prototype.__applyStyleToCurrentElement;
  if (typeof orig !== "function") return;

  C2S.prototype.__applyStyleToCurrentElement = function (
    this: any,
    type: string,
  ) {
    orig.call(this, type);
    const el = this.__currentElement;
    if (type !== "stroke" || !el?.setAttribute) return;
    const dash: number[] = this.lineDash;
    if (dash && dash.length > 0) {
      el.setAttribute("stroke-dasharray", dash.join(" "));
      const off = this._lineDashOffset ?? 0;
      if (off !== 0) {
        el.setAttribute("stroke-dashoffset", String(off));
      } else {
        el.removeAttribute("stroke-dashoffset");
      }
    } else {
      el.removeAttribute("stroke-dasharray");
      el.removeAttribute("stroke-dashoffset");
    }
  };
}
