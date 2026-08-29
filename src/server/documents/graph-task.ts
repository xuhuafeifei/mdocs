/**
 * 图谱生成任务 — 注册到任务队列。
 *
 * 副作用导入即可注册：import './graph-task.js'
 *
 * 分层：
 * - TaskQueue 只调度；本文件的 run 才是业务
 * - domain → runDomainGraph（按一级节点循环，内部仍走 buildGraph）
 * - dir/doc → runDocGraph（buildGraphByDocId 胶水一层后进 buildGraph）
 * - 进度：createBuildProgressHooks 把 onArticle/onFolderPhase 接到 lifecycle + yield
 */
import { taskQueue } from "../task-queue/index.js";
import type { TaskContext, TaskScheduler } from "../task-queue/types.js";
import { createGraphLifecycle, type GraphLifecycle } from "./graph-lifecycle.js";
import {
  buildGraphByDocId,
  createGraphDeps,
  buildTreeNodeForDoc,
} from "./graph.service.js";
import type { GraphAgentConfig } from "./graph/graph-agent.js";
import {
  buildGraph,
  aggregateAndInduce,
  countDocumentLeaves,
  type BuildGraphOptions,
} from "./graph/index.js";
import type { Graph } from "./graph/types.js";
import { getDb } from "../db/connection.js";
import { findDocumentById, listDocumentsByDomain } from "../db/repositories/document.repo.js";
import { findDomainById } from "../db/repositories/domain.repo.js";
import { FILE_TYPE } from "../../shared/file-types.js";

/* ── Payload 类型 ── */

/** enqueue("graph-generate", payload) 时传入；run 里原样使用 */
export interface GraphGeneratePayload {
  /** 构建范围：单篇 / 目录子树 / 整域 */
  type: "doc" | "dir" | "domain";
  /** 对应 document_id 或 domain_id */
  targetId: string;
  agentConfig: GraphAgentConfig;
  visitorId?: string;
  /** true 忽略 dirty 强制重算；false 可走缓存 */
  force?: boolean;
}

/* ── 任务定义 ── */

taskQueue.registerTask<GraphGeneratePayload>("graph-generate", {
  // 同 type+target 去重；前端轮询也靠这个 id
  makeId: (payload) => `graph:${payload.type}:${payload.targetId}`,

  run: async (payload, ctx: TaskContext) => {
    // lifecycle → 写任务日志；scheduler → shouldYield / yield
    const lifecycle = createGraphLifecycle(ctx);
    const scheduler = ctx.scheduler;

    if (payload.type === "domain") {
      await runDomainGraph(payload, lifecycle, scheduler);
    } else {
      // dir 与 doc 共用：目录会在 buildGraph 里递归叶子文章
      await runDocGraph(payload, lifecycle, scheduler);
    }
  },
});

/* ── 进度 hooks（domain / dir / doc 共用） ── */

/** 跨多次 buildGraph 累计已完成文章数（域级会连着加） */
type ProgressCounter = { done: number };

/**
 * 把核心 buildGraph 的进度回调接到任务生命周期。
 * - onArticle：每篇叶子的 start/done/cached/failed
 * - onFolderPhase：目录归纳 / 写盘
 * - 每处理完 3 篇且 shouldYield 时 await yield，让出并发槽
 *
 * 进度用 counter + totalDocs，不用单棵子树内部的 e.index（域级多棵树会重置）。
 */
function createBuildProgressHooks(opts: {
  lifecycle: GraphLifecycle;
  scheduler: TaskScheduler;
  totalDocs: number;
  startedAt: number;
  counter: ProgressCounter;
}): Pick<BuildGraphOptions, "onArticle" | "onFolderPhase"> {
  const { lifecycle, scheduler, totalDocs, startedAt, counter } = opts;

  return {
    onArticle: async (e) => {
      if (e.phase === "start") {
        // 开始抽当前篇；index 用全局已完成数，方便前端显示「第几篇」
        lifecycle.docStarted({
          docPath: e.docPath,
          docId: e.documentId,
          index: counter.done,
          total: totalDocs,
        });
        lifecycle.taskProgress({
          current: counter.done,
          total: totalDocs,
          phase: "extract",
        });
        return;
      }

      if (e.phase === "failed") {
        lifecycle.docFailed({
          docPath: e.docPath,
          docId: e.documentId,
          error: e.error ?? "",
        });
        return;
      }

      // done | cached：本篇结束，计数 +1
      counter.done += 1;
      lifecycle.docCompleted({
        docPath: e.docPath,
        docId: e.documentId,
        conceptsExtracted: e.nodesExtracted ?? 0,
        durationMs: e.durationMs ?? 0,
      });
      lifecycle.taskProgress({
        current: counter.done,
        total: totalDocs,
        phase: e.phase === "cached" ? "cached" : "extract",
      });

      // 协作式让出：有人排队且时间片到了才挂起
      if (counter.done % 3 === 0 && scheduler.shouldYield()) {
        lifecycle.taskYielded({
          current: counter.done,
          total: totalDocs,
          reason: "time-slice",
        });
        await scheduler.yield();
      }
    },

    onFolderPhase: (e) => {
      if (e.phase === "induce") {
        // 子树文章都处理完，开始对本目录做 concept / contains 归纳
        lifecycle.folderStarted({
          folderPath: e.folderPath,
          folderId: e.folderId,
          docCount: totalDocs,
        });
        lifecycle.taskProgress({
          current: counter.done,
          total: totalDocs,
          phase: "induction",
        });
      } else if (e.phase === "write") {
        lifecycle.folderCompleted({
          folderPath: e.folderPath,
          folderId: e.folderId,
          durationMs: Date.now() - startedAt,
        });
      }
    },
  };
}

/* ── Domain 级生成 ── */

/**
 * 域级：对每个一级节点 buildGraph，再 aggregateAndInduce，写入域根图谱。
 * 已有 rootNode + deps，直接调核心 buildGraph（不必再走 buildGraphByDocId）。
 */
async function runDomainGraph(
  payload: GraphGeneratePayload,
  lifecycle: GraphLifecycle,
  scheduler: TaskScheduler,
): Promise<void> {
  const startTime = Date.now();
  const db = getDb();
  const domain = findDomainById(db, payload.targetId);
  if (!domain) {
    throw new Error(`域不存在：${payload.targetId}`);
  }

  // 域下 parent_id 为空的一级节点（排除图谱隐藏文件）
  const allDocs = listDocumentsByDomain(db, payload.targetId);
  const topLevelDocs = allDocs.filter(
    (d) =>
      !d.parent_id &&
      d.file_type !== FILE_TYPE.GRAPH_FILE &&
      d.file_type !== FILE_TYPE.GRAPH_DIR,
  );

  // 先拼树，再数全域叶子文章 → 进度 total
  const rootNodes = topLevelDocs.map((d) => buildTreeNodeForDoc(d));
  const totalDocs = Math.max(
    1,
    rootNodes.reduce((sum, n) => sum + countDocumentLeaves(n), 0),
  );

  lifecycle.taskStarted({
    targetType: "domain",
    targetId: payload.targetId,
    totalDocs,
  });
  lifecycle.domainStarted({ domainId: payload.targetId, folderCount: topLevelDocs.length });

  const deps = createGraphDeps(payload.agentConfig, payload.targetId, domain.creator_visitor_id);
  // 同一 counter 贯穿所有一级子树，文章进度连续累加
  const counter: ProgressCounter = { done: 0 };
  const progress = createBuildProgressHooks({
    lifecycle,
    scheduler,
    totalDocs,
    startedAt: startTime,
    counter,
  });

  const childGraphs: Graph[] = [];
  for (let i = 0; i < topLevelDocs.length; i++) {
    const doc = topLevelDocs[i]!;
    const rootNode = rootNodes[i]!;
    try {
      // 一级节点可能是目录：buildGraph 内部仍会一篇篇 onArticle
      childGraphs.push(
        await buildGraph(rootNode, deps, { force: payload.force, ...progress }),
      );
    } catch (err: any) {
      lifecycle.docFailed({
        docPath: doc.relative_path,
        docId: doc.document_id,
        error: err.message,
      });
    }
  }

  // 域顶层再归纳一次，写 domain 级缓存
  lifecycle.taskProgress({ current: totalDocs, total: totalDocs, phase: "induction" });
  const result = await aggregateAndInduce(childGraphs, deps);

  await deps.writeDomainGraph(payload.targetId, {
    version: 1,
    meta: { dirty: false },
    nodes: result.nodes,
    edges: result.edges,
  });

  const durationMs = Date.now() - startTime;
  lifecycle.domainCompleted({
    domainId: payload.targetId,
    totalNodes: result.nodes.length,
    totalEdges: result.edges.length,
    durationMs,
  });
  lifecycle.taskCompleted({
    totalDocs,
    nodes: result.nodes.length,
    edges: result.edges.length,
    durationMs,
  });
}

/* ── Doc / Dir 级生成 ── */

/**
 * 单篇或目录：只有 document_id，走 buildGraphByDocId（查库拼树 + 造 deps + buildGraph）。
 */
async function runDocGraph(
  payload: GraphGeneratePayload,
  lifecycle: GraphLifecycle,
  scheduler: TaskScheduler,
): Promise<void> {
  const startTime = Date.now();
  const db = getDb();
  const doc = findDocumentById(db, payload.targetId);
  if (!doc) {
    throw new Error(`文档不存在：${payload.targetId}`);
  }

  // 仅用于算 totalDocs；真正构建仍由 buildGraphByDocId 内部再拼一次树
  const rootNode = buildTreeNodeForDoc(doc, payload.visitorId);
  const totalDocs = Math.max(1, countDocumentLeaves(rootNode));

  lifecycle.taskStarted({
    targetType: payload.type,
    targetId: payload.targetId,
    totalDocs,
  });

  const counter: ProgressCounter = { done: 0 };
  const progress = createBuildProgressHooks({
    lifecycle,
    scheduler,
    totalDocs,
    startedAt: startTime,
    counter,
  });

  // 胶水入口：id → TreeNode + GraphDeps → buildGraph(options 含 progress)
  const graph = await buildGraphByDocId(
    payload.targetId,
    payload.agentConfig,
    payload.visitorId,
    { force: payload.force, ...progress },
  );

  const durationMs = Date.now() - startTime;
  lifecycle.taskProgress({ current: totalDocs, total: totalDocs, phase: "complete" });
  lifecycle.taskCompleted({
    totalDocs,
    nodes: graph.nodes.length,
    edges: graph.edges.length,
    durationMs,
  });
}
