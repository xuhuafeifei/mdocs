/**
 * system prompt 的体量统计：给「提示词诊断」弹框用。
 * 只做粗估，不引入 tokenizer 依赖。
 *
 * 两个百分比基准不同，别混：
 * - sharePercent：占系统提示词自身的比例（段间构成，看完知道哪段最胖）
 * - windowPercent：占模型上下文窗口的比例（真实体量，看完知道还剩多少额度）
 */
import type { AssembledSystemPrompt, PromptSection } from "./system-prompt";

export type PromptSectionStat = {
  id: string;
  label: string;
  chars: number;
  tokens: number;
  /** 占系统提示词自身的比例，保留一位小数 */
  sharePercent: number;
  /** 占模型上下文窗口的比例，保留两位小数 */
  windowPercent: number;
};

export type PromptStats = {
  sections: PromptSectionStat[];
  total: {
    chars: number;
    tokens: number;
    sections: number;
    /** 整段提示词占窗口的比例 */
    windowPercent: number;
  };
  /** 上下文窗口 token 上限；0 表示未知 */
  window: number;
};

const CJK_RE = /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uac00-\ud7af\uf900-\ufaff]/g;

/** 粗估 token：CJK 约 1 token/字，其余约 4 字符/token。 */
export function estimateTokens(text: string): number {
  if (!text) return 0;
  const cjk = (text.match(CJK_RE) ?? []).length;
  const other = text.length - cjk;
  return cjk + Math.ceil(other / 4);
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function percentOf(part: number, whole: number, digits: 1 | 2): number {
  if (whole <= 0) return 0;
  return digits === 1 ? round1((part / whole) * 100) : round2((part / whole) * 100);
}

export function summarizePrompt(
  assembled: Pick<AssembledSystemPrompt, "sections" | "prompt">,
  /** 模型上下文窗口 token 上限；不传则 windowPercent 全为 0 */
  contextWindow = 0,
): PromptStats {
  const totalChars = assembled.sections.reduce((sum, s) => sum + s.text.length, 0) || 1;
  const window = Number.isFinite(contextWindow) && contextWindow > 0 ? Math.round(contextWindow) : 0;
  const sections = assembled.sections.map((section: PromptSection) => {
    const chars = section.text.length;
    const tokens = estimateTokens(section.text);
    return {
      id: section.id,
      label: section.label,
      chars,
      tokens,
      sharePercent: percentOf(chars, totalChars, 1),
      windowPercent: percentOf(tokens, window, 2),
    };
  });
  const totalTokens = estimateTokens(assembled.prompt);
  return {
    sections,
    total: {
      chars: assembled.prompt.length,
      tokens: totalTokens,
      sections: sections.length,
      windowPercent: percentOf(totalTokens, window, 2),
    },
    window,
  };
}
