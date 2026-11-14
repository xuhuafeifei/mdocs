import { useLexicalEditor } from "@lobehub/editor";
import {
  COMMAND_PRIORITY_CRITICAL,
  KEY_DOWN_COMMAND,
  SELECT_ALL_COMMAND,
} from "lexical";
import { loadSelectAllSkipLeadingH1 } from "../../storage/editorFeaturePrefs";
import {
  applySelectAllSkipLeadingH1,
  isDocumentSelectAllKey,
} from "./selectAllSkipLeadingH1";

/**
 * 可选：正文 Cmd/Ctrl+A 时跳过首个 H1（见设置 → 功能）。
 * 使用 CRITICAL + KEY_DOWN，避免 Windows 上浏览器原生全选抢在 SELECT_ALL 之前。
 */
export function SelectAllSkipLeadingH1Plugin() {
  useLexicalEditor((lexical) => {
    const unregisterSelectAll = lexical.registerCommand(
      SELECT_ALL_COMMAND,
      () => {
        if (!loadSelectAllSkipLeadingH1()) return false;
        return applySelectAllSkipLeadingH1();
      },
      COMMAND_PRIORITY_CRITICAL,
    );

    const unregisterKeyDown = lexical.registerCommand(
      KEY_DOWN_COMMAND,
      (event: KeyboardEvent) => {
        if (!loadSelectAllSkipLeadingH1()) return false;
        if (!isDocumentSelectAllKey(event)) return false;
        const handled = applySelectAllSkipLeadingH1();
        if (!handled) return false;
        event.preventDefault();
        event.stopPropagation();
        return true;
      },
      COMMAND_PRIORITY_CRITICAL,
    );

    return () => {
      unregisterSelectAll();
      unregisterKeyDown();
    };
  }, []);

  return null;
}

SelectAllSkipLeadingH1Plugin.displayName = "SelectAllSkipLeadingH1Plugin";
