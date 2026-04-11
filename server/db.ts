import {
  and,
  desc,
  eq,
  inArray,
  like,
  or,
  sql,
} from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  adSpendEntries,
  automationRules,
  automationRuns,
  broadcasts,
  InsertUser,
  leadCommunications,
  leadEvents,
  leadNotes,
  leadTasks,
  leads,
  type Lead,
  type InsertBroadcast,
  type InsertLeadCommunication,
  type InsertLeadEvent,
  type InsertLeadNote,
  type InsertLeadTask,
  type InsertReferralInvite,
  referralInvites,
  users,
} from "../drizzle/schema";
import { ENV } from "./_core/env";
import { sendTelegramRichMessage } from "./telegram";

let _db: ReturnType<typeof drizzle> | null = null;

const DEFAULT_AUTOMATIONS = [
  {
    automationKey: "hot_24h_followup" as const,
    name: "Hot lead: 24h follow-up",
    description: "Отправляет ускоренный follow-up по горячим лидам, если менеджер не закрыл касание в течение 24 часов.",
    status: "active" as const,
    triggerStage: "lead_created" as const,
    delayMinutes: 60,
    targetChannel: "telegram" as const,
    templateKey: "hot-lead-followup",
  },
  {
    automationKey: "warm_nurture" as const,
    name: "Warm nurture sequence",
    description: "Серия контентных Telegram-касаний после прохождения квиза и квалификации в warm сегмент.",
    status: "active" as const,
    triggerStage: "quiz_completed" as const,
    delayMinutes: 180,
    targetChannel: "telegram" as const,
    templateKey: "warm-nurture",
  },
  {
    automationKey: "post_purchase_cross_sell" as const,
    name: "Post-purchase cross-sell",
    description: "Предлагает дополнительные продукты и сервисные касания после закрытия продажи.",
    status: "paused" as const,
    triggerStage: "sale_closed" as const,
    delayMinutes: 1440,
    targetChannel: "telegram" as const,
    templateKey: "post-purchase-cross-sell",
  },
  {
    automationKey: "filter_renewal_reminder" as const,
    name: "Filter renewal reminder",
    description: "Напоминает клиенту о замене фильтра и предлагает сервисное обращение.",
    status: "active" as const,
    triggerStage: "repeat_sale" as const,
    delayMinutes: 43200,
    targetChannel: "telegram" as const,
    templateKey: "filter-renewal",
  },
  {
    automationKey: "reactivation_inactive" as const,
    name: "Inactive lead reactivation",
    description: "Возвращает в воронку пользователей без активности через контент и спецпредложение.",
    status: "active" as const,
    triggerStage: "lost" as const,
    delayMinutes: 10080,
    targetChannel: "telegram" as const,
    templateKey: "reactivation-inactive",
  },
];

const demoLeadRows = [
  {
    id: 1001,
    fullName: "Azizbek Rakhimov",
    phone: "+998 90 123 45 67",
    telegramUserId: null,
    telegramUsername: "aziz_contour",
    segment: "alba",
    stage: "manager_contacted",
    temperature: "hot",
    score: 91,
    city: "Tashkent",
    productInterest: "Midea ALBA inverter",
    expectedRevenueUsd: "920.00",
    assignedManagerId: 1,
    nextFollowUpAt: new Date(Date.now() + 1000 * 60 * 90),
    lastInteractionAt: new Date(Date.now() - 1000 * 60 * 42),
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 26),
    updatedAt: new Date(Date.now() - 1000 * 60 * 14),
  },
  {
    id: 1002,
    fullName: "Madinabonu Yusupova",
    phone: "+998 91 765 43 21",
    telegramUserId: null,
    telegramUsername: "madina_home",
    segment: "welkin",
    stage: "quiz_completed",
    temperature: "warm",
    score: 74,
    city: "Samarkand",
    productInterest: "Welkin purifier",
    expectedRevenueUsd: "440.00",
    assignedManagerId: 2,
    nextFollowUpAt: new Date(Date.now() + 1000 * 60 * 60 * 8),
    lastInteractionAt: new Date(Date.now() - 1000 * 60 * 115),
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 10),
    updatedAt: new Date(Date.now() - 1000 * 60 * 40),
  },
  {
    id: 1003,
    fullName: "Dilshod Karimov",
    phone: "+998 93 111 00 22",
    telegramUserId: null,
    telegramUsername: "dkarimov",
    segment: "combo",
    stage: "proposal_sent",
    temperature: "hot",
    score: 88,
    city: "Bukhara",
    productInterest: "ALBA + service package",
    expectedRevenueUsd: "1280.00",
    assignedManagerId: 1,
    nextFollowUpAt: new Date(Date.now() + 1000 * 60 * 30),
    lastInteractionAt: new Date(Date.now() - 1000 * 60 * 18),
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 36),
    updatedAt: new Date(Date.now() - 1000 * 60 * 12),
  },
  {
    id: 1004,
    fullName: "Kamila Rustamova",
    phone: "+998 95 444 90 90",
    telegramUserId: null,
    telegramUsername: "kamila_clean",
    segment: "consult",
    stage: "lead_created",
    temperature: "warm",
    score: 53,
    city: "Nukus",
    productInterest: "Consultation",
    expectedRevenueUsd: "220.00",
    assignedManagerId: null,
    nextFollowUpAt: new Date(Date.now() + 1000 * 60 * 60 * 14),
    lastInteractionAt: new Date(Date.now() - 1000 * 60 * 180),
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 4),
    updatedAt: new Date(Date.now() - 1000 * 60 * 70),
  },
] as const;

const demoManagers = [
  { id: 1, name: "Owner Desk", role: "admin" },
  { id: 2, name: "Lead Manager", role: "manager" },
];

const demoAttributionByLeadId = {
  1001: { source: "telegram_ads", campaign: "spring-launch", creative: "video-a" },
  1002: { source: "google_search", campaign: "air-purifier-quiz", creative: "search-rsa-1" },
  1003: { source: "telegram_ads", campaign: "spring-launch", creative: "video-a" },
  1004: { source: "instagram_reels", campaign: "consult-soft-launch", creative: "reel-b" },
} as const;

const demoAdSpendEntries = [
  {
    id: 1,
    source: "telegram_ads",
    campaign: "spring-launch",
    creative: "video-a",
    spendUsd: "480.00",
    notes: "Safe-mode manual spend for Telegram launch creatives.",
    createdByUserId: 1,
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 30),
    updatedAt: new Date(Date.now() - 1000 * 60 * 60 * 4),
  },
  {
    id: 2,
    source: "google_search",
    campaign: "air-purifier-quiz",
    creative: "search-rsa-1",
    spendUsd: "210.00",
    notes: "Safe-mode manual spend for search demand capture.",
    createdByUserId: 1,
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24),
    updatedAt: new Date(Date.now() - 1000 * 60 * 60 * 3),
  },
  {
    id: 3,
    source: "instagram_reels",
    campaign: "consult-soft-launch",
    creative: "reel-b",
    spendUsd: "96.00",
    notes: "Safe-mode manual spend for consultation awareness.",
    createdByUserId: 1,
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 20),
    updatedAt: new Date(Date.now() - 1000 * 60 * 90),
  },
] as const;

const toNumber = (value: unknown): number => {
  if (typeof value === "number") return value;
  if (typeof value === "bigint") return Number(value);
  if (typeof value === "string" && value.trim().length > 0) return Number(value);
  return 0;
};

const toNullableNumber = (value: unknown): number | null => {
  if (value === null || value === undefined || value === "") return null;
  const normalized = Number(value);
  return Number.isFinite(normalized) ? normalized : null;
};

const deriveTemperatureFromStage = (stage: string) => {
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

const scopeLeadRows = <T extends { assignedManagerId: number | null }>(rows: readonly T[], scope?: LeadAccessScope): T[] => {
  if (!isRestrictedScope(scope)) {
    return [...rows];
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

type AcquisitionAnalyticsRow = {
  stage: string;
  segment: string;
  score: unknown;
  expectedRevenueUsd: unknown;
  adSource: string | null;
  adCampaign: string | null;
  adCreative: string | null;
  utmSource: string | null;
  utmCampaign: string | null;
};

type SpendAnalyticsRow = {
  id?: number | null;
  source: string | null;
  campaign: string | null;
  creative: string | null;
  spendUsd: unknown;
  notes?: string | null;
  updatedAt?: Date | null;
  createdAt?: Date | null;
  createdByUserId?: number | null;
};

const getAttributionDimensions = (row: {
  adSource?: string | null;
  adCampaign?: string | null;
  adCreative?: string | null;
  utmSource?: string | null;
  utmCampaign?: string | null;
  source?: string | null;
  campaign?: string | null;
  creative?: string | null;
}) => {
  const source = row.utmSource ?? row.adSource ?? row.source ?? "unattributed";
  const campaign = row.utmCampaign ?? row.adCampaign ?? row.campaign ?? "always-on";
  const creative = row.adCreative ?? row.creative ?? "default";

  return {
    source,
    campaign,
    creative,
    key: `${source}::${campaign}::${creative}`,
  };
};

const mapSpendEntry = <T extends {
  id: number;
  source: string;
  campaign: string;
  creative: string;
  spendUsd: unknown;
  notes?: string | null;
  createdByUserId?: number | null;
  createdAt?: Date | null;
  updatedAt?: Date | null;
}>(row: T) => ({
  ...row,
  spendUsd: toNullableNumber(row.spendUsd) ?? 0,
  notes: row.notes ?? null,
  createdByUserId: row.createdByUserId ?? null,
  createdAt: row.createdAt ?? null,
  updatedAt: row.updatedAt ?? null,
});

const buildAcquisitionAnalytics = (
  rows: ReadonlyArray<AcquisitionAnalyticsRow>,
  spendRows: ReadonlyArray<SpendAnalyticsRow> = [],
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
  const spendByKey = new Map<string, {
    id: number | null;
    spendUsd: number;
    notes: string | null;
    updatedAt: Date | null;
    createdByUserId: number | null;
  }>();

  for (const spendRow of spendRows) {
    const { key } = getAttributionDimensions({
      source: spendRow.source,
      campaign: spendRow.campaign,
      creative: spendRow.creative,
    });
    const existing = spendByKey.get(key) ?? {
      id: spendRow.id ?? null,
      spendUsd: 0,
      notes: spendRow.notes ?? null,
      updatedAt: spendRow.updatedAt ?? spendRow.createdAt ?? null,
      createdByUserId: spendRow.createdByUserId ?? null,
    };

    existing.spendUsd += toNullableNumber(spendRow.spendUsd) ?? 0;
    existing.notes = spendRow.notes ?? existing.notes;
    existing.updatedAt = spendRow.updatedAt ?? spendRow.createdAt ?? existing.updatedAt;
    existing.createdByUserId = spendRow.createdByUserId ?? existing.createdByUserId;
    existing.id = spendRow.id ?? existing.id;
    spendByKey.set(key, existing);
  }

  for (const row of rows) {
    const { source, campaign, creative, key } = getAttributionDimensions(row);
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

  return Array.from(groups.entries())
    .map(([key, group]) => {
      const spend = spendByKey.get(key);
      const spendUsd = spend ? Math.round(spend.spendUsd * 100) / 100 : null;
      const cplUsd = spendUsd !== null && group.leadCount > 0 ? Math.round((spendUsd / group.leadCount) * 100) / 100 : null;

      return {
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
        cplUsd,
        spendUsd,
        spendEntryId: spend?.id ?? null,
        spendUpdatedAt: spend?.updatedAt ?? null,
        spendNotes: spend?.notes ?? null,
        segments: Array.from(group.segmentTotals.entries())
          .map(([segment, total]) => ({ segment, total }))
          .sort((left, right) => right.total - left.total),
      };
    })
    .sort((left, right) => right.leadCount - left.leadCount || right.projectedRevenueUsd - left.projectedRevenueUsd);
};

const buildDemoDashboardSnapshot = (scope?: LeadAccessScope) => {
  const scopedLeads = scopeLeadRows(demoLeadRows, scope).map((lead) => ({
    ...lead,
    stage: lead.stage as string,
    temperature: lead.temperature as string,
    assignedManagerId: lead.assignedManagerId as number | null,
  }));
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

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

async function ensureDefaultAutomationRules() {
  const db = await getDb();
  if (!db) return;

  const existing = await db
    .select({ total: sql<number>`count(*)` })
    .from(automationRules);

  if (toNumber(existing[0]?.total) > 0) {
    return;
  }

  await db.insert(automationRules).values(DEFAULT_AUTOMATIONS);
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = "admin";
      updateSet.role = "admin";
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

export async function listManagers(scope?: LeadAccessScope) {
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

export async function getDashboardSnapshot(scope?: LeadAccessScope) {
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

export async function listLeads(filters?: LeadListFilters, scope?: LeadAccessScope) {
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

export async function getLeadDetail(leadId: number, scope?: LeadAccessScope) {
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

export async function updateLeadStage(input: {
  leadId: number;
  stage: Lead["stage"];
  statusReason?: string | null;
  actorUserId: number;
  accessScope?: LeadAccessScope;
}) {
  const db = await getDb();
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

  await db
    .update(leads)
    .set({
      stage: input.stage,
      temperature: deriveTemperatureFromStage(input.stage),
      statusReason: input.statusReason ?? null,
      lastInteractionAt: new Date(),
      updatedAt: new Date(),
      closedWonAt: input.stage === "sale_closed" ? new Date() : null,
      lostAt: input.stage === "lost" ? new Date() : null,
    })
    .where(eq(leads.id, input.leadId));

  await createLeadEvent({
    leadId: input.leadId,
    eventType: "stage_changed",
    title: `Stage updated to ${input.stage}`,
    description: input.statusReason ?? "Stage updated from admin panel",
    actorType: "manager",
    actorUserId: input.actorUserId,
    payloadJson: JSON.stringify({ stage: input.stage, reason: input.statusReason ?? null }),
  });

  return { success: true, isDemo: false } as const;
}

export async function createLeadEvent(event: InsertLeadEvent) {
  const db = await getDb();
  if (!db) return;
  await db.insert(leadEvents).values(event);
}

export async function addLeadNote(input: {
  leadId: number;
  authorUserId: number;
  note: string;
  isPrivate?: boolean;
  accessScope?: LeadAccessScope;
}) {
  const db = await getDb();
  const lead = await getLeadDetail(input.leadId, input.accessScope);
  if (!lead?.lead) {
    throw new Error("Lead not found or access denied.");
  }

  if (!db) {
    return {
      id: Date.now(),
      leadId: input.leadId,
      authorUserId: input.authorUserId,
      note: input.note,
      isPrivate: input.isPrivate ? 1 : 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  const payload: InsertLeadNote = {
    leadId: input.leadId,
    authorUserId: input.authorUserId,
    note: input.note,
    isPrivate: input.isPrivate ? 1 : 0,
  };

  await db.insert(leadNotes).values(payload);
  await createLeadEvent({
    leadId: input.leadId,
    eventType: "manager_note",
    title: "Manager note added",
    description: input.note,
    actorType: "manager",
    actorUserId: input.authorUserId,
  });

  const latest = await db
    .select()
    .from(leadNotes)
    .where(eq(leadNotes.leadId, input.leadId))
    .orderBy(desc(leadNotes.id))
    .limit(1);

  return latest[0];
}

export async function createLeadTask(input: {
  leadId: number;
  title: string;
  description?: string;
  assignedToUserId?: number | null;
  dueAt?: Date | null;
  priority?: "low" | "medium" | "high" | "critical";
  accessScope?: LeadAccessScope;
}) {
  const db = await getDb();
  const lead = await getLeadDetail(input.leadId, input.accessScope);
  if (!lead?.lead) {
    throw new Error("Lead not found or access denied.");
  }

  if (!db) {
    return {
      id: Date.now(),
      leadId: input.leadId,
      title: input.title,
      description: input.description ?? null,
      status: "todo",
      priority: input.priority ?? "medium",
      assignedToUserId: input.assignedToUserId ?? null,
      dueAt: input.dueAt ?? null,
      completedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  const payload: InsertLeadTask = {
    leadId: input.leadId,
    title: input.title,
    description: input.description ?? null,
    status: "todo",
    priority: input.priority ?? "medium",
    assignedToUserId: input.assignedToUserId ?? null,
    dueAt: input.dueAt ?? null,
  };

  await db.insert(leadTasks).values(payload);
  await createLeadEvent({
    leadId: input.leadId,
    eventType: "task_created",
    title: "Task created",
    description: input.title,
    actorType: "manager",
    actorUserId: input.assignedToUserId ?? null,
    payloadJson: JSON.stringify({ dueAt: input.dueAt ?? null, priority: input.priority ?? "medium" }),
  });

  const latest = await db
    .select()
    .from(leadTasks)
    .where(eq(leadTasks.leadId, input.leadId))
    .orderBy(desc(leadTasks.id))
    .limit(1);

  return latest[0];
}

export async function listAutomationRules() {
  await ensureDefaultAutomationRules();
  const db = await getDb();
  if (!db) {
    return DEFAULT_AUTOMATIONS.map((rule, index) => ({
      id: index + 1,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...rule,
    }));
  }

  return db.select().from(automationRules).orderBy(desc(automationRules.updatedAt));
}

export async function updateAutomationRuleStatus(input: { ruleId: number; status: "draft" | "active" | "paused" | "archived"; }) {
  const db = await getDb();
  if (!db) {
    return { success: true, isDemo: true } as const;
  }

  await db
    .update(automationRules)
    .set({
      status: input.status,
      updatedAt: new Date(),
    })
    .where(eq(automationRules.id, input.ruleId));

  const rule = await db.select().from(automationRules).where(eq(automationRules.id, input.ruleId)).limit(1);
  return rule[0] ?? null;
}

export async function listBroadcasts() {
  const db = await getDb();
  if (!db) {
    return [
      {
        id: 1,
        title: "Weekend ALBA promo",
        segment: "alba",
        status: "scheduled",
        body: "Скидка на линейку ALBA до конца недели. Ответьте менеджеру, чтобы получить персональный расчёт.",
        imageUrl: null,
        ctaLabel: "Открыть предложение",
        ctaUrl: "https://www.midea-alba.uz",
        scheduledAt: new Date(Date.now() + 1000 * 60 * 90),
        sentAt: null,
        createdByUserId: 1,
        createdAt: new Date(Date.now() - 1000 * 60 * 70),
        updatedAt: new Date(Date.now() - 1000 * 60 * 20),
      },
    ];
  }

  return db.select().from(broadcasts).orderBy(desc(broadcasts.updatedAt)).limit(20);
}

export async function createBroadcastDraft(input: {
  title: string;
  body: string;
  segment?: "alba" | "welkin" | "combo" | "consult" | null;
  ctaLabel?: string | null;
  ctaUrl?: string | null;
  scheduledAt?: Date | null;
  createdByUserId: number;
}) {
  const db = await getDb();
  if (!db) {
    return {
      id: Date.now(),
      title: input.title,
      segment: input.segment ?? null,
      status: input.scheduledAt ? "scheduled" : "draft",
      body: input.body,
      imageUrl: null,
      ctaLabel: input.ctaLabel ?? null,
      ctaUrl: input.ctaUrl ?? null,
      scheduledAt: input.scheduledAt ?? null,
      sentAt: null,
      createdByUserId: input.createdByUserId,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  const payload: InsertBroadcast = {
    title: input.title,
    segment: input.segment ?? null,
    status: input.scheduledAt ? "scheduled" : "draft",
    body: input.body,
    ctaLabel: input.ctaLabel ?? null,
    ctaUrl: input.ctaUrl ?? null,
    scheduledAt: input.scheduledAt ?? null,
    createdByUserId: input.createdByUserId,
  };

  await db.insert(broadcasts).values(payload);
  const latest = await db.select().from(broadcasts).orderBy(desc(broadcasts.id)).limit(1);
  return latest[0];
}

export async function logLeadCommunication(payload: InsertLeadCommunication) {
  const db = await getDb();
  if (!db) return null;
  await db.insert(leadCommunications).values(payload);
  const latest = await db.select().from(leadCommunications).orderBy(desc(leadCommunications.id)).limit(1);
  return latest[0] ?? null;
}

export async function createReferralInvite(payload: InsertReferralInvite) {
  const db = await getDb();
  if (!db) {
    return {
      id: Date.now(),
      ...payload,
      invitedLeadId: payload.invitedLeadId ?? null,
      rewardLabel: payload.rewardLabel ?? null,
      rewardValueUsd: payload.rewardValueUsd ?? null,
      qualifiedAt: payload.qualifiedAt ?? null,
      rewardedAt: payload.rewardedAt ?? null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  await db.insert(referralInvites).values(payload);
  const latest = await db.select().from(referralInvites).orderBy(desc(referralInvites.id)).limit(1);
  return latest[0] ?? null;
}

export async function updateReferralInviteStatus(input: {
  referralId: number;
  status: NonNullable<InsertReferralInvite["status"]>;
  invitedLeadId?: number | null;
  actorUserId?: number | null;
}) {
  const db = await getDb();
  const now = new Date();

  if (!db) {
    return {
      id: input.referralId,
      leadId: 0,
      code: `REF-${input.referralId}`,
      invitedLeadId: input.invitedLeadId ?? null,
      status: input.status,
      rewardLabel: "Referral reward",
      rewardValueUsd: "25.00",
      qualifiedAt: input.status === "qualified" || input.status === "rewarded" ? now : null,
      rewardedAt: input.status === "rewarded" ? now : null,
      createdAt: now,
      updatedAt: now,
    };
  }

  const current = await db.select().from(referralInvites).where(eq(referralInvites.id, input.referralId)).limit(1);
  const referral = current[0];
  if (!referral) {
    throw new Error("Referral invite not found.");
  }

  const qualifiedAt =
    input.status === "qualified" || input.status === "rewarded"
      ? referral.qualifiedAt ?? now
      : referral.qualifiedAt;
  const rewardedAt = input.status === "rewarded" ? referral.rewardedAt ?? now : referral.rewardedAt;

  await db
    .update(referralInvites)
    .set({
      status: input.status,
      invitedLeadId: input.invitedLeadId ?? referral.invitedLeadId ?? null,
      qualifiedAt,
      rewardedAt,
      updatedAt: now,
    })
    .where(eq(referralInvites.id, input.referralId));

  await createLeadEvent({
    leadId: referral.leadId,
    eventType: "system",
    title: `Referral ${referral.code} updated to ${input.status}`,
    description: "Referral status changed from admin panel.",
    actorType: "manager",
    actorUserId: input.actorUserId ?? null,
    payloadJson: JSON.stringify({
      referralId: referral.id,
      referralCode: referral.code,
      previousStatus: referral.status,
      nextStatus: input.status,
      invitedLeadId: input.invitedLeadId ?? referral.invitedLeadId ?? null,
    }),
  });

  const updated = await db.select().from(referralInvites).where(eq(referralInvites.id, input.referralId)).limit(1);
  return updated[0] ?? null;
}

export async function getReferralSummary() {
  const db = await getDb();
  if (!db) {
    return {
      total: 6,
      pending: 3,
      qualified: 2,
      rewarded: 1,
      expired: 0,
      openRewardUsd: 50,
      rewardedUsd: 25,
    };
  }

  const [row] = await db
    .select({
      total: sql<number>`count(*)`,
      pending: sql<number>`sum(case when ${referralInvites.status} = 'pending' then 1 else 0 end)`,
      qualified: sql<number>`sum(case when ${referralInvites.status} = 'qualified' then 1 else 0 end)`,
      rewarded: sql<number>`sum(case when ${referralInvites.status} = 'rewarded' then 1 else 0 end)`,
      expired: sql<number>`sum(case when ${referralInvites.status} = 'expired' then 1 else 0 end)`,
      openRewardUsd: sql<number>`sum(case when ${referralInvites.status} = 'qualified' then coalesce(${referralInvites.rewardValueUsd}, 0) else 0 end)`,
      rewardedUsd: sql<number>`sum(case when ${referralInvites.status} = 'rewarded' then coalesce(${referralInvites.rewardValueUsd}, 0) else 0 end)`,
    })
    .from(referralInvites);

  return {
    total: toNumber(row?.total),
    pending: toNumber(row?.pending),
    qualified: toNumber(row?.qualified),
    rewarded: toNumber(row?.rewarded),
    expired: toNumber(row?.expired),
    openRewardUsd: toNumber(row?.openRewardUsd),
    rewardedUsd: toNumber(row?.rewardedUsd),
  };
}

export async function getAutomationRunMetrics() {
  const db = await getDb();
  if (!db) {
    return { queued: 3, sent: 18, failed: 1, total: 22 };
  }

  const [row] = await db
    .select({
      queued: sql<number>`sum(case when ${automationRuns.status} = 'queued' then 1 else 0 end)`,
      sent: sql<number>`sum(case when ${automationRuns.status} = 'sent' then 1 else 0 end)`,
      failed: sql<number>`sum(case when ${automationRuns.status} = 'failed' then 1 else 0 end)`,
      total: sql<number>`count(*)`,
    })
    .from(automationRuns);

  return {
    queued: toNumber(row?.queued),
    sent: toNumber(row?.sent),
    failed: toNumber(row?.failed),
    total: toNumber(row?.total),
  };
}

export async function getLeadByTelegramIdentity(input: { telegramUserId?: number | null; telegramUsername?: string | null }) {
  const db = await getDb();
  if (!db) return null;

  const conditions = [] as Array<ReturnType<typeof eq>>;
  if (input.telegramUserId) {
    conditions.push(eq(leads.telegramUserId, input.telegramUserId));
  }
  if (input.telegramUsername) {
    conditions.push(eq(leads.telegramUsername, input.telegramUsername));
  }

  if (conditions.length === 0) return null;

  const rows = await db
    .select()
    .from(leads)
    .where(or(...conditions))
    .limit(1);

  return rows[0] ?? null;
}

export async function updateLeadTelegramIdentity(input: {
  leadId: number;
  telegramUserId?: number | null;
  telegramUsername?: string | null;
}) {
  const db = await getDb();
  if (!db) return { success: true, isDemo: true } as const;

  await db
    .update(leads)
    .set({
      telegramUserId: input.telegramUserId ?? null,
      telegramUsername: input.telegramUsername ?? null,
      updatedAt: new Date(),
    })
    .where(eq(leads.id, input.leadId));

  return { success: true, isDemo: false } as const;
}

type TelegramAddressableLead = {
  id: number;
  fullName: string | null;
  firstName?: string | null;
  segment: Lead["segment"];
  stage: Lead["stage"];
  temperature: Lead["temperature"];
  productInterest?: string | null;
  telegramUserId?: number | null;
  telegramUsername?: string | null;
  nextFollowUpAt?: Date | null;
  lastInteractionAt?: Date | null;
  closedWonAt?: Date | null;
};

function getLeadTelegramChatId(lead: TelegramAddressableLead) {
  if (lead.telegramUserId) {
    return lead.telegramUserId;
  }

  if (lead.telegramUsername) {
    return lead.telegramUsername.startsWith("@") ? lead.telegramUsername : `@${lead.telegramUsername}`;
  }

  return null;
}

function buildAutomationMessage(rule: {
  name: string;
  automationKey: string;
}, lead: TelegramAddressableLead) {
  const leadName = lead.firstName ?? lead.fullName ?? "клиент";
  const product = lead.productInterest ?? "решение Midea";

  switch (rule.automationKey) {
    case "hot_24h_followup":
      return {
        text: `Здравствуйте, ${leadName}. По вашему запросу на ${product} уже можно быстро перейти к расчёту и подбору модели. Если удобно, ответьте на это сообщение, и менеджер свяжется с вами в приоритетном порядке.`,
        ctaLabel: "Написать менеджеру",
        ctaUrl: "https://t.me/mideasystembot",
      };
    case "warm_nurture":
      return {
        text: `Здравствуйте, ${leadName}. Мы подготовили рекомендации по ${product}, чтобы помочь выбрать модель под вашу площадь и сценарий использования. Напишите менеджеру, если хотите получить персональную подборку.`,
        ctaLabel: "Получить подборку",
        ctaUrl: "https://t.me/mideasystembot",
      };
    case "post_purchase_cross_sell":
      return {
        text: `Здравствуйте, ${leadName}. Спасибо за выбор Midea. Мы можем подобрать дополнительные аксессуары и сервисные решения для вашего ${product}.`,
        ctaLabel: "Открыть консультацию",
        ctaUrl: "https://t.me/mideasystembot",
      };
    case "filter_renewal_reminder":
      return {
        text: `Здравствуйте, ${leadName}. Пришло время проверить ресурс фильтра и запланировать сервисное обслуживание. Мы поможем быстро подобрать расходники и удобное окно визита.`,
        ctaLabel: "Записаться на сервис",
        ctaUrl: "https://t.me/mideasystembot",
      };
    case "reactivation_inactive":
    default:
      return {
        text: `Здравствуйте, ${leadName}. Если вопрос по ${product} всё ещё актуален, мы готовы вернуться с персональным предложением и помочь завершить выбор без лишних шагов.`,
        ctaLabel: "Вернуться к диалогу",
        ctaUrl: "https://t.me/mideasystembot",
      };
  }
}

function matchesAutomationRule(rule: {
  automationKey: string;
  triggerStage?: Lead["stage"] | null;
}, lead: TelegramAddressableLead, now = new Date()) {
  const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  switch (rule.automationKey) {
    case "hot_24h_followup":
      return (
        lead.temperature === "hot" &&
        ((lead.nextFollowUpAt && lead.nextFollowUpAt <= now) ||
          lead.stage === "manager_contacted" ||
          lead.stage === "proposal_sent")
      );
    case "warm_nurture":
      return lead.temperature === "warm" && ["lead_created", "quiz_completed"].includes(lead.stage);
    case "post_purchase_cross_sell":
      return lead.stage === "sale_closed";
    case "filter_renewal_reminder":
      return Boolean(lead.closedWonAt && lead.closedWonAt <= thirtyDaysAgo);
    case "reactivation_inactive":
      return lead.stage === "lost" || Boolean(lead.lastInteractionAt && lead.lastInteractionAt <= fourteenDaysAgo);
    default:
      return rule.triggerStage ? lead.stage === rule.triggerStage : false;
  }
}

async function sendTelegramWithRetry(input: {
  chatId: string | number;
  text: string;
  imageUrl?: string | null;
  ctaLabel?: string | null;
  ctaUrl?: string | null;
  retries?: number;
}) {
  const maxAttempts = Math.max(1, input.retries ?? 2);
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await sendTelegramRichMessage({
        chatId: input.chatId,
        text: input.text,
        imageUrl: input.imageUrl,
        ctaLabel: input.ctaLabel,
        ctaUrl: input.ctaUrl,
        parseMode: "HTML",
      });
    } catch (error) {
      lastError = error;
      if (attempt === maxAttempts) {
        throw error;
      }
    }
  }

  throw lastError instanceof Error ? lastError : new Error("Telegram delivery failed");
}

async function listBroadcastTargets(segment?: Lead["segment"] | null) {
  const db = await getDb();
  if (!db) {
    return demoLeadRows.filter((lead) => (!segment || lead.segment === segment) && Boolean(getLeadTelegramChatId(lead)));
  }

  const rows = await db
    .select()
    .from(leads)
    .where(segment ? eq(leads.segment, segment) : undefined)
    .orderBy(desc(leads.updatedAt))
    .limit(300);

  return rows.filter((lead) => Boolean(getLeadTelegramChatId(lead)));
}

export async function dispatchBroadcastNow(input: {
  broadcastId: number;
  actorUserId: number;
}) {
  const db = await getDb();
  if (!db) {
    return {
      broadcastId: input.broadcastId,
      totalTargets: demoLeadRows.filter((lead) => Boolean(getLeadTelegramChatId(lead))).length,
      sentCount: demoLeadRows.filter((lead) => Boolean(getLeadTelegramChatId(lead))).length,
      failedCount: 0,
      isDemo: true,
    } as const;
  }

  const [broadcast] = await db.select().from(broadcasts).where(eq(broadcasts.id, input.broadcastId)).limit(1);
  if (!broadcast) {
    throw new Error("Broadcast not found");
  }

  const targets = await listBroadcastTargets((broadcast.segment as Lead["segment"] | null) ?? null);
  const queuedAt = new Date();
  let sentCount = 0;
  let failedCount = 0;

  await db
    .update(broadcasts)
    .set({
      status: "sending",
      updatedAt: queuedAt,
    })
    .where(eq(broadcasts.id, input.broadcastId));

  for (const lead of targets) {
    const chatId = getLeadTelegramChatId(lead);
    if (!chatId) {
      continue;
    }

    try {
      const response = (await sendTelegramWithRetry({
        chatId,
        text: broadcast.body,
        imageUrl: broadcast.imageUrl,
        ctaLabel: broadcast.ctaLabel,
        ctaUrl: broadcast.ctaUrl,
      })) as { message_id?: number };

      await logLeadCommunication({
        leadId: lead.id,
        channel: "telegram",
        direction: "outbound",
        status: "sent",
        templateKey: "broadcast",
        subject: broadcast.title,
        content: broadcast.body,
        imageUrl: broadcast.imageUrl ?? null,
        ctaLabel: broadcast.ctaLabel ?? null,
        ctaUrl: broadcast.ctaUrl ?? null,
        externalMessageId: response.message_id ? String(response.message_id) : null,
        scheduledAt: queuedAt,
        sentAt: new Date(),
        createdByUserId: input.actorUserId,
      });

      await createLeadEvent({
        leadId: lead.id,
        eventType: "broadcast_sent",
        title: `Broadcast delivered: ${broadcast.title}`,
        description: broadcast.body,
        actorType: "manager",
        actorUserId: input.actorUserId,
        payloadJson: JSON.stringify({ broadcastId: broadcast.id }),
      });

      sentCount += 1;
    } catch (error) {
      failedCount += 1;

      await logLeadCommunication({
        leadId: lead.id,
        channel: "telegram",
        direction: "outbound",
        status: "failed",
        templateKey: "broadcast",
        subject: broadcast.title,
        content: `${broadcast.body}\n\nDelivery failed: ${error instanceof Error ? error.message : "unknown error"}`,
        imageUrl: broadcast.imageUrl ?? null,
        ctaLabel: broadcast.ctaLabel ?? null,
        ctaUrl: broadcast.ctaUrl ?? null,
        externalMessageId: null,
        scheduledAt: queuedAt,
        sentAt: null,
        createdByUserId: input.actorUserId,
      });
    }
  }

  await db
    .update(broadcasts)
    .set({
      status: targets.length > 0 ? "sent" : "draft",
      sentAt: sentCount > 0 ? new Date() : null,
      updatedAt: new Date(),
    })
    .where(eq(broadcasts.id, input.broadcastId));

  return {
    broadcastId: broadcast.id,
    totalTargets: targets.length,
    sentCount,
    failedCount,
    isDemo: false,
  } as const;
}

export async function executeAutomationRunsNow(input: {
  actorUserId: number;
  ruleId?: number;
}) {
  await ensureDefaultAutomationRules();
  const db = await getDb();

  if (!db) {
    const demoTargets = demoLeadRows.filter((lead) => Boolean(getLeadTelegramChatId(lead)));
    return {
      processedRules: input.ruleId ? 1 : DEFAULT_AUTOMATIONS.filter((rule) => rule.status === "active").length,
      totalTargets: demoTargets.length,
      sentCount: demoTargets.length,
      failedCount: 0,
      isDemo: true,
    } as const;
  }

  const rules = input.ruleId
    ? await db.select().from(automationRules).where(eq(automationRules.id, input.ruleId)).limit(1)
    : await db.select().from(automationRules).where(eq(automationRules.status, "active"));

  if (rules.length === 0) {
    return {
      processedRules: 0,
      totalTargets: 0,
      sentCount: 0,
      failedCount: 0,
      isDemo: false,
    } as const;
  }

  const now = new Date();
  const leadRows = await db.select().from(leads).orderBy(desc(leads.updatedAt)).limit(300);
  let totalTargets = 0;
  let sentCount = 0;
  let failedCount = 0;

  for (const rule of rules) {
    const targets = leadRows.filter(
      (lead) => Boolean(getLeadTelegramChatId(lead)) && matchesAutomationRule(rule, lead, now)
    );

    totalTargets += targets.length;

    for (const lead of targets) {
      const chatId = getLeadTelegramChatId(lead);
      if (!chatId) {
        continue;
      }

      const message = buildAutomationMessage(rule, lead);
      const scheduledFor = new Date();

      try {
        const response = (await sendTelegramWithRetry({
          chatId,
          text: message.text,
          ctaLabel: message.ctaLabel,
          ctaUrl: message.ctaUrl,
        })) as { message_id?: number };

        await db.insert(automationRuns).values({
          automationRuleId: rule.id,
          leadId: lead.id,
          status: "sent",
          scheduledFor,
          executedAt: new Date(),
          resultSummary: `Telegram delivered to ${typeof chatId === "number" ? chatId : chatId}`,
        });

        await logLeadCommunication({
          leadId: lead.id,
          channel: "telegram",
          direction: "outbound",
          status: "sent",
          templateKey: rule.templateKey,
          subject: rule.name,
          content: message.text,
          imageUrl: null,
          ctaLabel: message.ctaLabel,
          ctaUrl: message.ctaUrl,
          externalMessageId: response.message_id ? String(response.message_id) : null,
          scheduledAt: scheduledFor,
          sentAt: new Date(),
          createdByUserId: input.actorUserId,
        });

        await createLeadEvent({
          leadId: lead.id,
          eventType: "automation_fired",
          title: `Automation delivered: ${rule.name}`,
          description: message.text,
          actorType: "system",
          actorUserId: input.actorUserId,
          payloadJson: JSON.stringify({ automationRuleId: rule.id, automationKey: rule.automationKey }),
        });

        sentCount += 1;
      } catch (error) {
        await db.insert(automationRuns).values({
          automationRuleId: rule.id,
          leadId: lead.id,
          status: "failed",
          scheduledFor,
          executedAt: new Date(),
          resultSummary: error instanceof Error ? error.message : "unknown error",
        });

        await logLeadCommunication({
          leadId: lead.id,
          channel: "telegram",
          direction: "outbound",
          status: "failed",
          templateKey: rule.templateKey,
          subject: rule.name,
          content: `${message.text}\n\nDelivery failed: ${error instanceof Error ? error.message : "unknown error"}`,
          imageUrl: null,
          ctaLabel: message.ctaLabel,
          ctaUrl: message.ctaUrl,
          externalMessageId: null,
          scheduledAt: scheduledFor,
          sentAt: null,
          createdByUserId: input.actorUserId,
        });

        failedCount += 1;
      }
    }
  }

  return {
    processedRules: rules.length,
    totalTargets,
    sentCount,
    failedCount,
    isDemo: false,
  } as const;
}

export async function listAdSpendEntries() {
  const db = await getDb();
  if (!db) {
    const demoRows: Array<{
      id: number;
      source: string;
      campaign: string;
      creative: string;
      spendUsd: number;
      notes: string | null;
      createdByUserId: number | null;
      createdAt: Date | null;
      updatedAt: Date | null;
    }> = Array.from(demoAdSpendEntries, (entry) => mapSpendEntry(entry));
    return demoRows.sort((left, right) => right.id - left.id);
  }

  const rows = await db
    .select({
      id: adSpendEntries.id,
      source: adSpendEntries.source,
      campaign: adSpendEntries.campaign,
      creative: adSpendEntries.creative,
      spendUsd: adSpendEntries.spendUsd,
      notes: adSpendEntries.notes,
      createdByUserId: adSpendEntries.createdByUserId,
      createdAt: adSpendEntries.createdAt,
      updatedAt: adSpendEntries.updatedAt,
    })
    .from(adSpendEntries)
    .orderBy(desc(adSpendEntries.updatedAt), desc(adSpendEntries.id));

  return rows.map(mapSpendEntry);
}

type UpsertAdSpendEntryInput = {
  source: string;
  campaign: string;
  creative: string;
  spendUsd: number;
  notes?: string | null;
  createdByUserId: number;
};

export async function upsertAdSpendEntry(input: UpsertAdSpendEntryInput) {
  const normalized = {
    source: input.source.trim() || "unattributed",
    campaign: input.campaign.trim() || "always-on",
    creative: input.creative.trim() || "default",
    spendUsd: Math.max(0, Number(input.spendUsd) || 0),
    notes: input.notes?.trim() || null,
  };
  const db = await getDb();

  if (!db) {
    return mapSpendEntry({
      id: Date.now(),
      source: normalized.source,
      campaign: normalized.campaign,
      creative: normalized.creative,
      spendUsd: normalized.spendUsd.toFixed(2),
      notes: normalized.notes,
      createdByUserId: input.createdByUserId,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  const [existing] = await db
    .select({ id: adSpendEntries.id })
    .from(adSpendEntries)
    .where(
      and(
        eq(adSpendEntries.source, normalized.source),
        eq(adSpendEntries.campaign, normalized.campaign),
        eq(adSpendEntries.creative, normalized.creative),
      ),
    )
    .limit(1);

  if (existing) {
    await db
      .update(adSpendEntries)
      .set({
        spendUsd: normalized.spendUsd.toFixed(2),
        notes: normalized.notes,
        createdByUserId: input.createdByUserId,
        updatedAt: new Date(),
      })
      .where(eq(adSpendEntries.id, existing.id));

    const [updated] = await db
      .select({
        id: adSpendEntries.id,
        source: adSpendEntries.source,
        campaign: adSpendEntries.campaign,
        creative: adSpendEntries.creative,
        spendUsd: adSpendEntries.spendUsd,
        notes: adSpendEntries.notes,
        createdByUserId: adSpendEntries.createdByUserId,
        createdAt: adSpendEntries.createdAt,
        updatedAt: adSpendEntries.updatedAt,
      })
      .from(adSpendEntries)
      .where(eq(adSpendEntries.id, existing.id))
      .limit(1);

    if (!updated) {
      throw new Error("Failed to reload updated ad spend entry.");
    }

    return mapSpendEntry(updated);
  }

  await db.insert(adSpendEntries).values({
    source: normalized.source,
    campaign: normalized.campaign,
    creative: normalized.creative,
    spendUsd: normalized.spendUsd.toFixed(2),
    notes: normalized.notes,
    createdByUserId: input.createdByUserId,
  });

  const [created] = await db
    .select({
      id: adSpendEntries.id,
      source: adSpendEntries.source,
      campaign: adSpendEntries.campaign,
      creative: adSpendEntries.creative,
      spendUsd: adSpendEntries.spendUsd,
      notes: adSpendEntries.notes,
      createdByUserId: adSpendEntries.createdByUserId,
      createdAt: adSpendEntries.createdAt,
      updatedAt: adSpendEntries.updatedAt,
    })
    .from(adSpendEntries)
    .where(
      and(
        eq(adSpendEntries.source, normalized.source),
        eq(adSpendEntries.campaign, normalized.campaign),
        eq(adSpendEntries.creative, normalized.creative),
      ),
    )
    .orderBy(desc(adSpendEntries.id))
    .limit(1);

  if (!created) {
    throw new Error("Failed to reload created ad spend entry.");
  }

  return mapSpendEntry(created);
}

export async function getLeadPipelineSummary(scope?: LeadAccessScope) {
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
  const includeSpend = !scope || scope.role === "admin";

  if (!db) {
    const rows = scopeLeadRows(demoLeadRows, scope).map((lead) => {
      const attribution = demoAttributionByLeadId[lead.id as keyof typeof demoAttributionByLeadId];

      return {
        ...lead,
        adSource: attribution?.source ?? null,
        adCampaign: attribution?.campaign ?? null,
        adCreative: attribution?.creative ?? null,
        utmSource: attribution?.source ?? null,
        utmCampaign: attribution?.campaign ?? null,
      };
    });

    return buildAcquisitionAnalytics(rows, includeSpend ? demoAdSpendEntries : []);
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

  const spendRows = includeSpend
    ? await db
        .select({
          id: adSpendEntries.id,
          source: adSpendEntries.source,
          campaign: adSpendEntries.campaign,
          creative: adSpendEntries.creative,
          spendUsd: adSpendEntries.spendUsd,
          notes: adSpendEntries.notes,
          createdByUserId: adSpendEntries.createdByUserId,
          createdAt: adSpendEntries.createdAt,
          updatedAt: adSpendEntries.updatedAt,
        })
        .from(adSpendEntries)
    : [];

  return buildAcquisitionAnalytics(rows, spendRows);
}
