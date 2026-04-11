import {
  bigint,
  decimal,
  int,
  longtext,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/mysql-core";

export const userRoles = ["user", "manager", "admin"] as const;
export const leadSegments = ["alba", "welkin", "combo", "consult"] as const;
export const leadStages = [
  "ad_click",
  "landing",
  "bot_start",
  "quiz_started",
  "quiz_completed",
  "lead_created",
  "manager_contacted",
  "proposal_sent",
  "sale_closed",
  "lost",
  "reactivated",
  "repeat_sale",
] as const;
export const leadTemperatures = ["cold", "warm", "hot", "won", "lost"] as const;
export const eventTypes = [
  "ad_click",
  "landing_view",
  "cta_click_to_bot",
  "bot_start",
  "quiz_started",
  "quiz_answered",
  "quiz_completed",
  "result_assigned",
  "lead_created",
  "stage_changed",
  "manager_note",
  "manager_contacted",
  "telegram_message_sent",
  "telegram_message_received",
  "broadcast_sent",
  "automation_fired",
  "crm_status_synced",
  "sale_closed",
  "referral_created",
  "task_created",
  "task_completed",
  "system",
] as const;
export const communicationChannels = ["telegram", "amo_crm", "phone", "email", "internal"] as const;
export const communicationDirections = ["inbound", "outbound", "system"] as const;
export const communicationStatuses = ["draft", "scheduled", "sent", "delivered", "failed"] as const;
export const automationKeys = [
  "hot_24h_followup",
  "warm_nurture",
  "post_purchase_cross_sell",
  "filter_renewal_reminder",
  "reactivation_inactive",
] as const;
export const automationStatuses = ["draft", "active", "paused", "archived"] as const;
export const automationRunStatuses = ["queued", "sent", "skipped", "failed"] as const;
export const referralStatuses = ["pending", "qualified", "rewarded", "expired"] as const;
export const taskStatuses = ["todo", "in_progress", "done", "blocked"] as const;
export const taskPriorities = ["low", "medium", "high", "critical"] as const;
export const broadcastStatuses = ["draft", "scheduled", "sending", "sent", "cancelled"] as const;

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", userRoles).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export const leads = mysqlTable("leads", {
  id: int("id").autoincrement().primaryKey(),
  externalLeadId: varchar("externalLeadId", { length: 128 }),
  crmLeadId: varchar("crmLeadId", { length: 128 }),
  crmContactId: varchar("crmContactId", { length: 128 }),
  fullName: varchar("fullName", { length: 255 }).notNull(),
  phone: varchar("phone", { length: 64 }),
  telegramUserId: bigint("telegramUserId", { mode: "number" }),
  telegramUsername: varchar("telegramUsername", { length: 128 }),
  language: varchar("language", { length: 16 }).default("ru").notNull(),
  city: varchar("city", { length: 128 }),
  roomType: varchar("roomType", { length: 128 }),
  roomAreaSqm: int("roomAreaSqm"),
  householdProfile: varchar("householdProfile", { length: 255 }),
  painPoint: varchar("painPoint", { length: 255 }),
  purchaseTimeline: varchar("purchaseTimeline", { length: 128 }),
  productInterest: varchar("productInterest", { length: 128 }),
  segment: mysqlEnum("segment", leadSegments).default("consult").notNull(),
  stage: mysqlEnum("stage", leadStages).default("lead_created").notNull(),
  temperature: mysqlEnum("temperature", leadTemperatures).default("warm").notNull(),
  statusReason: varchar("statusReason", { length: 255 }),
  score: int("score").default(0).notNull(),
  expectedRevenueUsd: decimal("expectedRevenueUsd", { precision: 10, scale: 2 }),
  assignedManagerId: int("assignedManagerId"),
  referralCode: varchar("referralCode", { length: 64 }),
  referredByLeadId: int("referredByLeadId"),
  adSource: varchar("adSource", { length: 128 }),
  adCampaign: varchar("adCampaign", { length: 255 }),
  adSet: varchar("adSet", { length: 255 }),
  adCreative: varchar("adCreative", { length: 255 }),
  landingPath: varchar("landingPath", { length: 255 }),
  utmSource: varchar("utmSource", { length: 255 }),
  utmMedium: varchar("utmMedium", { length: 255 }),
  utmCampaign: varchar("utmCampaign", { length: 255 }),
  utmTerm: varchar("utmTerm", { length: 255 }),
  utmContent: varchar("utmContent", { length: 255 }),
  lastInteractionAt: timestamp("lastInteractionAt"),
  nextFollowUpAt: timestamp("nextFollowUpAt"),
  firstQualifiedAt: timestamp("firstQualifiedAt"),
  closedWonAt: timestamp("closedWonAt"),
  lostAt: timestamp("lostAt"),
  summary: text("summary"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const quizSessions = mysqlTable("quizSessions", {
  id: int("id").autoincrement().primaryKey(),
  leadId: int("leadId").notNull(),
  startedAt: timestamp("startedAt").defaultNow().notNull(),
  completedAt: timestamp("completedAt"),
  resultSegment: mysqlEnum("resultSegment", leadSegments),
  resultTitle: varchar("resultTitle", { length: 255 }),
  completionRate: int("completionRate").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const quizAnswers = mysqlTable("quizAnswers", {
  id: int("id").autoincrement().primaryKey(),
  quizSessionId: int("quizSessionId").notNull(),
  leadId: int("leadId").notNull(),
  questionKey: varchar("questionKey", { length: 128 }).notNull(),
  questionLabel: varchar("questionLabel", { length: 255 }).notNull(),
  answerValue: text("answerValue").notNull(),
  answerOrder: int("answerOrder").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const leadEvents = mysqlTable("leadEvents", {
  id: int("id").autoincrement().primaryKey(),
  leadId: int("leadId").notNull(),
  eventType: mysqlEnum("eventType", eventTypes).notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  payloadJson: longtext("payloadJson"),
  actorType: varchar("actorType", { length: 64 }).default("system").notNull(),
  actorUserId: int("actorUserId"),
  occurredAt: timestamp("occurredAt").defaultNow().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const leadNotes = mysqlTable("leadNotes", {
  id: int("id").autoincrement().primaryKey(),
  leadId: int("leadId").notNull(),
  authorUserId: int("authorUserId").notNull(),
  note: text("note").notNull(),
  isPrivate: int("isPrivate").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const leadCommunications = mysqlTable("leadCommunications", {
  id: int("id").autoincrement().primaryKey(),
  leadId: int("leadId").notNull(),
  channel: mysqlEnum("channel", communicationChannels).default("telegram").notNull(),
  direction: mysqlEnum("direction", communicationDirections).default("outbound").notNull(),
  status: mysqlEnum("status", communicationStatuses).default("draft").notNull(),
  templateKey: varchar("templateKey", { length: 128 }),
  subject: varchar("subject", { length: 255 }),
  content: longtext("content").notNull(),
  imageUrl: varchar("imageUrl", { length: 512 }),
  ctaLabel: varchar("ctaLabel", { length: 128 }),
  ctaUrl: varchar("ctaUrl", { length: 512 }),
  externalMessageId: varchar("externalMessageId", { length: 255 }),
  scheduledAt: timestamp("scheduledAt"),
  sentAt: timestamp("sentAt"),
  createdByUserId: int("createdByUserId"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const broadcasts = mysqlTable("broadcasts", {
  id: int("id").autoincrement().primaryKey(),
  title: varchar("title", { length: 255 }).notNull(),
  segment: mysqlEnum("segment", leadSegments),
  status: mysqlEnum("status", broadcastStatuses).default("draft").notNull(),
  body: longtext("body").notNull(),
  imageUrl: varchar("imageUrl", { length: 512 }),
  ctaLabel: varchar("ctaLabel", { length: 128 }),
  ctaUrl: varchar("ctaUrl", { length: 512 }),
  scheduledAt: timestamp("scheduledAt"),
  sentAt: timestamp("sentAt"),
  createdByUserId: int("createdByUserId"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const automationRules = mysqlTable("automationRules", {
  id: int("id").autoincrement().primaryKey(),
  automationKey: mysqlEnum("automationKey", automationKeys).notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  status: mysqlEnum("status", automationStatuses).default("active").notNull(),
  triggerStage: mysqlEnum("triggerStage", leadStages),
  delayMinutes: int("delayMinutes").default(0).notNull(),
  targetChannel: mysqlEnum("targetChannel", communicationChannels).default("telegram").notNull(),
  templateKey: varchar("templateKey", { length: 128 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const automationRuns = mysqlTable("automationRuns", {
  id: int("id").autoincrement().primaryKey(),
  automationRuleId: int("automationRuleId").notNull(),
  leadId: int("leadId").notNull(),
  status: mysqlEnum("status", automationRunStatuses).default("queued").notNull(),
  scheduledFor: timestamp("scheduledFor"),
  executedAt: timestamp("executedAt"),
  resultSummary: text("resultSummary"),
  errorMessage: text("errorMessage"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const referralInvites = mysqlTable("referralInvites", {
  id: int("id").autoincrement().primaryKey(),
  leadId: int("leadId").notNull(),
  code: varchar("code", { length: 64 }).notNull().unique(),
  invitedLeadId: int("invitedLeadId"),
  status: mysqlEnum("status", referralStatuses).default("pending").notNull(),
  rewardLabel: varchar("rewardLabel", { length: 255 }),
  rewardValueUsd: decimal("rewardValueUsd", { precision: 10, scale: 2 }),
  qualifiedAt: timestamp("qualifiedAt"),
  rewardedAt: timestamp("rewardedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const crmWebhookEvents = mysqlTable("crmWebhookEvents", {
  id: int("id").autoincrement().primaryKey(),
  leadId: int("leadId"),
  amoEventId: varchar("amoEventId", { length: 128 }),
  eventName: varchar("eventName", { length: 255 }).notNull(),
  payloadJson: longtext("payloadJson").notNull(),
  processedAt: timestamp("processedAt"),
  status: varchar("status", { length: 64 }).default("received").notNull(),
  errorMessage: text("errorMessage"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const adSpendEntries = mysqlTable("adSpendEntries", {
  id: int("id").autoincrement().primaryKey(),
  source: varchar("source", { length: 255 }).notNull(),
  campaign: varchar("campaign", { length: 255 }).notNull(),
  creative: varchar("creative", { length: 255 }).notNull(),
  spendUsd: decimal("spendUsd", { precision: 10, scale: 2 }).default("0.00").notNull(),
  notes: text("notes"),
  createdByUserId: int("createdByUserId"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const leadTasks = mysqlTable("leadTasks", {
  id: int("id").autoincrement().primaryKey(),
  leadId: int("leadId").notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  status: mysqlEnum("status", taskStatuses).default("todo").notNull(),
  priority: mysqlEnum("priority", taskPriorities).default("medium").notNull(),
  assignedToUserId: int("assignedToUserId"),
  dueAt: timestamp("dueAt"),
  completedAt: timestamp("completedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

export type Lead = typeof leads.$inferSelect;
export type InsertLead = typeof leads.$inferInsert;

export type QuizSession = typeof quizSessions.$inferSelect;
export type InsertQuizSession = typeof quizSessions.$inferInsert;

export type QuizAnswer = typeof quizAnswers.$inferSelect;
export type InsertQuizAnswer = typeof quizAnswers.$inferInsert;

export type LeadEvent = typeof leadEvents.$inferSelect;
export type InsertLeadEvent = typeof leadEvents.$inferInsert;

export type LeadNote = typeof leadNotes.$inferSelect;
export type InsertLeadNote = typeof leadNotes.$inferInsert;

export type LeadCommunication = typeof leadCommunications.$inferSelect;
export type InsertLeadCommunication = typeof leadCommunications.$inferInsert;

export type Broadcast = typeof broadcasts.$inferSelect;
export type InsertBroadcast = typeof broadcasts.$inferInsert;

export type AutomationRule = typeof automationRules.$inferSelect;
export type InsertAutomationRule = typeof automationRules.$inferInsert;

export type AutomationRun = typeof automationRuns.$inferSelect;
export type InsertAutomationRun = typeof automationRuns.$inferInsert;

export type ReferralInvite = typeof referralInvites.$inferSelect;
export type InsertReferralInvite = typeof referralInvites.$inferInsert;

export type CrmWebhookEvent = typeof crmWebhookEvents.$inferSelect;
export type InsertCrmWebhookEvent = typeof crmWebhookEvents.$inferInsert;

export type AdSpendEntry = typeof adSpendEntries.$inferSelect;
export type InsertAdSpendEntry = typeof adSpendEntries.$inferInsert;

export type LeadTask = typeof leadTasks.$inferSelect;
export type InsertLeadTask = typeof leadTasks.$inferInsert;
