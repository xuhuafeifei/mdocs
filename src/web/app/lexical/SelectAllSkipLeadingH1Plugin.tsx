import { useLexicalEditor } from "@lobehub/editor";
import {
  COMMAND_PRIORITY_HIGH,
  SELECT_ALL_COMMAND,
} from "lexical";
import { loadSelectAllSkipLeadingH1 } from "../../storage/editorFeaturePrefs";
import { applySelectAllSkipLeadingH1 } from "./selectAllSkipLeadingH1";

/**
 * 可选：正文 Cmd/Ctrl+A 时跳过首个 H1（见设置 → 功能）。
 */
export function SelectAllSkipLeadingH1Plugin() {
  useLexicalEditor((lexical) => {
    return lexical.registerCommand(
      SELECT_ALL_COMMAND,
      () => {
        if (!loadSelectAllSkipLeadingH1()) return false;
        return applySelectAllSkipLeadingH1();
      },
      COMMAND_PRIORITY_HIGH,
    );
  }, []);

  return null;
}

SelectAllSkipLeadingH1Plugin.displayName = "SelectAllSkipLeadingH1Plugin";
