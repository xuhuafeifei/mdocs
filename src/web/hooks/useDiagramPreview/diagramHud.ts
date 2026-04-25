import { BLOCK_SELECTOR, META2_SOURCE_SELECTOR, ensureMeta2CaretAnchor } from "./diagramUtils";

export const HUD_CLASS = "mdocs-diagram-hud";

/** Dispatched on `container` (bubbles) when user clicks Edit/Delete in the corner HUD. */
export const MDOCS_DIAGRAM_HUD_EVENT = "mdocs-diagram-hud";

export type MdocsDiagramHudDetail = { action: "edit" | "delete"; block: Element };

export function removeDiagramHud(viewPre: HTMLElement): void {
  /* Vditor 重排后同一 preview 上可能挂多个过期的 .mdocs-diagram-hud，只删一个会复现双按钮/错位。 */
  viewPre.querySelectorAll(`.${HUD_CLASS}`).forEach((n) => n.remove());
}

/**
 * 删块后 Lute 会复用节点、孤儿 HUD 可能挂到别处的 preview 上；整编辑器扫一遍并移除非法 HUD。
 */
export function sweepOrphanMdocsHuds(container: Element): void {
  container.querySelectorAll(`.${HUD_CLASS}`).forEach((hud) => {
    if (!(hud instanceof HTMLElement)) {
      return;
    }
    const preview = hud.parentElement;
    if (!preview?.classList.contains("vditor-wysiwyg__preview")) {
      hud.remove();
      return;
    }
    const block = preview.closest(BLOCK_SELECTOR);
    if (!block || !block.contains(preview) || !block.querySelector(META2_SOURCE_SELECTOR)) {
      hud.remove();
    }
  });
}

/**
 * Corner overlay (bottom-right) on the preview column; shown via CSS on hover of the preview.
 * 不缓存 block：点击时从 DOM 解析当前 .vditor-wysiwyg__block，避免删块/重排后闭包还是旧节点。
 */
export function syncDiagramHud(viewPre: HTMLElement, isLocked: boolean): void {
  viewPre.style.position = "relative";
  removeDiagramHud(viewPre);
  ensureMeta2CaretAnchor(viewPre);
  if (isLocked) {
    return;
  }

  const hud = document.createElement("div");
  hud.className = HUD_CLASS;
  hud.setAttribute("contenteditable", "false");
  viewPre.appendChild(hud);

  const addBtn = (action: "edit" | "delete", label: string) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "mdocs-diagram-hud__btn";
    b.setAttribute("data-mdocs-hud", action);
    b.setAttribute("contenteditable", "false");
    b.setAttribute("aria-label", action === "edit" ? "Edit diagram" : "Delete diagram");
    b.textContent = label;
    b.addEventListener("click", (e) => {
      e.stopPropagation();
      e.preventDefault();
      const currentBlock = b.closest(BLOCK_SELECTOR) as Element | null;
      if (!currentBlock?.querySelector(META2_SOURCE_SELECTOR)) {
        return;
      }
      const detail: MdocsDiagramHudDetail = { action, block: currentBlock };
      currentBlock.dispatchEvent(
        new CustomEvent(MDOCS_DIAGRAM_HUD_EVENT, { bubbles: true, detail }),
      );
    });
    hud.appendChild(b);
  };

  addBtn("edit", "Edit");
  addBtn("delete", "Delete");
}
