import "canvas2svg";

const EPSILON = 1e-6;

function patchEllipse(): void {
  const Ctor = (window as any).C2S;
  if (!Ctor?.prototype || Ctor.prototype.ellipse) return;

  const TWO_PI = 2 * Math.PI;

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
    // ---------- 1. 角度标准化（与原逻辑等价，但更紧凑） ----------
    let start = sa;
    let end = ea;

    if (!ccw && end - start >= TWO_PI) {
      end = start + TWO_PI;
    } else if (ccw && start - end >= TWO_PI) {
      end = start - TWO_PI;
    } else {
      const sweep = end - start;
      if (!ccw && sweep < 0) {
        end = start + (TWO_PI + (sweep % TWO_PI));
      } else if (ccw && sweep > 0) {
        end = start - (TWO_PI - (sweep % TWO_PI));
      }
    }

    const sweep = end - start;
    const pieces = Math.max(1, Math.ceil(Math.abs(sweep) / (Math.PI / 2)));
    const delta = sweep / pieces; // 每段角度差（可为负）

    // ---------- 2. 预计算从单位圆到椭圆的仿射变换矩阵 ----------
    // 矩阵： [ a  b ]  = [ rx*cosR  -ry*sinR ]
    //        [ c  d ]    [ rx*sinR   ry*cosR ]
    const cosR = Math.cos(rotation);
    const sinR = Math.sin(rotation);
    const a = rx * cosR;
    const b = -ry * sinR;
    const cMat = rx * sinR;
    const d = ry * cosR;

    // 将单位圆上的点 (x, y) 映射到椭圆坐标系
    const transform = (x: number, y: number): [number, number] => [
      cx + a * x + b * y,
      cy + cMat * x + d * y,
    ];

    // ---------- 3. 贝塞尔曲线分段逼近 ----------
    // 循环不变量：控制点偏移系数 k（只需计算一次）
    const k = (4 / 3) * Math.tan(delta / 4);

    // 起点
    let cosCurr = Math.cos(start);
    let sinCurr = Math.sin(start);
    const [sx, sy] = transform(cosCurr, sinCurr);
    this.moveTo(sx, sy);

    for (let i = 0; i < pieces; i++) {
      const angleNext = start + (i + 1) * delta;
      const cosNext = Math.cos(angleNext);
      const sinNext = Math.sin(angleNext);

      // 单位圆上的控制点（公式保持对正负 delta 均有效）
      const cp1x = cosCurr - k * sinCurr;
      const cp1y = sinCurr + k * cosCurr;
      const cp2x = cosNext + k * sinNext;
      const cp2y = sinNext - k * cosNext;

      // 变换到椭圆空间
      const [p1x, p1y] = transform(cp1x, cp1y);
      const [p2x, p2y] = transform(cp2x, cp2y);
      const [x2, y2] = transform(cosNext, sinNext);

      this.bezierCurveTo(p1x, p1y, p2x, p2y, x2, y2);

      // 复用当前终点作为下一段起点
      cosCurr = cosNext;
      sinCurr = sinNext;
    }
  };
}

function patchLineDash(): void {
  const Ctor = (window as any).C2S;
  if (!Ctor?.prototype || Ctor.prototype.setLineDash) return;

  // ---------- 1. 基本的 set / get 实现 ----------
  Ctor.prototype.setLineDash = function (segments?: number[]) {
    this.__dashPattern =
      Array.isArray(segments) && segments.length > 0 ? segments : [];
  };

  Ctor.prototype.getLineDash = function (): number[] {
    return Array.isArray(this.__dashPattern) ? [...this.__dashPattern] : [];
  };

  // ---------- 2. lineDashOffset 属性 ----------
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

  // ---------- 3. 注入 SVG 属性输出 ----------
  const baseApply = Ctor.prototype.__applyStyleToCurrentElement;
  if (typeof baseApply !== "function") return;

  Ctor.prototype.__applyStyleToCurrentElement = function (kind: string) {
    baseApply.call(this, kind);

    if (kind !== "stroke") return;
    const node = this.__currentElement;
    if (!node?.setAttribute) return;

    const pattern: number[] = this.__dashPattern;
    const offset: number = this.__dashOffset ?? 0;

    if (pattern && pattern.length > 0) {
      node.setAttribute("stroke-dasharray", pattern.join(" "));
      if (Math.abs(offset) > EPSILON) {
        node.setAttribute("stroke-dashoffset", String(offset));
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
