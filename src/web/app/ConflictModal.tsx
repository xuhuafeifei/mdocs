/**
 * 发布冲突弹框：去合并；owner 可强制覆盖。仅关闭按钮可关。
 */
import { useI18n } from "../i18n";

interface ConflictModalProps {
  open: boolean;
  onClose: () => void;
  onResolve: () => void;
  /** 仅文档所有者传入 */
  onForceOverwrite?: () => void;
  forceBusy?: boolean;
}

export function ConflictModal({
  open,
  onClose,
  onResolve,
  onForceOverwrite,
  forceBusy,
}: ConflictModalProps) {
  const { t } = useI18n();
  if (!open) return null;

  return (
    <div className="mdocs-conflict-modal-root" role="alertdialog" aria-modal="true">
      <div className="mdocs-conflict-modal-panel">
        <h2 className="mdocs-conflict-modal-title">{t("conflictTitle")}</h2>
        <p className="mdocs-conflict-modal-body">{t("conflictBody")}</p>
        {onForceOverwrite ? (
          <p className="mdocs-conflict-modal-force-hint">{t("conflictForceHint")}</p>
        ) : null}
        <div className="mdocs-conflict-modal-actions">
          <button type="button" className="primary" onClick={onResolve} disabled={forceBusy}>
            {t("conflictResolve")}
          </button>
          {onForceOverwrite ? (
            <button
              type="button"
              className="mdocs-conflict-force-btn"
              disabled={forceBusy}
              onClick={onForceOverwrite}
            >
              {forceBusy ? t("conflictForceBusy") : t("conflictForce")}
            </button>
          ) : null}
          <button type="button" className="secondary" onClick={onClose} disabled={forceBusy}>
            {t("conflictClose")}
          </button>
        </div>
      </div>
    </div>
  );
}
