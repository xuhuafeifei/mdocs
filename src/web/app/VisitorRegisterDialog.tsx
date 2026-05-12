/**
 * 访客注册/登录弹窗
 * 顶部两个 Tab：注册、登录
 * 注册：两步流 - 1. 输入名称  2. 输入密码（可选）
 * 登录：两种方式 - 用户名+密码 / 恢复码
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

  // 顶部 Tab：注册/登录
  const [tab, setTab] = useState<"register" | "login">("register");

  // ===== 注册相关 state =====
  const [registerStep, setRegisterStep] = useState<1 | 2>(1);
  const [registerName, setRegisterName] = useState("");
  const [registerPassword, setRegisterPassword] = useState("");

  // ===== 登录相关 state =====
  const [loginMode, setLoginMode] = useState<"password" | "recovery">("password");
  const [loginName, setLoginName] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [recoveryCode, setRecoveryCode] = useState("");

  /**
   * 注册第一步：校验名称（不真正调用接口，只是切到第二步）
   */
  function goToStep2(e: React.FormEvent): void {
    e.preventDefault();
    const trimmed = registerName.trim();
    if (!trimmed) {
      setLocalError(t("nameRequired"));
      return;
    }
    setLocalError(null);
    setRegisterStep(2);
  }

  /**
   * 注册第二步：提交名称和密码（可选），真正调用注册接口
   */
  async function submitRegister(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    setBusy(true);
    setLocalError(null);
    try {
      const pwd = registerPassword.trim();
      await props.onSubmit(registerName.trim(), pwd || undefined);
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : String(err));
      // 出错了切回第一步，让用户重新输入名称
      setRegisterStep(1);
    } finally {
      setBusy(false);
    }
  }

  /**
   * 密码登录
   */
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

  /**
   * 恢复码登录
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
      storeVisitorId(res.visitor.visitorId);
      await props.onRecover(res.visitor.visitorId);
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  const error = localError ?? props.error;

  // 切换 Tab 时清空错误
  function switchTab(newTab: "register" | "login") {
    setLocalError(null);
    setTab(newTab);
  }

  return (
    <div className="mdocs-dialog-backdrop">
      <div className="mdocs-dialog card" style={{ maxWidth: 420 }}>
        {/* 顶部 Tab 栏 */}
        <div
          style={{
            display: "flex",
            borderBottom: "1px solid var(--mdocs-border)",
            marginBottom: 16,
          }}
        >
          <button
            type="button"
            onClick={() => switchTab("register")}
            style={{
              flex: 1,
              padding: "12px",
              border: "none",
              background: tab === "register" ? "var(--mdocs-bg)" : "none",
              color: tab === "register" ? "var(--mdocs-text)" : "var(--mdocs-text-secondary)",
              cursor: "pointer",
              fontWeight: tab === "register" ? 600 : 400,
              borderBottom: tab === "register" ? "2px solid var(--mdocs-accent)" : "none",
            }}
          >
            注册
          </button>
          <button
            type="button"
            onClick={() => switchTab("login")}
            style={{
              flex: 1,
              padding: "12px",
              border: "none",
              background: tab === "login" ? "var(--mdocs-bg)" : "none",
              color: tab === "login" ? "var(--mdocs-text)" : "var(--mdocs-text-secondary)",
              cursor: "pointer",
              fontWeight: tab === "login" ? 600 : 400,
              borderBottom: tab === "login" ? "2px solid var(--mdocs-accent)" : "none",
            }}
          >
            登录
          </button>
        </div>

        {/* ========== Tab 1：注册 ========== */}
        {tab === "register" && (
          <>
            {registerStep === 1 ? (
              <>
                <h1>{t("welcomeTitle")}</h1>
                <p>{t("welcomeDesc")}</p>
                <form onSubmit={goToStep2}>
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
                    onClick={() => switchTab("login")}
                  >
                    已有账号？点击登录
                  </button>
                </p>
              </>
            ) : (
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
                    onClick={() => setRegisterStep(1)}
                  >
                    ← 返回上一步
                  </button>
                </p>
              </>
            )}
          </>
        )}

        {/* ========== Tab 2：登录 ========== */}
        {tab === "login" && (
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
                    onClick={() => switchTab("register")}
                  >
                    没有账号？去注册
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
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
