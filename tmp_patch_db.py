from pathlib import Path

path = Path('/home/ubuntu/midea-digital-contour-admin/server/db.ts')
text = path.read_text()

old_helpers = '''const deriveTemperatureFromStage = (stage: string) => {
  if (stage === "sale_closed") return "won" as const;
  if (stage === "lost") return "lost" as const;
  if (["proposal_sent", "manager_contacted"].includes(stage)) return "hot" as const;
  if (["quiz_completed", "lead_created", "reactivated"].includes(stage)) return "warm" as const;
  return "cold" as const;
};

const buildDemoDashboardSnapshot = () => ({
  isDemo: true,
  kpis: {
    totalLeads: demoLeadRows.length,
    hotLeads: demoLeadRows.filter((lead) => lead.temperature === "hot").length,
    wonLeads: 0,
    pendingFollowUps: demoLeadRows.filter((lead) => lead.nextFollowUpAt).length,
    automationCoverage: 82,
    telegramReachable: demoLeadRows.filter((lead) => lead.telegramUsername).length,
    projectedRevenueUsd: demoLeadRows.reduce((sum, lead) => sum + toNumber(lead.expectedRevenueUsd), 0),
    conversionRate: 18,
  },
  stageDistribution: [
    { stage: "lead_created", total: 1 },
    { stage: "quiz_completed", total: 1 },
    { stage: "manager_contacted", total: 1 },
    { stage: "proposal_sent", total: 1 },
  ],
  segmentDistribution: [
    { segment: "alba", total: 1 },
    { segment: "welkin", total: 1 },
    { segment: "combo", total: 1 },
    { segment: "consult", total: 1 },
  ],
  recentLeads: demoLeadRows,
  followUpQueue: demoLeadRows
    .slice()
    .sort((a, b) => (a.nextFollowUpAt?.getTime() ?? 0) - (b.nextFollowUpAt?.getTime() ?? 0))
    .map((lead) => ({
      leadId: lead.id,
      fullName: lead.fullName,
      stage: lead.stage,
      temperature: lead.temperature,
      nextFollowUpAt: lead.nextFollowUpAt,
      assignedManagerId: lead.assignedManagerId,
    })),
  automationRules: DEFAULT_AUTOMATIONS.map((rule, index) => ({ id: index + 1, ...rule })),
  deliveryReadiness: {
    hasTelegramToken: Boolean(ENV.telegramBotToken),
    leadsWithTelegramId: demoLeadRows.filter((lead) => lead.telegramUsername).length,
    recentMessages: 12,
  },
});
'''

new_helpers = '''const deriveTemperatureFromStage = (stage: string) => {
  if (stage === "sale_closed") return "won" as const;
  if (stage === "lost") return "lost" as const;
  if (["proposal_sent", "manager_contacted"].includes(stage)) return "hot" as const;
  if (["quiz_completed", "lead_created", "reactivated"].includes(stage)) return "warm" as const;
  return "cold" as const;
};

type LeadAccessScope = {
  userId: number;
  role: "user" | "manager" | "admin";
};

type LeadListFilters = {
  query?: string;
  stage?: string;
  segment?: string;
  temperature?: string;
  assignedManagerId?: number | null;
};

const FUNNEL_STAGES = ["ad_click", "landing", "bot_start", "quiz_completed", "lead_created", "sale_closed"] as const;

const getLeadStageDepth = (stage: string) => {
  switch (stage) {
    case "ad_click":
      return 0;
    case "landing":
      return 1;
    case "bot_start":
      return 2;
    case "quiz_completed":
      return 3;
    case "sale_closed":
    case "repeat_sale":
      return 5;
    case "lead_created":
    case "manager_contacted":
    case "proposal_sent":
    case "reactivated":
    case "lost":
    default:
      return 4;
  }
};

const isRestrictedScope = (scope?: LeadAccessScope) => Boolean(scope && scope.role !== "admin");

const scopeLeadRows = <T extends { assignedManagerId: number | null }>(rows: T[], scope?: LeadAccessScope) => {
  if (!isRestrictedScope(scope)) {
    return rows;
  }

  return rows.filter((row) => row.assignedManagerId === scope!.userId);
};

const buildLeadAccessCondition = (scope?: LeadAccessScope) =>
  isRestrictedScope(scope) ? eq(leads.assignedManagerId, scope!.userId) : undefined;

const buildFunnelAnalytics = (
  rows: Array<{ stage: string; expectedRevenueUsd: unknown; score: unknown }>,
) => {
  const counts = FUNNEL_STAGES.map((stage, index) => ({
    stage,
    order: index + 1,
    total: 0,
    projectedRevenueUsd: 0,
    averageScore: 0,
  }));

  for (const row of rows) {
    const depth = getLeadStageDepth(row.stage);
    const revenue = toNullableNumber(row.expectedRevenueUsd) ?? 0;
    const score = toNumber(row.score);

    for (let index = 0; index <= depth && index < counts.length; index += 1) {
      counts[index].total += 1;
      counts[index].projectedRevenueUsd += revenue;
      counts[index].averageScore += score;
    }
  }

  return counts.map((item, index) => {
    const previous = index === 0 ? item.total : counts[index - 1].total;
    const first = counts[0]?.total ?? 0;
    return {
      stage: item.stage,
      order: item.order,
      total: item.total,
      conversionFromPreviousPct: previous > 0 ? Math.round((item.total / previous) * 100) : 0,
      conversionFromStartPct: first > 0 ? Math.round((item.total / first) * 100) : 0,
      projectedRevenueUsd: Math.round(item.projectedRevenueUsd),
      averageScore: item.total > 0 ? Math.round(item.averageScore / item.total) : 0,
    };
  });
};

const buildAcquisitionAnalytics = (
  rows: Array<{
    stage: string;
    segment: string;
    score: unknown;
    expectedRevenueUsd: unknown;
    adSource: string | null;
    adCampaign: string | null;
    adCreative: string | null;
    utmSource: string | null;
    utmCampaign: string | null;
  }>,
) => {
  const groups = new Map<string, {
    source: string;
    campaign: string;
    creative: string;
    leadCount: number;
    quizCompletedCount: number;
    qualifiedCount: number;
    saleClosedCount: number;
    projectedRevenueUsd: number;
    cumulativeScore: number;
    segmentTotals: Map<string, number>;
  }>();

  for (const row of rows) {
    const source = row.utmSource ?? row.adSource ?? "unattributed";
    const campaign = row.utmCampaign ?? row.adCampaign ?? "always-on";
    const creative = row.adCreative ?? "default";
    const key = `${source}::${campaign}::${creative}`;
    const existing = groups.get(key) ?? {
      source,
      campaign,
      creative,
      leadCount: 0,
      quizCompletedCount: 0,
      qualifiedCount: 0,
      saleClosedCount: 0,
      projectedRevenueUsd: 0,
      cumulativeScore: 0,
      segmentTotals: new Map<string, number>(),
    };
    const depth = getLeadStageDepth(row.stage);

    existing.leadCount += 1;
    if (depth >= 3) existing.quizCompletedCount += 1;
    if (depth >= 4) existing.qualifiedCount += 1;
    if (depth >= 5) existing.saleClosedCount += 1;
    existing.projectedRevenueUsd += toNullableNumber(row.expectedRevenueUsd) ?? 0;
    existing.cumulativeScore += toNumber(row.score);
    existing.segmentTotals.set(row.segment, (existing.segmentTotals.get(row.segment) ?? 0) + 1);
    groups.set(key, existing);
  }

  return Array.from(groups.values())
    .map((group) => ({
      source: group.source,
      campaign: group.campaign,
      creative: group.creative,
      leadCount: group.leadCount,
      quizCompletedCount: group.quizCompletedCount,
      qualifiedCount: group.qualifiedCount,
      saleClosedCount: group.saleClosedCount,
      conversionToQuizPct: group.leadCount > 0 ? Math.round((group.quizCompletedCount / group.leadCount) * 100) : 0,
      conversionToQualifiedPct: group.leadCount > 0 ? Math.round((group.qualifiedCount / group.leadCount) * 100) : 0,
      conversionToSalePct: group.leadCount > 0 ? Math.round((group.saleClosedCount / group.leadCount) * 100) : 0,
      projectedRevenueUsd: Math.round(group.projectedRevenueUsd),
      averageLeadScore: group.leadCount > 0 ? Math.round(group.cumulativeScore / group.leadCount) : 0,
      cplUsd: null as number | null,
      spendUsd: null as number | null,
      segments: Array.from(group.segmentTotals.entries())
        .map(([segment, total]) => ({ segment, total }))
        .sort((left, right) => right.total - left.total),
    }))
    .sort((left, right) => right.leadCount - left.leadCount || right.projectedRevenueUsd - left.projectedRevenueUsd);
};

const buildDemoDashboardSnapshot = (scope?: LeadAccessScope) => {
  const scopedLeads = scopeLeadRows(demoLeadRows, scope);
  const hotLeads = scopedLeads.filter((lead) => lead.temperature === "hot").length;
  const wonLeads = scopedLeads.filter((lead) => lead.stage === "sale_closed").length;
  const totalLeads = scopedLeads.length;
  const managerIds = new Set(scopedLeads.map((lead) => lead.assignedManagerId).filter((value): value is number => Boolean(value)));

  return {
    isDemo: true,
    kpis: {
      totalLeads,
      hotLeads,
      wonLeads,
      pendingFollowUps: scopedLeads.filter((lead) => lead.nextFollowUpAt).length,
      automationCoverage: 82,
      telegramReachable: scopedLeads.filter((lead) => lead.telegramUsername).length,
      projectedRevenueUsd: scopedLeads.reduce((sum, lead) => sum + toNumber(lead.expectedRevenueUsd), 0),
      conversionRate: totalLeads > 0 ? Math.round((wonLeads / totalLeads) * 100) : 0,
    },
    stageDistribution: Object.entries(
      scopedLeads.reduce<Record<string, number>>((accumulator, lead) => {
        accumulator[lead.stage] = (accumulator[lead.stage] ?? 0) + 1;
        return accumulator;
      }, {}),
    ).map(([stage, total]) => ({ stage, total })),
    segmentDistribution: Object.entries(
      scopedLeads.reduce<Record<string, number>>((accumulator, lead) => {
        accumulator[lead.segment] = (accumulator[lead.segment] ?? 0) + 1;
        return accumulator;
      }, {}),
    ).map(([segment, total]) => ({ segment, total })),
    recentLeads: scopedLeads,
    followUpQueue: scopedLeads
      .slice()
      .sort((a, b) => (a.nextFollowUpAt?.getTime() ?? 0) - (b.nextFollowUpAt?.getTime() ?? 0))
      .map((lead) => ({
        leadId: lead.id,
        fullName: lead.fullName,
        stage: lead.stage,
        temperature: lead.temperature,
        nextFollowUpAt: lead.nextFollowUpAt,
        assignedManagerId: lead.assignedManagerId,
      })),
    automationRules: DEFAULT_AUTOMATIONS.map((rule, index) => ({ id: index + 1, ...rule })),
    deliveryReadiness: {
      hasTelegramToken: Boolean(ENV.telegramBotToken),
      leadsWithTelegramId: scopedLeads.filter((lead) => lead.telegramUsername).length,
      recentMessages: managerIds.size > 0 ? scopedLeads.length * 3 : 12,
    },
  };
};
'''

if old_helpers not in text:
    raise SystemExit('helper block not found')
text = text.replace(old_helpers, new_helpers)

start = text.index('export async function listManagers() {')
end = text.index('export async function getDashboardSnapshot() {')
text = text[:start] + '''export async function listManagers(scope?: LeadAccessScope) {
  const scopedManagers = isRestrictedScope(scope)
    ? demoManagers.filter((manager) => manager.id === scope!.userId)
    : demoManagers;

  const db = await getDb();
  if (!db) return scopedManagers;

  const managerRows = await db
    .select({
      id: users.id,
      name: users.name,
      role: users.role,
      email: users.email,
      lastSignedIn: users.lastSignedIn,
    })
    .from(users)
    .where(inArray(users.role, ["manager", "admin"]));

  const visibleManagers = isRestrictedScope(scope)
    ? managerRows.filter((manager) => manager.id == scope!.userId)
    : managerRows;

  if (visibleManagers.length === 0) {
    return scopedManagers;
  }

  return visibleManagers;
}

''' + text[end:]

start = text.index('export async function getDashboardSnapshot() {')
end = text.index('export async function listLeads(filters?: {')
text = text[:start] + '''export async function getDashboardSnapshot(scope?: LeadAccessScope) {
  await ensureDefaultAutomationRules();

  const db = await getDb();
  if (!db) return buildDemoDashboardSnapshot(scope);

  const leadScopeCondition = buildLeadAccessCondition(scope);
  const [totalsRow] = await db
    .select({
      totalLeads: sql<number>`count(*)`,
      hotLeads: sql<number>`sum(case when ${leads.temperature} = 'hot' then 1 else 0 end)`,
      wonLeads: sql<number>`sum(case when ${leads.stage} = 'sale_closed' then 1 else 0 end)`,
      pendingFollowUps: sql<number>`sum(case when ${leads.nextFollowUpAt} is not null then 1 else 0 end)`,
      projectedRevenueUsd: sql<number>`coalesce(sum(${leads.expectedRevenueUsd}), 0)`,
      telegramReachable: sql<number>`sum(case when ${leads.telegramUserId} is not null or ${leads.telegramUsername} is not null then 1 else 0 end)`,
    })
    .from(leads)
    .where(leadScopeCondition);

  if (toNumber(totalsRow?.totalLeads) === 0) {
    return buildDemoDashboardSnapshot(scope);
  }

  const [automationHealthRow] = await db
    .select({
      activeRules: sql<number>`sum(case when ${automationRules.status} = 'active' then 1 else 0 end)`,
      totalRules: sql<number>`count(*)`,
    })
    .from(automationRules);

  const [messagesRow] = isRestrictedScope(scope)
    ? await db
        .select({
          recentMessages: sql<number>`count(*)`,
        })
        .from(leadCommunications)
        .innerJoin(leads, eq(leadCommunications.leadId, leads.id))
        .where(and(eq(leadCommunications.channel, "telegram"), eq(leads.assignedManagerId, scope!.userId)))
    : await db
        .select({
          recentMessages: sql<number>`count(*)`,
        })
        .from(leadCommunications)
        .where(eq(leadCommunications.channel, "telegram"));

  const stageDistribution = await db
    .select({
      stage: leads.stage,
      total: sql<number>`count(*)`,
    })
    .from(leads)
    .where(leadScopeCondition)
    .groupBy(leads.stage)
    .orderBy(desc(sql`count(*)`));

  const segmentDistribution = await db
    .select({
      segment: leads.segment,
      total: sql<number>`count(*)`,
    })
    .from(leads)
    .where(leadScopeCondition)
    .groupBy(leads.segment)
    .orderBy(desc(sql`count(*)`));

  const recentLeads = await db
    .select({
      id: leads.id,
      fullName: leads.fullName,
      phone: leads.phone,
      telegramUsername: leads.telegramUsername,
      segment: leads.segment,
      stage: leads.stage,
      temperature: leads.temperature,
      score: leads.score,
      city: leads.city,
      productInterest: leads.productInterest,
      expectedRevenueUsd: leads.expectedRevenueUsd,
      assignedManagerId: leads.assignedManagerId,
      nextFollowUpAt: leads.nextFollowUpAt,
      lastInteractionAt: leads.lastInteractionAt,
      createdAt: leads.createdAt,
      updatedAt: leads.updatedAt,
    })
    .from(leads)
    .where(leadScopeCondition)
    .orderBy(desc(leads.updatedAt))
    .limit(8);

  const followUpQueue = await db
    .select({
      leadId: leads.id,
      fullName: leads.fullName,
      stage: leads.stage,
      temperature: leads.temperature,
      nextFollowUpAt: leads.nextFollowUpAt,
      assignedManagerId: leads.assignedManagerId,
    })
    .from(leads)
    .where(
      leadScopeCondition
        ? and(leadScopeCondition, sql`${leads.nextFollowUpAt} is not null`)
        : sql`${leads.nextFollowUpAt} is not null`,
    )
    .orderBy(sql`${leads.nextFollowUpAt} asc`)
    .limit(8);

  const automationRuleRows = await db
    .select()
    .from(automationRules)
    .orderBy(desc(automationRules.updatedAt));

  const totalLeads = toNumber(totalsRow?.totalLeads);
  const wonLeads = toNumber(totalsRow?.wonLeads);
  const totalRules = toNumber(automationHealthRow?.totalRules);
  const activeRules = toNumber(automationHealthRow?.activeRules);

  return {
    isDemo: false,
    kpis: {
      totalLeads,
      hotLeads: toNumber(totalsRow?.hotLeads),
      wonLeads,
      pendingFollowUps: toNumber(totalsRow?.pendingFollowUps),
      automationCoverage: totalRules > 0 ? Math.round((activeRules / totalRules) * 100) : 0,
      telegramReachable: toNumber(totalsRow?.telegramReachable),
      projectedRevenueUsd: toNumber(totalsRow?.projectedRevenueUsd),
      conversionRate: totalLeads > 0 ? Math.round((wonLeads / totalLeads) * 100) : 0,
    },
    stageDistribution: stageDistribution.map((row) => ({
      stage: row.stage,
      total: toNumber(row.total),
    })),
    segmentDistribution: segmentDistribution.map((row) => ({
      segment: row.segment,
      total: toNumber(row.total),
    })),
    recentLeads,
    followUpQueue,
    automationRules: automationRuleRows,
    deliveryReadiness: {
      hasTelegramToken: Boolean(ENV.telegramBotToken),
      leadsWithTelegramId: toNumber(totalsRow?.telegramReachable),
      recentMessages: toNumber(messagesRow?.recentMessages),
    },
  };
}

''' + text[end:]

start = text.index('export async function listLeads(filters?: {')
end = text.index('export async function getLeadDetail(leadId: number) {')
text = text[:start] + '''export async function listLeads(filters?: LeadListFilters, scope?: LeadAccessScope) {
  const effectiveFilters = filters ?? {};
  const scopedAssignedManagerId = isRestrictedScope(scope) ? scope!.userId : effectiveFilters.assignedManagerId;

  const db = await getDb();
  if (!db) {
    return scopeLeadRows(demoLeadRows, scope).filter((lead) => {
      const matchesQuery =
        !effectiveFilters.query ||
        lead.fullName.toLowerCase().includes(effectiveFilters.query.toLowerCase()) ||
        lead.phone?.includes(effectiveFilters.query) ||
        lead.telegramUsername?.toLowerCase().includes(effectiveFilters.query.toLowerCase());
      const matchesStage = !effectiveFilters.stage || effectiveFilters.stage === "all" || lead.stage === effectiveFilters.stage;
      const matchesSegment = !effectiveFilters.segment || effectiveFilters.segment === "all" || lead.segment === effectiveFilters.segment;
      const matchesTemperature =
        !effectiveFilters.temperature || effectiveFilters.temperature === "all" || lead.temperature === effectiveFilters.temperature;
      const matchesManager = scopedAssignedManagerId === undefined || scopedAssignedManagerId === null || lead.assignedManagerId === scopedAssignedManagerId;
      return matchesQuery && matchesStage && matchesSegment && matchesTemperature && matchesManager;
    });
  }

  const conditions: Array<any> = [];

  if (effectiveFilters.stage && effectiveFilters.stage !== "all") {
    conditions.push(eq(leads.stage, effectiveFilters.stage as Lead["stage"]));
  }
  if (effectiveFilters.segment && effectiveFilters.segment !== "all") {
    conditions.push(eq(leads.segment, effectiveFilters.segment as Lead["segment"]));
  }
  if (effectiveFilters.temperature && effectiveFilters.temperature !== "all") {
    conditions.push(eq(leads.temperature, effectiveFilters.temperature as Lead["temperature"]));
  }
  if (scopedAssignedManagerId) {
    conditions.push(eq(leads.assignedManagerId, scopedAssignedManagerId));
  }
  if (effectiveFilters.query?.trim()) {
    const pattern = `%${effectiveFilters.query.trim()}%`;
    conditions.push(
      or(
        like(leads.fullName, pattern),
        like(leads.phone, pattern),
        like(leads.telegramUsername, pattern),
        like(leads.adCampaign, pattern),
      )!,
    );
  }

  const rows = await db
    .select()
    .from(leads)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(leads.updatedAt))
    .limit(50);

  return rows;
}

''' + text[end:]

start = text.index('export async function getLeadDetail(leadId: number) {')
end = text.index('export async function updateLeadStage(input: {')
text = text[:start] + '''export async function getLeadDetail(leadId: number, scope?: LeadAccessScope) {
  const db = await getDb();
  if (!db) {
    const lead = scopeLeadRows(demoLeadRows, scope).find((item) => item.id === leadId) ?? null;
    if (!lead) {
      return null;
    }

    return {
      lead,
      notes: [
        {
          id: 1,
          leadId: lead.id,
          authorUserId: 1,
          authorName: "Owner Desk",
          note: "Пользователь уже прошёл квиз и ожидает расчёт по комнате 28 м².",
          isPrivate: 0,
          createdAt: new Date(Date.now() - 1000 * 60 * 90),
          updatedAt: new Date(Date.now() - 1000 * 60 * 90),
        },
      ],
      events: [
        {
          id: 1,
          leadId: lead.id,
          eventType: "quiz_completed",
          title: "Квиз завершён",
          description: "Пользователь прошёл сценарий подбора и попал в сегмент sales-ready.",
          actorType: "system",
          actorUserId: null,
          payloadJson: null,
          occurredAt: new Date(Date.now() - 1000 * 60 * 140),
          createdAt: new Date(Date.now() - 1000 * 60 * 140),
        },
      ],
      communications: [
        {
          id: 1,
          leadId: lead.id,
          channel: "telegram",
          direction: "outbound",
          status: "sent",
          templateKey: "warm-nurture",
          subject: "Follow-up",
          content: "Спасибо за интерес к Midea. Менеджер уже готовит предложение.",
          imageUrl: null,
          ctaLabel: "Открыть каталог",
          ctaUrl: "https://www.midea-alba.uz",
          externalMessageId: "demo-1",
          scheduledAt: null,
          sentAt: new Date(Date.now() - 1000 * 60 * 80),
          createdByUserId: 1,
          createdAt: new Date(Date.now() - 1000 * 60 * 80),
        },
      ],
      tasks: [
        {
          id: 1,
          leadId: lead.id,
          title: "Подтвердить время выезда замерщика",
          description: "Нужно связаться с клиентом и зафиксировать удобный слот.",
          status: "in_progress",
          priority: "high",
          assignedToUserId: 1,
          dueAt: new Date(Date.now() + 1000 * 60 * 120),
          completedAt: null,
          createdAt: new Date(Date.now() - 1000 * 60 * 60),
          updatedAt: new Date(Date.now() - 1000 * 60 * 25),
        },
      ],
      referrals: [
        {
          id: 1,
          leadId: lead.id,
          code: "ALBA-FRIEND-01",
          invitedLeadId: null,
          status: "pending",
          rewardLabel: "Filter bonus",
          rewardValueUsd: "25.00",
          qualifiedAt: null,
          rewardedAt: null,
          createdAt: new Date(Date.now() - 1000 * 60 * 60 * 5),
          updatedAt: new Date(Date.now() - 1000 * 60 * 60 * 5),
        },
      ],
    };
  }

  const leadCondition = isRestrictedScope(scope)
    ? and(eq(leads.id, leadId), eq(leads.assignedManagerId, scope!.userId))
    : eq(leads.id, leadId);
  const leadRow = await db.select().from(leads).where(leadCondition).limit(1);
  if (leadRow.length === 0) {
    return null;
  }

  const [noteRows, eventRows, communicationRows, taskRows, referralRows] = await Promise.all([
    db.select().from(leadNotes).where(eq(leadNotes.leadId, leadId)).orderBy(desc(leadNotes.createdAt)).limit(20),
    db.select().from(leadEvents).where(eq(leadEvents.leadId, leadId)).orderBy(desc(leadEvents.occurredAt)).limit(30),
    db.select().from(leadCommunications).where(eq(leadCommunications.leadId, leadId)).orderBy(desc(leadCommunications.createdAt)).limit(20),
    db.select().from(leadTasks).where(eq(leadTasks.leadId, leadId)).orderBy(desc(leadTasks.updatedAt)).limit(20),
    db.select().from(referralInvites).where(eq(referralInvites.leadId, leadId)).orderBy(desc(referralInvites.createdAt)).limit(20),
  ]);

  const authorIds = Array.from(new Set(noteRows.map((row) => row.authorUserId).filter(Boolean)));
  const authors = authorIds.length
    ? await db.select({ id: users.id, name: users.name }).from(users).where(inArray(users.id, authorIds))
    : [];
  const authorMap = new Map(authors.map((author) => [author.id, author.name ?? `User #${author.id}`]));

  return {
    lead: leadRow[0],
    notes: noteRows.map((row) => ({
      ...row,
      authorName: authorMap.get(row.authorUserId) ?? `User #${row.authorUserId}`,
    })),
    events: eventRows,
    communications: communicationRows,
    tasks: taskRows,
    referrals: referralRows,
  };
}

''' + text[end:]

text = text.replace('''export async function updateLeadStage(input: {
  leadId: number;
  stage: Lead["stage"];
  statusReason?: string | null;
  actorUserId: number;
}) {''', '''export async function updateLeadStage(input: {
  leadId: number;
  stage: Lead["stage"];
  statusReason?: string | null;
  actorUserId: number;
  accessScope?: LeadAccessScope;
}) {''')
text = text.replace('''  const db = await getDb();
  if (!db) {
    return { success: true, isDemo: true } as const;
  }
''', '''  const db = await getDb();
  if (!db) {
    const lead = await getLeadDetail(input.leadId, input.accessScope);
    if (!lead?.lead) {
      throw new Error("Lead not found or access denied.");
    }
    return { success: true, isDemo: true } as const;
  }

  const lead = await getLeadDetail(input.leadId, input.accessScope);
  if (!lead?.lead) {
    throw new Error("Lead not found or access denied.");
  }
''', 1)

text = text.replace('''export async function addLeadNote(input: {
  leadId: number;
  authorUserId: number;
  note: string;
  isPrivate?: boolean;
}) {''', '''export async function addLeadNote(input: {
  leadId: number;
  authorUserId: number;
  note: string;
  isPrivate?: boolean;
  accessScope?: LeadAccessScope;
}) {''')
text = text.replace('''  const db = await getDb();
  if (!db) {
    return {
''', '''  const db = await getDb();
  const lead = await getLeadDetail(input.leadId, input.accessScope);
  if (!lead?.lead) {
    throw new Error("Lead not found or access denied.");
  }

  if (!db) {
    return {
''', 1)

text = text.replace('''export async function createLeadTask(input: {
  leadId: number;
  title: string;
  description?: string;
  assignedToUserId?: number | null;
  dueAt?: Date | null;
  priority?: "low" | "medium" | "high" | "critical";
}) {''', '''export async function createLeadTask(input: {
  leadId: number;
  title: string;
  description?: string;
  assignedToUserId?: number | null;
  dueAt?: Date | null;
  priority?: "low" | "medium" | "high" | "critical";
  accessScope?: LeadAccessScope;
}) {''')
text = text.replace('''  const db = await getDb();
  if (!db) {
    return {
''', '''  const db = await getDb();
  const lead = await getLeadDetail(input.leadId, input.accessScope);
  if (!lead?.lead) {
    throw new Error("Lead not found or access denied.");
  }

  if (!db) {
    return {
''', 1)

start = text.index('export async function getLeadPipelineSummary() {')
end = len(text)
text = text[:start] + '''export async function getLeadPipelineSummary(scope?: LeadAccessScope) {
  const db = await getDb();
  if (!db) {
    return scopeLeadRows(demoLeadRows, scope).map((lead) => ({
      id: lead.id,
      fullName: lead.fullName,
      stage: lead.stage,
      temperature: lead.temperature,
      assignedManagerId: lead.assignedManagerId,
      expectedRevenueUsd: toNullableNumber(lead.expectedRevenueUsd),
    }));
  }

  const rows = await db
    .select({
      id: leads.id,
      fullName: leads.fullName,
      stage: leads.stage,
      temperature: leads.temperature,
      assignedManagerId: leads.assignedManagerId,
      expectedRevenueUsd: leads.expectedRevenueUsd,
    })
    .from(leads)
    .where(buildLeadAccessCondition(scope))
    .orderBy(desc(leads.updatedAt))
    .limit(100);

  return rows.map((row) => ({
    ...row,
    expectedRevenueUsd: toNullableNumber(row.expectedRevenueUsd),
  }));
}

export async function getLeadFunnelAnalytics(scope?: LeadAccessScope) {
  const db = await getDb();
  if (!db) {
    return buildFunnelAnalytics(scopeLeadRows(demoLeadRows, scope));
  }

  const rows = await db
    .select({
      stage: leads.stage,
      expectedRevenueUsd: leads.expectedRevenueUsd,
      score: leads.score,
    })
    .from(leads)
    .where(buildLeadAccessCondition(scope));

  return buildFunnelAnalytics(rows);
}

export async function getLeadAcquisitionAnalytics(scope?: LeadAccessScope) {
  const db = await getDb();
  if (!db) {
    return buildAcquisitionAnalytics(scopeLeadRows(demoLeadRows, scope));
  }

  const rows = await db
    .select({
      stage: leads.stage,
      segment: leads.segment,
      score: leads.score,
      expectedRevenueUsd: leads.expectedRevenueUsd,
      adSource: leads.adSource,
      adCampaign: leads.adCampaign,
      adCreative: leads.adCreative,
      utmSource: leads.utmSource,
      utmCampaign: leads.utmCampaign,
    })
    .from(leads)
    .where(buildLeadAccessCondition(scope));

  return buildAcquisitionAnalytics(rows);
}
'''

path.write_text(text)
