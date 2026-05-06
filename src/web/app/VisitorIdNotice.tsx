/**
 * 访客 ID 提示条
 * 注册成功后短暂展示访客 ID，提醒用户保存以便未来恢复身份。
 */
import { useI18n } from "../i18n";

/**
 * 访客 ID 提示条组件。
 */
/**
 * 访客 ID 提示条：注册成功后提醒用户保存 ID。
 */
export function VisitorIdNotice(props: {
  visitorId: string;
  onDismiss: () => void;
}) {
  const { t } = useI18n();
  return (
    <div className="mdocs-notice card">
      <span>
        {t("visitorIdNotice", { id: props.visitorId })}
      </span>
      <button type="button" onClick={props.onDismiss}>
        {t("gotIt")}
      </button>
    </div>
  );
}
