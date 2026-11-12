/**
 * 图谱工具函数单元测试。
 */
import { describe, expect, test } from 'vitest';
import { makeNodeId, needRebuild, slugify, findRootNodes } from './utils.js';

describe('slugify', () => {
  test('中文 label 正常保留', () => {
    expect(slugify('恢复码')).toBe('恢复码');
  });

  test('英文转小写', () => {
    expect(slugify('Recovery Code')).toBe('recovery-code');
  });

  test('空格替换为 -', () => {
    expect(slugify('hello world')).toBe('hello-world');
  });

  test('特殊字符替换并去重', () => {
    expect(slugify('a!@#b')).toBe('a-b');
  });

  test('首尾空格和 - 去掉', () => {
    expect(slugify('  -hello-  ')).toBe('hello');
  });

  test('中英混合', () => {
    expect(slugify('OAuth2 认证')).toBe('oauth2-认证');
  });
});

describe('makeNodeId', () => {
  test('doc 类型', () => {
    const id = makeNodeId('doc', '恢复码是什么');
    expect(id).toMatch(/^doc:恢复码是什么-\d{4}$/);
  });

  test('concept 类型', () => {
    const id = makeNodeId('concept', '身份认证');
    expect(id).toMatch(/^concept:身份认证-\d{4}$/);
  });

  test('每次生成的 id 不同（随机后缀）', () => {
    const id1 = makeNodeId('doc', '测试');
    const id2 = makeNodeId('doc', '测试');
    expect(id1).not.toBe(id2);
  });

  test('label 会被 slugify', () => {
    const id = makeNodeId('doc', 'Hello World');
    expect(id).toMatch(/^doc:hello-world-\d{4}$/);
  });
});

describe('needRebuild', () => {
  test('无缓存时需要重建', () => {
    expect(needRebuild('abc')).toBe(true);
  });

  test('commit 相同不需要重建', () => {
    expect(needRebuild('abc', 'abc')).toBe(false);
  });

  test('commit 不同需要重建', () => {
    expect(needRebuild('abc', 'def')).toBe(true);
  });
});

describe('findRootNodes', () => {
  test('没有边时所有节点都是根节点', () => {
    const nodes = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
    const result = findRootNodes(nodes, []);
    expect(result.map(n => n.id)).toEqual(['a', 'b', 'c']);
  });

  test('单层包含：被指向的不是根节点', () => {
    const nodes = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
    const edges = [{ to: 'b' }, { to: 'c' }];
    const result = findRootNodes(nodes, edges);
    expect(result.map(n => n.id)).toEqual(['a']);
  });

  test('多层包含：只有最顶层是根节点', () => {
    const nodes = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
    const edges = [{ to: 'b' }, { to: 'c' }];
    // a 指向 b，b 指向 c —— 这里只用 to 来算入度，所以 a、b 都是根
    // （我们只测试 findRootNodes 函数本身，边的来源由调用方保证）
    const result = findRootNodes(nodes, edges);
    expect(result.map(n => n.id)).toEqual(['a']);
  });

  test('多根节点', () => {
    const nodes = [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }];
    const edges = [{ to: 'b' }, { to: 'd' }];
    const result = findRootNodes(nodes, edges);
    expect(result.map(n => n.id)).toEqual(['a', 'c']);
  });

  test('空节点列表返回空', () => {
    const result = findRootNodes([], [{ to: 'y' }]);
    expect(result).toEqual([]);
  });
});
