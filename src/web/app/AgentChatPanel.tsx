import { History, Plus, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import deepseekLogoUrl from "../assets/deepseek.svg";

/**
 * 上手助手浮层壳：入口旁弹出。
 * 本期仅 UI：关闭 / 新会话(假) / 历史(假)；不接 chat API。
 */
export function AgentChatPanel(props: { open: boolean; onClose: () => void }) {
  const { open, onClose } = props;
  const [historyOpen, setHistoryOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) setHistoryOpen(false);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div ref={panelRef} className="mdocs-agent-panel" role="dialog" aria-label="mdocs 上手助手">
      <header className="mdocs-agent-panel-header">
        <div className="mdocs-agent-panel-title">
          <img src={deepseekLogoUrl} alt="" className="mdocs-agent-panel-title-logo" />
          <span>mdocs 上手助手</span>
        </div>
        <div className="mdocs-agent-panel-actions">
          <button
            type="button"
            className="mdocs-agent-panel-icon-btn"
            title="新会话"
            aria-label="新会话"
            onClick={() => {
              /* 假 UI：暂无 session */
              setHistoryOpen(false);
            }}
          >
            <Plus size={16} strokeWidth={1.8} />
          </button>
          <button
            type="button"
            className={"mdocs-agent-panel-icon-btn" + (historyOpen ? " active" : "")}
            title="历史会话"
            aria-label="历史会话"
            onClick={() => setHistoryOpen((v) => !v)}
          >
            <History size={16} strokeWidth={1.8} />
          </button>
          <button
            type="button"
            className="mdocs-agent-panel-icon-btn"
            title="关闭"
            aria-label="关闭"
            onClick={onClose}
          >
            <X size={16} strokeWidth={1.8} />
          </button>
        </div>
      </header>

      {historyOpen ? (
        <div className="mdocs-agent-panel-history">
          <p className="mdocs-agent-panel-history-empty">暂无历史会话</p>
          <p className="mdocs-agent-panel-history-hint">多会话能力后续开放</p>
        </div>
      ) : (
        <div className="mdocs-agent-panel-body">
          <div className="mdocs-agent-panel-welcome">
            <p className="mdocs-agent-panel-hello">你好，我是 mdocs 上手助手</p>
            <p className="mdocs-agent-panel-desc">
              可以问我域、草稿、发布、权限等怎么用。本期不协助写作。
            </p>
            <div className="mdocs-agent-panel-chips">
              <span className="mdocs-agent-panel-chip">如何发布文档？</span>
              <span className="mdocs-agent-panel-chip">草稿是什么？</span>
              <span className="mdocs-agent-panel-chip">如何创建域？</span>
            </div>
          </div>
          <div className="mdocs-agent-panel-input-wrap">
            <textarea
              className="mdocs-agent-panel-input"
              rows={2}
              placeholder="把你的问题告诉我…"
              disabled
              readOnly
            />
            <button type="button" className="mdocs-agent-panel-send" disabled title="即将接入">
              ↑
            </button>
          </div>
          <p className="mdocs-agent-panel-footnote">内容由 AI 生成，仅供参考</p>
        </div>
      )}
    </div>
  );
}
