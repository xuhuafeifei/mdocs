/**
 * 知识图谱页面
 *
 * 功能：
 * 1. 力导向图可视化（react-force-graph-2d）
 * 2. 点击节点 → 右侧详情面板
 * 3. 右上角「生成/重新生成」按钮
 * 4. 筛选器：显示 doc 节点开关
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
  const [showDocNodes, setShowDocNodes] = useState(true);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
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

  // 适配 dag 数据格式给 force-graph
  const graphForRender = useMemo(() => {
    const nodes = displayNodes.map((n) => ({
      id: n.id,
      name: n.label,
      type: n.type,
      val: n.type === "concept" ? 3 : 1.5, // 节点大小
      __raw: n,
    }));
    const links = displayEdges.map((e) => ({
      source: e.from,
      target: e.to,
      type: e.type,
      __raw: e,
    }));
    return { nodes, links };
  }, [displayNodes, displayEdges]);

  // 自适应画布大小
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
            nodeVal={(node: any) => (node.type === "concept" ? 5 : 3)}
            nodeColor={(node: any) =>
              node.type === "concept" ? "#8b5cf6" : "#06b6d4"
            }
            nodeCanvasObjectMode={() => "replace"}
            nodeCanvasObject={(node: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
              const label = node.name;
              const isConcept = node.type === "concept";
              const fontSize = (isConcept ? 13 : 11) / globalScale;
              const nodeRadius = (isConcept ? 10 : 6) / globalScale;

              // 节点圆
              ctx.beginPath();
              ctx.arc(node.x, node.y, nodeRadius, 0, 2 * Math.PI);
              ctx.fillStyle = isConcept ? "#8b5cf6" : "#06b6d4";
              ctx.fill();
              ctx.strokeStyle = "#ffffff";
              ctx.lineWidth = 2 / globalScale;
              ctx.stroke();

              // 节点标签
              ctx.font = `${isConcept ? "600" : "400"} ${fontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
              ctx.textAlign = "center";
              ctx.textBaseline = "top";
              ctx.fillStyle = isConcept ? "#1e1b4b" : "#0c4a6e";

              const textPadding = 2 / globalScale;
              if (isConcept) {
                // concept 节点：显示完整名称
                ctx.fillText(label, node.x, node.y + nodeRadius + textPadding);
              } else {
                // doc 节点：显示前 10 个字
                const displayText = label.length > 10 ? label.slice(0, 10) + "…" : label;
                ctx.fillText(displayText, node.x, node.y + nodeRadius + textPadding);
              }
            }}
            linkDirectionalArrowLength={5}
            linkDirectionalArrowRelPos={1}
            linkDirectionalArrowColor={"#64748b"}
            linkWidth={1.5}
            linkColor={() => "#94a3b8"}
            linkCurvature={0.05}
            linkCanvasObjectMode={() => "after"}
            linkCanvasObject={(
              link: any,
              ctx: CanvasRenderingContext2D,
              globalScale: number,
            ) => {
              const from = link.source as { x: number; y: number };
              const to = link.target as { x: number; y: number };
              const midX = (from.x + to.x) / 2;
              const midY = (from.y + to.y) / 2;

              const typeMap: Record<string, string> = {
                contains: "包含",
                related_to: "相关",
                part_of: "属于",
                depends_on: "依赖",
              };
              const label = typeMap[link.type] || link.type;

              const fontSize = 10 / globalScale;
              ctx.font = `${fontSize}px sans-serif`;
              ctx.textAlign = "center";
              ctx.textBaseline = "middle";

              // 白色背景框，避免文字和线重叠
              const textWidth = ctx.measureText(label).width;
              const padding = 3 / globalScale;
              ctx.fillStyle = "#ffffff";
              ctx.fillRect(
                midX - textWidth / 2 - padding,
                midY - fontSize / 2 - padding / 2,
                textWidth + padding * 2,
                fontSize + padding,
              );

              ctx.fillStyle = "#475569";
              ctx.fillText(label, midX, midY);
            }}
            linkDistance={180}
            linkStrength={0.4}
            chargeStrength={-400}
            cooldownTicks={300}
            cooldownTime={8000}
            onNodeClick={(node: any) => {
              setSelectedNode(node.__raw as GraphNode);
            }}
            linkHoverPrecision={6}
            enableNodeDrag={true}
            enableZoomInteraction={true}
            enablePanInteraction={true}
            nodePointerAreaPaint={(node: any, color: string, ctx: CanvasRenderingContext2D, globalScale: number) => {
              const radius = (node.type === "concept" ? 12 : 8) / globalScale;
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
              className="graph-close-btn"
              onClick={() => setSelectedNode(null)}
            >
              <X size={16} />
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
