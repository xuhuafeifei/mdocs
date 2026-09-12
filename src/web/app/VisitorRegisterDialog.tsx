/**
 * 访客注册/登录弹窗
 * 主界面为登录，下方「没有账号？点击注册」进入注册两步流。
 * 注册完成后自动切回登录，让用户用刚设的密码登录。
 */
import { useState } from "react";
import { useI18n } from "../i18n";
import { loginWithPasswordApi, recoverVisitorApi } from "../services/endpoints";
import { storeVisitorId } from "../services/client";

export function VisitorRegisterDialog(props: {
  onSubmit: (visitorName: string, password?: string) => Promise<void>;
  onRecover: (visitorId: string) => Promise<void>;
  error: string | null;
}) {
  const { t } = useI18n();
  const [busy, setBusy] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  // 当前页面：login | register | register-password
  const [page, setPage] = useState<"login" | "register" | "register-password">("login");

  // ===== 注册相关 state =====
  const [registerName, setRegisterName] = useState("");
  const [registerPassword, setRegisterPassword] = useState("");

  // ===== 登录相关 state =====
  const [loginMode, setLoginMode] = useState<"password" | "recovery">("password");
  const [loginName, setLoginName] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [recoveryCode, setRecoveryCode] = useState("");

  /** 注册第一步：校验名称，进入密码页 */
  function goToPassword(e: React.FormEvent): void {
    e.preventDefault();
    const trimmed = registerName.trim();
    if (!trimmed) {
      setLocalError(t("nameRequired"));
      return;
    }
    setLocalError(null);
    setPage("register-password");
  }

  /** 注册第二步：提交名称和密码，成功后切回登录 */
  async function submitRegister(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    setBusy(true);
    setLocalError(null);
    try {
      const pwd = registerPassword.trim();
      await props.onSubmit(registerName.trim(), pwd || undefined);
      // 注册成功 → 清空表单 → 切回登录
      setRegisterName("");
      setRegisterPassword("");
      setPage("login");
      setLoginMode("password");
      setLoginName(registerName.trim());
      setLoginPassword(pwd || "");
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : String(err));
      setPage("register");
    } finally {
      setBusy(false);
    }
  }

  /** 密码登录 */
  async function handlePasswordLogin(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    const name = loginName.trim();
    const pwd = loginPassword.trim();
    if (!name || !pwd) {
      setLocalError("请输入用户名和密码");
      return;
    }
    setBusy(true);
    setLocalError(null);
    try {
      const res = await loginWithPasswordApi(name, pwd);
      storeVisitorId(res.visitor.visitorId);
      await props.onRecover(res.visitor.visitorId);
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  /** 恢复码登录 */
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
      storeVisitorId(res.visitor.visitorId);
      await props.onRecover(res.visitor.visitorId);
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  const error = localError ?? props.error;

  function switchToRegister() {
    setLocalError(null);
    setRegisterName("");
    setRegisterPassword("");
    setPage("register");
  }

  function switchToLogin() {
    setLocalError(null);
    setPage("login");
  }

  return (
    <div className="mdocs-dialog-backdrop">
      <div className="mdocs-dialog card" style={{ maxWidth: 420 }}>
        {/* ========== 登录 ========== */}
        {page === "login" && (
          <>
            {/* 登录方式子 Tab */}
            <div
              style={{
                display: "flex",
                gap: 16,
                marginBottom: 16,
                fontSize: "0.875rem",
              }}
            >
              <button
                type="button"
                onClick={() => {
                  setLocalError(null);
                  setLoginMode("password");
                }}
                style={{
                  background: "none",
                  border: "none",
                  color: loginMode === "password" ? "var(--mdocs-accent)" : "var(--mdocs-text-secondary)",
                  cursor: "pointer",
                  padding: "4px 0",
                  borderBottom: loginMode === "password" ? "2px solid var(--mdocs-accent)" : "none",
                  fontWeight: loginMode === "password" ? 600 : 400,
                }}
              >
                用户名+密码
              </button>
              <button
                type="button"
                onClick={() => {
                  setLocalError(null);
                  setLoginMode("recovery");
                }}
                style={{
                  background: "none",
                  border: "none",
                  color: loginMode === "recovery" ? "var(--mdocs-accent)" : "var(--mdocs-text-secondary)",
                  cursor: "pointer",
                  padding: "4px 0",
                  borderBottom: loginMode === "recovery" ? "2px solid var(--mdocs-accent)" : "none",
                  fontWeight: loginMode === "recovery" ? 600 : 400,
                }}
              >
                恢复码
              </button>
            </div>

            {/* 密码登录表单 */}
            {loginMode === "password" ? (
              <>
                <h1>🔑 使用密码登录</h1>
                <p>输入用户名和密码，在其他设备上找回你的身份。</p>
                <form onSubmit={handlePasswordLogin}>
                  <input
                    autoFocus
                    placeholder="用户名"
                    value={loginName}
                    onChange={(e) => setLoginName(e.target.value)}
                    maxLength={60}
                    style={{ marginBottom: 8 }}
                  />
                  <input
                    type="password"
                    placeholder="密码"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                  />
                  {error && <div className="mdocs-dialog-error">{error}</div>}
                  <button type="submit" className="primary" disabled={busy}>
                    {busy ? "验证中…" : "登录"}
                  </button>
                </form>
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
              </>
            )}

            {/* 切换到注册 */}
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
                onClick={switchToRegister}
              >
                没有账号？点击注册
              </button>
            </p>
          </>
        )}

        {/* ========== 注册第一步：输入名称 ========== */}
        {page === "register" && (
          <>
            <h1>{t("welcomeTitle")}</h1>
            <p>{t("welcomeDesc")}</p>
            <form onSubmit={goToPassword}>
              <input
                autoFocus
                placeholder={t("visitorNamePlaceholder")}
                value={registerName}
                onChange={(e) => setRegisterName(e.target.value)}
                maxLength={60}
              />
              {error && <div className="mdocs-dialog-error">{error}</div>}
              <button type="submit" className="primary" disabled={busy}>
                下一步
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
                onClick={switchToLogin}
              >
                已有账号？点击登录
              </button>
            </p>
          </>
        )}

        {/* ========== 注册第二步：设置密码 ========== */}
        {page === "register-password" && (
          <>
            <h1>设置密码（可选）</h1>
            <p style={{ marginBottom: 8 }}>
              设置密码后，你可以在其他浏览器或设备上使用「用户名+密码」登录。
            </p>
            <p style={{ color: "var(--mdocs-text-secondary)", fontSize: "0.875rem", marginBottom: 16 }}>
              留空不设置密码也能正常使用，但只能在当前浏览器操作。
            </p>
            <form onSubmit={submitRegister}>
              <input
                autoFocus
                type="password"
                placeholder="设置密码（至少 4 位）"
                value={registerPassword}
                onChange={(e) => setRegisterPassword(e.target.value)}
                minLength={4}
              />
              {error && <div className="mdocs-dialog-error">{error}</div>}
              <button
                type="submit"
                className="primary"
                disabled={busy}
                style={{ marginTop: 8 }}
              >
                {busy ? t("creating") : "完成注册"}
              </button>
            </form>
            <p style={{ marginTop: 16, textAlign: "center" }}>
              <button
                type="button"
                style={{
                  background: "none",
                  border: "none",
                  color: "var(--mdocs-text-secondary)",
                  cursor: "pointer",
                  fontSize: "0.875rem",
                  padding: 0,
                }}
                onClick={() => setPage("register")}
              >
                ← 返回上一步
              </button>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
