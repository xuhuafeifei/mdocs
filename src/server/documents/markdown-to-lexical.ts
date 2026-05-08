/**
 * Markdown → Lexical JSON 转换器
 *
 * 接收 markdown 文本，用 remark 解析为 mdast 树，
 * 再递归转换为 Lexical 的 SerializedEditorState 可识别的 JSON。
 *
 * 覆盖 B 层节点：段落、标题、粗体、斜体、删除线、内联代码、代码块、
 *              链接、无序/有序列表、块引用、分隔线、表格。
 */

import { remark } from "remark";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";

// ── 格式 bitmask ──────────────────────────────────────
const TEXT_BOLD = 1;
const TEXT_ITALIC = 2;
const TEXT_STRIKETHROUGH = 4;
const TEXT_UNDERLINE = 8;
const TEXT_CODE = 16;

// ── 基础节点骨架 ─────────────────────────────────────
const BASE = {
  direction: "ltr" as const,
  format: "",
  indent: 0,
  version: 1,
};

interface LexicalNode {
  [key: string]: unknown;
}

// ── 节点工厂 ──────────────────────────────────────────

function textNode(text: string, format = 0): LexicalNode {
  return {
    ...BASE,
    detail: 0,
    format,
    mode: "normal",
    style: "",
    text,
    type: "text",
  };
}

function elementNode(
  type: string,
  children: LexicalNode[],
  extra?: Record<string, unknown>,
): LexicalNode {
  return { ...BASE, ...extra, children, type };
}

/**
 * Lexical 根节点的序列化片段（`type: "root"`）。
 * SerializedEditorState 必须是 `{ root: 本对象 }`；仅在外层入口处包一层 `{ root }`。
 */
function lexicalSerializedRoot(children: LexicalNode[]): LexicalNode {
  return { ...BASE, type: "root", children };
}

function paragraphNode(children: LexicalNode[]): LexicalNode {
  return elementNode("paragraph", children, { textFormat: 0, textStyle: "" });
}

function headingNode(children: LexicalNode[], depth: number): LexicalNode {
  return elementNode("heading", children, {
    tag: `h${Math.min(Math.max(depth, 1), 6)}`,
  });
}

function codeBlockNode(language: string | null, value: string): LexicalNode {
  return {
    ...BASE,
    children: [textNode(value)],
    language: language ?? null,
    type: "code",
  };
}

function linkNode(children: LexicalNode[], url: string): LexicalNode {
  return elementNode("link", children, { url });
}

function listNode(
  children: LexicalNode[],
  ordered: boolean,
  start: number,
): LexicalNode {
  return elementNode("list", children, {
    listType: ordered ? "number" : "bullet",
    start,
  });
}

function listItemNode(children: LexicalNode[]): LexicalNode {
  return elementNode("listitem", children, { value: 1 });
}

function quoteNode(children: LexicalNode[]): LexicalNode {
  return elementNode("quote", children);
}

function horizontalRuleNode(): LexicalNode {
  return { ...BASE, type: "horizontalrule" };
}

function tableNode(children: LexicalNode[], colWidths: number[]): LexicalNode {
  return elementNode("table", children, { colWidths });
}

/** 从 mdast table 推断列数，列宽一律 floor(825 / 列数) */
function columnWidthsFromMdastTable(table: Record<string, unknown>): number[] {
  const rows = table.children as unknown[] | undefined;
  if (!Array.isArray(rows) || rows.length === 0) return [];
  let colCount = 0;
  for (const row of rows) {
    const r = row as Record<string, unknown>;
    if (r.type !== "tableRow" || !Array.isArray(r.children)) continue;
    colCount = r.children.length;
    break;
  }
  if (colCount <= 0) return [];
  const w = Math.floor(825 / colCount);
  return Array.from({ length: colCount }, () => w);
}

function tableRowNode(children: LexicalNode[]): LexicalNode {
  return elementNode("tablerow", children, { height: 33 });
}

function tableCellNode(children: LexicalNode[]): LexicalNode {
  return elementNode("tablecell", children, {
    backgroundColor: null,
    colSpan: 1,
    headerState: 0,
    rowSpan: 1,
  });
}

// ── 内联内容处理 ─────────────────────────────────────

/**
 * 处理内联节点列表（段落/标题/块引用内部的格式化内容）。
 * strong → format |= BOLD, emphasis → format |= ITALIC, 等。
 */
function flattenInline(nodes: unknown[]): LexicalNode[] {
  const result: LexicalNode[] = [];

  for (const node of nodes) {
    const n = node as Record<string, unknown>;
    switch (n.type) {
      case "text":
        result.push(textNode(n.value as string));
        break;

      case "strong": {
        const children = flattenInline(n.children as unknown[]);
        for (const child of children) {
          if (child.type === "text")
            child.format = ((child.format as number) ?? 0) | TEXT_BOLD;
        }
        result.push(...children);
        break;
      }

      case "emphasis": {
        const children = flattenInline(n.children as unknown[]);
        for (const child of children) {
          if (child.type === "text")
            child.format = ((child.format as number) ?? 0) | TEXT_ITALIC;
        }
        result.push(...children);
        break;
      }

      case "delete": {
        const children = flattenInline(n.children as unknown[]);
        for (const child of children) {
          if (child.type === "text")
            child.format = ((child.format as number) ?? 0) | TEXT_STRIKETHROUGH;
        }
        result.push(...children);
        break;
      }

      case "inlineCode":
        result.push(textNode(n.value as string, TEXT_CODE));
        break;

      case "link":
        result.push(
          linkNode(flattenInline(n.children as unknown[]), n.url as string),
        );
        break;

      case "image":
        // 图片无损表示需要自定义节点（block-image），这里转成链接保留文本信息
        result.push(
          linkNode(
            [textNode((n.alt as string) || (n.url as string))],
            n.url as string,
          ),
        );
        break;

      default:
        // 未知内联节点：如果包含 children 则递归，否则跳过
        if (n.children && Array.isArray(n.children)) {
          result.push(...flattenInline(n.children));
        }
        break;
    }
  }

  return result;
}

// ── 块级节点递归 ─────────────────────────────────────

/**
 * 将 mdast child node 转换为 Lexical 节点（或 null 表示跳过）。
 */
function convert(
  child: Record<string, unknown>,
): LexicalNode | LexicalNode[] | null {
  const children = child.children as unknown[] | undefined;

  switch (child.type) {
    case "paragraph": {
      const inlines = flattenInline(children ?? []);
      // 空段落也保留结构（不丢弃），让编辑器可以继续编辑
      return paragraphNode(inlines);
    }

    case "heading":
      return headingNode(flattenInline(children ?? []), child.depth as number);

    case "code":
      return codeBlockNode(
        (child.lang as string | undefined) ?? null,
        child.value as string,
      );

    case "blockquote":
      return quoteNode(children ? convertBlockChildren(children) : []);

    case "list": {
      const ordered = (child.ordered as boolean) ?? false;
      const start = (child.start as number) ?? 1;
      const items = children ? convertBlockChildren(children) : [];
      return listNode(items, ordered, start);
    }

    case "listItem":
      // listItem 的子节点通常是多个 block 级节点（paragraph、code 等）
      return listItemNode(children ? convertBlockChildren(children) : []);

    case "thematicBreak":
      return horizontalRuleNode();

    case "table": {
      const colWidths = columnWidthsFromMdastTable(child);
      const rows = children ? convertBlockChildren(children) : [];
      return tableNode(rows, colWidths);
    }

    case "tableRow":
      return tableRowNode(children ? convertBlockChildren(children) : []);

    case "tableCell":
      return tableCellNode(children ? flattenInline(children) : []);

    default:
      // 不认识的块级节点：递归处理子节点，打平结构
      if (children && Array.isArray(children)) {
        return convertBlockChildren(children);
      }
      return null;
  }
}

/**
 * 批量转换 mdast children 数组，过滤掉 null 结果。
 */
function convertBlockChildren(nodes: unknown[]): LexicalNode[] {
  const result: LexicalNode[] = [];
  for (const node of nodes) {
    const converted = convert(node as Record<string, unknown>);
    if (converted === null) continue;
    if (Array.isArray(converted)) {
      result.push(...converted);
    } else {
      result.push(converted);
    }
  }
  return result;
}

// ── 公开入口 ──────────────────────────────────────────

/**
 * 将 markdown 字符串转换为 Lexical SerializedEditorState JSON 字符串。
 *
 * 解析后应为 `{ root: { type: "root", children: [...], ... } }`。若调试时只打印解构出的 `.root`，
 * 会看到 `{ type: "root", ... }`（内层节点），并非丢了一层 `root`。
 *
 * @param markdown - 原始 markdown 文本
 */
export function markdownToLexicalJson(markdown: string): string {
  const ast = remark().use(remarkGfm).use(remarkMath).parse(markdown);

  const children = convertBlockChildren(
    (ast as unknown as Record<string, unknown>).children as unknown[],
  );
  return JSON.stringify({ root: lexicalSerializedRoot(children) });
}
