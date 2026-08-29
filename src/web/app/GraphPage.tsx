/**
 * 知识图谱页面
 *
 * 功能：
 * 1. 力导向图可视化（react-force-graph-2d）
 * 2. 点击节点 → 右侧详情面板
 * 3. 右上角「生成/重新生成」按钮
 * 4. 筛选器：显示 doc 节点开关（默认关，只看 concept）
 */
import { useEffect, useMemo, useRef, useState } from "react";
import ForceGraph2D from "react-force-graph-2d";
import { X, Play, Loader2 } from "lucide-react";
import {
  analyzeDomainGraphApi,
  analyzeGraphApi,
  getDomainGraphApi,
  getGraphApi,
  getGraphTaskApi,
  type GraphData,
  type GraphEdge,
  type GraphNode,
  type GraphTaskLogEntry,
  type GraphTaskStatusEnum,
} from "../services/endpoints";
import "./GraphPage.css";

/** 把日志事件转成用户可读的文字 */
function formatLogEvent(log: GraphTaskLogEntry): string {
  const { event, data } = log;
  switch (event) {
    case "task.started":
      return `🚀 开始生成，共 ${data?.totalDocs ?? 0} 篇文档`;
    case "doc.started":
      return `📄 处理中：${data?.docPath ?? ""}（${data?.index ?? 0}/${data?.total ?? 0}）`;
    case "doc.completed":
      return `✅ ${data?.docPath ?? ""}（提取 ${data?.conceptsExtracted ?? 0} 个知识块）`;
    case "doc.failed":
      return `⚠️ ${data?.docPath ?? ""} 失败：${data?.error ?? ""}`;
    case "folder.started":
      return `📁 归纳目录：${data?.folderPath ?? ""}`;
    case "folder.completed":
      return `✅ 目录归纳完成：${data?.folderPath ?? ""}`;
    case "domain.started":
      return `🌐 开始 domain 级合成`;
    case "domain.completed":
      return `✅ domain 合成完成（${data?.totalNodes ?? 0} 节点，${data?.totalEdges ?? 0} 边）`;
    case "task.yielded":
      return `⏸️ 让出资源，排队等待中...`;
    case "task.progress":
      return `⏳ ${data?.phase ?? "progress"} ${data?.current ?? 0}/${data?.total ?? 0}`;
    case "task.completed":
      return `🎉 生成完成！${data?.nodes ?? 0} 个节点，${data?.edges ?? 0} 条边`;
    case "task.failed":
      return `❌ 生成失败：${data?.error ?? ""}`;
    default:
      return `${event}${data ? `: ${JSON.stringify(data)}` : ""}`;
  }
}

/** 队列位次：position 1 = 下一位；>1 才说前面还有几个 */
function formatQueueStatus(position: number): string {
  if (position <= 1) return "排队中，即将开始…";
  return `排队中，前面还有 ${position - 1} 个任务`;
}

/** 屏幕像素 → 图坐标；保证放大后线条/箭头在屏幕上仍有最小可见粗细 */
function screenToWorld(globalScale: number, screenPx: number, minScreenPx?: number): number {
  const scale = Math.max(globalScale, 0.2);
  const px = Math.max(minScreenPx ?? screenPx * 0.75, screenPx);
  return px / scale;
}

/**
 * 按树形思路分层：入度 0 为根（顶层），其余按最长路径向下排布。
 * 有环时环内未排到的节点挂到最底层之后。
 */
function computeTreeLayout(
  nodeIds: string[],
  edges: Array<{ from: string; to: string }>,
  opts?: { levelGap?: number; nodeGap?: number },
): Map<string, { x: number; y: number; level: number }> {
  const levelGap = opts?.levelGap ?? 120;
  const nodeGap = opts?.nodeGap ?? 160;
  const idSet = new Set(nodeIds);
  const children = new Map<string, string[]>();
  const inDegree = new Map<string, number>();
  for (const id of nodeIds) {
    children.set(id, []);
    inDegree.set(id, 0);
  }
  for (const e of edges) {
    if (!idSet.has(e.from) || !idSet.has(e.to) || e.from === e.to) continue;
    children.get(e.from)!.push(e.to);
    inDegree.set(e.to, (inDegree.get(e.to) ?? 0) + 1);
  }

  let roots = nodeIds.filter((id) => (inDegree.get(id) ?? 0) === 0);
  if (roots.length === 0 && nodeIds.length > 0) {
    const minIn = Math.min(...nodeIds.map((id) => inDegree.get(id) ?? 0));
    roots = nodeIds.filter((id) => (inDegree.get(id) ?? 0) === minIn);
  }

  // Kahn + 最长路径：子节点 level = max(父) + 1
  const level = new Map<string, number>();
  const pendingIn = new Map(inDegree);
  const queue: string[] = [];
  for (const r of roots) {
    level.set(r, 0);
    queue.push(r);
  }
  // 把「假装成根」的节点入度清零，便于出队
  for (const r of roots) {
    pendingIn.set(r, 0);
  }

  let head = 0;
  while (head < queue.length) {
    const cur = queue[head++]!;
    const curLevel = level.get(cur) ?? 0;
    for (const next of children.get(cur) ?? []) {
      const nextLevel = curLevel + 1;
      if (!level.has(next) || nextLevel > (level.get(next) ?? 0)) {
        level.set(next, nextLevel);
      }
      const left = (pendingIn.get(next) ?? 1) - 1;
      pendingIn.set(next, left);
      if (left <= 0 && !queue.includes(next)) {
        queue.push(next);
      }
    }
  }

  // 环内残留：挂到现有最深一层之后
  let maxLevel = 0;
  for (const L of level.values()) maxLevel = Math.max(maxLevel, L);
  for (const id of nodeIds) {
    if (!level.has(id)) {
      maxLevel += 1;
      level.set(id, maxLevel);
    }
  }

  const byLevel = new Map<number, string[]>();
  for (const id of nodeIds) {
    const L = level.get(id) ?? 0;
    const list = byLevel.get(L) ?? [];
    list.push(id);
    byLevel.set(L, list);
  }

  // 同层按 id 稳定排序，左右对称铺开
  const pos = new Map<string, { x: number; y: number; level: number }>();
  for (const [L, ids] of byLevel) {
    ids.sort((a, b) => a.localeCompare(b));
    const n = ids.length;
    const gap = n > 8 ? Math.max(100, nodeGap * (8 / n)) : nodeGap;
    ids.forEach((id, i) => {
      pos.set(id, {
        x: (i - (n - 1) / 2) * gap,
        y: L * levelGap,
        level: L,
      });
    });
  }
  return pos;
}

interface GraphPageProps {
  scope: "folder" | "domain";
  resourceId: string; // folderId 或 domainId
  name: string;
  onOpenDocument: (documentId: string) => void;
}

export function GraphPage({ scope, resourceId, name, onOpenDocument }: GraphPageProps) {
  const [graphData, setGraphData] = useState<GraphData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  /** 默认只显示 concept，避免 doc 全开导致线乱成一团 */
  const [showDocNodes, setShowDocNodes] = useState(false);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const graphRef = useRef<any>(null);

  // 任务状态
  const [taskStatus, setTaskStatus] = useState<GraphTaskStatusEnum>("not_found");
  const [taskLogs, setTaskLogs] = useState<GraphTaskLogEntry[]>([]);
  const [taskProgress, setTaskProgress] = useState<{ current: number; total: number } | null>(null);
  const [taskPosition, setTaskPosition] = useState(0);
  /** 与后端 makeId 默认对齐；入队后改为接口返回的 taskId */
  const defaultTaskId = `graph:${scope === "domain" ? "domain" : "dir"}:${resourceId}`;
  const taskIdRef = useRef(defaultTaskId);
  const pollTimerRef = useRef<number | null>(null);

  // 是否"正在处理中"（排队中 / 运行中，都显示进度面板）
  const isProcessing = taskStatus === "running" || taskStatus === "pending";

  // 加载图谱数据
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setSelectedNode(null);

    const fetchFn = scope === "domain" ? getDomainGraphApi : getGraphApi;
    fetchFn(resourceId)
      .then((data) => {
        if (!cancelled) {
          setGraphData(data);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err.message || "加载失败");
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [resourceId, scope]);

  // 进入页面 / 切换资源：复位 taskId，检查是否有在跑任务
  useEffect(() => {
    taskIdRef.current = defaultTaskId;
    stopPolling();
    void checkTaskStatus();
    return () => stopPolling();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultTaskId]);

  /** 查询一次任务状态（读 taskIdRef，避免闭包过期） */
  async function checkTaskStatus() {
    try {
      const result = await getGraphTaskApi(taskIdRef.current);
      setTaskStatus(result.status);
      setTaskLogs(result.logs);
      setTaskProgress(result.progress ?? null);
      setTaskPosition(result.position);

      // 完成了 → 重新加载图谱，停轮询
      if (result.status === "completed") {
        stopPolling();
        reloadGraph();
      } else if (result.status === "failed" || result.status === "stale") {
        stopPolling();
        if (result.error) {
          setError(result.error);
        }
      } else if (result.status === "running" || result.status === "pending") {
        startPolling();
      }
    } catch {
      // 查不到就算了
    }
  }

  /** 开始轮询 */
  function startPolling() {
    if (pollTimerRef.current) return;
    pollTimerRef.current = window.setInterval(() => {
      void checkTaskStatus();
    }, 2000);
  }

  /** 停止轮询 */
  function stopPolling() {
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  }

  /** 重新加载图谱数据 */
  async function reloadGraph() {
    try {
      const fetchFn = scope === "domain" ? getDomainGraphApi : getGraphApi;
      const data = await fetchFn(resourceId);
      setGraphData(data);
    } catch (err: any) {
      setError(err.message || "加载失败");
    }
  }

  // 触发生成
  const handleAnalyze = async () => {
    if (isProcessing) return;
    setError(null);
    try {
      const analyzeFn = scope === "domain" ? analyzeDomainGraphApi : analyzeGraphApi;
      const result = await analyzeFn(resourceId);
      taskIdRef.current = result.taskId;
      setTaskStatus(result.status);
      setTaskPosition(result.position);
      setTaskLogs([]);
      setTaskProgress(null);
      startPolling();
    } catch (err: any) {
      setError(err.message || "生成失败");
    }
  };

  // 根据显示模式过滤节点和边
  const { displayNodes, displayEdges } = useMemo(() => {
    if (!graphData) return { displayNodes: [], displayEdges: [] };

    if (showDocNodes) {
      return {
        displayNodes: graphData.nodes,
        displayEdges: graphData.edges,
      };
    }

    // 只显示 concept 节点，以及 concept 之间的边
    const conceptIds = new Set(
      graphData.nodes.filter((n) => n.type === "concept").map((n) => n.id),
    );
    const filteredEdges = graphData.edges.filter(
      (e) => conceptIds.has(e.from) && conceptIds.has(e.to),
    );
    return {
      displayNodes: graphData.nodes.filter((n) => n.type === "concept"),
      displayEdges: filteredEdges,
    };
  }, [graphData, showDocNodes]);

  // 树形分层布局 + 适配 force-graph；同向平行边轻微弯曲
  const graphForRender = useMemo(() => {
    const layout = computeTreeLayout(
      displayNodes.map((n) => n.id),
      displayEdges.map((e) => ({ from: e.from, to: e.to })),
      {
        levelGap: showDocNodes ? 130 : 140,
        nodeGap: showDocNodes ? 140 : 180,
      },
    );

    const nodes = displayNodes.map((n) => {
      const p = layout.get(n.id);
      return {
        id: n.id,
        name: n.label,
        type: n.type,
        val: n.type === "concept" ? 4 : 2,
        // 钉在树形坐标上，仿真不会再搅成毛球
        fx: p?.x ?? 0,
        fy: p?.y ?? 0,
        __raw: n,
        __level: p?.level ?? 0,
      };
    });

    const pairCount = new Map<string, number>();
    const links = displayEdges.map((e) => {
      const key = `${e.from}->${e.to}`;
      const idx = pairCount.get(key) ?? 0;
      pairCount.set(key, idx + 1);
      const bend = idx === 0 ? 0.04 : 0.04 + idx * 0.12;
      return {
        source: e.from,
        target: e.to,
        type: e.type,
        curvature: bend,
        __raw: e,
      };
    });
    return { nodes, links };
  }, [displayNodes, displayEdges, showDocNodes]);

  // 树形钉点后只需轻微力；保留极弱斥力
  const forceTuning = useMemo(() => {
    const n = Math.max(1, displayNodes.length);
    return {
      linkDistance: 80,
      chargeStrength: Math.max(-80, -20 - n),
    };
  }, [displayNodes.length]);

  // 自适应画布大小（须在引用 dimensions 的 effect 之前声明）
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });

  useEffect(() => {
    if (!containerRef.current) return;
    const update = () => {
      if (containerRef.current) {
        setDimensions({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight,
        });
      }
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  // 树形钉点几乎立刻稳定，缩短 fit 等待
  useEffect(() => {
    if (!graphData || loading) return;
    const t = window.setTimeout(() => {
      graphRef.current?.zoomToFit?.(400, 80);
    }, 120);
    return () => window.clearTimeout(t);
  }, [graphData, showDocNodes, loading, dimensions.width, dimensions.height]);

  // 树形布局：弱化力，避免把钉住的节点拽乱
  useEffect(() => {
    if (!graphData || loading) return;
    const fg = graphRef.current;
    if (!fg) return;
    const charge = fg.d3Force("charge") as
      | { strength?: (v: number) => unknown }
      | undefined;
    charge?.strength?.(forceTuning.chargeStrength);
    const link = fg.d3Force("link") as
      | {
          distance?: (v: number) => unknown;
          strength?: (v: number) => unknown;
        }
      | undefined;
    link?.distance?.(forceTuning.linkDistance);
    link?.strength?.(0.05);
    // 关掉居中拉力，否则整棵树会被拽向中心挤扁
    fg.d3Force("center", null);
    fg.d3ReheatSimulation?.();
  }, [forceTuning, graphData, loading, showDocNodes, graphForRender]);

  // 找到节点的子节点（用于详情面板）
  const getChildren = (nodeId: string): GraphNode[] => {
    if (!graphData) return [];
    const childIds = graphData.edges
      .filter((e) => e.from === nodeId)
      .map((e) => e.to);
    return graphData.nodes.filter((n) => childIds.includes(n.id));
  };

  // 找到节点的父节点
  const getParents = (nodeId: string): GraphNode[] => {
    if (!graphData) return [];
    const parentIds = graphData.edges
      .filter((e) => e.to === nodeId)
      .map((e) => e.from);
    return graphData.nodes.filter((n) => parentIds.includes(n.id));
  };

  // 向下追溯所有相关 doc 节点
  const getRelatedDocs = (nodeId: string): GraphNode[] => {
    if (!graphData) return [];
    const visited = new Set<string>();
    const result: GraphNode[] = [];
    const queue = [nodeId];

    while (queue.length > 0) {
      const cur = queue.shift()!;
      if (visited.has(cur)) continue;
      visited.add(cur);

      const node = graphData.nodes.find((n) => n.id === cur);
      if (node?.type === "doc") {
        result.push(node);
      }

      const children = graphData.edges
        .filter((e) => e.from === cur)
        .map((e) => e.to);
      queue.push(...children);
    }

    return result;
  };

  return (
    <div className="graph-page">
      {/* 顶部工具栏 */}
      <div className="graph-toolbar">
        <div className="graph-title">
          <span className="graph-icon">🕸️</span>
          <span>知识图谱 — {name}</span>
        </div>
        <div className="graph-actions">
          <label className="graph-toggle">
            <input
              type="checkbox"
              checked={showDocNodes}
              onChange={(e) => setShowDocNodes(e.target.checked)}
            />
            <span>显示 doc 节点</span>
          </label>
          <button
            className="graph-btn graph-btn-primary"
            onClick={handleAnalyze}
            disabled={isProcessing}
          >
            {isProcessing ? (
              <>
                <Loader2 size={14} className="spin" />
                {taskStatus === "pending" ? formatQueueStatus(taskPosition) : "生成中..."}
              </>
            ) : (
              <>
                <Play size={14} />
                {graphData ? "重新生成" : "生成图谱"}
              </>
            )}
          </button>
        </div>
      </div>

      {/* 图谱画布 */}
      <div className="graph-canvas-container" ref={containerRef}>
        {loading && (
          <div className="graph-loading">
            <Loader2 size={32} className="spin" />
            <p>加载图谱中...</p>
          </div>
        )}

        {error && !loading && (
          <div className="graph-error">
            <p>❌ {error}</p>
            <button className="graph-btn" onClick={handleAnalyze}>
              重试生成
            </button>
          </div>
        )}

        {!loading && !error && !graphData && !isProcessing && (
          <div className="graph-empty">
            <p style={{ fontSize: 48, margin: 0 }}>🕸️</p>
            <h3>还没有知识图谱</h3>
            <p className="muted">点击右上角「生成图谱」开始构建</p>
            <button
              className="graph-btn graph-btn-primary"
              onClick={handleAnalyze}
              disabled={isProcessing}
            >
              {isProcessing ? "生成中..." : "生成图谱"}
            </button>
          </div>
        )}

        {/* 进度面板：生成中/排队中时显示 */}
        {isProcessing && (
          <div className="graph-progress-panel">
            <div className="graph-progress-header">
              <Loader2 size={16} className="spin" />
              <span>
                {taskStatus === "pending"
                  ? formatQueueStatus(taskPosition)
                  : taskProgress
                    ? `正在生成（${taskProgress.current}/${taskProgress.total}）`
                    : "正在生成..."}
              </span>
            </div>
            {taskProgress && taskProgress.total > 0 && (
              <div className="graph-progress-bar">
                <div
                  className="graph-progress-bar-fill"
                  style={{ width: `${(taskProgress.current / taskProgress.total) * 100}%` }}
                />
              </div>
            )}
            <div className="graph-progress-logs">
              {taskLogs.slice(-10).map((log, i) => (
                <div key={i} className={`graph-log-item graph-log-${log.level}`}>
                  <span className="graph-log-event">{formatLogEvent(log)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {!loading && !error && graphData && graphData.nodes.length === 0 && !isProcessing && (
          <div className="graph-empty">
            <p style={{ fontSize: 48, margin: 0 }}>📄</p>
            <h3>图谱已生成</h3>
            <p className="muted">当前内容暂未提取到可关联的知识概念</p>
            <p className="muted" style={{ fontSize: 13, marginTop: 4 }}>
              内容较少或结构较简单时可能出现这种情况，补充更多内容后可以重新生成
            </p>
            <button
              className="graph-btn graph-btn-primary"
              onClick={handleAnalyze}
              disabled={isProcessing}
              style={{ marginTop: 12 }}
            >
              重新生成
            </button>
          </div>
        )}

        {!loading && !error && graphData && graphData.nodes.length > 0 && (
          <ForceGraph2D
            ref={graphRef}
            width={dimensions.width}
            height={dimensions.height}
            graphData={graphForRender}
            nodeId="id"
            nodeVal={(node: any) => (node.type === "concept" ? 6 : 3)}
            nodeColor={(node: any) =>
              node.type === "concept" ? "#8b5cf6" : "#06b6d4"
            }
            nodeCanvasObjectMode={() => "replace"}
            nodeCanvasObject={(node: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
              const label = String(node.name ?? "");
              const isConcept = node.type === "concept";
              const isHot =
                node.id === selectedNode?.id || node.id === hoveredNodeId;
              const nodeRadius = (isConcept ? 9 : 5) / Math.max(globalScale, 0.35);

              ctx.beginPath();
              ctx.arc(node.x, node.y, nodeRadius, 0, 2 * Math.PI);
              ctx.fillStyle = isConcept ? "#8b5cf6" : "#06b6d4";
              ctx.globalAlpha = isHot || !selectedNode ? 1 : 0.35;
              ctx.fill();
              ctx.strokeStyle = "#ffffff";
              ctx.lineWidth = 1.5 / Math.max(globalScale, 0.35);
              ctx.stroke();
              ctx.globalAlpha = 1;

              // 小缩放：只画 concept 短标题；doc 仅悬停/选中时出字
              const showLabel =
                isHot ||
                (isConcept && globalScale >= 0.55) ||
                (!isConcept && globalScale >= 1.4);
              if (!showLabel) return;

              const fontSize = Math.max(
                10 / globalScale,
                isConcept ? 11 / globalScale : 9 / globalScale,
              );
              const maxChars = isConcept
                ? globalScale < 0.9
                  ? 8
                  : 16
                : 10;
              const displayText =
                label.length > maxChars ? label.slice(0, maxChars) + "…" : label;

              ctx.font = `${isConcept ? "600" : "400"} ${fontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
              ctx.textAlign = "center";
              ctx.textBaseline = "top";

              const textY = node.y + nodeRadius + 3 / globalScale;
              const tw = ctx.measureText(displayText).width;
              const padX = 4 / globalScale;
              const padY = 2 / globalScale;
              ctx.fillStyle = "rgba(255,255,255,0.88)";
              ctx.fillRect(
                node.x - tw / 2 - padX,
                textY - padY,
                tw + padX * 2,
                fontSize + padY * 2,
              );
              ctx.fillStyle = isConcept ? "#1e1b4b" : "#0c4a6e";
              ctx.fillText(displayText, node.x, textY);
            }}
            // 线宽/箭头按屏幕像素恒定，并提高基准值便于放大后辨认
            linkDirectionalArrowLength={(link: any) => {
              const scale = graphRef.current?.zoom?.() ?? 1;
              const hot =
                link.source?.id === hoveredNodeId ||
                link.target?.id === hoveredNodeId ||
                link.source?.id === selectedNode?.id ||
                link.target?.id === selectedNode?.id;
              return screenToWorld(scale, hot ? 13 : 11, 9);
            }}
            linkDirectionalArrowRelPos={0.86}
            linkDirectionalArrowColor={() => "#475569"}
            linkWidth={(link: any) => {
              const scale = graphRef.current?.zoom?.() ?? 1;
              const hot =
                link.source?.id === hoveredNodeId ||
                link.target?.id === hoveredNodeId ||
                link.source?.id === selectedNode?.id ||
                link.target?.id === selectedNode?.id;
              return screenToWorld(scale, hot ? 3.5 : 3, 2.25);
            }}
            linkColor={(link: any) => {
              const hot =
                link.source?.id === hoveredNodeId ||
                link.target?.id === hoveredNodeId ||
                link.source?.id === selectedNode?.id ||
                link.target?.id === selectedNode?.id;
              return hot ? "#334155" : "#64748b";
            }}
            linkCurvature={(link: any) => link.curvature ?? 0.12}
            linkCanvasObjectMode={() => "after"}
            linkCanvasObject={(
              link: any,
              ctx: CanvasRenderingContext2D,
              globalScale: number,
            ) => {
              // 缩放较小时也显示关系标签，避免放大后只剩细线
              if (globalScale < 0.45) return;
              const from = link.source as { x?: number; y?: number };
              const to = link.target as { x?: number; y?: number };
              if (
                from.x == null ||
                from.y == null ||
                to.x == null ||
                to.y == null
              ) {
                return;
              }

              const typeMap: Record<string, string> = {
                contains: "包含",
                related_to: "相关",
                part_of: "属于",
                depends_on: "依赖",
              };
              const label = typeMap[link.type] || String(link.type ?? "");
              const curvature =
                typeof link.curvature === "number" ? link.curvature : 0.12;

              const mx = (from.x + to.x) / 2;
              const my = (from.y + to.y) / 2;
              const cpx = mx - (to.y - from.y) * curvature;
              const cpy = my + (to.x - from.x) * curvature;

              const t = 0.5;
              const u = 1 - t;
              const x = u * u * from.x + 2 * u * t * cpx + t * t * to.x;
              const y = u * u * from.y + 2 * u * t * cpy + t * t * to.y;

              const dx = 2 * u * (cpx - from.x) + 2 * t * (to.x - cpx);
              const dy = 2 * u * (cpy - from.y) + 2 * t * (to.y - cpy);
              let angle = Math.atan2(dy, dx);
              if (angle > Math.PI / 2 || angle < -Math.PI / 2) {
                angle += Math.PI;
              }

              const fontSize = screenToWorld(globalScale, 11, 9);
              ctx.save();
              ctx.translate(x, y);
              ctx.rotate(angle);
              ctx.font = `500 ${fontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
              ctx.textAlign = "center";
              ctx.textBaseline = "middle";
              const textWidth = ctx.measureText(label).width;
              const padX = 3 / globalScale;
              const padY = 1.5 / globalScale;
              ctx.fillStyle = "rgba(255,255,255,0.92)";
              ctx.fillRect(
                -textWidth / 2 - padX,
                -fontSize / 2 - padY,
                textWidth + padX * 2,
                fontSize + padY * 2,
              );
              ctx.fillStyle = "#475569";
              ctx.fillText(label, 0, 0);
              ctx.restore();
            }}
            onZoom={() => {
              // 触发重绘，使 linkWidth / 箭头随缩放更新
              graphRef.current?.refresh?.();
            }}
            cooldownTicks={40}
            cooldownTime={800}
            dagMode="td"
            dagLevelDistance={140}
            onNodeClick={(node: any) => {
              setSelectedNode(node.__raw as GraphNode);
            }}
            onNodeHover={(node: any) => {
              setHoveredNodeId(node ? String(node.id) : null);
            }}
            onBackgroundClick={() => {
              setSelectedNode(null);
              setHoveredNodeId(null);
            }}
            onEngineStop={() => {
              graphRef.current?.zoomToFit?.(300, 72);
            }}
            linkHoverPrecision={8}
            enableNodeDrag={true}
            enableZoomInteraction={true}
            enablePanInteraction={true}
            nodePointerAreaPaint={(
              node: any,
              color: string,
              ctx: CanvasRenderingContext2D,
              globalScale: number,
            ) => {
              const radius = (node.type === "concept" ? 14 : 9) / Math.max(globalScale, 0.35);
              ctx.fillStyle = color;
              ctx.beginPath();
              ctx.arc(node.x, node.y, radius, 0, 2 * Math.PI);
              ctx.fill();
            }}
          />
        )}
      </div>

      {/* 右侧详情面板 */}
      {selectedNode && (
        <div className="graph-detail-panel">
          <div className="graph-detail-header">
            <span
              className={`graph-node-type-badge ${selectedNode.type}`}
            >
              {selectedNode.type === "concept" ? "概念" : "知识要点"}
            </span>
            <button
              type="button"
              className="graph-close-btn"
              aria-label="关闭"
              onClick={() => setSelectedNode(null)}
            >
              <X size={18} strokeWidth={2.25} />
            </button>
          </div>

          <h3 className="graph-detail-title">{selectedNode.label}</h3>

          {selectedNode.definition && (
            <div className="graph-detail-section">
              <h4>定义</h4>
              <p>{selectedNode.definition}</p>
            </div>
          )}

          <div className="graph-detail-section">
            <h4>描述</h4>
            <p>{selectedNode.description}</p>
          </div>

          <div className="graph-detail-meta">
            <span>置信度: {(selectedNode.confidence * 100).toFixed(0)}%</span>
          </div>

          {selectedNode.type === "concept" && (
            <>
              <div className="graph-detail-section">
                <h4>包含的子节点 ({getChildren(selectedNode.id).length})</h4>
                <ul className="graph-node-list">
                  {getChildren(selectedNode.id).slice(0, 20).map((child) => (
                    <li
                      key={child.id}
                      className={`graph-node-item ${child.type}`}
                      onClick={() => setSelectedNode(child)}
                    >
                      <span className="dot" />
                      {child.label}
                    </li>
                  ))}
                  {getChildren(selectedNode.id).length > 20 && (
                    <li className="muted">
                      还有 {getChildren(selectedNode.id).length - 20} 个...
                    </li>
                  )}
                </ul>
              </div>

              <div className="graph-detail-section">
                <h4>相关文章 ({getRelatedDocs(selectedNode.id).length})</h4>
                <ul className="graph-doc-list">
                  {Array.from(
                    new Set(
                      getRelatedDocs(selectedNode.id).flatMap((d) =>
                        d.sources?.map((s) => ({
                          documentId: s.documentId,
                          title: s.title || s.documentId,
                          heading: s.heading,
                        })) || [],
                      ),
                    ),
                  )
                    .slice(0, 10)
                    .map((src, i) => (
                      <li key={i} className="graph-doc-item">
                        <button onClick={() => onOpenDocument(src.documentId)}>
                          📄 {src.title}
                          {src.heading && (
                            <span className="muted"> · {src.heading}</span>
                          )}
                        </button>
                      </li>
                    ))}
                </ul>
              </div>
            </>
          )}

          {selectedNode.type === "doc" && selectedNode.sources && (
            <div className="graph-detail-section">
              <h4>来源</h4>
              <ul className="graph-doc-list">
                {selectedNode.sources.map((src, i) => (
                  <li key={i} className="graph-doc-item">
                    <button onClick={() => onOpenDocument(src.documentId)}>
                      📄 {src.title || src.documentId}
                      {src.heading && (
                        <span className="muted"> · {src.heading}</span>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {getParents(selectedNode.id).length > 0 && (
            <div className="graph-detail-section">
              <h4>所属概念 ({getParents(selectedNode.id).length})</h4>
              <ul className="graph-node-list">
                {getParents(selectedNode.id).map((parent) => (
                  <li
                    key={parent.id}
                    className={`graph-node-item ${parent.type}`}
                    onClick={() => setSelectedNode(parent)}
                  >
                    <span className="dot" />
                    {parent.label}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
