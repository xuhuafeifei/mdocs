/**
 * LLM 工具函数单元测试（JSON 提取部分）。
 */
import { describe, expect, test } from 'vitest';
import { extractJson } from './llm-utils.js';

describe('extractJson', () => {
  test('纯 JSON 直接返回', () => {
    const json = '{"a": 1}';
    expect(extractJson(json)).toBe(json);
  });

  test('带 markdown code fence', () => {
    const input = '```json\n{"a": 1}\n```';
    expect(extractJson(input)).toBe('{"a": 1}');
  });

  test('带前后多余文字', () => {
    const input = '好的，这是结果：\n{"a": 1}\n希望对你有帮助。';
    expect(extractJson(input)).toBe('{"a": 1}');
  });

  test('带 fence 和多余文字', () => {
    const input = '开始\n```\n{"a": 1}\n```\n结束';
    expect(extractJson(input)).toBe('{"a": 1}');
  });

  test('嵌套对象正确取最外层', () => {
    const input = '{"a": {"b": 1}}';
    expect(extractJson(input)).toBe(input);
  });

  test('没有 JSON 返回 null', () => {
    expect(extractJson('hello world')).toBeNull();
  });

  test('空字符串返回 null', () => {
    expect(extractJson('')).toBeNull();
  });
});
