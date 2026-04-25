/** Reserved filename for per-folder description (hidden in tree, opened when folder is selected). */
export const FOLDER_DESC_FILENAME = "desc.md";

export function folderDescPathForFolder(folderPath: string): string {
  const p = folderPath.trim();
  return p ? `${p}/${FOLDER_DESC_FILENAME}` : FOLDER_DESC_FILENAME;
}
