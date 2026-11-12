/**
 * TaskQueue 单元测试。
 *
 * 测试要点：
 * 1. 基本入队、执行、完成
 * 2. 并发控制（不超过 concurrency）
 * 3. 去重
 * 4. yield 让出 + 恢复
 * 5. 失败处理
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { TaskQueue } from './TaskQueue.js';

describe('TaskQueue', () => {
  let tmpDir: string;
  let queue: TaskQueue;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'task-queue-test-'));
    queue = new TaskQueue({ concurrency: 2, timeSliceMs: 100, logDir: tmpDir });
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  /* ── 辅助：注册一个简单的测试任务 ── */

  function registerSimpleTask(name: string, work: (ctx: any) => Promise<void>) {
    queue.registerTask(name, {
      makeId: (payload: any) => `${name}:${payload.id}`,
      run: async (payload, ctx) => {
        await work(ctx);
      },
    });
  }

  it('基本流程：入队 → 执行 → 完成', async () => {
    let ran = false;
    registerSimpleTask('test', async () => {
      ran = true;
    });

    const result = queue.enqueue('test', { id: '1' });
    expect(result.deduped).toBe(false);
    expect(result.taskId).toBe('test:1');

    // 等 setImmediate 里的调度执行完
    await new Promise((r) => setTimeout(r, 10));

    expect(ran).toBe(true);
    const status = queue.getTask('test:1');
    expect(status.status).toBe('completed');
  });

  it('并发控制：同时最多跑 concurrency 个', async () => {
    let running = 0;
    let maxRunning = 0;
    const tasks: Promise<void>[] = [];

    queue.registerTask('test', {
      makeId: (p: any) => `test:${p.id}`,
      run: async () => {
        running++;
        maxRunning = Math.max(maxRunning, running);
        await new Promise((r) => setTimeout(r, 50));
        running--;
      },
    });

    // 入队 5 个
    for (let i = 0; i < 5; i++) {
      queue.enqueue('test', { id: String(i) });
    }

    // 等所有任务跑完
    await new Promise((r) => setTimeout(r, 200));

    expect(maxRunning).toBe(2);
  });

  it('去重：相同 ID 不重复入队', async () => {
    let count = 0;
    registerSimpleTask('test', async () => {
      count++;
    });

    queue.enqueue('test', { id: 'same' });
    const result = queue.enqueue('test', { id: 'same' });

    expect(result.deduped).toBe(true);
    expect(result.taskId).toBe('test:same');

    await new Promise((r) => setTimeout(r, 10));

    expect(count).toBe(1); // 只执行了一次
  });

  it('yield：任务可以让出，后面的顶上', async () => {
    // 用并发 1 来测，确保 A yield 后 B 能顶上
    queue = new TaskQueue({ concurrency: 1, timeSliceMs: 100, logDir: tmpDir });
    const order: string[] = [];

    queue.registerTask('test', {
      makeId: (p: any) => `test:${p.id}`,
      run: async (payload, ctx) => {
        order.push(`${payload.id}-start`);
        if (payload.yield) {
          await ctx.scheduler.yield();
        }
        order.push(`${payload.id}-end`);
      },
    });

    // A yield，B 不 yield
    queue.enqueue('test', { id: 'A', yield: true });
    queue.enqueue('test', { id: 'B', yield: false });

    await new Promise((r) => setTimeout(r, 100));

    // 顺序应该是：
    // A-start → A yield → B-start → B-end → A-end
    expect(order).toEqual(['A-start', 'B-start', 'B-end', 'A-end']);
  });

  it('失败：任务异常标记为 failed，不影响其他任务', async () => {
    queue.registerTask('test', {
      makeId: (p: any) => `test:${p.id}`,
      run: async (payload) => {
        if (payload.fail) {
          throw new Error('boom');
        }
      },
    });

    queue.enqueue('test', { id: 'bad', fail: true });
    queue.enqueue('test', { id: 'good', fail: false });

    await new Promise((r) => setTimeout(r, 50));

    const bad = queue.getTask('test:bad');
    const good = queue.getTask('test:good');

    expect(bad.status).toBe('failed');
    expect(bad.error).toBe('boom');
    expect(good.status).toBe('completed');
  });

  it('shouldYield：没人排队时不让', async () => {
    let capturedShouldYield = true;
    queue.registerTask('test', {
      makeId: (p: any) => `test:${p.id}`,
      run: async (_payload, ctx) => {
        capturedShouldYield = ctx.scheduler.shouldYield();
      },
    });

    queue.enqueue('test', { id: '1' });
    await new Promise((r) => setTimeout(r, 10));

    // 只有一个任务，没人排队 → 不让
    expect(capturedShouldYield).toBe(false);
  });
});
