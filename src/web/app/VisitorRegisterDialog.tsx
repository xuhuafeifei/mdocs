/**
 * 访客注册/恢复弹窗
 * 支持两种模式：
 * 1. 注册：输入昵称创建新访客
 * 2. 恢复：输入恢复码找回已有访客
 */
import { useState } from "react";
import { useI18n } from "../i18n";
import { recoverVisitorApi } from "../services/endpoints";
import { storeIdentity } from "../services/client";

export function VisitorRegisterDialog(props: {
  onSubmit: (visitorName: string) => Promise<void>;
  onRecover: (visitorId: string) => Promise<void>;
  error: string | null;
}) {
  const { t } = useI18n();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [mode, setMode] = useState<"register" | "recover">("register");
  const [recoveryCode, setRecoveryCode] = useState("");

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

  /**
   * 使用恢复码找回访客。
   */
  async function handleRecover(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    const code = recoveryCode.trim();
    if (!code) {
      setLocalError("请输入恢复码");
      return;
    }
    setBusy(true);
    setLocalError(null);
    try {
      const res = await recoverVisitorApi(code);
      storeIdentity(res.visitor.visitorId, res.visitorToken);
      await props.onRecover(res.visitor.visitorId);
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  const error = localError ?? props.error;

  return (
    <div className="mdocs-dialog-backdrop">
      <div className="mdocs-dialog card" style={{ maxWidth: 420 }}>
        {mode === "register" ? (
          <>
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
            <p style={{ marginTop: 16, textAlign: "center" }}>
              <button
                type="button"
                style={{
                  background: "none",
                  border: "none",
                  color: "var(--mdocs-accent)",
                  cursor: "pointer",
                  fontSize: "0.875rem",
                  textDecoration: "underline",
                  padding: 0,
                }}
                onClick={() => { setMode("recover"); setLocalError(null); }}
              >
                已有恢复码？点击找回
              </button>
            </p>
          </>
        ) : (
          <>
            <h1>🔑 使用恢复码找回</h1>
            <p>输入注册时保存的恢复码，系统将为您生成新的身份令牌。</p>
            <form onSubmit={handleRecover}>
              <input
                autoFocus
                placeholder="ABCD-EFGH-IJKL-MNOP"
                value={recoveryCode}
                onChange={(e) => setRecoveryCode(e.target.value)}
                style={{ fontFamily: "monospace", letterSpacing: "0.1em" }}
                maxLength={30}
              />
              {error && <div className="mdocs-dialog-error">{error}</div>}
              <button type="submit" className="primary" disabled={busy}>
                {busy ? "验证中…" : "找回身份"}
              </button>
            </form>
            <p style={{ marginTop: 16, textAlign: "center" }}>
              <button
                type="button"
                style={{
                  background: "none",
                  border: "none",
                  color: "var(--mdocs-accent)",
                  cursor: "pointer",
                  fontSize: "0.875rem",
                  textDecoration: "underline",
                  padding: 0,
                }}
                onClick={() => { setMode("register"); setLocalError(null); }}
              >
                返回注册
              </button>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
