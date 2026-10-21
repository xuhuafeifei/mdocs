import { useCallback, useEffect, useState } from "react";
import { useI18n } from "../i18n";
import { ApiRequestError } from "../services/client";
import {
  listDeletedDocumentsApi,
  restoreDocumentApi,
  type DeletedDocumentListItem,
} from "../services/endpoints";

export function TrashPanel(props: { onRestored?: (documentId: string) => void }) {
  const { t } = useI18n();
  const [items, setItems] = useState<DeletedDocumentListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyAuditId, setBusyAuditId] = useState<number | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listDeletedDocumentsApi(100);
      setItems(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleRestore(item: DeletedDocumentListItem): Promise<void> {
    if (!item.restorable || busyAuditId != null) return;
    setBusyAuditId(item.auditId);
    setMessage(null);
    try {
      const doc = await restoreDocumentApi(item.auditId);
      setItems((prev) => prev.filter((x) => x.auditId !== item.auditId));
      setMessage(t("trashRestored"));
      props.onRestored?.(doc.documentId);
    } catch (err) {
      const code = err instanceof ApiRequestError ? err.code : undefined;
      if (code === "PATH_EXISTS" || code === "DOC_EXISTS") {
        setMessage(t("trashRestoreConflict"));
      } else {
        setMessage(err instanceof Error ? err.message : String(err));
      }
    } finally {
      setBusyAuditId(null);
    }
  }

  return (
    <div className="mdocs-settings">
      <div className="mdocs-settings-header">
        <h2 className="mdocs-settings-title">{t("trashTitle")}</h2>
      </div>
      <p className="mdocs-settings-item-desc" style={{ margin: "0 0 16px" }}>
        {t("trashDesc")}
      </p>
      {message && (
        <div className="mdocs-settings-item-desc" style={{ marginBottom: 12 }} role="status">
          {message}
        </div>
      )}
      {loading ? (
        <span className="mdocs-settings-item-desc">{t("loading")}</span>
      ) : error ? (
        <span className="mdocs-settings-item-desc" style={{ color: "var(--mdocs-danger)" }}>
          {error}
        </span>
      ) : items.length === 0 ? (
        <div className="mdocs-settings-card">
          <span className="mdocs-settings-item-desc">{t("trashEmpty")}</span>
        </div>
      ) : (
        <div className="mdocs-settings-cards">
          {items.map((item) => (
            <div key={item.auditId} className="mdocs-settings-card">
              <div className="mdocs-settings-item">
                <span className="mdocs-settings-item-info">
                  <span className="mdocs-settings-card-title">
                    {item.displayName || item.relativePath}
                  </span>
                  <span className="mdocs-settings-item-desc">{item.relativePath}</span>
                  <span className="mdocs-settings-item-desc">
                    {new Date(item.deletedAt).toLocaleString()}
                    {item.viaFolderDelete ? ` · ${t("trashViaFolder")}` : ""}
                    {!item.restorable ? ` · ${t("trashNotRestorable")}` : ""}
                  </span>
                </span>
                <button
                  type="button"
                  className="secondary"
                  disabled={!item.restorable || busyAuditId === item.auditId}
                  onClick={() => void handleRestore(item)}
                >
                  {busyAuditId === item.auditId ? "…" : t("trashRestore")}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
