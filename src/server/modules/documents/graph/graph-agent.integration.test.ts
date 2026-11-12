/**
 * 图谱 Agent 集成测试。
 *
 * 真实调用 Anthropic API，验证：
 * 1. runComplete 纯文本问答
 * 2. runToolExtractionWithFallback 正常调用
 * 3. runToolExtractionWithFallback 降级调用（内容太少时）
 *
 * 默认跳过（.skip），需要手动运行：
 * pnpm vitest run graph-agent.integration.test.ts -t "纯文本"
 */
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, it, expect } from 'vitest';
import { Type } from '@earendil-works/pi-ai';
import { z } from 'zod';
import { runComplete, runToolExtractionWithFallback } from './graph-agent.js';
import type { GraphAgentConfig, GraphToolDefinition } from './graph-agent.js';

async function loadAgentConfig(): Promise<GraphAgentConfig> {
  const settingsPath = path.join(os.homedir(), '.claude', 'settings.json');
  const raw = await fs.readFile(settingsPath, 'utf-8');
  const settings = JSON.parse(raw);
  const env = settings.env ?? {};

  const baseUrl = env.ANTHROPIC_BASE_URL;
  const apiKey = env.ANTHROPIC_AUTH_TOKEN;
  const modelId = settings.model ?? 'ddmc';

  if (!baseUrl || !apiKey) {
    throw new Error('settings.json 中缺少 ANTHROPIC_BASE_URL 或 ANTHROPIC_AUTH_TOKEN');
  }

  return { baseUrl, apiKey, modelId };
}

describe.skip('GraphAgent 集成测试（真实 API 调用）', () => {
  it('纯文本问答可以正常工作', async () => {
    const config = await loadAgentConfig();

    const result = await runComplete(
      config,
      '你是一个助手，只回答问题。',
      '用一句话介绍什么是知识图谱。',
    );

    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });

  it('runToolExtractionWithFallback 正常场景：调用主 tool', async () => {
    const config = await loadAgentConfig();

    const primaryTool: GraphToolDefinition<{ name: string; value: number }> = {
      name: 'submitTestResult',
      description: '提交测试结果',
      parameters: Type.Object({
        name: Type.String({ description: '名称' }),
        value: Type.Number({ description: '数值' }),
      }),
      schema: z.object({ name: z.string(), value: z.number() }),
    };

    const fallbackTool: GraphToolDefinition<{ reason: string }> = {
      name: 'submitNoResult',
      description: '当无法生成结果时调用，说明原因',
      parameters: Type.Object({
        reason: Type.String({ description: '原因' }),
      }),
      schema: z.object({ reason: z.string() }),
    };

    const result = await runToolExtractionWithFallback(
      config,
      primaryTool,
      fallbackTool,
      '你是一个测试助手。必须调用 submitTestResult 或 submitNoResult 之一提交结果。',
      '请提交一个对象，name 字段为 "test"，value 字段为 42。',
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.name).toBe('test');
      expect(result.data.value).toBe(42);
    }
  });

  it('runToolExtractionWithFallback 降级场景：内容太少时调用降级 tool', async () => {
    const config = await loadAgentConfig();

    const primaryTool: GraphToolDefinition<{ points: Array<{ label: string; description: string }> }> = {
      name: 'submitKnowledgePoints',
      description: '提交从文章中提取的知识要点',
      parameters: Type.Object({
        points: Type.Array(
          Type.Object({
            label: Type.String(),
            description: Type.String(),
          }),
        ),
      }),
      schema: z.object({ points: z.array(z.object({ label: z.string(), description: z.string() })) }),
    };

    const fallbackTool: GraphToolDefinition<{ reason: string }> = {
      name: 'submitNoKnowledgePoints',
      description: '当内容太少无法提取知识要点时调用',
      parameters: Type.Object({
        reason: Type.String({ description: '原因' }),
      }),
      schema: z.object({ reason: z.string() }),
    };

    const result = await runToolExtractionWithFallback(
      config,
      primaryTool,
      fallbackTool,
      '你是知识提取专家。内容太少时必须调用 submitNoKnowledgePoints。',
      '以下文章内容只有一个标题，没有正文：\n\n# 测试标题\n',
    );

    // 内容太少时应该走降级
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(typeof result.reason).toBe('string');
      expect(result.reason.length).toBeGreaterThan(0);
    }
  });
});
