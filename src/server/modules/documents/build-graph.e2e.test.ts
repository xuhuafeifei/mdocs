/**
 * buildGraphByDocId 端到端集成测试。
 *
 * 用本地真实的 mdocs 数据（~/.mdocs/），完整跑一遍图谱构建流程：
 * - 读文档内容
 * - AI 提取 doc 节点
 * - 归纳 concept 节点
 * - 生成 contains 关系
 * - 写入图谱隐藏文件
 *
 * 默认跳过（.skip），需要手动运行：
 * pnpm vitest run build-graph.e2e.test.ts
 *
 * 运行前确认：
 * 1. ~/.mdocs/ 有数据
 * 2. ~/.claude/settings.json 配置正确
 * 3. 把下面的 TEST_DOC_ID 换成你想测试的文档/目录 ID
 */
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, it, expect } from "vitest";
import { buildGraphByDocId } from "./graph.service.js";
import type { GraphAgentConfig } from "./graph/graph-agent.js";

// 换成你要测试的文档或目录 ID
const TEST_DOC_ID = "a513302a-7dda-4b68-a47c-06e4f5280ac6.folder-desc";

/** 从 ~/.claude/settings.json 读取 Agent 配置（测试用） */
async function loadAgentConfig(): Promise<GraphAgentConfig> {
  const settingsPath = path.join(os.homedir(), ".claude", "settings.json");
  const raw = await fs.readFile(settingsPath, "utf-8");
  const settings = JSON.parse(raw);
  const env = settings.env ?? {};

  const baseUrl = env.ANTHROPIC_BASE_URL;
  const apiKey = env.ANTHROPIC_AUTH_TOKEN;
  const modelId = settings.model ?? "ddmc";

  if (!baseUrl || !apiKey) {
    throw new Error(
      "settings.json 中缺少 ANTHROPIC_BASE_URL 或 ANTHROPIC_AUTH_TOKEN",
    );
  }

  return { baseUrl, apiKey, modelId };
}

describe("buildGraphByDocId 端到端测试", () => {
  it("可以正常构建图谱", async () => {
    const agentConfig = await loadAgentConfig();

    console.log(`开始构建图谱，docId: ${TEST_DOC_ID}...`);
    const graph = await buildGraphByDocId(TEST_DOC_ID, agentConfig);

    console.log(`构建完成！`);
    console.log(`  节点数：${graph.nodes.length}`);
    console.log(`  边数：${graph.edges.length}`);
    console.log(
      `  doc 节点：${graph.nodes.filter((n) => n.type === "doc").length}`,
    );
    console.log(
      `  concept 节点：${graph.nodes.filter((n) => n.type === "concept").length}`,
    );

    // 打印前 3 个节点看看
    console.log("\n前 3 个节点：");
    for (const node of graph.nodes.slice(0, 3)) {
      console.log(
        `  [${node.type}] ${node.label} — ${node.description.slice(0, 50)}...`,
      );
    }

    // 打印前 3 条边看看
    if (graph.edges.length > 0) {
      console.log("\n前 3 条边：");
      for (const edge of graph.edges.slice(0, 3)) {
        console.log(
          `  ${edge.from} → ${edge.to} (${edge.type}, ${edge.confidence})`,
        );
      }
    }

    expect(graph.nodes.length).toBeGreaterThan(0);
  });
});
