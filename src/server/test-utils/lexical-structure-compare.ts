/**
 * 【仅 Vitest】比较 Lobe 导出 Lexical 与 markdown 解析结果的结构差异。
 * 不参与 `document.service` / 路由等运行时路径；仅被 `*.test.ts` 引用。
 */
export type LexicalStructureMismatch = string;

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/** 从 code 节点取出可比较的源码字符串（兼容 `code` 字段与 `children`+text） */
export function extractCodeSource(node: Record<string, unknown>): string {
  if (node.type !== "code") return "";
  if (typeof node.code === "string") return node.code;
  const ch = node.children;
  if (!Array.isArray(ch)) return "";
  const parts: string[] = [];
  for (const c of ch) {
    if (isRecord(c) && c.type === "text" && typeof c.text === "string") {
      parts.push(c.text);
    }
  }
  return parts.join("");
}

function structuralChildren(node: Record<string, unknown>): unknown[] {
  if (node.type === "code") {
    return [];
  }
  const ch = node.children;
  return Array.isArray(ch) ? ch : [];
}

function diffNodes(golden: unknown, actual: unknown, path: string): LexicalStructureMismatch[] {
  const out: LexicalStructureMismatch[] = [];

  if (!isRecord(golden) || !isRecord(actual)) {
    out.push(`${path}: 期望 object，实际 ${typeof golden} / ${typeof actual}`);
    return out;
  }

  const gType = golden.type;
  const aType = actual.type;
  if (gType !== aType) {
    out.push(`${path}.type: 期望 ${String(gType)}，实际 ${String(aType)}`);
    return out;
  }

  const typeStr = typeof gType === "string" ? gType : "";

  if (typeStr === "text") {
    const gt = golden.text;
    const at = actual.text;
    if (gt !== at) {
      out.push(`${path}.text: 期望 ${JSON.stringify(gt)}，实际 ${JSON.stringify(at)}`);
    }
    return out;
  }

  if (typeStr === "code") {
    const gs = extractCodeSource(golden);
    const as = extractCodeSource(actual);
    if (gs !== as) {
      out.push(`${path}.code: 源码不一致`);
      out.push(`  golden: ${JSON.stringify(gs)}`);
      out.push(`  actual: ${JSON.stringify(as)}`);
    }
    return out;
  }

  const gKids = structuralChildren(golden);
  const aKids = structuralChildren(actual);
  if (gKids.length !== aKids.length) {
    out.push(
      `${path}.children.length: 期望 ${gKids.length} 个子节点，实际 ${aKids.length} 个`,
    );
    const n = Math.min(gKids.length, aKids.length);
    for (let i = 0; i < n; i++) {
      out.push(...diffNodes(gKids[i], aKids[i], `${path}.children[${i}]`));
    }
    return out;
  }

  for (let i = 0; i < gKids.length; i++) {
    out.push(...diffNodes(gKids[i], aKids[i], `${path}.children[${i}]`));
  }
  return out;
}

/**
 * @param goldenDoc - Lobe 导出：`{ root: {...} }`
 * @param actualDoc - markdownToLexicalJson 解析结果：`{ root: {...} }`
 */
export function compareLexicalStructure(
  goldenDoc: unknown,
  actualDoc: unknown,
): LexicalStructureMismatch[] {
  if (!isRecord(goldenDoc) || !isRecord(actualDoc)) {
    return ["文档根: 期望值须为 `{ root }` object"];
  }
  const gRoot = goldenDoc.root;
  const aRoot = actualDoc.root;
  if (!isRecord(gRoot) || !isRecord(aRoot)) {
    return ["文档根: golden 或 actual 缺少 .root"];
  }
  return diffNodes(gRoot, aRoot, "root");
}
