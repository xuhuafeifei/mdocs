import { useEffect, useState } from "react";
import { useI18n } from "../i18n";
import { listAllDrafts, deleteDraft, type DraftRecord } from "../storage/drafts";

interface DraftListPageProps {
  onPublish: (docId: string) => void;
  onClose: () => void;
}

export function DraftListPage({ onPublish, onClose }: DraftListPageProps) {
  const { t } = useI18n();
  const [drafts, setDrafts] = useState<DraftRecord[]>([]);

  useEffect(() => {
    listAllDrafts().then((list) => setDrafts(list.filter((d) => !d.published)));
  }, []);

  async function handleDelete(docId: string) {
    await deleteDraft(docId);
    setDrafts((prev) => prev.filter((d) => d.documentId !== docId));
  }

  const unpublished = drafts.filter((d) => !d.published);

  return (
    <div className="mdocs-draft-list">
      <div className="mdocs-draft-list-header">
        <h2>{t("unpublishedDrafts")}</h2>
        <span className="muted">
          {t("draftCount", { count: String(unpublished.length) })}
        </span>
      </div>
      {unpublished.length === 0 ? (
        <p className="muted">{t("noDrafts")}</p>
      ) : (
        <>
          <div className="mdocs-draft-list-items">
            {unpublished.map((d) => (
              <div key={d.documentId} className="mdocs-draft-list-item">
                <div className="mdocs-draft-list-item-info">
                  <span className="mdocs-draft-list-item-name">{d.displayName || d.documentId}</span>
                  <span className="muted">
                    {new Date(d.updatedAt).toLocaleString()}
                  </span>
                </div>
                <div className="mdocs-draft-list-item-actions">
                  <button
                    type="button"
                    className="primary"
                    onClick={() => {
                      onPublish(d.documentId);
                      void handleDelete(d.documentId);
                    }}
                  >
                    {t("publish")}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(d.documentId)}
                  >
                    {t("delete")}
                  </button>
                </div>
              </div>
            ))}
          </div>
          <div className="mdocs-draft-list-publish-all">
            <button
              type="button"
              className="primary"
              onClick={() => {
                for (const d of unpublished) {
                  onPublish(d.documentId);
                  void handleDelete(d.documentId);
                }
              }}
            >
              {t("publishAll")}
            </button>
          </div>
        </>
      )}
      <div className="mdocs-draft-list-close">
        <button type="button" onClick={onClose}>
          {t("close")}
        </button>
      </div>
    </div>
  );
}
