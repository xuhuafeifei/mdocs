/**
 * 替代 lobe ReactDiffPlugin 的审阅条：
 * - Keep All / Undo All 固定在编辑区底部；写入后短暂显示，之后悬停热区才浮现
 * - 导航滚动只动 `.mdocs-editor-scroll-host`，避免整页滚到底
 */
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { createPortal } from "react-dom";
import { $getRoot, type LexicalEditor } from "lexical";
import {
  $isDiffHunkNode,
  DiffPlugin,
  acceptAllDiffOps,
  acceptDiffOp,
  rejectAllDiffOps,
  rejectDiffOp,
  useLexicalComposerContext,
  useLexicalEditor,
  type DiffChromeNode,
} from "@lobehub/editor";

type PendingOp = { opId: string; kind: string };

type HoverActions = {
  opId: string;
  left: number;
  top: number;
};

const AUTO_SHOW_MS = 4200;

function readPending(lexical: LexicalEditor): PendingOp[] {
  const list: PendingOp[] = [];
  lexical.getEditorState().read(() => {
    for (const child of $getRoot().getChildren()) {
      if (!$isDiffHunkNode(child) && child.getType() !== "diff-hunk") continue;
      const opId = $isDiffHunkNode(child)
        ? child.opId
        : String((child as { __opId?: string }).__opId ?? "");
      const kind = $isDiffHunkNode(child)
        ? child.kind
        : String((child as { __kind?: string }).__kind ?? "");
      if (opId) list.push({ kind, opId });
    }
  });
  return list;
}

function markActive(root: HTMLElement | null, opId: string | undefined) {
  if (!root) return;
  root.querySelectorAll("[data-diff-op-id]").forEach((el) => {
    el.classList.toggle(
      "is-active",
      el.getAttribute("data-diff-op-id") === opId,
    );
  });
}

/** 只滚动编辑器 scroll-host，不带动 window / 外层 layout */
function scrollOpIntoHost(opId: string | undefined) {
  if (!opId) return;
  const host = document.querySelector(
    ".mdocs-editor-scroll-host",
  ) as HTMLElement | null;
  const root = document.querySelector(
    ".mdocs-document-editor-root",
  ) as HTMLElement | null;
  const el = root?.querySelector(
    `[data-diff-op-id="${CSS.escape(opId)}"]`,
  ) as HTMLElement | null;
  if (!host || !el) return;
  const hostRect = host.getBoundingClientRect();
  const elRect = el.getBoundingClientRect();
  const pad = 24;
  if (elRect.top < hostRect.top + pad) {
    host.scrollTop -= hostRect.top + pad - elRect.top;
  } else if (elRect.bottom > hostRect.bottom - pad) {
    host.scrollTop += elRect.bottom - (hostRect.bottom - pad);
  }
}

function placeUnder(hunk: Element): HoverActions | null {
  const opId = hunk.getAttribute("data-diff-op-id");
  if (!opId) return null;
  const rect = hunk.getBoundingClientRect();
  return { left: rect.left, opId, top: rect.bottom + 4 };
}

function DiffChromeView({ node }: { node: DiffChromeNode }) {
  if (node.kind === "update" && node.oldText) {
    return (
      <div className="mdocs-diff-chrome" contentEditable={false}>
        <div className="mdocs-diff-delete-line">{node.oldText}</div>
      </div>
    );
  }
  return null;
}

function DiffReviewDock({ editor }: { editor: LexicalEditor }) {
  const [pending, setPending] = useState<PendingOp[]>([]);
  const [index, setIndex] = useState(0);
  const [lexical, setLexical] = useState<LexicalEditor | null>(null);
  const [hover, setHover] = useState<HoverActions | null>(null);
  const [pinned, setPinned] = useState(false);
  const [hotHover, setHotHover] = useState(false);
  const hoverHunkRef = useRef<Element | null>(null);
  const hideTimerRef = useRef<number | null>(null);
  const pinTimerRef = useRef<number | null>(null);
  const prevCountRef = useRef(0);

  const refresh = useCallback((lex: LexicalEditor) => {
    const next = readPending(lex);
    setPending(next);
    setIndex((i) => (next.length === 0 ? 0 : Math.min(i, next.length - 1)));
    setHover((h) => {
      if (!h || !next.some((p) => p.opId === h.opId)) {
        hoverHunkRef.current = null;
        return null;
      }
      const el = hoverHunkRef.current;
      return el ? placeUnder(el) : h;
    });
  }, []);

  useLexicalEditor((lex) => {
    setLexical(lex);
    refresh(lex);
    return lex.registerUpdateListener(() => {
      refresh(lex);
    });
  }, [refresh]);

  // agent 新写入（pending 从无到有，或数量增加）→ 短暂钉住底栏
  useEffect(() => {
    const prev = prevCountRef.current;
    prevCountRef.current = pending.length;
    if (pending.length === 0) {
      setPinned(false);
      if (pinTimerRef.current != null) {
        window.clearTimeout(pinTimerRef.current);
        pinTimerRef.current = null;
      }
      return;
    }
    if (pending.length > prev) {
      setPinned(true);
      if (pinTimerRef.current != null) window.clearTimeout(pinTimerRef.current);
      pinTimerRef.current = window.setTimeout(() => {
        setPinned(false);
        pinTimerRef.current = null;
      }, AUTO_SHOW_MS);
    }
  }, [pending.length]);

  const active = pending[index];
  useEffect(() => {
    markActive(editor.getRootElement(), active?.opId);
  }, [editor, active?.opId, pending]);

  const clearHideTimer = () => {
    if (hideTimerRef.current != null) {
      window.clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
  };
  const scheduleHide = () => {
    clearHideTimer();
    hideTimerRef.current = window.setTimeout(() => {
      hoverHunkRef.current = null;
      setHover(null);
    }, 140);
  };
  const showActionsFor = useCallback(
    (hunk: Element) => {
      clearHideTimer();
      hoverHunkRef.current = hunk;
      const next = placeUnder(hunk);
      if (!next) return;
      setHover(next);
      setIndex((i) => {
        const idx = pending.findIndex((p) => p.opId === next.opId);
        return idx >= 0 ? idx : i;
      });
    },
    [pending],
  );

  useEffect(() => {
    const root = editor.getRootElement();
    if (!root || pending.length === 0) return;
    const onOver = (e: MouseEvent) => {
      const t = e.target as HTMLElement | null;
      if (!t?.closest) return;
      if (t.closest("[data-diff-hunk-actions]")) {
        clearHideTimer();
        return;
      }
      const hunk = t.closest("[data-diff-op-id]");
      if (hunk && root.contains(hunk)) showActionsFor(hunk);
    };
    const onOut = (e: MouseEvent) => {
      const to = e.relatedTarget as HTMLElement | null;
      if (
        to?.closest?.("[data-diff-op-id]") ||
        to?.closest?.("[data-diff-hunk-actions]")
      ) {
        return;
      }
      scheduleHide();
    };
    root.addEventListener("mouseover", onOver);
    root.addEventListener("mouseout", onOut);
    return () => {
      root.removeEventListener("mouseover", onOver);
      root.removeEventListener("mouseout", onOut);
      clearHideTimer();
    };
  }, [editor, pending.length, showActionsFor]);

  useEffect(() => {
    if (!hover) return;
    const sync = () => {
      const el = hoverHunkRef.current;
      if (!el) return;
      const next = placeUnder(el);
      if (next) setHover(next);
    };
    window.addEventListener("scroll", sync, true);
    window.addEventListener("resize", sync);
    return () => {
      window.removeEventListener("scroll", sync, true);
      window.removeEventListener("resize", sync);
    };
  }, [hover]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (pending.length === 0 || !lexical || !active) return;
      const meta = e.metaKey || e.ctrlKey;
      if (meta && e.key.toLowerCase() === "y") {
        e.preventDefault();
        acceptDiffOp(lexical, active.opId);
      }
      if (meta && e.key.toLowerCase() === "n") {
        e.preventDefault();
        rejectDiffOp(lexical, active.opId);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lexical, pending, active]);

  useEffect(() => {
    return () => {
      if (pinTimerRef.current != null) window.clearTimeout(pinTimerRef.current);
    };
  }, []);

  if (pending.length === 0 || !lexical) return null;

  const go = (nextIndex: number) => {
    setIndex(nextIndex);
    scrollOpIntoHost(pending[nextIndex]?.opId);
  };

  const dockVisible = pinned || hotHover;
  const pane =
    document.querySelector(".mdocs-editor-review-pane") ?? document.body;

  const dockStyle: CSSProperties = {
    opacity: dockVisible ? 1 : 0,
    pointerEvents: dockVisible ? "auto" : "none",
    transform: dockVisible
      ? "translateX(-50%) translateY(0)"
      : "translateX(-50%) translateY(8px)",
  };

  return createPortal(
    <>
      <div
        className="mdocs-diff-dock-hotzone"
        onMouseEnter={() => setHotHover(true)}
        onMouseLeave={() => setHotHover(false)}
      >
        {/* 细热区：不挡正文点击；移入后展开完整 dock */}
        <div className="mdocs-diff-dock-hit" aria-hidden />
        <div
          className={
            "mdocs-diff-dock" + (dockVisible ? " is-visible" : "")
          }
          style={dockStyle}
          role="toolbar"
          aria-label="Diff review"
        >
          <button
            type="button"
            className="mdocs-diff-dock__nav"
            aria-label="Previous change"
            disabled={pending.length < 2}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() =>
              go((index - 1 + pending.length) % pending.length)
            }
          >
            ▲
          </button>
          <span className="mdocs-diff-dock__count">
            {index + 1} / {pending.length}
          </span>
          <button
            type="button"
            className="mdocs-diff-dock__nav"
            aria-label="Next change"
            disabled={pending.length < 2}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => go((index + 1) % pending.length)}
          >
            ▼
          </button>
          <span className="mdocs-diff-dock__spacer" />
          <button
            type="button"
            className="mdocs-diff-dock__undo"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => rejectAllDiffOps(lexical)}
          >
            Undo All
          </button>
          <button
            type="button"
            className="mdocs-diff-dock__keep"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => acceptAllDiffOps(lexical)}
          >
            Keep All
          </button>
        </div>
      </div>
      {hover
        ? createPortal(
            <div
              className="mdocs-diff-hunk-actions"
              data-diff-hunk-actions=""
              onMouseEnter={clearHideTimer}
              onMouseLeave={scheduleHide}
              style={{ left: hover.left, top: hover.top }}
            >
              <button
                type="button"
                className="mdocs-diff-dock__undo"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => rejectDiffOp(lexical, hover.opId)}
              >
                Undo ⌘N
              </button>
              <button
                type="button"
                className="mdocs-diff-dock__keep"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => acceptDiffOp(lexical, hover.opId)}
              >
                Keep ⌘Y
              </button>
            </div>,
            document.body,
          )
        : null}
    </>,
    pane,
  );
}

export function MdocsDiffPlugin() {
  const [editor] = useLexicalComposerContext();
  useMemo(() => {
    editor.registerPlugin(DiffPlugin, {
      decorator(node, _lexicalEditor) {
        return <DiffChromeView node={node} />;
      },
      theme: "mdocs-diff-hunk",
    });
  }, [editor]);
  return <DiffReviewDock editor={editor} />;
}

MdocsDiffPlugin.displayName = "MdocsDiffPlugin";
