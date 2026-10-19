/** Reserved filename for per-folder description (hidden in tree, opened when folder is selected). */
export const FOLDER_DESC_FILENAME = "___desc___.md";

export function folderDescPathForFolder(folderPath: string): string {
  const p = folderPath.trim();
  return p ? `${p}/${FOLDER_DESC_FILENAME}` : FOLDER_DESC_FILENAME;
}

/** 目录描述文件路径：根上是 `___desc___.md`，其余以 `/___desc___.md` 结尾。 */
export function isFolderDescPath(relativePath: string): boolean {
  return relativePath === FOLDER_DESC_FILENAME || relativePath.endsWith(`/${FOLDER_DESC_FILENAME}`);
}
