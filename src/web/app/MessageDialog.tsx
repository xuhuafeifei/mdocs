/**
 * 通用消息弹窗
 * 用于展示错误提示或其他需要用户确认的信息（点击「知道了」关闭）。
 */
import { useI18n } from "../i18n";

interface MessageDialogProps {
  title?: string;
  message: string;
  onClose: () => void;
}

/**
 * 通用消息弹窗组件：点击遮罩或「知道了」按钮关闭。
 */
export function MessageDialog({ title, message, onClose }: MessageDialogProps) {
  const { t } = useI18n();
  return (
    <div
      className="mdocs-dialog-backdrop"
      role="presentation"
      onMouseDown={(ev) => {
        if (ev.target === ev.currentTarget) onClose();
      }}
    >
      <div className="mdocs-dialog card mdocs-message-dialog" role="alertdialog" aria-modal="true">
        {title && <h2 className="mdocs-message-dialog-title">{title}</h2>}
        <p className="mdocs-message-dialog-body">{message}</p>
        <div className="mdocs-message-dialog-actions">
          <button type="button" className="primary" onClick={onClose}>
            {t("gotIt")}
          </button>
        </div>
      </div>
    </div>
  );
}
