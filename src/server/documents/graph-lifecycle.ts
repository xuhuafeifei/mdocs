/**
 * 图谱生成生命周期接口（具名事件，类型安全）。
 *
 * 任务代码只依赖这个接口，不直接调用 ctx.emit。
 * 实现层把每个方法转成对应的 emit(event, data)。
 */
import type { TaskContext } from '../task-queue/types.js';

/* ── 接口定义 ── */

export interface GraphLifecycle {
  taskStarted(data: { targetType: string; targetId: string; totalDocs: number }): void;

  docStarted(data: { docPath: string; docId: string; index: number; total: number }): void;
  docCompleted(data: { docPath: string; docId: string; conceptsExtracted: number; durationMs: number }): void;
  docFailed(data: { docPath: string; docId: string; error: string }): void;

  folderStarted(data: { folderPath: string; folderId: string; docCount: number }): void;
  folderCompleted(data: { folderPath: string; folderId: string; durationMs: number }): void;
  folderFailed(data: { folderPath: string; folderId: string; error: string }): void;

  domainStarted(data: { domainId: string; folderCount: number }): void;
  domainCompleted(data: { domainId: string; totalNodes: number; totalEdges: number; durationMs: number }): void;

  taskProgress(data: { current: number; total: number; phase: string }): void;
  taskCompleted(data: { totalDocs: number; nodes: number; edges: number; durationMs: number }): void;
  taskFailed(data: { error: string; durationMs: number }): void;
  taskYielded(data: { current: number; total: number; reason: string }): void;
}

/* ── 实现 ── */

export function createGraphLifecycle(ctx: TaskContext): GraphLifecycle {
  return {
    taskStarted: (data) => ctx.emit('task.started', data),

    docStarted: (data) => ctx.emit('doc.started', data),
    docCompleted: (data) => ctx.emit('doc.completed', data),
    docFailed: (data) => ctx.emit('doc.failed', data, 'warn'),

    folderStarted: (data) => ctx.emit('folder.started', data),
    folderCompleted: (data) => ctx.emit('folder.completed', data),
    folderFailed: (data) => ctx.emit('folder.failed', data, 'warn'),

    domainStarted: (data) => ctx.emit('domain.started', data),
    domainCompleted: (data) => ctx.emit('domain.completed', data),

    taskProgress: (data) => ctx.emit('task.progress', data),
    taskCompleted: (data) => ctx.emit('task.completed', data),
    taskFailed: (data) => ctx.emit('task.failed', data, 'error'),
    taskYielded: (data) => ctx.emit('task.yielded', data),
  };
}
