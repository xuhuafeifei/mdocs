/**
 * 文档「复制全文」：标准 MD 仍走 Lobe getDocument("markdown")；
 * 紧凑版在 mdocs 侧清掉段间空行（\n\n… → \n），不改 Lobe 导出。
 */

/** 去掉多余空行：连续换行压成单个 \n（段与段之间不再空一行） */
export function stripExcessBlankLinesFromMarkdown(md: string): string {
  return md.replace(/\r\n/g, "\n").replace(/\n{2,}/g, "\n").replace(/\n+$/g, "\n");
}
