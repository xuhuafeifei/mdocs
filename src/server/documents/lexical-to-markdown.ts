/**
 * Lexical JSON → Markdown（与 markdown-to-lexical 对称的 B 层子集）。
 * 供 Agent get_document(format=md) / replace / convertDocumentContent 使用。
 * 不做与 lobe 前端 100% 一致；复杂自定义节点降级为可见文本或围栏。
 */

const MAX_DEPTH = 40;

const TEXT_BOLD = 1;
const TEXT_ITALIC = 2;
const TEXT_STRIKETHROUGH = 4;
const TEXT_UNDERLINE = 8;
const TEXT_CODE = 16;

type LexNode = Record<string, unknown>;

function asNodes(children: unknown): LexNode[] {
  if (!Array.isArray(children)) return [];
  return children.filter((c): c is LexNode => Boolean(c) && typeof c === "object");
}

function escapeInline(text: string): string {
  return text.replace(/([\\`*_[\]{}()#+.!|-])/g, "\\$1");
}

/** 按 format bitmask 包裹；顺序：code → bold → italic → strike → underline(HTML) */
function wrapFormat(text: string, format: number, style: string): string {
  let out = text;
  if (format & TEXT_CODE) out = `\`${out.replace(/`/g, "\\`")}\``;
  else out = escapeInline(out);
  if (format & TEXT_BOLD) out = `**${out}**`;
  if (format & TEXT_ITALIC) out = `*${out}*`;
  if (format & TEXT_STRIKETHROUGH) out = `~~${out}~~`;
  if (format & TEXT_UNDERLINE) out = `<u>${out}</u>`;
  if (style && /color\s*:|background-color\s*:/i.test(style)) {
    out = `<span style="${style.replace(/"/g, "")}">${out}</span>`;
  }
  return out;
}

function serializeInline(nodes: LexNode[], depth: number): string {
  if (depth > MAX_DEPTH) return "";
  let out = "";
  for (const n of nodes) {
    const type = String(n.type ?? "");
    if (type === "text") {
      const text = typeof n.text === "string" ? n.text : "";
      if (!text) continue;
      const format = typeof n.format === "number" ? n.format : 0;
      const style = typeof n.style === "string" ? n.style : "";
      out += wrapFormat(text, format, style);
      continue;
    }
    if (type === "link") {
      const label = serializeInline(asNodes(n.children), depth + 1) || "link";
      const url = typeof n.url === "string" ? n.url : "";
      out += `[${label}](${url})`;
      continue;
    }
    if (type === "linebreak") {
      out += "  \n";
      continue;
    }
    // 未知内联：拍平 children
    if (Array.isArray(n.children)) {
      out += serializeInline(asNodes(n.children), depth + 1);
    }
  }
  return out;
}

function headingLevel(node: LexNode): number {
  const tag = typeof node.tag === "string" ? node.tag : "";
  const m = /^h([1-6])$/i.exec(tag);
  if (m) return Number(m[1]);
  if (typeof node.depth === "number" && node.depth >= 1 && node.depth <= 6) {
    return node.depth;
  }
  return 1;
}

function codeFenceContent(node: LexNode): { lang: string; body: string } {
  const lang =
    typeof node.language === "string" && node.language ? node.language : "";
  if (typeof node.code === "string") {
    return { lang, body: node.code };
  }
  const kids = asNodes(node.children);
  const body = kids
    .map((c) => (c.type === "text" && typeof c.text === "string" ? c.text : ""))
    .join("");
  return { lang, body };
}

function serializeList(
  node: LexNode,
  depth: number,
  indent: number,
): string {
  const ordered = node.listType === "number" || node.listType === "ordered";
  const start = typeof node.start === "number" && node.start > 0 ? node.start : 1;
  const items = asNodes(node.children);
  const lines: string[] = [];
  let idx = start;
  const pad = "  ".repeat(indent);
  for (const item of items) {
    if (item.type !== "listitem" && item.type !== "list-item") {
      // 容错：直接当块
      const block = serializeBlock(item, depth + 1, indent);
      if (block.trim()) lines.push(block);
      continue;
    }
    const kids = asNodes(item.children);
    const bullet = ordered ? `${idx}.` : "-";
    idx += 1;
    const parts: string[] = [];
    for (const k of kids) {
      if (k.type === "list") {
        parts.push(serializeList(k, depth + 1, indent + 1));
      } else if (k.type === "paragraph") {
        parts.push(serializeInline(asNodes(k.children), depth + 1));
      } else {
        const b = serializeBlock(k, depth + 1, indent + 1).trimEnd();
        if (b) parts.push(b);
      }
    }
    const first = parts[0] ?? "";
    const rest = parts.slice(1).join("\n");
    lines.push(`${pad}${bullet} ${first}`.trimEnd());
    if (rest) lines.push(rest);
  }
  return lines.join("\n");
}

function serializeTable(node: LexNode, depth: number): string {
  const rows = asNodes(node.children).filter(
    (r) => r.type === "tablerow" || r.type === "table-row",
  );
  if (rows.length === 0) return "";
  const cellTexts: string[][] = rows.map((row) =>
    asNodes(row.children)
      .filter((c) => c.type === "tablecell" || c.type === "table-cell")
      .map((c) => {
        const inners = asNodes(c.children);
        // cell 里常是 paragraph
        return inners
          .map((p) =>
            p.type === "paragraph"
              ? serializeInline(asNodes(p.children), depth + 1)
              : serializeInline(asNodes(p.children ?? [p]), depth + 1),
          )
          .join(" ")
          .replace(/\|/g, "\\|")
          .trim();
      }),
  );
  const colCount = Math.max(1, ...cellTexts.map((r) => r.length));
  const norm = cellTexts.map((r) => {
    const copy = r.slice();
    while (copy.length < colCount) copy.push("");
    return copy;
  });
  const header = norm[0]!;
  const sep = header.map(() => "---");
  const lines = [
    `| ${header.join(" | ")} |`,
    `| ${sep.join(" | ")} |`,
    ...norm.slice(1).map((r) => `| ${r.join(" | ")} |`),
  ];
  return lines.join("\n");
}

function serializeBlock(node: LexNode, depth: number, listIndent = 0): string {
  if (depth > MAX_DEPTH) return "";
  const type = String(node.type ?? "");

  switch (type) {
    case "paragraph": {
      const inline = serializeInline(asNodes(node.children), depth + 1);
      return inline;
    }
    case "heading": {
      const level = headingLevel(node);
      const inline = serializeInline(asNodes(node.children), depth + 1);
      return `${"#".repeat(level)} ${inline}`;
    }
    case "code":
    case "codeblock": {
      const { lang, body } = codeFenceContent(node);
      return `\`\`\`${lang}\n${body}\n\`\`\``;
    }
    case "quote":
    case "blockquote": {
      const kids = asNodes(node.children);
      // 空引用（无子节点 / 仅空段落）必须仍输出 `>`，否则 replace 往返会把「空白引用行」吃掉
      if (kids.length === 0) return ">";
      const parts = kids.map((c) => serializeBlock(c, depth + 1));
      if (parts.every((p) => p.length === 0)) return ">";
      const inner = parts.join("\n\n");
      return inner
        .split("\n")
        .map((line) => (line.length > 0 ? `> ${line}` : ">"))
        .join("\n");
    }
    case "list":
      return serializeList(node, depth, listIndent);
    case "horizontalrule":
    case "hr":
      return "---";
    case "table":
      return serializeTable(node, depth);
    case "markmap":
    case "meta2d": {
      const md =
        typeof node.__markdown === "string"
          ? node.__markdown
          : typeof node.markdown === "string"
            ? node.markdown
            : "";
      if (md) {
        const fence = type === "markmap" ? "markmap" : "meta2d";
        return `\`\`\`${fence}\n${md}\n\`\`\``;
      }
      return "";
    }
    default: {
      if (Array.isArray(node.children)) {
        return asNodes(node.children)
          .map((c) => serializeBlock(c, depth + 1, listIndent))
          .filter(Boolean)
          .join("\n\n");
      }
      return "";
    }
  }
}

/**
 * 将 Lexical SerializedEditorState JSON 转为 Markdown。
 * 非 Lexical JSON（解析失败或无 root）原样返回。
 */
export function lexicalJsonToMarkdown(rawContent: string): string {
  let doc: unknown;
  try {
    doc = JSON.parse(rawContent);
  } catch {
    return rawContent;
  }
  if (!doc || typeof doc !== "object" || !("root" in doc)) {
    return rawContent;
  }
  const root = (doc as { root: LexNode }).root;
  if (!root || typeof root !== "object") return rawContent;
  const blocks = asNodes(root.children)
    .map((c) => serializeBlock(c, 0))
    .map((s) => s.trimEnd())
    .filter((s) => s.length > 0);
  return blocks.join("\n\n").trimEnd() + (blocks.length ? "\n" : "");
}
