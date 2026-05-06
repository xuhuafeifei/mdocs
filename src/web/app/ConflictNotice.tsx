/**
 * 发布冲突提示条
 * 当发布文档时检测到云端与本地版本冲突时，在编辑器底部展示此提示。
 * 用户需手动解决冲突后重新发布。
 */
import { useI18n } from "../i18n";

interface ConflictNoticeProps {
  onDismiss: () => void;
}

/**
 * 发布冲突提示条组件：展示冲突信息并提供关闭按钮。
 */
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
