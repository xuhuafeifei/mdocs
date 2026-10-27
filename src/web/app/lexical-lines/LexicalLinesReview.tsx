import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type RefObject,
} from "react";
import { Button, Space, Typography, message } from "antd";
import { computeLexicalDiffRows } from "@lobehub/editor/renderer";
import {
  buildProposedEditorState,
  parseEditorState,
  type LexicalLinesMode,
} from "./buildProposedLexical";
import {
  buildFinalFromDecisions,
  buildReviewEditorState,
  groupHunks,
  type HunkDecision,
  type ReviewHunkPlacement,
} from "./buildReviewState";

export type LexicalLinesProposal = {
  documentId: string;
  mode: LexicalLinesMode;
  lines: Record<string, string>;
  markdown?: string;
  baseLexicalJson: string;
};

type Props = {
  proposal: LexicalLinesProposal;
  /** 滚动宿主（量块位置 / scrollIntoView） */
  scrollHostRef: RefObject<HTMLElement | null> | RefObject<HTMLDivElement | null>;
  /** 不滚动的外层（浮层挂这里，避免跟文档滚到底） */
  paneRef: RefObject<HTMLElement | null> | RefObject<HTMLDivElement | null>;
  onClose: () => void;
  onApply: (lexicalJson: string) => void;
  onPreviewChange: (lexicalJson: string | null) => void;
};

type FloatPos = { id: string; hunkIndex: number; top: number; right: number };

function getEditableRoot(host: HTMLElement): HTMLElement | null {
  // 审阅期 editable=false → contenteditable="false"，不能只查 true
  const byAttr =
    (host.querySelector('[contenteditable="true"]') as HTMLElement | null) ||
    (host.querySelector('[contenteditable="false"]') as HTMLElement | null);
  if (byAttr) return byAttr;
  const root = host.querySelector(".mdocs-document-editor-root");
  return (root?.firstElementChild as HTMLElement | null) ?? null;
}

/**
 * 控制器 + 浮层：正文在 live Editor；本组件挂在不滚动的 pane 上，
 * Accept/Reject 贴着变更块，顶栏固定在编辑区顶部。
 */
export function LexicalLinesReview(props: Props) {
  const { proposal, scrollHostRef, paneRef, onClose, onApply, onPreviewChange } =
    props;
  const [decisions, setDecisions] = useState<Record<string, HunkDecision>>({});
  const [activeHunk, setActiveHunk] = useState(0);
  const [floats, setFloats] = useState<FloatPos[]>([]);
  const [placements, setPlacements] = useState<ReviewHunkPlacement[]>([]);
  const finishingRef = useRef(false);
  const didInitialScroll = useRef(false);

  const oldValue = useMemo(
    () => parseEditorState(proposal.baseLexicalJson),
    [proposal],
  );
  const newValue = useMemo(
    () =>
      buildProposedEditorState(
        proposal.baseLexicalJson,
        proposal.mode,
        proposal.lines,
        proposal.markdown,
      ),
    [proposal],
  );

  const rows = useMemo(
    () => computeLexicalDiffRows(oldValue, newValue),
    [oldValue, newValue],
  );
  const hunks = useMemo(() => groupHunks(rows), [rows]);

  const pendingIndexes = useMemo(
    () =>
      hunks
        .map((h, i) => i)
        .filter((i) => (decisions[hunks[i]!.id] ?? "pending") === "pending"),
    [hunks, decisions],
  );

  useEffect(() => {
    setDecisions({});
    setActiveHunk(0);
    finishingRef.current = false;
    didInitialScroll.current = false;
  }, [proposal.documentId, proposal.mode, proposal.lines, proposal.markdown]);

  useEffect(() => {
    const built = buildReviewEditorState(rows, hunks, decisions);
    setPlacements(built.placements);
    onPreviewChange(JSON.stringify(built.state));
  }, [rows, hunks, decisions, onPreviewChange]);

  useEffect(() => {
    return () => {
      onPreviewChange(null);
    };
  }, [onPreviewChange]);

  useEffect(() => {
    if (pendingIndexes.length === 0) return;
    if (!pendingIndexes.includes(activeHunk)) {
      setActiveHunk(pendingIndexes[0]!);
    }
  }, [pendingIndexes, activeHunk]);

  const paintDomChrome = () => {
    const host = scrollHostRef.current;
    const pane = paneRef.current;
    if (!host || !pane) return;
    const editable = getEditableRoot(host);
    if (!editable) return;

    const blocks = Array.from(editable.children) as HTMLElement[];
    for (const el of blocks) {
      el.classList.remove(
        "mdocs-inline-diff-block",
        "is-delete",
        "is-insert",
        "is-hunk-active",
      );
    }

    const paneRect = pane.getBoundingClientRect();
    const nextFloats: FloatPos[] = [];

    for (const p of placements) {
      const isActive = p.hunkIndex === activeHunk;
      for (let i = p.blockStart; i < p.blockEnd; i++) {
        const el = blocks[i];
        if (!el) continue;
        const role = p.roles[i - p.blockStart] ?? "plain";
        el.classList.add("mdocs-inline-diff-block");
        if (role === "delete") el.classList.add("is-delete");
        if (role === "insert") el.classList.add("is-insert");
        if (isActive) el.classList.add("is-hunk-active");
      }

      const anchor = blocks[p.blockStart];
      if (!anchor) continue;
      const ar = anchor.getBoundingClientRect();
      // 相对不滚动 pane 定位；块在视口外则夹紧到可见区边缘仍显示按钮
      let top = ar.top - paneRect.top;
      const minTop = 52;
      const maxTop = Math.max(minTop, paneRect.height - 44);
      if (top < minTop) top = minTop;
      if (top > maxTop) top = maxTop;
      // 完全滚出上下则仍为 active hunk 显示，其它 hunk 隐藏
      const fullyAway =
        ar.bottom < paneRect.top + 8 || ar.top > paneRect.bottom - 8;
      if (fullyAway && !isActive) continue;

      nextFloats.push({
        id: p.id,
        hunkIndex: p.hunkIndex,
        top,
        right: 12,
      });
    }
    setFloats(nextFloats);
  };

  useLayoutEffect(() => {
    let cancelled = false;
    const run = () => {
      if (!cancelled) paintDomChrome();
    };
    const id0 = window.requestAnimationFrame(run);
    const id1 = window.setTimeout(run, 32);
    const id2 = window.setTimeout(run, 120);
    const id3 = window.setTimeout(run, 280);
    return () => {
      cancelled = true;
      window.cancelAnimationFrame(id0);
      window.clearTimeout(id1);
      window.clearTimeout(id2);
      window.clearTimeout(id3);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [placements, activeHunk, scrollHostRef, paneRef]);

  useEffect(() => {
    const host = scrollHostRef.current;
    if (!host) return;
    const onScroll = () => paintDomChrome();
    host.addEventListener("scroll", onScroll, { passive: true });
    const ro = new ResizeObserver(() => paintDomChrome());
    ro.observe(host);
    const pane = paneRef.current;
    if (pane) ro.observe(pane);
    return () => {
      host.removeEventListener("scroll", onScroll);
      ro.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [placements, activeHunk, scrollHostRef, paneRef]);

  // 进入审阅 / 切 hunk：滚到变更处
  useEffect(() => {
    const p = placements.find((x) => x.hunkIndex === activeHunk);
    if (!p) return;
    const host = scrollHostRef.current;
    const editable = host ? getEditableRoot(host) : null;
    const el = editable?.children[p.blockStart] as HTMLElement | undefined;
    if (!el) return;
    const behavior = didInitialScroll.current ? "smooth" : "instant";
    didInitialScroll.current = true;
    el.scrollIntoView({
      behavior: behavior as ScrollBehavior,
      block: "center",
    });
    window.setTimeout(() => paintDomChrome(), 50);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeHunk, placements, scrollHostRef]);

  const finishWith = (next: Record<string, HunkDecision>) => {
    if (finishingRef.current) return;
    finishingRef.current = true;
    try {
      const final = buildFinalFromDecisions(rows, hunks, next);
      onApply(JSON.stringify(final));
      message.success("已写入编辑器（尚未发布）");
      onClose();
    } catch (e) {
      finishingRef.current = false;
      message.error(e instanceof Error ? e.message : String(e));
    }
  };

  const decide = (hunkIndex: number, d: HunkDecision) => {
    const h = hunks[hunkIndex];
    if (!h) return;
    const next = { ...decisions, [h.id]: d };
    setDecisions(next);
    setActiveHunk(hunkIndex);

    const allDone = hunks.every((x) => (next[x.id] ?? "pending") !== "pending");
    if (allDone) {
      finishWith(next);
      return;
    }
    const nextPending = hunks.findIndex(
      (x, i) => i > hunkIndex && (next[x.id] ?? "pending") === "pending",
    );
    const wrapPending = hunks.findIndex(
      (x) => (next[x.id] ?? "pending") === "pending",
    );
    setActiveHunk(nextPending >= 0 ? nextPending : wrapPending);
  };

  const goPending = (delta: number) => {
    if (pendingIndexes.length === 0) return;
    const cur = pendingIndexes.indexOf(activeHunk);
    const base = cur >= 0 ? cur : 0;
    const next =
      pendingIndexes[
        (base + delta + pendingIndexes.length) % pendingIndexes.length
      ]!;
    setActiveHunk(next);
  };

  const pendingCount = pendingIndexes.length;
  const navPos =
    pendingCount === 0
      ? 0
      : Math.max(0, pendingIndexes.indexOf(activeHunk)) + 1;

  return (
    <div className="mdocs-lexical-lines-review mdocs-lexical-lines-review--overlay">
      <div className="mdocs-lexical-lines-review__bar">
        <Space size="small" wrap>
          <Typography.Text strong>审阅更改</Typography.Text>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            剩余 {pendingCount} / {hunks.length}
          </Typography.Text>
          {pendingCount > 0 ? (
            <>
              <Button size="small" onClick={() => decide(activeHunk, "rejected")}>
                拒绝
              </Button>
              <Button
                size="small"
                type="primary"
                className="mdocs-inline-diff-hunk__accept"
                onClick={() => decide(activeHunk, "accepted")}
              >
                接受
              </Button>
              {pendingCount > 1 ? (
                <span className="mdocs-inline-diff-nav__count">
                  {navPos}/{pendingCount}
                </span>
              ) : null}
              {pendingCount > 1 ? (
                <>
                  <button
                    type="button"
                    className="mdocs-inline-diff-nav__btn"
                    onClick={() => goPending(-1)}
                    aria-label="上一处"
                  >
                    ▲
                  </button>
                  <button
                    type="button"
                    className="mdocs-inline-diff-nav__btn"
                    onClick={() => goPending(1)}
                    aria-label="下一处"
                  >
                    ▼
                  </button>
                </>
              ) : null}
            </>
          ) : null}
        </Space>
        <Button size="small" onClick={onClose}>
          丢弃全部
        </Button>
      </div>

      {floats.map((f) => (
        <div
          key={f.id}
          className={
            "mdocs-inline-diff-hunk__actions mdocs-inline-diff-hunk__actions--float" +
            (f.hunkIndex === activeHunk ? " is-active" : "")
          }
          style={{ top: f.top, right: f.right }}
        >
          <Button size="small" onClick={() => decide(f.hunkIndex, "rejected")}>
            拒绝
          </Button>
          <Button
            size="small"
            type="primary"
            className="mdocs-inline-diff-hunk__accept"
            onClick={() => decide(f.hunkIndex, "accepted")}
          >
            接受
          </Button>
        </div>
      ))}
    </div>
  );
}
