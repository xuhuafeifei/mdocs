/**
 * LLM 调用的公共工具：JSON 提取 + Zod 校验 + 单轮重试。
 */
import { z } from 'zod';

export type AgentLike = { complete: (system: string, user: string) => Promise<string> };

/**
 * 从 Agent 输出中提取最外层 JSON 对象。
 * 支持 ```json 围栏、前后多余文字等情况。
 */
export function extractJson(text: string): string | null {
  // 先尝试找 fenced code block
  const fenceMatch = text.match(/```(?:json)?\s*\n([\s\S]*?)\n\s*```/i);
  if (fenceMatch && fenceMatch[1]) {
    return fenceMatch[1].trim();
  }
  // 再尝试找最外层的 { ... }
  const firstBrace = text.indexOf('{');
  const lastBrace = text.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    return text.slice(firstBrace, lastBrace + 1);
  }
  return null;
}