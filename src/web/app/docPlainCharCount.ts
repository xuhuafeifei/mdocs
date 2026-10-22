/**
 * 文档信息「字符数」：人读纯文本总字符（忽略 md 语法 / html 标签）。
 * 块与块之间保留换行，对齐 Typora「字符」（含空白）。
 */
import { remark } from "remark";
import remarkGfm from "remark-gfm";

const MAX_LEXICAL_DEPTH = 64;

const LEXICAL_BLOCK_TYPES = new Set([
  "paragraph",
  "heading",
  "quote",
  "blockquote",
  "list",
  "listitem",
  "code",
  "codeblock",
  "table",
  "tablerow",
  "hr",
  "horizontalrule",
  "markmap",
  "meta2d",
]);

const MDAST_BLOCK_TYPES = new Set([
  "paragraph",
  "heading",
  "blockquote",
  "list",
  "listItem",
  "code",
  "table",
  "thematicBreak",
  "yaml",
]);

/** 与服务端 extractLexicalPlainText 同构：抽 type=text，块间补换行。 */
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
  if (n.type === "linebreak") {
    parts.push("\n");
    return;
  }
  if (!Array.isArray(n.children) || n.children.length === 0) return;

  const kids = n.children;
  const blockKids = kids.some(
    (c) =>
      c &&
      typeof c === "object" &&
      LEXICAL_BLOCK_TYPES.has(String((c as { type?: unknown }).type ?? "")),
  );
  for (let i = 0; i < kids.length; i += 1) {
    if (i > 0 && blockKids) parts.push("\n\n");
    collectLexicalText(kids[i], parts, depth + 1);
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

  if (type === "break") {
    parts.push("\n");
    return;
  }

  if (
    (type === "text" || type === "inlineCode" || type === "code" || type === "yaml") &&
    typeof node.value === "string" &&
    node.value.length > 0
  ) {
    parts.push(node.value);
  }

  if (!Array.isArray(node.children) || node.children.length === 0) return;

  const kids = node.children;
  const blockKids = kids.some((c) => MDAST_BLOCK_TYPES.has(c.type ?? ""));
  for (let i = 0; i < kids.length; i += 1) {
    if (i > 0 && blockKids) parts.push("\n\n");
    collectMdastPlain(kids[i], parts);
  }
}

/** markdown → 去语法纯文本（保留代码正文、链接可见文案、块间换行）。 */
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

export type DocTextStats = {
  /** 含空白/标点的总字符 */
  chars: number;
  /** 汉字 + 数字个数（每位数字计 1；不含标点、空白、拉丁字母） */
  words: number;
  /** 按换行计行，空文为 0 */
  lines: number;
  /** 预估阅读分钟；有正文时至少 1（约 400 字/分） */
  readingMinutes: number;
};

/**
 * 词数 = 汉字个数 + 数字个数。
 * 汉字：基本区 / 扩展 A / 兼容表意文字；数字：ASCII 0-9 与全角 ０-９，每位计 1。
 */
export function countHanAndDigits(plain: string): number {
  if (!plain) return 0;
  const re = /[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff0-9\uff10-\uff19]/g;
  let n = 0;
  while (re.exec(plain) !== null) n += 1;
  return n;
}

/** @deprecated 使用 countHanAndDigits */
export function countHanCharacters(plain: string): number {
  return countHanAndDigits(plain);
}

/** @deprecated 使用 countHanAndDigits */
export function countWordsTyporaStyle(plain: string): number {
  return countHanAndDigits(plain);
}

export function computeTextStats(plain: string): DocTextStats {
  const chars = plain.length;
  const lines = chars === 0 ? 0 : plain.split(/\r\n|\r|\n/).length;
  const words = countHanAndDigits(plain);
  const readingMinutes = words === 0 ? 0 : Math.max(1, Math.ceil(words / 400));
  return { chars, words, lines, readingMinutes };
}

export function computeDocumentStats(kind: "md" | "html", content: string): DocTextStats {
  return computeTextStats(plainTextForCharCount(kind, content));
}
