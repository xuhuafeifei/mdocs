/**
 * HTML 文档帮写：工作台与写回都是 HTML 原文，不做 MD↔HTML 转换。
 */

/** 进场：工作稿就是 HTML 原文 */
export function htmlToAiWriteSeed(html: string): string {
  return html.trim();
}

/** 写回：原样作为 HTML 草稿 */
export function aiWriteResultToHtml(content: string): string {
  return content.trim();
}
