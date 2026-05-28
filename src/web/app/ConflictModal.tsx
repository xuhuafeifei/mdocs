/**
 * 发布冲突弹框：仅关闭按钮可关，无遮罩/Esc 关闭。
 */
import { useI18n } from "../i18n";

interface ConflictModalProps {
  open: boolean;
  onClose: () => void;
  onResolve: () => void;
}

export function ConflictModal({ open, onClose, onResolve }: ConflictModalProps) {
  const { t } = useI18n();
  if (!open) return null;

  return (
    <div className="mdocs-conflict-modal-root" role="alertdialog" aria-modal="true">
      <div className="mdocs-conflict-modal-panel">
        <h2 className="mdocs-conflict-modal-title">{t("conflictTitle")}</h2>
        <p className="mdocs-conflict-modal-body">{t("conflictBody")}</p>
        <div className="mdocs-conflict-modal-actions">
          <button type="button" className="primary" onClick={onResolve}>
            {t("conflictResolve")}
          </button>
          <button type="button" className="secondary" onClick={onClose}>
            {t("conflictClose")}
          </button>
        </div>
      </div>
    </div>
  );
}
