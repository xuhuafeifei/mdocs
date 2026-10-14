import { useEffect, useRef, useState } from "react";
import deepseekLogoUrl from "../assets/deepseek.svg";
import { useI18n } from "../i18n";

export type AgentFabPos = { left: number; bottom: number };

export const AGENT_FAB_DEFAULT: AgentFabPos = { left: 12, bottom: 64 };
const STORAGE_KEY = "mdocs.agentFabPosition";
const FAB_SIZE = 36;
/** 浮层默认落在 480–520 这一档，避免一打开就占满半屏 */
export const AGENT_PANEL_WIDTH_DEFAULT = 500;
export const AGENT_PANEL_WIDTH_MIN = 400;
export const AGENT_PANEL_WIDTH_MAX = 960;
const AGENT_PANEL_WIDTH_KEY = "mdocs.agentPanelWidth";

export function clampAgentPanelWidth(width: number): number {
  const viewportMax =
    typeof window === "undefined"
      ? AGENT_PANEL_WIDTH_MAX
      : Math.max(
          AGENT_PANEL_WIDTH_MIN,
          Math.min(AGENT_PANEL_WIDTH_MAX, window.innerWidth - 32),
        );
  if (!Number.isFinite(width)) return Math.min(AGENT_PANEL_WIDTH_DEFAULT, viewportMax);
  return Math.min(viewportMax, Math.max(AGENT_PANEL_WIDTH_MIN, Math.round(width)));
}

export function loadAgentPanelWidth(): number {
  try {
    const raw = localStorage.getItem(AGENT_PANEL_WIDTH_KEY);
    if (!raw) return clampAgentPanelWidth(AGENT_PANEL_WIDTH_DEFAULT);
    return clampAgentPanelWidth(Number(raw));
  } catch {
    return clampAgentPanelWidth(AGENT_PANEL_WIDTH_DEFAULT);
  }
}

export function saveAgentPanelWidth(width: number): void {
  try {
    localStorage.setItem(AGENT_PANEL_WIDTH_KEY, String(clampAgentPanelWidth(width)));
  } catch {
    // 隐私模式或配额满时忽略，本次会话仍用内存宽度
  }
}
/** 超过该像素位移才算拖动（否则松开视为点击开关面板） */
const CLICK_SLOP = 3;

function clampPos(pos: AgentFabPos): AgentFabPos {
  const margin = 8;
  const maxLeft = Math.max(margin, window.innerWidth - FAB_SIZE - margin);
  const maxBottom = Math.max(margin, window.innerHeight - FAB_SIZE - margin);
  return {
    left: Math.min(maxLeft, Math.max(margin, pos.left)),
    bottom: Math.min(maxBottom, Math.max(margin, pos.bottom)),
  };
}

function clientToPos(clientX: number, clientY: number, offsetX: number, offsetY: number): AgentFabPos {
  const left = clientX - offsetX;
  const top = clientY - offsetY;
  const bottom = window.innerHeight - top - FAB_SIZE;
  return clampPos({ left, bottom });
}

function loadPos(): AgentFabPos {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return AGENT_FAB_DEFAULT;
    const parsed = JSON.parse(raw) as Partial<AgentFabPos>;
    if (typeof parsed.left !== "number" || typeof parsed.bottom !== "number") {
      return AGENT_FAB_DEFAULT;
    }
    return clampPos({ left: parsed.left, bottom: parsed.bottom });
  } catch {
    return AGENT_FAB_DEFAULT;
  }
}

function savePos(pos: AgentFabPos): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(pos));
}

function isDefaultPos(pos: AgentFabPos): boolean {
  return pos.left === AGENT_FAB_DEFAULT.left && pos.bottom === AGENT_FAB_DEFAULT.bottom;
}

/** 按 FAB 位置计算聊天面板 left/bottom（尽量贴在入口旁，避让视口边缘） */
export function agentPanelAnchorStyle(
  fab: AgentFabPos,
  panelWidth?: number,
): React.CSSProperties {
  const gap = 8;
  const panelW = clampAgentPanelWidth(panelWidth ?? loadAgentPanelWidth());
  let left = fab.left + FAB_SIZE + gap;
  if (left + panelW > window.innerWidth - 8) {
    left = fab.left - gap - panelW;
  }
  const maxLeft = Math.max(8, window.innerWidth - panelW - 8);
  left = Math.max(8, Math.min(left, maxLeft));
  const bottom = Math.max(8, fab.bottom - 8);
  return { left, bottom };
}

export function AgentFab(props: {
  open: boolean;
  onToggle: () => void;
  position: AgentFabPos;
  onPositionChange: (pos: AgentFabPos) => void;
  /** 保留：强制固定默认位、禁止拖动（默认允许拖动，含手机） */
  disableDrag?: boolean;
}) {
  const { t } = useI18n();
  const disableDrag = Boolean(props.disableDrag);
  const [dragging, setDragging] = useState(false);
  // 拖动跟手用本地坐标，避免每帧 setState 打到 App 导致整页卡顿
  const [livePos, setLivePos] = useState(props.position);
  const fabRef = useRef<HTMLButtonElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const livePosRef = useRef(livePos);
  const onPositionChangeRef = useRef(props.onPositionChange);
  const onToggleRef = useRef(props.onToggle);
  livePosRef.current = livePos;
  onPositionChangeRef.current = props.onPositionChange;
  onToggleRef.current = props.onToggle;

  const dragRef = useRef<{
    pointerId: number;
    offsetX: number;
    offsetY: number;
    startX: number;
    startY: number;
    didMove: boolean;
  } | null>(null);
  const rafRef = useRef(0);
  const pendingPosRef = useRef<AgentFabPos | null>(null);

  // 非拖动时跟外部位置同步（重置 / 父级 clamp）
  useEffect(() => {
    if (dragRef.current) return;
    setLivePos(props.position);
    livePosRef.current = props.position;
  }, [props.position]);

  useEffect(() => {
    function onResize() {
      const next = clampPos(livePosRef.current);
      if (next.left === livePosRef.current.left && next.bottom === livePosRef.current.bottom) return;
      livePosRef.current = next;
      setLivePos(next);
      onPositionChangeRef.current(next);
      savePos(next);
    }
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    function applyPendingPos() {
      rafRef.current = 0;
      const next = pendingPosRef.current;
      if (!next) return;
      pendingPosRef.current = null;
      livePosRef.current = next;
      setLivePos(next);
      // 直接写 DOM，减少 React 提交延迟带来的粘滞感
      const el = wrapRef.current;
      if (el) {
        el.style.left = `${next.left}px`;
        el.style.bottom = `${next.bottom}px`;
      }
      // 同步给壳组件（面板跟手）；壳很轻，不会打到整页 App
      onPositionChangeRef.current(next);
    }

    function onPointerMove(e: PointerEvent) {
      const drag = dragRef.current;
      if (!drag || e.pointerId !== drag.pointerId) return;
      e.preventDefault();
      const dx = e.clientX - drag.startX;
      const dy = e.clientY - drag.startY;
      if (!drag.didMove && dx * dx + dy * dy >= CLICK_SLOP * CLICK_SLOP) {
        drag.didMove = true;
        setDragging(true);
      }
      if (!drag.didMove) return;
      pendingPosRef.current = clientToPos(e.clientX, e.clientY, drag.offsetX, drag.offsetY);
      if (!rafRef.current) {
        rafRef.current = requestAnimationFrame(applyPendingPos);
      }
    }

    function onPointerUp(e: PointerEvent) {
      const drag = dragRef.current;
      if (!drag || e.pointerId !== drag.pointerId) return;
      dragRef.current = null;
      setDragging(false);
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = 0;
      }
      if (pendingPosRef.current) {
        livePosRef.current = pendingPosRef.current;
        setLivePos(pendingPosRef.current);
        pendingPosRef.current = null;
      }
      try {
        fabRef.current?.releasePointerCapture(e.pointerId);
      } catch {
        // ignore
      }
      if (drag.didMove) {
        const finalPos = livePosRef.current;
        onPositionChangeRef.current(finalPos);
        savePos(finalPos);
        return;
      }
      onToggleRef.current();
    }

    window.addEventListener("pointermove", onPointerMove, { passive: false });
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointercancel", onPointerUp);
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerUp);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  function onPointerDown(e: React.PointerEvent<HTMLButtonElement>): void {
    if (e.button !== 0) return;
    if (disableDrag) {
      e.preventDefault();
      props.onToggle();
      return;
    }
    e.preventDefault();
    const rect = e.currentTarget.getBoundingClientRect();
    dragRef.current = {
      pointerId: e.pointerId,
      offsetX: e.clientX - rect.left,
      offsetY: e.clientY - rect.top,
      startX: e.clientX,
      startY: e.clientY,
      didMove: false,
    };
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function resetPosition(): void {
    livePosRef.current = AGENT_FAB_DEFAULT;
    setLivePos(AGENT_FAB_DEFAULT);
    props.onPositionChange(AGENT_FAB_DEFAULT);
    localStorage.removeItem(STORAGE_KEY);
  }

  const displayPos = disableDrag ? AGENT_FAB_DEFAULT : livePos;
  const moved = !disableDrag && !isDefaultPos(livePos);

  return (
    <div
      ref={wrapRef}
      className={"mdocs-agent-fab-wrap" + (dragging ? " dragging" : "")}
      style={{ left: displayPos.left, bottom: displayPos.bottom }}
    >
      <button
        ref={fabRef}
        type="button"
        className={
          "mdocs-agent-fab" +
          (props.open ? " open" : "") +
          (dragging ? " dragging" : "") +
          (disableDrag ? " mdocs-agent-fab--nodrag" : "")
        }
        aria-label={t("agentFabOpen")}
        aria-expanded={props.open}
        onPointerDown={onPointerDown}
      >
        <img src={deepseekLogoUrl} alt="" draggable={false} />
      </button>
      {moved && (
        <button
          type="button"
          className="mdocs-agent-fab-reset"
          onClick={resetPosition}
          aria-label={t("agentFabReset")}
        >
          {t("agentFabReset")}
        </button>
      )}
    </div>
  );
}

export function useAgentFabPosition(): [AgentFabPos, (pos: AgentFabPos) => void] {
  const [position, setPosition] = useState<AgentFabPos>(() =>
    typeof window === "undefined" ? AGENT_FAB_DEFAULT : loadPos(),
  );
  return [position, setPosition];
}
