import {
  AIAnalyticsReportSchema,
  AIAnalyticsRequestSchema,
  BoardAnalyticsSchema,
  type AIAnalyticsReport,
  type Board,
  type BoardAnalytics,
  type BurndownDataPoint,
  type Card,
  type Column,
  type ColumnMetric,
  type LabelMetric,
  type MemberWorkload,
  type Priority,
  type PriorityMetric,
  type SprintHealthStatus,
} from "@kinetix/contracts";

const DONE_TITLE_KEYWORDS = ["done", "completed", "selesai", "shipped", "published"];

export function isDoneColumn(col: Pick<Column, "title">): boolean {
  const normalized = col.title.trim().toLowerCase();
  return DONE_TITLE_KEYWORDS.some(
    (kw) => normalized === kw || normalized.includes(kw)
  );
}

export function isCardCompleted(card: Card, doneColumnIds: Set<string>): boolean {
  return doneColumnIds.has(card.column_id) || card.is_due_complete === true;
}

export function isCardOverdue(
  card: Card,
  doneColumnIds: Set<string>,
  nowMs: number = Date.now()
): boolean {
  if (card.is_archived) return false;
  if (card.is_due_complete) return false;
  if (doneColumnIds.has(card.column_id)) return false;
  if (!card.due_date) return false;
  const dueMs = new Date(card.due_date).getTime();
  if (Number.isNaN(dueMs)) return false;
  return dueMs < nowMs;
}

function roundToOneDecimal(num: number): number {
  return Math.round(num * 10) / 10;
}

export class AnalyticsService {
  /**
   * Computes real-time metrics for a board from its current live state.
   */
  public computeBoardAnalytics(board: Board): BoardAnalytics {
    const activeColumns = board.columns.filter((c) => !c.is_archived);
    const doneColumnIds = new Set<string>(
      board.columns.filter((c) => isDoneColumn(c)).map((c) => c.id)
    );

    const archivedCardsList = board.cards.filter((c) => c.is_archived);
    const activeCards = board.cards.filter((c) => !c.is_archived);

    const totalCards = activeCards.length;
    const archivedCards = archivedCardsList.length;

    const completedCardsList = activeCards.filter((c) =>
      isCardCompleted(c, doneColumnIds)
    );
    const completedCards = completedCardsList.length;

    const completionRate =
      totalCards > 0
        ? Math.min(100, Math.max(0, roundToOneDecimal((completedCards / totalCards) * 100)))
        : 0;

    let totalStoryPoints = 0;
    let completedStoryPoints = 0;
    const nowMs = Date.now();
    let overdueCardsCount = 0;
    let blockedCardsCount = 0;

    let totalChecklistItems = 0;
    let completedChecklistItems = 0;

    for (const card of activeCards) {
      const sp = Math.max(0, card.story_points ?? 0);
      totalStoryPoints += sp;
      if (isCardCompleted(card, doneColumnIds)) {
        completedStoryPoints += sp;
      }

      if (isCardOverdue(card, doneColumnIds, nowMs)) {
        overdueCardsCount += 1;
      }

      if (Array.isArray(card.blocked_by_card_ids) && card.blocked_by_card_ids.length > 0) {
        blockedCardsCount += 1;
      }

      if (Array.isArray(card.checklists) && card.checklists.length > 0) {
        for (const cl of card.checklists) {
          for (const item of cl.items ?? []) {
            totalChecklistItems += 1;
            if (item.is_completed) {
              completedChecklistItems += 1;
            }
          }
        }
      } else if (Array.isArray(card.subtasks) && card.subtasks.length > 0) {
        for (const st of card.subtasks) {
          totalChecklistItems += 1;
          if (st.is_completed) {
            completedChecklistItems += 1;
          }
        }
      }
    }

    const checklistCompletionRate =
      totalChecklistItems > 0
        ? Math.min(
            100,
            Math.max(
              0,
              roundToOneDecimal((completedChecklistItems / totalChecklistItems) * 100)
            )
          )
        : 0;

    const automationExecutionsTotal = (board.automation_rules ?? []).reduce(
      (sum, rule) => sum + Math.max(0, rule.execution_count ?? 0),
      0
    );

    // Compute cards_by_column
    const cardsByColumn: ColumnMetric[] = activeColumns.map((col) => {
      const colCards = activeCards.filter((c) => c.column_id === col.id);
      const cardCount = colCards.length;
      const colStoryPoints = colCards.reduce(
        (sum, c) => sum + Math.max(0, c.story_points ?? 0),
        0
      );
      const isDone = doneColumnIds.has(col.id);
      const exceedsWip =
        col.wip_limit !== null &&
        col.wip_limit !== undefined &&
        cardCount > col.wip_limit;
      const exceedsConcentration =
        totalCards >= 4 && cardCount / totalCards > 0.4;

      const isBottleneck = !isDone && (exceedsWip || exceedsConcentration);

      return {
        column_id: col.id,
        column_title: col.title,
        card_count: cardCount,
        total_story_points: colStoryPoints,
        wip_limit: col.wip_limit ?? null,
        is_bottleneck: isBottleneck,
      };
    });

    // Compute workload_by_member
    const workloadByMember: MemberWorkload[] = (board.members ?? []).map(
      (member) => {
        const assignedCards = activeCards.filter((c) =>
          (c.member_ids ?? []).includes(member.id)
        );
        const assignedCardsCount = assignedCards.length;
        const memberCompletedCards = assignedCards.filter((c) =>
          isCardCompleted(c, doneColumnIds)
        );
        const completedCardsCount = memberCompletedCards.length;
        const activeStoryPoints = assignedCards
          .filter((c) => !isCardCompleted(c, doneColumnIds))
          .reduce((sum, c) => sum + Math.max(0, c.story_points ?? 0), 0);
        const memberOverdueCount = assignedCards.filter((c) =>
          isCardOverdue(c, doneColumnIds, nowMs)
        ).length;

        return {
          member_id: member.id,
          member_name: member.name,
          member_initials: member.initials,
          member_color: member.color,
          assigned_cards_count: assignedCardsCount,
          completed_cards_count: completedCardsCount,
          active_story_points: activeStoryPoints,
          overdue_cards_count: memberOverdueCount,
        };
      }
    );

    // Compute cards_by_priority
    const prioritiesOrder: Priority[] = ["URGENT", "HIGH", "MEDIUM", "LOW"];
    const cardsByPriority: PriorityMetric[] = prioritiesOrder.map((prio) => {
      const matching = activeCards.filter((c) => c.priority === prio);
      return {
        priority: prio,
        count: matching.length,
        story_points: matching.reduce(
          (sum, c) => sum + Math.max(0, c.story_points ?? 0),
          0
        ),
      };
    });

    // Compute cards_by_label
    const cardsByLabel: LabelMetric[] = (board.labels ?? []).map((lbl) => {
      const count = activeCards.filter((c) =>
        (c.label_ids ?? []).includes(lbl.id)
      ).length;
      return {
        label_id: lbl.id,
        label_name: lbl.name,
        label_color: lbl.color,
        count,
      };
    });

    // Generate deterministic 7-day burndown_series anchored to total_story_points & completed_story_points
    const burndownSeries: BurndownDataPoint[] = this.buildBurndownSeries(
      totalStoryPoints,
      completedStoryPoints,
      completedCards
    );

    return BoardAnalyticsSchema.parse({
      board_id: board.id,
      total_cards: totalCards,
      completed_cards: completedCards,
      archived_cards: archivedCards,
      completion_rate: completionRate,
      total_story_points: totalStoryPoints,
      completed_story_points: completedStoryPoints,
      overdue_cards_count: overdueCardsCount,
      blocked_cards_count: blockedCardsCount,
      checklist_completion_rate: checklistCompletionRate,
      automation_executions_total: automationExecutionsTotal,
      cards_by_column: cardsByColumn,
      workload_by_member: workloadByMember,
      cards_by_priority: cardsByPriority,
      cards_by_label: cardsByLabel,
      burndown_series: burndownSeries,
    });
  }

  private buildBurndownSeries(
    totalStoryPoints: number,
    completedStoryPoints: number,
    completedCards: number
  ): BurndownDataPoint[] {
    const progressWeights = [0, 0.1, 0.25, 0.45, 0.65, 0.85, 1.0];
    const series: BurndownDataPoint[] = [];

    for (let i = 0; i < 7; i++) {
      const weight = progressWeights[i] ?? 1.0;
      const idealRemaining = Math.max(
        0,
        roundToOneDecimal(totalStoryPoints * (1 - i / 6))
      );
      const deliveredSoFar = roundToOneDecimal(completedStoryPoints * weight);
      const actualRemaining =
        i === 6
          ? Math.max(0, totalStoryPoints - completedStoryPoints)
          : Math.max(0, roundToOneDecimal(totalStoryPoints - deliveredSoFar));
      const completedCardsSoFar =
        i === 6 ? completedCards : Math.round(completedCards * weight);

      series.push({
        date: `Day ${i + 1}`,
        ideal_remaining_points: idealRemaining,
        actual_remaining_points: actualRemaining,
        completed_cards_count: completedCardsSoFar,
      });
    }

    return series;
  }

  /**
   * Generates an AI Executive Sprint Health & Bottleneck Report by calling services/ai-engine,
   * with a built-in deterministic fallback if the AI engine is temporarily unreachable.
   */
  public async generateAIExecutiveReport(
    board: Board
  ): Promise<AIAnalyticsReport> {
    const analytics = this.computeBoardAnalytics(board);

    const aiEngineBaseUrl = (
      process.env.INTERNAL_AI_ENGINE_URL ?? "http://localhost:8001"
    ).replace(/\/+$/, "");
    const internalToken =
      process.env.INTERNAL_SERVICE_TOKEN ?? "orca_internal_sync_token_2026";

    try {
      const reqPayload = AIAnalyticsRequestSchema.parse({
        board_title: board.title,
        analytics,
      });

      const response = await fetch(
        `${aiEngineBaseUrl}/internal/v1/analyze-board`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Internal-Token": internalToken,
          },
          body: JSON.stringify(reqPayload),
          signal: AbortSignal.timeout(8000),
        }
      );

      if (response.ok) {
        const raw = await response.json();
        return AIAnalyticsReportSchema.parse(raw);
      }
      throw new Error(`AI Engine returned status ${response.status}`);
    } catch (err) {
      console.warn(
        `[AnalyticsService] AI Engine unreachable or error in generateAIExecutiveReport (${
          err instanceof Error ? err.message : String(err)
        }); using deterministic executive report fallback.`
      );
      return this.buildFallbackExecutiveReport(board.title, analytics);
    }
  }

  public buildFallbackExecutiveReport(
    boardTitle: string,
    analytics: BoardAnalytics
  ): AIAnalyticsReport {
    const bottlenecks: string[] = [];
    const recommendations: string[] = [];

    const bottleneckColumns = analytics.cards_by_column.filter(
      (c) => c.is_bottleneck
    );
    for (const col of bottleneckColumns) {
      if (col.wip_limit !== null && col.card_count > col.wip_limit) {
        bottlenecks.push(
          `Column '${col.column_title}' exceeds its WIP limit (${col.card_count} active cards vs limit of ${col.wip_limit}).`
        );
        recommendations.push(
          `Swarm on cards in '${col.column_title}' to bring the column back within its WIP limit of ${col.wip_limit}.`
        );
      } else {
        bottlenecks.push(
          `Column '${col.column_title}' holds a high concentration of active work (${col.card_count} cards, ${col.total_story_points} pts).`
        );
        recommendations.push(
          `Unblock and advance in-flight items out of '${col.column_title}' before pulling new backlog work.`
        );
      }
    }

    if (analytics.overdue_cards_count > 0 || analytics.blocked_cards_count > 0) {
      bottlenecks.push(
        `${analytics.overdue_cards_count} card(s) are currently past their due date and ${analytics.blocked_cards_count} card(s) are flagged as blocked.`
      );
      recommendations.push(
        `Prioritize resolving the ${analytics.blocked_cards_count} blocked card(s) and re-baseline due dates for the ${analytics.overdue_cards_count} overdue card(s) during standup.`
      );
    }

    const heavilyLoadedMembers = [...analytics.workload_by_member].sort(
      (a, b) => b.active_story_points - a.active_story_points
    );
    const topMember = heavilyLoadedMembers[0];
    const lightestMember =
      heavilyLoadedMembers[heavilyLoadedMembers.length - 1];

    if (topMember && topMember.active_story_points >= 8) {
      const openCards = Math.max(
        0,
        topMember.assigned_cards_count - topMember.completed_cards_count
      );
      bottlenecks.push(
        `${topMember.member_name} is carrying ${topMember.active_story_points} active story points across ${openCards} open card(s).`
      );
      if (lightestMember && lightestMember.member_id !== topMember.member_id) {
        recommendations.push(
          `Rebalance 1 High-priority card from ${topMember.member_name} to ${lightestMember.member_name} to even out sprint capacity.`
        );
      }
    }

    if (bottlenecks.length === 0) {
      bottlenecks.push(
        "No critical WIP limit violations or blockers detected across active workflow columns."
      );
    }

    if (recommendations.length < 3) {
      recommendations.push(
        `Maintain checklist hygiene (${analytics.checklist_completion_rate}% sub-items complete) and leverage Butler automation rules (${analytics.automation_executions_total} executions so far).`
      );
    }
    if (recommendations.length < 3) {
      recommendations.push(
        `Focus on completing remaining high-priority story points (${Math.max(
          0,
          analytics.total_story_points - analytics.completed_story_points
        )} pts remaining) to stay aligned with the 7-day ideal burndown trajectory.`
      );
    }

    // Compute health score (0-100)
    let rawScore =
      55 +
      analytics.completion_rate * 0.35 +
      analytics.checklist_completion_rate * 0.1 -
      bottleneckColumns.length * 8 -
      analytics.overdue_cards_count * 5 -
      analytics.blocked_cards_count * 6;
    const healthScore = Math.round(Math.min(100, Math.max(15, rawScore)));

    let healthStatus: SprintHealthStatus = "ON_TRACK";
    if (healthScore >= 85) {
      healthStatus = "EXCELLENT";
    } else if (healthScore >= 65) {
      healthStatus = "ON_TRACK";
    } else if (healthScore >= 45) {
      healthStatus = "AT_RISK";
    } else {
      healthStatus = "CRITICAL";
    }

    const executiveSummary = `Sprint velocity on **${boardTitle}** is at **${analytics.completion_rate}% completion** (${analytics.completed_story_points}/${analytics.total_story_points} story points delivered across ${analytics.completed_cards}/${analytics.total_cards} cards)${
      bottleneckColumns.length > 0 || analytics.overdue_cards_count > 0
        ? `, with ${bottleneckColumns.length} column bottleneck(s) and ${analytics.overdue_cards_count} overdue card(s) requiring attention.`
        : ", progressing smoothly with balanced WIP limits."
    }`;

    return AIAnalyticsReportSchema.parse({
      health_score: healthScore,
      health_status: healthStatus,
      executive_summary: executiveSummary,
      bottlenecks,
      actionable_recommendations: recommendations.slice(0, 5),
      generated_at: new Date().toISOString(),
    });
  }
}
