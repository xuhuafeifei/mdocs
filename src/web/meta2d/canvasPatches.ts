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
    if (typeof this.save === "function") this.save();
    if (typeof this.translate === "function") this.translate(x, y);
    if (rotation && typeof this.rotate === "function") this.rotate(rotation);
    if (typeof this.scale === "function") this.scale(rx, ry);
    if (typeof this.arc === "function") {
      this.arc(0, 0, 1, startAngle, endAngle, !!anticlockwise);
    }
    if (typeof this.restore === "function") this.restore();
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
    const dash: number[] = Array.isArray(this.lineDash) ? this.lineDash : [];
    if (dash.length === 0) {
      el.removeAttribute("stroke-dasharray");
      el.removeAttribute("stroke-dashoffset");
      return;
    }
    el.setAttribute("stroke-dasharray", dash.join(" "));
    const off = this._lineDashOffset ?? 0;
    if (off) {
      el.setAttribute("stroke-dashoffset", String(off));
    } else {
      el.removeAttribute("stroke-dashoffset");
    }
  };
}
