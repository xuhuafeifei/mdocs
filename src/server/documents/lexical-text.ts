/**
 * Lexical JSON 纯文本提取工具。
 *
 * 从 Lexical 编辑器的 JSON 格式中递归提取所有文本节点内容，
 * 用于全文搜索索引、CLI 纯文本输出等场景。
 */

/** 递归遍历 Lexical JSON 的最大深度，防止恶意构造的超深 JSON 导致爆栈 */
const MAX_LEXICAL_DEPTH = 40;

/**
 * 从 Lexical JSON 字符串中提取纯文本内容。
 *
 * @param rawContent - 原始内容字符串（可能是 Lexical JSON，也可能是纯文本）
 * @returns 提取出的纯文本（所有 text 节点的内容拼接）
 *
 * 处理逻辑：
 * - 解析失败 → 直接返回原文（兼容非 Lexical 格式的老数据）
 * - 没有 root 节点 → 直接返回原文
 * - 正常 Lexical JSON → 递归收集所有 type="text" 节点的 text 字段
 */
export function extractPlainTextFromLexical(rawContent: string): string {
  let doc: unknown;
  try {
    doc = JSON.parse(rawContent);
  } catch {
    // 非 JSON 格式（老数据、纯 Markdown 等），直接返回
    return rawContent;
  }

  // 必须是对象且有 root 节点，才是 Lexical JSON
  if (!doc || typeof doc !== "object" || !("root" in doc)) {
    return rawContent;
  }

  const parts: string[] = [];
  collectLexicalText((doc as { root: unknown }).root, parts, 0);
  return parts.join("");
}

/**
 * 递归收集 Lexical 节点树中的所有文本。
 *
 * @param node 当前遍历的 Lexical 节点
 * @param parts 累积文本的数组，type="text" 节点的 text 字段追加到此数组
 * @param depth 当前递归深度，超过 MAX_LEXICAL_DEPTH 时截断
 */
function collectLexicalText(node: unknown, parts: string[], depth: number): void {
  if (depth > MAX_LEXICAL_DEPTH) return;
  if (!node || typeof node !== "object") return;

  const n = node as Record<string, unknown>;

  // 文本节点：提取实际内容
  if (n.type === "text") {
    if (typeof n.text === "string" && n.text.length > 0) {
      parts.push(n.text);
    }
  }

  // 递归处理子节点
  if (Array.isArray(n.children)) {
    for (const child of n.children) {
      collectLexicalText(child, parts, depth + 1);
    }
  }
}
