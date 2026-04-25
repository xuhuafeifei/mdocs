import "canvas2svg";

function applyEllipsePatch(): void {
  const ctor = (window as any).C2S;
  if (!ctor?.prototype?.ellipse) {
    ctor.prototype.ellipse = function (
      x: number, y: number, rx: number, ry: number,
      rotation: number, startAngle: number, endAngle: number,
      anticlockwise?: boolean,
    ) {
      const TAU = Math.PI * 2;
      let s = startAngle, e = endAngle;
      if (!anticlockwise && e - s >= TAU) e = s + TAU;
      else if (anticlockwise && s - e >= TAU) e = s - TAU;
      else if (!anticlockwise && s > e) e = s + (TAU - ((s - e) % TAU));
      else if (anticlockwise && s < e) e = s - (TAU - ((e - s) % TAU));

      const cos = Math.cos(rotation), sin = Math.sin(rotation);
      const pt = (t: number): [number, number] => {
        const cx = Math.cos(t), sy = Math.sin(t);
        return [x + rx * cx * cos - ry * sy * sin, y + rx * cx * sin + ry * sy * cos];
      };

      const [sx, syPt] = pt(s);
      this.moveTo(sx, syPt);

      const delta = e - s;
      const segs = Math.max(1, Math.ceil(Math.abs(delta) / (Math.PI / 2)));
      const step = delta / segs;

      for (let i = 0; i < segs; i++) {
        const t1 = s + i * step, t2 = t1 + step;
        const alpha = (4 / 3) * Math.tan((t2 - t1) / 4);
        const [p1x, p1y] = pt(t1), [p2x, p2y] = pt(t2);
        const tan1x = -Math.sin(t1) * rx, tan1y = Math.cos(t1) * ry;
        const tan2x = -Math.sin(t2) * rx, tan2y = Math.cos(t2) * ry;
        this.bezierCurveTo(
          p1x + alpha * (tan1x * cos - tan1y * sin),
          p1y + alpha * (tan1x * sin + tan1y * cos),
          p2x - alpha * (tan2x * cos - tan2y * sin),
          p2y - alpha * (tan2x * sin + tan2y * cos),
          p2x, p2y,
        );
      }
    };
  }
}

function applyDashPatch(): void {
  const ctor = (window as any).C2S;
  if (!ctor?.prototype?.setLineDash) {
    ctor.prototype.setLineDash = function (s: number[] | undefined) {
      this.lineDash = Array.isArray(s) && s.length ? s : [];
    };
    ctor.prototype.getLineDash = function (): number[] {
      return Array.isArray(this.lineDash) ? [...this.lineDash] : [];
    };
    Object.defineProperty(ctor.prototype, "lineDashOffset", {
      get() { return this._lineDashOffset ?? 0; },
      set(v: number) { this._lineDashOffset = Number(v) || 0; },
      configurable: true,
    });
    const orig = ctor.prototype.__applyStyleToCurrentElement;
    if (typeof orig === "function") {
      ctor.prototype.__applyStyleToCurrentElement = function (type: string) {
        orig.call(this, type);
        const el = this.__currentElement;
        if (type !== "stroke" || !el?.setAttribute) return;
        const dash: number[] = this.lineDash;
        if (dash?.length) {
          el.setAttribute("stroke-dasharray", dash.join(" "));
          if (this._lineDashOffset) el.setAttribute("stroke-dashoffset", String(this._lineDashOffset));
          else el.removeAttribute("stroke-dashoffset");
        } else {
          el.removeAttribute("stroke-dasharray");
          el.removeAttribute("stroke-dashoffset");
        }
      };
    }
  }
}

export function installCanvasPatches(): void {
  applyEllipsePatch();
  applyDashPatch();
}
