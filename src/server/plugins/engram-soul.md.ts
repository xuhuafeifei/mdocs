/**
 * Engram 安装后写入 tenant soul 旁路（engram.md）的正文。
 * 流水线 YAML / bundled 文本 / 已装实例刷新共用这一份。
 */
import fs from "node:fs";
import path from "node:path";
import { getConfig } from "../config/index.js";
import { ensureVisitorSoulShell } from "../soul/ensure-shells.js";
import { visitorSoulDir } from "../soul/paths.js";
import { listVisitorMcpServers } from "../mcp/tenant-mcp-store.js";
import { visitorPluginDataDir } from "./plugin-paths.js";

export const ENGRAM_SOUL_MARKDOWN = `# Engram（本机 Agent 记忆）

## 它是什么

Engram 是挂在助手上的**本机记忆库**（单二进制 + SQLite，经 MCP 暴露）。用来跨会话记住：项目结论、技术决策、踩坑 gotcha、约定与待办——不是聊天流水账，也不是文档正文仓库。

空间已由 mdocs 按**当前访客**隔离（\`ENGRAM_PROJECT=mdocs-<visitorId>\`）。**不要**尝试切换他人记忆或改 project；宿主会代调会话初始化，并对模型隐藏 \`mem_session_start\`。

## 什么时候用

- **先搜再答**：用户问「我们上次怎么定的」「这个坑踩过吗」→ 先调记忆搜索类工具，再结合检索结果回答。
- **值得写下来**：拍板决策、稳定约定、可复用的排错结论、明确的 gotcha → 写入记忆。
- **别滥写**：寒暄、一次性操作步骤、已在 mdocs 文档里完整存着且无额外结论的内容 → 不必写记忆。

## 怎么用（工具名形如 mcp__…__mem_*）

具体工具以本轮挂载的 MCP 列表为准，常见能力：

| 意图 | 做法 |
|------|------|
| 回忆 | 用搜索 / timeline / 按 id 读取类工具；query 用简短关键词或问题句 |
| 沉淀 | 用 save / add / observation 类工具；写清「结论 + 为何重要 + 适用场景」 |
| 体检 | stats 类工具看量级；不要每轮都调 |

写作提示：

1. 一条记忆一个主题；标题/摘要要能检索到。
2. 注明上下文（哪篇文档、哪个工作空间、哪次讨论），避免裸结论。
3. 冲突时：新结论覆盖旧理解时，写明「取代此前 …」。
4. 文档正文仍用 mdocs 文档工具读写；Engram 只补「跨会话、可检索的元知识」。

## 与 mdocs 文档的分工

- **mdocs 文档**：给人看的正文、可协作编辑、有权限与版本。
- **Engram**：给助手用的长期记忆索引；用户通常不直接翻库。

闲聊、改错别字、纯格式调整 → 不动 Engram。
`;

/** 旧版旁路全文（用于识别并原地刷新） */
export const ENGRAM_SOUL_MARKDOWN_LEGACY = `# Engram

本机记忆已接入。空间按当前访客隔离，无需也不应切换他人记忆。
`;

/** YAML `content: |` 块缩进 */
export function engramSoulYamlIndented(indent = "      "): string {
  return ENGRAM_SOUL_MARKDOWN.trimEnd()
    .split("\n")
    .map((line) => indent + line)
    .join("\n");
}

function normalizeSoul(text: string): string {
  return text.replace(/\r\n/g, "\n").trim();
}

function visitorHasEngram(visitorId: string): boolean {
  try {
    if (
      listVisitorMcpServers(visitorId).some(
        (s) => s.enabled && (s.id === "engram" || /engram/i.test(s.name)),
      )
    ) {
      return true;
    }
  } catch {
    /* ignore */
  }
  try {
    return fs.existsSync(visitorPluginDataDir(visitorId, "engram"));
  } catch {
    return false;
  }
}

/**
 * 若访客已装 Engram：缺失旁路则写入；仍是旧 stub 则刷新。
 * 不覆盖用户手改过的旁路。
 */
export function ensureEngramSoulSidecar(visitorId: string): void {
  const id = visitorId.trim();
  if (!id || !visitorHasEngram(id)) return;
  try {
    // touch getConfig so MDOCS_DATA_DIR 解析与运行时一致
    void getConfig().dataDir;
    ensureVisitorSoulShell(id);
    const target = path.join(visitorSoulDir(id), "engram.md");
    if (!fs.existsSync(target)) {
      fs.writeFileSync(target, ENGRAM_SOUL_MARKDOWN, "utf8");
      return;
    }
    const cur = normalizeSoul(fs.readFileSync(target, "utf8"));
    if (cur === normalizeSoul(ENGRAM_SOUL_MARKDOWN_LEGACY)) {
      fs.writeFileSync(target, ENGRAM_SOUL_MARKDOWN, "utf8");
    }
  } catch {
    // 旁路刷新失败不影响主流程
  }
}
