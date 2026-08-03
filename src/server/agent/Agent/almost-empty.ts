/**
 * Ask 覆写判空：以纯文本判断「几乎空」。
 * 约定：去空白无正文，或仅一行标题。
 */
export function isAlmostEmptyDocumentText(plainText: string): boolean {
  const trimmed = plainText.replace(/\u00a0/g, " ").trim();
  if (!trimmed) return true;

  const lines = trimmed
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  return lines.length <= 1;
}
