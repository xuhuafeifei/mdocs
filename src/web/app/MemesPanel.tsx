/**
 * 设置页：表情包管理。
 *
 * 分两层，与后端的「系统库 / 租户库」一一对应：
 *   1. 系统图库：全局共享、只读，只能整包同步（npm 包）覆盖；
 *   2. 我的表情包：当前访客自己上传的，可增、可改描述、可删。
 *
 * 图片统一走 /api/memes/image/:id（同源 <img> 自带 cookie），不在前端拼磁盘路径。
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useI18n } from "../i18n";
import { ConfirmDialog } from "./ConfirmDialog";
import {
  deleteMemeApi,
  fetchMemesApi,
  fetchMemeSyncMetaApi,
  memeImageUrl,
  syncSystemMemesApi,
  updateMemeDescApi,
  uploadMemeApi,
  type MemeItem,
  type MemeSyncMeta,
} from "../services/endpoints";

const DEFAULT_SPEC = "mdocs-memes@latest";

function formatBytes(bytes: number): string {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(0) + " KB";
  return (bytes / (1024 * 1024)).toFixed(2) + " MB";
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const pad = (n: number) => String(n).padStart(2, "0");
  return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()) + " " + pad(d.getHours()) + ":" + pad(d.getMinutes());
}

function errorMessage(err: unknown, fallback: string): string {
  return err instanceof Error && err.message ? err.message : fallback;
}

export function MemesPanel() {
  const { t } = useI18n();
  const mountedRef = useRef(true);

  const [layer, setLayer] = useState<"system" | "tenant">("system");
  const [systemMemes, setSystemMemes] = useState<MemeItem[]>([]);
  const [tenantMemes, setTenantMemes] = useState<MemeItem[]>([]);
  const [meta, setMeta] = useState<MemeSyncMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  // 系统库同步
  const [spec, setSpec] = useState(DEFAULT_SPEC);
  const [syncing, setSyncing] = useState(false);

  // 租户库上传 / 编辑 / 删除
  const [uploadDesc, setUploadDesc] = useState("");
  const [uploading, setUploading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingDesc, setEditingDesc] = useState("");
  const [savingDesc, setSavingDesc] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<MemeItem | null>(null);
  const [deleting, setDeleting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [systemRes, tenantRes, metaRes] = await Promise.all([
        fetchMemesApi("system"),
        fetchMemesApi("tenant"),
        fetchMemeSyncMetaApi(),
      ]);
      if (!mountedRef.current) return;
      setSystemMemes(systemRes.memes);
      setTenantMemes(tenantRes.memes);
      setMeta(metaRes.meta);
    } catch (err) {
      if (mountedRef.current) setError(errorMessage(err, t("memesLoadFailed")));
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const visible = useMemo(() => {
    const list = layer === "system" ? systemMemes : tenantMemes;
    const q = query.trim().toLowerCase();
    if (!q) return list;
    return list.filter(
      (m) => m.id.toLowerCase().includes(q) || m.desc.toLowerCase().includes(q),
    );
  }, [layer, systemMemes, tenantMemes, query]);

  const handleSync = useCallback(async () => {
    setSyncing(true);
    setError(null);
    setNotice(null);
    try {
      const result = await syncSystemMemesApi(spec.trim() || DEFAULT_SPEC);
      if (!mountedRef.current) return;
      await loadAll();
      if (!mountedRef.current) return;
      setNotice(
        t("memesSyncOk", {
          version: result.version || "?",
          count: String(result.written),
          size: formatBytes(result.bytes),
        }),
      );
    } catch (err) {
      if (mountedRef.current) setError(errorMessage(err, t("memesSyncFailed")));
    } finally {
      if (mountedRef.current) setSyncing(false);
    }
  }, [spec, loadAll, t]);

  const handleUpload = useCallback(async () => {
    const file = fileInputRef.current?.files?.[0] ?? null;
    const desc = uploadDesc.trim();
    if (!file) {
      setError(t("memesFileRequired"));
      return;
    }
    if (!desc) {
      setError(t("memesDescRequired"));
      return;
    }
    setUploading(true);
    setError(null);
    setNotice(null);
    try {
      await uploadMemeApi(file, desc);
      if (!mountedRef.current) return;
      setUploadDesc("");
      if (fileInputRef.current) fileInputRef.current.value = "";
      await loadAll();
      if (mountedRef.current) setNotice(t("memesUploadOk"));
    } catch (err) {
      if (mountedRef.current) setError(errorMessage(err, t("memesUploadFailed")));
    } finally {
      if (mountedRef.current) setUploading(false);
    }
  }, [uploadDesc, loadAll, t]);

  const handleSaveDesc = useCallback(async () => {
    const id = editingId;
    const desc = editingDesc.trim();
    if (!id || !desc) return;
    setSavingDesc(true);
    setError(null);
    try {
      await updateMemeDescApi(id, desc);
      if (!mountedRef.current) return;
      setEditingId(null);
      setEditingDesc("");
      await loadAll();
    } catch (err) {
      if (mountedRef.current) setError(errorMessage(err, t("memesSaveFailed")));
    } finally {
      if (mountedRef.current) setSavingDesc(false);
    }
  }, [editingId, editingDesc, loadAll, t]);

  const handleDelete = useCallback(async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    setError(null);
    try {
      await deleteMemeApi(deleteTarget.id);
      if (!mountedRef.current) return;
      setDeleteTarget(null);
      await loadAll();
    } catch (err) {
      if (mountedRef.current) setError(errorMessage(err, t("memesDeleteFailed")));
    } finally {
      if (mountedRef.current) setDeleting(false);
    }
  }, [deleteTarget, loadAll, t]);

  const renderCard = (meme: MemeItem) => {
    const editing = editingId === meme.id;
    return (
      <figure className="mdocs-meme-card" key={meme.id}>
        <img src={memeImageUrl(meme.id)} alt={meme.desc} loading="lazy" />
        <figcaption>
          <div className="mdocs-meme-card-head">
            <code className="mdocs-meme-id" title={meme.id}>{meme.id}</code>
            {meme.source === "tenant" && !editing && (
              <span className="mdocs-meme-card-actions">
                <button
                  type="button"
                  className="mdocs-meme-link"
                  onClick={() => {
                    setEditingId(meme.id);
                    setEditingDesc(meme.desc);
                  }}
                >
                  {t("memesEdit")}
                </button>
                <button
                  type="button"
                  className="mdocs-meme-link mdocs-meme-link--danger"
                  onClick={() => setDeleteTarget(meme)}
                >
                  {t("memesDelete")}
                </button>
              </span>
            )}
          </div>
          {editing ? (
            <div className="mdocs-meme-edit">
              <textarea
                className="mdocs-meme-input mdocs-meme-textarea"
                value={editingDesc}
                onChange={(e) => setEditingDesc(e.target.value)}
                rows={3}
                maxLength={200}
              />
              <div className="mdocs-meme-edit-actions">
                <button
                  type="button"
                  className="mdocs-meme-btn mdocs-meme-btn--primary"
                  onClick={() => void handleSaveDesc()}
                  disabled={savingDesc || !editingDesc.trim()}
                >
                  {savingDesc ? t("saving") : t("memesEditSave")}
                </button>
                <button
                  type="button"
                  className="mdocs-meme-btn"
                  onClick={() => {
                    setEditingId(null);
                    setEditingDesc("");
                  }}
                  disabled={savingDesc}
                >
                  {t("memesEditCancel")}
                </button>
              </div>
            </div>
          ) : (
            <p className="mdocs-meme-desc">{meme.desc}</p>
          )}
        </figcaption>
      </figure>
    );
  };

  const countOf = (n: number) => t("memesCountShort", { count: String(n) });

  return (
    <div className="mdocs-settings mdocs-memes">
      <div className="mdocs-settings-header">
        <h2 className="mdocs-settings-title">{t("memesTitle")}</h2>
        <p className="mdocs-settings-item-desc">{t("memesIntro")}</p>
      </div>

      <div className="mdocs-meme-tabs" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={layer === "system"}
          className={"mdocs-meme-tab" + (layer === "system" ? " on" : "")}
          onClick={() => setLayer("system")}
        >
          {t("memesTabSystem")}
          <span className="mdocs-meme-tab-count">{countOf(systemMemes.length)}</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={layer === "tenant"}
          className={"mdocs-meme-tab" + (layer === "tenant" ? " on" : "")}
          onClick={() => setLayer("tenant")}
        >
          {t("memesTabTenant")}
          <span className="mdocs-meme-tab-count">{countOf(tenantMemes.length)}</span>
        </button>
      </div>

      {error && (
        <p className="mdocs-settings-item-desc mdocs-meme-error" role="alert">{error}</p>
      )}
      {notice && !error && (
        <p className="mdocs-settings-item-desc mdocs-meme-notice" role="status">{notice}</p>
      )}

      {layer === "system" ? (
        <div className="mdocs-settings-cards">
          <div className="mdocs-settings-card">
            <div className="mdocs-settings-item-info">
              <span className="mdocs-settings-card-title">{t("memesSystemTitle")}</span>
              <span className="mdocs-settings-item-desc">{t("memesSystemHint")}</span>
            </div>
            <div className="mdocs-meme-sync">
              <label className="mdocs-meme-field">
                <span>{t("memesSyncSpec")}</span>
                <input
                  className="mdocs-meme-input"
                  value={spec}
                  onChange={(e) => setSpec(e.target.value)}
                  disabled={syncing}
                  spellCheck={false}
                />
              </label>
              <button
                type="button"
                className="mdocs-meme-btn mdocs-meme-btn--primary"
                onClick={() => void handleSync()}
                disabled={syncing || loading}
              >
                {syncing ? t("memesSyncing") : t("memesSyncButton")}
              </button>
            </div>
            <p className="mdocs-meme-meta">
              {meta
                ? t("memesMeta", {
                    version: meta.version || "—",
                    count: String(meta.count),
                    time: formatTime(meta.syncedAt),
                  })
                : t("memesNeverSynced")}
            </p>
          </div>

          <div className="mdocs-meme-toolbar">
            <input
              className="mdocs-meme-input"
              placeholder={t("memesSearchPlaceholder")}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>

          {loading ? (
            <p className="mdocs-settings-item-desc">{t("loading")}</p>
          ) : visible.length === 0 ? (
            <p className="mdocs-settings-item-desc">{query ? t("memesNoMatch") : t("memesSystemEmpty")}</p>
          ) : (
            <div className="mdocs-meme-grid">{visible.map(renderCard)}</div>
          )}
        </div>
      ) : (
        <div className="mdocs-settings-cards">
          <div className="mdocs-settings-card">
            <div className="mdocs-settings-item-info">
              <span className="mdocs-settings-card-title">{t("memesUploadTitle")}</span>
              <span className="mdocs-settings-item-desc">{t("memesTenantHint")}</span>
            </div>
            <div className="mdocs-meme-upload">
              <label className="mdocs-meme-field">
                <span>{t("memesPickFile")}</span>
                <input
                  ref={fileInputRef}
                  className="mdocs-meme-file"
                  type="file"
                  accept="image/png,image/jpeg,image/gif,image/webp"
                  disabled={uploading}
                />
              </label>
              <label className="mdocs-meme-field">
                <span>{t("memesDescLabel")}</span>
                <input
                  className="mdocs-meme-input"
                  placeholder={t("memesDescPlaceholder")}
                  value={uploadDesc}
                  onChange={(e) => setUploadDesc(e.target.value)}
                  maxLength={200}
                  disabled={uploading}
                />
              </label>
              <button
                type="button"
                className="mdocs-meme-btn mdocs-meme-btn--primary mdocs-meme-upload-submit"
                onClick={() => void handleUpload()}
                disabled={uploading}
              >
                {uploading ? t("memesUploading") : t("memesUpload")}
              </button>
            </div>
          </div>

          <div className="mdocs-meme-toolbar">
            <input
              className="mdocs-meme-input"
              placeholder={t("memesSearchPlaceholder")}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>

          {loading ? (
            <p className="mdocs-settings-item-desc">{t("loading")}</p>
          ) : visible.length === 0 ? (
            <p className="mdocs-settings-item-desc">{query ? t("memesNoMatch") : t("memesTenantEmpty")}</p>
          ) : (
            <div className="mdocs-meme-grid">{visible.map(renderCard)}</div>
          )}
        </div>
      )}

      {deleteTarget && (
        <ConfirmDialog
          message={t("memesDeleteConfirm", { id: deleteTarget.id })}
          confirmLabel={t("delete")}
          cancelLabel={t("cancel")}
          busy={deleting}
          danger
          onConfirm={() => void handleDelete()}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}
