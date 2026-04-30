import { useI18n } from "../i18n";

interface ConflictNoticeProps {
  onDismiss: () => void;
}

export function ConflictNotice({ onDismiss }: ConflictNoticeProps) {
  const { t } = useI18n();

  return (
    <div className="mdocs-conflict-notice">
      <div className="mdocs-conflict-notice-header">
        <strong>{t("conflictTitle")}</strong>
        <button
          type="button"
          className="ghost"
          onClick={onDismiss}
          style={{ padding: "2px 6px", fontSize: 14 }}
        >
          x
        </button>
      </div>
      <p>{t("conflictBody")}</p>
    </div>
  );
}
