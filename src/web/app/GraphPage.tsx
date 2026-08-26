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
  type GraphData,
  type GraphEdge,
  type GraphNode,
} from "../services/endpoints";
import "./GraphPage.css";

/** 屏幕像素 → 图坐标；保证放大后线条/箭头在屏幕上仍有最小可见粗细 */
function screenToWorld(globalScale: number, screenPx: number, minScreenPx?: number): number {
  const scale = Math.max(globalScale, 0.2);
  const px = Math.max(minScreenPx ?? screenPx * 0.75, screenPx);
  return px / scale;
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
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** 默认只显示 concept，避免 doc 全开导致线乱成一团 */
  const [showDocNodes, setShowDocNodes] = useState(false);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const graphRef = useRef<any>(null);

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

  // 触发生成
  const handleAnalyze = async () => {
    if (analyzing) return;
    setAnalyzing(true);
    setError(null);
    try {
      const analyzeFn = scope === "domain" ? analyzeDomainGraphApi : analyzeGraphApi;
      const data = await analyzeFn(resourceId);
      setGraphData(data);
    } catch (err: any) {
      setError(err.message || "生成失败");
    } finally {
      setAnalyzing(false);
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

  // 适配 force-graph；同向平行边分配不同曲率，减少重叠
  const graphForRender = useMemo(() => {
    const nodes = displayNodes.map((n) => ({
      id: n.id,
      name: n.label,
      type: n.type,
      val: n.type === "concept" ? 4 : 2,
      __raw: n,
    }));
    const pairCount = new Map<string, number>();
    const links = displayEdges.map((e) => {
      const key = `${e.from}->${e.to}`;
      const idx = pairCount.get(key) ?? 0;
      pairCount.set(key, idx + 1);
      const bend = idx === 0 ? 0.12 : 0.12 + idx * 0.18;
      return {
        source: e.from,
        target: e.to,
        type: e.type,
        curvature: bend,
        __raw: e,
      };
    });
    return { nodes, links };
  }, [displayNodes, displayEdges]);

  // 节点变少时间距可稍紧；多时拉大斥力，少挤成团
  const forceTuning = useMemo(() => {
    const n = Math.max(1, displayNodes.length);
    return {
      linkDistance: n <= 12 ? 140 : Math.min(220, 100 + n * 4),
      chargeStrength: n <= 12 ? -450 : Math.max(-1200, -350 - n * 12),
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

  // 布局稳定后自动 fit，避免飞出视口
  useEffect(() => {
    if (!graphData || loading) return;
    const t = window.setTimeout(() => {
      graphRef.current?.zoomToFit?.(400, 60);
    }, 700);
    return () => window.clearTimeout(t);
  }, [graphData, showDocNodes, loading, dimensions.width, dimensions.height]);

  // 通过 d3Force 调间距/斥力（库不提供 chargeStrength 等 React props）
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
    link?.strength?.(0.25);
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
            disabled={analyzing}
          >
            {analyzing ? (
              <>
                <Loader2 size={14} className="spin" />
                生成中...
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

        {!loading && !error && !graphData && (
          <div className="graph-empty">
            <p style={{ fontSize: 48, margin: 0 }}>🕸️</p>
            <h3>还没有知识图谱</h3>
            <p className="muted">点击右上角「生成图谱」开始构建</p>
            <button
              className="graph-btn graph-btn-primary"
              onClick={handleAnalyze}
              disabled={analyzing}
            >
              {analyzing ? "生成中..." : "生成图谱"}
            </button>
          </div>
        )}

        {!loading && !error && graphData && (
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
            cooldownTicks={200}
            cooldownTime={5000}
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
              graphRef.current?.zoomToFit?.(300, 48);
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
