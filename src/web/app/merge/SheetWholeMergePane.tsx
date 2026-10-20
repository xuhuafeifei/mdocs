/**
 * Sheet 冲突：整表二选一（用我的 / 用别人的），不做 JSON 行级 merge。
 */
import { parseSheetDocument } from "../../../shared/sheetDocument";
import { useI18n } from "../../i18n";

export type SheetTabSummary = {
  name: string;
  rows: number;
  cols: number;
  merges: number;
};

export type SheetDocSummary =
  | { ok: true; sheetCount: number; tabs: SheetTabSummary[] }
  | { ok: false; reason: "empty" | "invalid" };

export function summarizeSheetContent(raw: string): SheetDocSummary {
  const trimmed = raw.trim();
  if (!trimmed) return { ok: false, reason: "empty" };
  // parseSheetDocument 对坏 JSON 会静默回退空表；预览要区分「真坏」与「空表」
  try {
    JSON.parse(trimmed);
  } catch {
    return { ok: false, reason: "invalid" };
  }
  const doc = parseSheetDocument(trimmed);
  return {
    ok: true,
    sheetCount: doc.sheets.length,
    tabs: doc.sheets.map((tab) => ({
      name: tab.name,
      rows: tab.rows.length,
      cols: tab.columns.length,
      merges: tab.merges?.length ?? 0,
    })),
  };
}

function SummaryCard(props: {
  title: string;
  side: "local" | "remote";
  summary: SheetDocSummary;
}) {
  const { t } = useI18n();
  const { title, side, summary } = props;
  return (
    <div className={`mdocs-sheet-merge-card mdocs-sheet-merge-card--${side}`}>
      <h3 className="mdocs-sheet-merge-card-title">{title}</h3>
      {!summary.ok ? (
        <p className="mdocs-sheet-merge-card-muted">
          {summary.reason === "empty"
            ? t("sheetMergePreviewEmpty")
            : t("sheetMergePreviewInvalid")}
        </p>
      ) : (
        <>
          <p className="mdocs-sheet-merge-card-meta">
            {t("sheetMergeSheetCount", { count: String(summary.sheetCount) })}
          </p>
          <ul className="mdocs-sheet-merge-tab-list">
            {summary.tabs.map((tab) => (
              <li key={`${tab.name}-${tab.rows}-${tab.cols}-${tab.merges}`}>
                <span className="mdocs-sheet-merge-tab-name">{tab.name}</span>
                <span className="mdocs-sheet-merge-tab-stats">
                  {t("sheetMergeTabStats", {
                    rows: String(tab.rows),
                    cols: String(tab.cols),
                    merges: String(tab.merges),
                  })}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

export function SheetWholeMergePane(props: {
  localContent: string;
  remoteContent: string;
  busy: boolean;
  onUseMine: () => void;
  onUseTheirs: () => void;
  /** 仅文档所有者 */
  onForceOverwrite?: () => void;
  forceBusy?: boolean;
}) {
  const { t } = useI18n();
  const localSummary = summarizeSheetContent(props.localContent);
  const remoteSummary = summarizeSheetContent(props.remoteContent);
  const publishingLabel = props.forceBusy ? t("conflictForceBusy") : t("publishing");

  return (
    <div className="mdocs-sheet-merge-pane">
      <p className="mdocs-sheet-merge-hint">{t("sheetMergeHint")}</p>
      {props.onForceOverwrite ? (
        <p className="mdocs-sheet-merge-force-hint">{t("conflictForceHint")}</p>
      ) : null}
      <div className="mdocs-sheet-merge-cards">
        <SummaryCard title={t("mergeLocal")} side="local" summary={localSummary} />
        <SummaryCard title={t("mergeRemote")} side="remote" summary={remoteSummary} />
      </div>
      <div className="mdocs-sheet-merge-actions">
        <button
          type="button"
          className="primary mdocs-sheet-merge-btn-mine"
          disabled={props.busy || !props.localContent.trim()}
          onClick={props.onUseMine}
        >
          {props.busy && !props.forceBusy ? publishingLabel : t("sheetMergeUseMine")}
        </button>
        <button
          type="button"
          className="secondary mdocs-sheet-merge-btn-theirs"
          disabled={props.busy || !props.remoteContent.trim()}
          onClick={props.onUseTheirs}
        >
          {props.busy && !props.forceBusy ? publishingLabel : t("sheetMergeUseTheirs")}
        </button>
        {props.onForceOverwrite ? (
          <button
            type="button"
            className="mdocs-conflict-force-btn mdocs-sheet-merge-btn-force"
            disabled={props.busy || !props.localContent.trim()}
            onClick={props.onForceOverwrite}
          >
            {props.forceBusy ? t("conflictForceBusy") : t("conflictForce")}
          </button>
        ) : null}
      </div>
    </div>
  );
}
