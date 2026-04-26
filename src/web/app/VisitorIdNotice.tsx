import { useI18n } from "../i18n";

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
