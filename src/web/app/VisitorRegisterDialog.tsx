/**
 * 访客注册弹窗
 * 首次访问时展示的欢迎界面，要求用户输入昵称以创建访客身份。
 * 创建成功后，后端返回 visitorToken 和 visitorId，存入 localStorage。
 */
import { useState } from "react";
import { useI18n } from "../i18n";

export function VisitorRegisterDialog(props: {
  onSubmit: (visitorName: string) => Promise<void>;
  error: string | null;
}) {
  const { t } = useI18n();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  /**
   * 提交注册：校验名称非空 → 调用注册接口 → 处理错误。
   */
  async function submit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setLocalError(t("nameRequired"));
      return;
    }
    setBusy(true);
    setLocalError(null);
    try {
      await props.onSubmit(trimmed);
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  const error = localError ?? props.error;

  return (
    <div className="mdocs-dialog-backdrop">
      <div className="mdocs-dialog card">
        <h1>{t("welcomeTitle")}</h1>
        <p>{t("welcomeDesc")}</p>
        <form onSubmit={submit}>
          <input
            autoFocus
            placeholder={t("visitorNamePlaceholder")}
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={60}
          />
          {error && <div className="mdocs-dialog-error">{error}</div>}
          <button type="submit" className="primary" disabled={busy}>
            {busy ? t("creating") : t("createVisitor")}
          </button>
        </form>
      </div>
    </div>
  );
}
