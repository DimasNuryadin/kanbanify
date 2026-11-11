"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  AlertOctagon,
  ArrowRight,
  CheckCircle2,
  ChevronRight,
  Filter,
  Flame,
  Link2,
  Loader2,
  RefreshCw,
  Sparkles,
  Workflow,
  Zap,
} from "lucide-react";
import {
  AICriticalPathResponse,
  BoardDependencyGraph,
  Priority,
} from "@kinetix/contracts";
import { PRIORITY_STYLES } from "./kanban-board";
import { useWorkspaceStore } from "@/store/workspace-store";
import { apiClient } from "@/lib/api-client";

const NODE_WIDTH = 240;
const NODE_HEIGHT = 105;
const HORIZONTAL_SPACING = 150;
const VERTICAL_SPACING = 30;

export function DependencyGraphView() {
  const board = useWorkspaceStore((s) => s.board);
  const setSelectedCardId = useWorkspaceStore((s) => s.setSelectedCardId);
  const linkCardDependency = useWorkspaceStore((s) => s.linkCardDependency);
  const unlinkCardDependency = useWorkspaceStore((s) => s.unlinkCardDependency);
  const addToast = useWorkspaceStore((s) => s.addToast);
  const activeRole = useWorkspaceStore((s) => s.activeRole);
  const isViewer = activeRole === "VIEWER";
  const useMockMode = useWorkspaceStore((s) => s.useMockMode);

  const [graphData, setGraphData] = useState<BoardDependencyGraph | null>(null);
  const [showConnectedOnly, setShowConnectedOnly] = useState(true);
  const [isLoadingGraph, setIsLoadingGraph] = useState(false);

  // Link Quick-Bar state
  const [selectedBlockerId, setSelectedBlockerId] = useState("");
  const [selectedBlockedId, setSelectedBlockedId] = useState("");
  const [isLinking, setIsLinking] = useState(false);

  // AI Critical Path Sidebar state
  const [aiAnalysis, setAiAnalysis] = useState<AICriticalPathResponse | null>(null);
  const [isAnalyzingAi, setIsAnalyzingAi] = useState(false);

  // Load graph data
  const loadGraph = async () => {
    setIsLoadingGraph(true);
    try {
      const data = await apiClient.getDependencyGraph(board.id, {
        useMock: useMockMode,
      });
      setGraphData(data);
    } catch (err) {
      console.error("Failed to fetch dependency graph:", err);
    } finally {
      setIsLoadingGraph(false);
    }
  };

  useEffect(() => {
    loadGraph();
  }, [board.id, board.cards, useMockMode]);

  // Load AI Analysis
  const handleAnalyzeAi = async () => {
    setIsAnalyzingAi(true);
    try {
      const data = await apiClient.aiAnalyzeCriticalPath(board.id, {
        useMock: useMockMode,
      });
      setAiAnalysis(data);
    } catch (err) {
      console.error("Failed to run AI critical path analysis:", err);
    } finally {
      setIsAnalyzingAi(false);
    }
  };

  // Initial AI load on mount
  useEffect(() => {
    handleAnalyzeAi();
  }, [board.id, useMockMode]);

  // Handle Quick Linking
  const handleLinkDependency = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBlockerId || !selectedBlockedId) return;
    if (selectedBlockerId === selectedBlockedId) {
      addToast({
        id: `toast-${Date.now()}`,
        ruleName: "Self-Dependency Error",
        cardTitle: "Dependency Linker",
        actionSummary: "A card cannot depend on itself.",
        timestamp: "Just now",
      });
      return;
    }

    setIsLinking(true);
    try {
      await apiClient.addCardDependency(selectedBlockedId, selectedBlockerId, {
        useMock: useMockMode,
      });
      linkCardDependency(selectedBlockedId, selectedBlockerId);
      setSelectedBlockerId("");
      setSelectedBlockedId("");
      await loadGraph();
      addToast({
        id: `toast-${Date.now()}`,
        ruleName: "Dependency Linked",
        cardTitle: "Graph Updated",
        actionSummary: "Successfully linked blocker to blocked card.",
        timestamp: "Just now",
      });
    } catch (err: unknown) {
      const errorMsg =
        err instanceof Error
          ? err.message
          : "⚠️ Circular dependency detected: adding this blocker creates a cycle.";
      addToast({
        id: `toast-${Date.now()}`,
        ruleName: "Circular Dependency Prevented",
        cardTitle: "Graph Validation",
        actionSummary: errorMsg,
        timestamp: "Just now",
      });
    } finally {
      setIsLinking(false);
    }
  };

  // Filter nodes according to toggle
  const { visibleNodes, visibleEdges, nodePositions, canvasWidth, canvasHeight } =
    useMemo(() => {
      if (!graphData) {
        return {
          visibleNodes: [],
          visibleEdges: [],
          nodePositions: new Map<string, { x: number; y: number }>(),
          canvasWidth: 800,
          canvasHeight: 600,
        };
      }

      const connectedCardIds = new Set<string>();
      graphData.edges.forEach((edge) => {
        connectedCardIds.add(edge.from_card_id);
        connectedCardIds.add(edge.to_card_id);
      });

      const nodes = showConnectedOnly
        ? graphData.nodes.filter((n) => connectedCardIds.has(n.card_id))
        : graphData.nodes;

      const visibleCardIds = new Set(nodes.map((n) => n.card_id));
      const edges = graphData.edges.filter(
        (e) =>
          visibleCardIds.has(e.from_card_id) && visibleCardIds.has(e.to_card_id)
      );

      // Calculate topological layers (roots at 0, dependents to the right)
      const layers = new Map<string, number>();
      nodes.forEach((n) => layers.set(n.card_id, 0));

      for (let iter = 0; iter < nodes.length; iter++) {
        let changed = false;
        for (const edge of edges) {
          const fromL = layers.get(edge.from_card_id) ?? 0;
          const toL = layers.get(edge.to_card_id) ?? 0;
          if (fromL + 1 > toL) {
            layers.set(edge.to_card_id, fromL + 1);
            changed = true;
          }
        }
        if (!changed) break;
      }

      // Group nodes by layer
      const layerGroups = new Map<number, typeof nodes>();
      nodes.forEach((n) => {
        const layer = layers.get(n.card_id) ?? 0;
        const list = layerGroups.get(layer) ?? [];
        list.push(n);
        layerGroups.set(layer, list);
      });

      const sortedLayers = Array.from(layerGroups.keys()).sort((a, b) => a - b);
      const positions = new Map<string, { x: number; y: number }>();

      let maxLayerIndex = sortedLayers.length - 1;
      let maxNodesInAnyLayer = 0;

      sortedLayers.forEach((layer, colIndex) => {
        const layerNodes = layerGroups.get(layer) ?? [];
        if (layerNodes.length > maxNodesInAnyLayer) {
          maxNodesInAnyLayer = layerNodes.length;
        }

        layerNodes.forEach((node, rowIndex) => {
          const x = 50 + colIndex * (NODE_WIDTH + HORIZONTAL_SPACING);
          const y = 50 + rowIndex * (NODE_HEIGHT + VERTICAL_SPACING);
          positions.set(node.card_id, { x, y });
        });
      });

      const width = Math.max(
        900,
        100 + (maxLayerIndex + 1) * (NODE_WIDTH + HORIZONTAL_SPACING)
      );
      const height = Math.max(
        600,
        100 + maxNodesInAnyLayer * (NODE_HEIGHT + VERTICAL_SPACING)
      );

      return {
        visibleNodes: nodes,
        visibleEdges: edges,
        nodePositions: positions,
        canvasWidth: width,
        canvasHeight: height,
      };
    }, [graphData, showConnectedOnly]);

  return (
    <div className="flex h-[calc(100vh-140px)] w-full overflow-hidden rounded-2xl border border-zinc-200/80 bg-white/90 shadow-sm backdrop-blur-md dark:border-zinc-800/80 dark:bg-zinc-950/80">
      {/* LEFT / CENTER: Interactive Graph Canvas & Controls */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Top Control Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-200/80 bg-zinc-50/70 px-4 py-2.5 backdrop-blur-xs dark:border-zinc-800 dark:bg-zinc-900/60">
          {/* Left: View Filter Toggle & Refresh */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowConnectedOnly(!showConnectedOnly)}
              className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors ${
                showConnectedOnly
                  ? "border-indigo-500/40 bg-indigo-500/10 text-indigo-700 dark:border-indigo-500/30 dark:bg-indigo-500/20 dark:text-indigo-300"
                  : "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
              }`}
            >
              <Filter className="h-3.5 w-3.5" />
              <span>
                {showConnectedOnly
                  ? "Connected Only (DAG Focus)"
                  : "Show All Cards"}
              </span>
            </button>

            <button
              type="button"
              onClick={loadGraph}
              disabled={isLoadingGraph}
              title="Refresh Graph"
              className="rounded-lg border border-zinc-200 bg-white p-1.5 text-zinc-600 hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
            >
              <RefreshCw
                className={`h-3.5 w-3.5 ${isLoadingGraph ? "animate-spin" : ""}`}
              />
            </button>

            <span className="text-xs text-zinc-400">
              {visibleNodes.length} cards · {visibleEdges.length} dependencies
            </span>
          </div>

          {/* Quick Link Dependency Form */}
          {!isViewer && (
            <form
              onSubmit={handleLinkDependency}
              className="flex flex-wrap items-center gap-1.5 text-xs"
            >
              <span className="font-semibold text-zinc-500 dark:text-zinc-400">
                🔗 Link Dependency:
              </span>
              <select
                value={selectedBlockerId}
                onChange={(e) => setSelectedBlockerId(e.target.value)}
                className="h-8 max-w-[170px] rounded-lg border border-zinc-200/80 bg-white px-2 text-xs font-medium text-zinc-800 focus:border-indigo-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
              >
                <option value="">Blocker (upstream)...</option>
                {board.cards.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title}
                  </option>
                ))}
              </select>

              <ArrowRight className="h-3 w-3 text-zinc-400" />

              <select
                value={selectedBlockedId}
                onChange={(e) => setSelectedBlockedId(e.target.value)}
                className="h-8 max-w-[170px] rounded-lg border border-zinc-200/80 bg-white px-2 text-xs font-medium text-zinc-800 focus:border-indigo-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
              >
                <option value="">Blocked card...</option>
                {board.cards
                  .filter((c) => c.id !== selectedBlockerId)
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.title}
                    </option>
                  ))}
              </select>

              <button
                type="submit"
                disabled={
                  !selectedBlockerId || !selectedBlockedId || isLinking
                }
                className="inline-flex h-8 items-center gap-1 rounded-lg bg-indigo-600 px-3 font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
              >
                {isLinking ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Link2 className="h-3.5 w-3.5" />
                )}
                <span>+ Link</span>
              </button>
            </form>
          )}

          {/* Graph Legend */}
          <div className="flex items-center gap-2 text-[11px]">
            <span className="inline-flex items-center gap-1 rounded-md border border-rose-500/30 bg-rose-500/10 px-2 py-0.5 font-bold text-rose-600 dark:text-rose-400">
              <Flame className="h-3 w-3 text-rose-500" />
              Critical Path
            </span>
            <span className="inline-flex items-center gap-1 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 font-semibold text-emerald-700 dark:text-emerald-300">
              <CheckCircle2 className="h-3 w-3 text-emerald-500" />
              Resolved
            </span>
            <span className="inline-flex items-center gap-1 rounded-md border border-indigo-500/30 bg-indigo-500/10 px-2 py-0.5 font-semibold text-indigo-700 dark:text-indigo-300">
              Active Blocker
            </span>
          </div>
        </div>

        {/* Interactive SVG Canvas */}
        <div className="relative flex-1 overflow-auto bg-dot-grid p-6">
          <style dangerouslySetInnerHTML={{
            __html: `
              @keyframes flowDash {
                from { stroke-dashoffset: 20; }
                to { stroke-dashoffset: 0; }
              }
              .critical-edge-flow {
                animation: flowDash 1s linear infinite;
              }
            `
          }} />

          <div
            className="relative"
            style={{ width: `${canvasWidth}px`, height: `${canvasHeight}px` }}
          >
            {/* SVG Connecting Arrows */}
            <svg
              className="pointer-events-none absolute inset-0 h-full w-full"
              style={{ width: `${canvasWidth}px`, height: `${canvasHeight}px` }}
            >
              <defs>
                {/* Arrowhead marker: Critical */}
                <marker
                  id="arrow-critical"
                  viewBox="0 0 10 10"
                  refX="9"
                  refY="5"
                  markerWidth="7"
                  markerHeight="7"
                  orient="auto-start-reverse"
                >
                  <path d="M 0 1 L 10 5 L 0 9 z" fill="#f43f5e" />
                </marker>

                {/* Arrowhead marker: Resolved */}
                <marker
                  id="arrow-resolved"
                  viewBox="0 0 10 10"
                  refX="9"
                  refY="5"
                  markerWidth="7"
                  markerHeight="7"
                  orient="auto-start-reverse"
                >
                  <path d="M 0 1 L 10 5 L 0 9 z" fill="#10b981" />
                </marker>

                {/* Arrowhead marker: Active */}
                <marker
                  id="arrow-active"
                  viewBox="0 0 10 10"
                  refX="9"
                  refY="5"
                  markerWidth="7"
                  markerHeight="7"
                  orient="auto-start-reverse"
                >
                  <path d="M 0 1 L 10 5 L 0 9 z" fill="#6366f1" />
                </marker>
              </defs>

              {visibleEdges.map((edge) => {
                const startPos = nodePositions.get(edge.from_card_id);
                const endPos = nodePositions.get(edge.to_card_id);
                if (!startPos || !endPos) return null;

                const x1 = startPos.x + NODE_WIDTH;
                const y1 = startPos.y + NODE_HEIGHT / 2;
                const x2 = endPos.x;
                const y2 = endPos.y + NODE_HEIGHT / 2;
                const dx = Math.max(40, (x2 - x1) / 2);

                const pathData = `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`;

                let strokeColor = "#6366f1";
                let markerId = "arrow-active";
                let strokeWidth = 2.5;
                let strokeDasharray: string | undefined = undefined;
                let edgeClass = "";

                if (edge.is_critical) {
                  strokeColor = "#f43f5e";
                  markerId = "arrow-critical";
                  strokeWidth = 3;
                  strokeDasharray = "6 4";
                  edgeClass = "critical-edge-flow";
                } else if (edge.is_resolved) {
                  strokeColor = "#10b981";
                  markerId = "arrow-resolved";
                  strokeWidth = 2;
                }

                return (
                  <g key={`${edge.from_card_id}-${edge.to_card_id}`}>
                    {/* Shadow glow line for critical paths */}
                    {edge.is_critical && (
                      <path
                        d={pathData}
                        fill="none"
                        stroke="#f43f5e"
                        strokeWidth={7}
                        strokeOpacity={0.25}
                      />
                    )}
                    <path
                      d={pathData}
                      fill="none"
                      stroke={strokeColor}
                      strokeWidth={strokeWidth}
                      strokeDasharray={strokeDasharray}
                      markerEnd={`url(#${markerId})`}
                      className={edgeClass}
                    />
                  </g>
                );
              })}
            </svg>

            {/* Render HTML Card Nodes */}
            {visibleNodes.map((node) => {
              const pos = nodePositions.get(node.card_id);
              if (!pos) return null;

              const isCriticalNode = graphData?.critical_path_card_ids.includes(
                node.card_id
              );
              const priorityMeta = PRIORITY_STYLES[node.priority];

              return (
                <div
                  key={node.card_id}
                  onClick={() => setSelectedCardId(node.card_id)}
                  style={{
                    left: `${pos.x}px`,
                    top: `${pos.y}px`,
                    width: `${NODE_WIDTH}px`,
                    height: `${NODE_HEIGHT}px`,
                  }}
                  className={`group absolute cursor-pointer rounded-xl border p-3 shadow-md transition-all duration-150 hover:-translate-y-0.5 hover:shadow-lg ${
                    isCriticalNode
                      ? "border-rose-500/70 bg-rose-50/70 ring-2 ring-rose-500/30 dark:bg-rose-950/30"
                      : node.in_degree > 0
                        ? "border-amber-500/60 bg-amber-50/50 dark:bg-amber-950/20"
                        : "border-zinc-200/80 bg-white hover:border-indigo-400 dark:border-zinc-800 dark:bg-zinc-900"
                  }`}
                >
                  {/* Card Node Header: Column Badge + Priority + Story Points */}
                  <div className="mb-1.5 flex items-center justify-between gap-1 text-[10px]">
                    <span className="truncate rounded bg-zinc-100 px-1.5 py-0.5 font-semibold text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                      {node.column_title}
                    </span>

                    <div className="flex items-center gap-1">
                      {node.story_points !== null && (
                        <span className="rounded border border-zinc-200/80 bg-zinc-50 px-1 font-mono font-semibold text-zinc-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">
                          {node.story_points}pt
                        </span>
                      )}
                      <span
                        className={`inline-flex items-center gap-1 rounded px-1.5 py-0.2 font-medium ${priorityMeta.badge}`}
                      >
                        {priorityMeta.label}
                      </span>
                    </div>
                  </div>

                  {/* Card Title */}
                  <h4 className="line-clamp-2 text-xs font-bold leading-snug text-zinc-900 group-hover:text-indigo-600 dark:text-zinc-100 dark:group-hover:text-indigo-400">
                    {node.title}
                  </h4>

                  {/* Node Footer: Assignee & Status Badges */}
                  <div className="mt-2 flex items-center justify-between text-[10px]">
                    <span className="truncate text-zinc-400">
                      {node.assignee_initials && node.assignee_initials.length > 0
                        ? `👤 ${node.assignee_initials.join(", ")}`
                        : "Unassigned"}
                    </span>

                    {isCriticalNode ? (
                      <span className="inline-flex items-center gap-0.5 rounded bg-rose-500/15 px-1.5 py-0.5 font-bold text-rose-600 dark:text-rose-300">
                        <Flame className="h-2.5 w-2.5" />
                        Critical
                      </span>
                    ) : node.in_degree > 0 ? (
                      <span className="inline-flex items-center gap-0.5 rounded bg-amber-500/15 px-1.5 py-0.5 font-semibold text-amber-700 dark:text-amber-300">
                        <AlertOctagon className="h-2.5 w-2.5" />
                        Blocked ({node.in_degree})
                      </span>
                    ) : node.out_degree > 0 ? (
                      <span className="inline-flex items-center gap-0.5 rounded bg-indigo-500/15 px-1.5 py-0.5 font-semibold text-indigo-700 dark:text-indigo-300">
                        ⚡ Blocker ({node.out_degree})
                      </span>
                    ) : (
                      <span className="text-zinc-400 font-mono">
                        Independent
                      </span>
                    )}
                  </div>
                </div>
              );
            })}

            {visibleNodes.length === 0 && (
              <div className="flex h-64 w-full flex-col items-center justify-center text-center">
                <Workflow className="mb-2 h-10 w-10 text-zinc-400" />
                <p className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                  No dependencies to display.
                </p>
                <p className="mt-1 text-xs text-zinc-500">
                  Toggle &quot;Show All Cards&quot; or use the selector bar above to link cards!
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* RIGHT SIDEBAR: ✨ AI Critical Path & Bottleneck Unblocker */}
      <div className="flex w-84 shrink-0 flex-col border-l border-zinc-200/80 bg-zinc-50/60 dark:border-zinc-800 dark:bg-zinc-900/60">
        <div className="border-b border-zinc-200/80 p-4 dark:border-zinc-800">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-600 text-white shadow-xs">
                <Sparkles className="h-4 w-4" />
              </div>
              <div>
                <h3 className="text-xs font-bold text-zinc-900 dark:text-zinc-100">
                  AI Critical Path
                </h3>
                <p className="text-[10px] text-zinc-500">
                  Bottleneck Unblocker
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleAnalyzeAi}
              disabled={isAnalyzingAi}
              className="inline-flex items-center gap-1 rounded-lg border border-indigo-500/30 bg-indigo-500/10 px-2 py-1 text-[11px] font-semibold text-indigo-700 hover:bg-indigo-500/20 disabled:opacity-50 dark:text-indigo-300"
            >
              <RefreshCw
                className={`h-3 w-3 ${isAnalyzingAi ? "animate-spin" : ""}`}
              />
              <span>Analyze</span>
            </button>
          </div>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto p-4 text-xs">
          {isAnalyzingAi && !aiAnalysis && (
            <div className="flex h-40 flex-col items-center justify-center text-zinc-400">
              <Loader2 className="mb-2 h-6 w-6 animate-spin text-indigo-500" />
              <p className="text-xs">Analyzing board DAG with AI...</p>
            </div>
          )}

          {aiAnalysis && (
            <>
              {/* Executive Risk Summary */}
              <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 dark:border-amber-500/20 dark:bg-amber-500/15">
                <div className="mb-1 flex items-center gap-1.5 font-bold text-amber-900 dark:text-amber-200">
                  <Zap className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
                  <span>Executive Risk Summary</span>
                </div>
                <p className="text-[11px] leading-relaxed text-amber-900/90 dark:text-amber-200/90">
                  {aiAnalysis.risk_summary}
                </p>
              </div>

              {/* Critical Path Chain */}
              <div>
                <h4 className="mb-2 flex items-center gap-1.5 font-bold text-zinc-800 uppercase dark:text-zinc-200 text-[10px] tracking-wider">
                  <Flame className="h-3.5 w-3.5 text-rose-500" />
                  <span>Critical Path Chain ({aiAnalysis.critical_path_titles.length} steps)</span>
                </h4>
                <div className="space-y-1.5 rounded-xl border border-zinc-200/80 bg-white p-3 shadow-xs dark:border-zinc-800 dark:bg-zinc-950">
                  {aiAnalysis.critical_path_titles.map((title, i) => (
                    <div
                      key={title}
                      className="flex items-center gap-2 text-[11px]"
                    >
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-rose-500/15 font-mono text-[10px] font-bold text-rose-600 dark:text-rose-400">
                        {i + 1}
                      </span>
                      <span className="truncate font-medium text-zinc-800 dark:text-zinc-200">
                        {title}
                      </span>
                      {i < aiAnalysis.critical_path_titles.length - 1 && (
                        <ChevronRight className="ml-auto h-3 w-3 shrink-0 text-zinc-400" />
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Top Blocker Cards */}
              <div>
                <h4 className="mb-2 flex items-center gap-1.5 font-bold text-zinc-800 uppercase dark:text-zinc-200 text-[10px] tracking-wider">
                  <AlertOctagon className="h-3.5 w-3.5 text-amber-500" />
                  <span>Top Bottlenecks</span>
                </h4>
                <div className="space-y-2">
                  {aiAnalysis.top_blocker_cards.map((blocker) => (
                    <div
                      key={blocker.card_id}
                      onClick={() => setSelectedCardId(blocker.card_id)}
                      className="cursor-pointer rounded-xl border border-zinc-200/80 bg-white p-2.5 transition-colors hover:border-indigo-400 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:hover:bg-zinc-900"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                          {blocker.title}
                        </span>
                        <span className="shrink-0 rounded bg-rose-500/10 px-1.5 py-0.5 font-mono text-[10px] font-bold text-rose-600 dark:text-rose-400">
                          Holds {blocker.blocks_count}
                        </span>
                      </div>
                      <p className="mt-1 text-[10px] leading-relaxed text-zinc-500 dark:text-zinc-400">
                        💡 {blocker.reason}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Actionable Recommendations */}
              <div>
                <h4 className="mb-2 flex items-center gap-1.5 font-bold text-zinc-800 uppercase dark:text-zinc-200 text-[10px] tracking-wider">
                  <span>🎯</span>
                  <span>Unblocking Recommendations</span>
                </h4>
                <ul className="space-y-1.5 rounded-xl border border-zinc-200/80 bg-white p-3 shadow-xs dark:border-zinc-800 dark:bg-zinc-950">
                  {aiAnalysis.unblocking_recommendations.map((rec, i) => (
                    <li
                      key={i}
                      className="flex items-start gap-2 text-[11px] leading-relaxed text-zinc-700 dark:text-zinc-300"
                    >
                      <span className="text-emerald-500">✓</span>
                      <span>{rec}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
