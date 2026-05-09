/**
 * 确认弹窗
 * 用于需要用户确认操作的场景，提供「取消」和「确认」两个按钮。
 */
interface ConfirmDialogProps {
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  busy?: boolean;
  danger?: boolean;
}

/**
 * 通用确认弹窗组件：点击遮罩或「取消」按钮关闭，点击「确认」执行操作。
 */
export function ConfirmDialog({
  title,
  message,
  confirmLabel = "确定",
  cancelLabel = "取消",
  onConfirm,
  onCancel,
  busy = false,
  danger = false,
}: ConfirmDialogProps) {
  return (
    <div
      className="mdocs-dialog-backdrop"
      role="presentation"
      onMouseDown={(ev) => {
        if (ev.target === ev.currentTarget && !busy) onCancel();
      }}
    >
      <div className="mdocs-dialog card mdocs-message-dialog" role="alertdialog" aria-modal="true">
        {title && <h2 className="mdocs-message-dialog-title">{title}</h2>}
        <p className="mdocs-message-dialog-body">{message}</p>
        <div className="mdocs-message-dialog-actions" style={{ gap: 8 }}>
          <button type="button" onClick={onCancel} disabled={busy}>
            {cancelLabel}
          </button>
          <button type="button" className={danger ? "danger" : "primary"} onClick={onConfirm} disabled={busy}>
            {busy ? "…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
