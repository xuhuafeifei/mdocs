/**
 * 文档信息「字符数」：人读纯文本总字符（忽略 md 语法 / html 标签）。
 */
import { remark } from "remark";
import remarkGfm from "remark-gfm";

const MAX_LEXICAL_DEPTH = 64;

/** 与服务端 extractLexicalPlainText 同构：只抽 type=text。 */
export function plainTextFromLexicalJson(rawContent: string): string | null {
  let doc: unknown;
  try {
    doc = JSON.parse(rawContent);
  } catch {
    return null;
  }
  if (!doc || typeof doc !== "object" || !("root" in doc)) return null;
  const parts: string[] = [];
  collectLexicalText((doc as { root: unknown }).root, parts, 0);
  return parts.join("");
}

function collectLexicalText(node: unknown, parts: string[], depth: number): void {
  if (depth > MAX_LEXICAL_DEPTH) return;
  if (!node || typeof node !== "object") return;
  const n = node as Record<string, unknown>;
  if (n.type === "text" && typeof n.text === "string" && n.text.length > 0) {
    parts.push(n.text);
  }
  if (Array.isArray(n.children)) {
    for (const child of n.children) {
      collectLexicalText(child, parts, depth + 1);
    }
  }
}

type MdastNode = {
  type?: string;
  value?: string;
  lang?: string | null;
  alt?: string | null;
  children?: MdastNode[];
};

function collectMdastPlain(node: MdastNode | undefined, parts: string[]): void {
  if (!node) return;
  const type = node.type ?? "";

  // meta2 / meta2d 图数据不计
  if (
    type === "code" &&
    typeof node.lang === "string" &&
    /^(meta2|meta2d)$/i.test(node.lang.trim())
  ) {
    return;
  }

  if (type === "image") {
    if (typeof node.alt === "string" && node.alt) parts.push(node.alt);
    return;
  }

  if (
    (type === "text" || type === "inlineCode" || type === "code" || type === "yaml") &&
    typeof node.value === "string" &&
    node.value.length > 0
  ) {
    parts.push(node.value);
  }

  if (Array.isArray(node.children)) {
    for (const child of node.children) {
      collectMdastPlain(child, parts);
    }
  }
}

/** markdown → 去语法纯文本（保留代码正文、链接可见文案）。 */
export function plainTextFromMarkdown(md: string): string {
  const tree = remark().use(remarkGfm).parse(md) as MdastNode;
  const parts: string[] = [];
  collectMdastPlain(tree, parts);
  return parts.join("");
}

/** html → 去标签纯文本。 */
export function plainTextFromHtml(html: string): string {
  if (typeof document !== "undefined") {
    const el = document.createElement("div");
    el.innerHTML = html;
    return el.textContent ?? "";
  }
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ");
}

/**
 * md：Lexical JSON 抽字，否则当 markdown 剥语法。
 * html：去标签。
 */
export function plainTextForCharCount(kind: "md" | "html", content: string): string {
  if (!content) return "";
  if (kind === "html") return plainTextFromHtml(content);
  const fromLex = plainTextFromLexicalJson(content);
  if (fromLex !== null) return fromLex;
  return plainTextFromMarkdown(content);
}

export function countPlainChars(plain: string): number {
  return plain.length;
}

export function countDocumentPlainChars(kind: "md" | "html", content: string): number {
  return countPlainChars(plainTextForCharCount(kind, content));
}
