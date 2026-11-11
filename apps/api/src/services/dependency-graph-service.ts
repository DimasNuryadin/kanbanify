import {
  type BoardDependencyGraph,
  type DependencyEdge,
  type DependencyNode,
  type Card,
  type AddCardDependencyResponse,
  type AICriticalPathResponse,
  BoardDependencyGraphSchema,
  AICriticalPathResponseSchema,
} from "@kinetix/contracts";
import { StorageRepository } from "../db/repository.js";
import { BoardRealtimeHub } from "../ws/hub.js";
import { AppError } from "../errors.js";

interface PathResult {
  weight: number;
  path: string[];
}

export class DependencyGraphService {
  constructor(
    private readonly repository: StorageRepository,
    private readonly hub: BoardRealtimeHub
  ) {}

  public async computeDependencyGraph(boardId: string): Promise<BoardDependencyGraph> {
    const board = await this.repository.getBoardById(boardId);
    if (!board) {
      throw new AppError(
        404,
        "RESOURCE_NOT_FOUND",
        `Board '${boardId}' not found`,
        { board_id: boardId }
      );
    }

    const cards = (board.cards ?? []).filter((c) => !c.is_archived);
    const cardMap = new Map<string, Card>(cards.map((c) => [c.id, c]));
    const colMap = new Map(board.columns.map((c) => [c.id, c]));
    const memberMap = new Map(board.members.map((m) => [m.id, m]));

    const doneColIds = new Set(
      board.columns
        .filter((c) => c.title.trim().toLowerCase() === "done")
        .map((c) => c.id)
    );

    const isCardCompleted = (c: Card): boolean => {
      return Boolean(c.is_due_complete) || doneColIds.has(c.column_id);
    };

    // Calculate in-degree & out-degree
    const inDegreeMap = new Map<string, number>();
    const outDegreeMap = new Map<string, number>();
    const forwardEdges: Array<{ from: string; to: string }> = [];

    for (const c of cards) {
      inDegreeMap.set(c.id, 0);
      outDegreeMap.set(c.id, 0);
    }

    for (const c of cards) {
      const blockers = (c.blocked_by_card_ids ?? []).filter((bId) =>
        cardMap.has(bId)
      );
      inDegreeMap.set(c.id, blockers.length);

      for (const blockerId of blockers) {
        outDegreeMap.set(
          blockerId,
          (outDegreeMap.get(blockerId) ?? 0) + 1
        );
        forwardEdges.push({ from: blockerId, to: c.id });
      }
    }

    // Build edges
    const edges: DependencyEdge[] = forwardEdges.map(({ from, to }) => {
      const blockerCard = cardMap.get(from);
      const isResolved = blockerCard ? isCardCompleted(blockerCard) : false;
      return {
        from_card_id: from,
        to_card_id: to,
        is_resolved: isResolved,
        is_critical: false,
      };
    });

    // Check cycles in overall graph
    const adj = new Map<string, string[]>();
    for (const c of cards) {
      adj.set(c.id, []);
    }
    for (const e of edges) {
      adj.get(e.from_card_id)?.push(e.to_card_id);
    }

    let hasCycle = false;
    const visited = new Set<string>();
    const recStack = new Set<string>();

    const checkCycleDfs = (u: string): boolean => {
      visited.add(u);
      recStack.add(u);
      const neighbors = adj.get(u) ?? [];
      for (const v of neighbors) {
        if (!visited.has(v)) {
          if (checkCycleDfs(v)) return true;
        } else if (recStack.has(v)) {
          return true;
        }
      }
      recStack.delete(u);
      return false;
    };

    for (const c of cards) {
      if (!visited.has(c.id)) {
        if (checkCycleDfs(c.id)) {
          hasCycle = true;
          break;
        }
      }
    }

    // Total blocked cards: uncompleted cards with >= 1 unresolved blocker
    let totalBlockedCards = 0;
    for (const c of cards) {
      if (!isCardCompleted(c)) {
        const hasUnresolvedBlocker = (c.blocked_by_card_ids ?? []).some(
          (bId) => {
            const b = cardMap.get(bId);
            return b ? !isCardCompleted(b) : false;
          }
        );
        if (hasUnresolvedBlocker) {
          totalBlockedCards++;
        }
      }
    }

    // Nodes initial setup
    const nodes: DependencyNode[] = cards.map((c) => {
      const isCompleted = isCardCompleted(c);
      const column = colMap.get(c.column_id);
      const assigneeInitials = (c.member_ids ?? [])
        .map((mId) => memberMap.get(mId)?.initials)
        .filter((init): init is string => Boolean(init));

      return {
        card_id: c.id,
        title: c.title,
        column_id: c.column_id,
        column_title: column?.title ?? "Unknown",
        priority: c.priority,
        story_points: c.story_points ?? null,
        is_completed: isCompleted,
        assignee_initials: assigneeInitials,
        in_degree: inDegreeMap.get(c.id) ?? 0,
        out_degree: outDegreeMap.get(c.id) ?? 0,
        is_on_critical_path: false,
      };
    });

    // Compute Critical Path on DAG of uncompleted cards
    const uncompletedNodes = nodes.filter((n) => !n.is_completed);
    const uncompletedIds = new Set(uncompletedNodes.map((n) => n.card_id));

    const uncompletedAdj = new Map<string, string[]>();
    for (const n of uncompletedNodes) {
      uncompletedAdj.set(n.card_id, []);
    }
    for (const e of edges) {
      if (uncompletedIds.has(e.from_card_id) && uncompletedIds.has(e.to_card_id)) {
        uncompletedAdj.get(e.from_card_id)?.push(e.to_card_id);
      }
    }

    const weightMap = new Map<string, number>();
    for (const n of uncompletedNodes) {
      const w = n.story_points && n.story_points > 0 ? n.story_points : 1;
      weightMap.set(n.card_id, w);
    }

    const memo = new Map<string, PathResult>();

    const findLongestPath = (u: string, pathVisited: Set<string>): PathResult => {
      if (memo.has(u)) return memo.get(u)!;
      if (pathVisited.has(u)) return { weight: 0, path: [] };

      pathVisited.add(u);
      const uWeight = weightMap.get(u) ?? 1;
      let bestNext: PathResult = { weight: 0, path: [] };

      const neighbors = uncompletedAdj.get(u) ?? [];
      for (const v of neighbors) {
        const sub = findLongestPath(v, new Set(pathVisited));
        if (
          sub.weight > bestNext.weight ||
          (sub.weight === bestNext.weight && sub.path.length > bestNext.path.length)
        ) {
          bestNext = sub;
        }
      }

      pathVisited.delete(u);
      const result: PathResult = {
        weight: uWeight + bestNext.weight,
        path: [u, ...bestNext.path],
      };
      memo.set(u, result);
      return result;
    };

    let bestPath: PathResult = { weight: 0, path: [] };
    for (const n of uncompletedNodes) {
      const p = findLongestPath(n.card_id, new Set());
      if (
        p.weight > bestPath.weight ||
        (p.weight === bestPath.weight && p.path.length > bestPath.path.length)
      ) {
        bestPath = p;
      }
    }

    const criticalPathCardIds = bestPath.path;
    const criticalNodeSet = new Set(criticalPathCardIds);

    for (const node of nodes) {
      node.is_on_critical_path = criticalNodeSet.has(node.card_id);
    }

    const criticalEdgePairs = new Set<string>();
    for (let i = 0; i < criticalPathCardIds.length - 1; i++) {
      criticalEdgePairs.add(`${criticalPathCardIds[i]}->${criticalPathCardIds[i + 1]}`);
    }

    for (const edge of edges) {
      edge.is_critical = criticalEdgePairs.has(
        `${edge.from_card_id}->${edge.to_card_id}`
      );
    }

    const result = {
      board_id: boardId,
      nodes,
      edges,
      critical_path_card_ids: criticalPathCardIds,
      total_blocked_cards: totalBlockedCards,
      has_circular_dependency: hasCycle,
    };

    return BoardDependencyGraphSchema.parse(result);
  }

  public async addDependency(
    cardId: string,
    blockerCardId: string,
    actorName = "Alex Rivera",
    actorId = "kinetix-api"
  ): Promise<AddCardDependencyResponse> {
    if (cardId === blockerCardId) {
      throw new AppError(
        400,
        "VALIDATION_ERROR",
        "Circular dependency detected: adding this blocker would create a dependency loop.",
        {
          card_id: cardId,
          blocker_card_id: blockerCardId,
          cycle_path: [cardId, cardId],
        }
      );
    }

    const card = await this.repository.getCardById(cardId);
    if (!card) {
      throw new AppError(
        404,
        "RESOURCE_NOT_FOUND",
        `Card '${cardId}' not found`,
        { card_id: cardId }
      );
    }

    const blockerCard = await this.repository.getCardById(blockerCardId);
    if (!blockerCard) {
      throw new AppError(
        404,
        "RESOURCE_NOT_FOUND",
        `Blocker card '${blockerCardId}' not found`,
        { blocker_card_id: blockerCardId }
      );
    }

    if (card.board_id !== blockerCard.board_id) {
      throw new AppError(
        400,
        "VALIDATION_ERROR",
        "Cannot create dependency between cards from different boards",
        {
          card_board_id: card.board_id,
          blocker_board_id: blockerCard.board_id,
        }
      );
    }

    // Build existing directed graph (blocker -> card) to test reachability
    const board = await this.repository.getBoardById(card.board_id);
    const cards = (board?.cards ?? []).filter((c) => !c.is_archived);
    const forwardAdj = new Map<string, string[]>();

    for (const c of cards) {
      forwardAdj.set(c.id, []);
    }
    for (const c of cards) {
      for (const bId of c.blocked_by_card_ids ?? []) {
        forwardAdj.get(bId)?.push(c.id);
      }
    }

    // Check if blockerCardId is reachable from cardId
    const queue: Array<{ current: string; path: string[] }> = [
      { current: cardId, path: [cardId] },
    ];
    const visited = new Set<string>([cardId]);
    let cyclePath: string[] | null = null;

    while (queue.length > 0) {
      const { current, path } = queue.shift()!;
      if (current === blockerCardId) {
        cyclePath = [...path, cardId];
        break;
      }
      const neighbors = forwardAdj.get(current) ?? [];
      for (const next of neighbors) {
        if (!visited.has(next)) {
          visited.add(next);
          queue.push({ current: next, path: [...path, next] });
        } else if (next === blockerCardId) {
          cyclePath = [...path, next, cardId];
          break;
        }
      }
      if (cyclePath) break;
    }

    if (cyclePath) {
      throw new AppError(
        400,
        "VALIDATION_ERROR",
        "Circular dependency detected: adding this blocker would create a dependency loop.",
        {
          card_id: cardId,
          blocker_card_id: blockerCardId,
          cycle_path: cyclePath,
        }
      );
    }

    // Add blockerCardId if not already present
    const existing = card.blocked_by_card_ids ?? [];
    const nextBlocked = existing.includes(blockerCardId)
      ? existing
      : [...existing, blockerCardId];

    const updatedCard = await this.repository.updateCard(
      cardId,
      { blocked_by_card_ids: nextBlocked },
      {
        actorName,
        activityDescription: `${actorName} added dependency: blocked by "${blockerCard.title}"`,
      }
    );

    await this.hub.broadcast({
      event: "CARD_UPDATED",
      board_id: card.board_id,
      actor_id: actorId,
      data: updatedCard,
    });

    const graph = await this.computeDependencyGraph(card.board_id);
    return {
      card: updatedCard,
      graph,
    };
  }

  public async removeDependency(
    cardId: string,
    blockerCardId: string,
    actorName = "Alex Rivera",
    actorId = "kinetix-api"
  ): Promise<AddCardDependencyResponse> {
    const card = await this.repository.getCardById(cardId);
    if (!card) {
      throw new AppError(
        404,
        "RESOURCE_NOT_FOUND",
        `Card '${cardId}' not found`,
        { card_id: cardId }
      );
    }

    const nextBlocked = (card.blocked_by_card_ids ?? []).filter(
      (id) => id !== blockerCardId
    );

    const updatedCard = await this.repository.updateCard(
      cardId,
      { blocked_by_card_ids: nextBlocked },
      {
        actorName,
        activityDescription: `${actorName} removed blocker dependency '${blockerCardId}'`,
      }
    );

    await this.hub.broadcast({
      event: "CARD_UPDATED",
      board_id: card.board_id,
      actor_id: actorId,
      data: updatedCard,
    });

    const graph = await this.computeDependencyGraph(card.board_id);
    return {
      card: updatedCard,
      graph,
    };
  }

  public async aiAnalyzeDependencies(
    boardId: string
  ): Promise<AICriticalPathResponse> {
    const board = await this.repository.getBoardById(boardId);
    if (!board) {
      throw new AppError(
        404,
        "RESOURCE_NOT_FOUND",
        `Board '${boardId}' not found`,
        { board_id: boardId }
      );
    }

    const graph = await this.computeDependencyGraph(boardId);

    const aiEngineBaseUrl = (
      process.env.INTERNAL_AI_ENGINE_URL ??
      process.env.AI_ENGINE_URL ??
      "http://localhost:8001"
    ).replace(/\/+$/, "");

    const internalToken =
      process.env.INTERNAL_SERVICE_TOKEN ?? "orca_internal_sync_token_2026";

    try {
      const response = await fetch(
        `${aiEngineBaseUrl}/internal/v1/analyze-dependencies`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Internal-Token": internalToken,
          },
          body: JSON.stringify({
            board_title: board.title,
            graph,
          }),
          signal: AbortSignal.timeout(8000),
        }
      );

      if (!response.ok) {
        throw new Error(`AI Engine error status: ${response.status}`);
      }

      const json = await response.json();
      return AICriticalPathResponseSchema.parse(json);
    } catch {
      // Deterministic fallback when AI Engine is offline or in isolated tests
      const criticalTitles = graph.critical_path_card_ids
        .map((id) => graph.nodes.find((n) => n.card_id === id)?.title)
        .filter((t): t is string => Boolean(t));

      const topBlockers = graph.nodes
        .filter((n) => n.out_degree > 0)
        .sort((a, b) => b.out_degree - a.out_degree)
        .slice(0, 3)
        .map((n) => ({
          card_id: n.card_id,
          title: n.title,
          blocks_count: n.out_degree,
          reason: `Directly blocks ${n.out_degree} downstream card(s) on the board.`,
        }));

      const riskSummary =
        graph.total_blocked_cards > 0
          ? `${graph.total_blocked_cards} card(s) are currently blocked. Critical path contains ${graph.critical_path_card_ids.length} task(s).`
          : `All dependencies resolved or no active blockers. Critical path contains ${graph.critical_path_card_ids.length} task(s).`;

      const recommendations =
        topBlockers.length > 0
          ? topBlockers.map(
              (b) =>
                `Prioritize "${b.title}" to unblock ${b.blocks_count} downstream task(s).`
            )
          : ["Keep monitoring uncompleted tasks along the critical path."];

      const fallback: AICriticalPathResponse = {
        risk_summary: riskSummary,
        critical_path_titles: criticalTitles,
        top_blocker_cards: topBlockers,
        unblocking_recommendations: recommendations,
      };

      return AICriticalPathResponseSchema.parse(fallback);
    }
  }
}
