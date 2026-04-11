import { COOKIE_NAME } from "@shared/const";
import { z } from "zod";
import {
  automationStatuses,
  leadSegments,
  leadStages,
  leadTemperatures,
  taskPriorities,
} from "../drizzle/schema";
import { getSessionCookieOptions } from "./_core/cookies";
import { notifyOwner } from "./_core/notification";
import { systemRouter } from "./_core/systemRouter";
import { adminProcedure, protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { buildLeadStageOwnerNotification } from "./ownerNotifications";
import {
  addLeadNote,
  createBroadcastDraft,
  createLeadTask,
  dispatchBroadcastNow,
  executeAutomationRunsNow,
  createReferralInvite,
  getAutomationRunMetrics,
  getDashboardSnapshot,
  getLeadAcquisitionAnalytics,
  getLeadByTelegramIdentity,
  getLeadDetail,
  getLeadFunnelAnalytics,
  getLeadPipelineSummary,
  listAdSpendEntries,
  listAutomationRules,
  listBroadcasts,
  listLeads,
  listManagers,
  logLeadCommunication,
  updateAutomationRuleStatus,
  updateLeadStage,
  updateLeadTelegramIdentity,
  upsertAdSpendEntry,
} from "./db";
import { getTelegramBotProfile, sendTelegramMessage } from "./telegram";

const leadListInput = z.object({
  query: z.string().trim().optional(),
  stage: z.enum(["all", ...leadStages]).optional(),
  segment: z.enum(["all", ...leadSegments]).optional(),
  temperature: z.enum(["all", ...leadTemperatures]).optional(),
  assignedManagerId: z.number().int().nullable().optional(),
});

const leadStageInput = z.object({
  leadId: z.number().int().positive(),
  stage: z.enum(leadStages),
  statusReason: z.string().trim().max(255).nullable().optional(),
});

const leadNoteInput = z.object({
  leadId: z.number().int().positive(),
  note: z.string().trim().min(3).max(5000),
  isPrivate: z.boolean().optional(),
});

const leadTaskInput = z.object({
  leadId: z.number().int().positive(),
  title: z.string().trim().min(3).max(255),
  description: z.string().trim().max(2000).optional(),
  assignedToUserId: z.number().int().positive().nullable().optional(),
  dueAt: z.coerce.date().nullable().optional(),
  priority: z.enum(taskPriorities).optional(),
});

const automationStatusInput = z.object({
  ruleId: z.number().int().positive(),
  status: z.enum(automationStatuses),
});

const broadcastDraftInput = z.object({
  title: z.string().trim().min(3).max(255),
  body: z.string().trim().min(10).max(20000),
  segment: z.enum(leadSegments).nullable().optional(),
  ctaLabel: z.string().trim().max(128).nullable().optional(),
  ctaUrl: z.string().trim().url().nullable().optional(),
  scheduledAt: z.coerce.date().nullable().optional(),
});

const telegramTestMessageInput = z.object({
  chatId: z.union([z.string().trim().min(1), z.number().int()]),
  text: z.string().trim().min(1).max(4000),
});

const telegramLeadPingInput = z.object({
  leadId: z.number().int().positive(),
  text: z.string().trim().min(1).max(4000),
});

const linkTelegramLeadInput = z.object({
  leadId: z.number().int().positive(),
  telegramUserId: z.number().int().positive().nullable().optional(),
  telegramUsername: z.string().trim().max(128).nullable().optional(),
});

const referralInput = z.object({
  leadId: z.number().int().positive(),
  code: z.string().trim().min(4).max(64),
  rewardLabel: z.string().trim().max(255).optional(),
  rewardValueUsd: z.string().trim().max(32).optional(),
});

const adSpendEntryInput = z.object({
  source: z.string().trim().min(1).max(128),
  campaign: z.string().trim().min(1).max(128),
  creative: z.string().trim().min(1).max(128),
  spendUsd: z.coerce.number().min(0).max(1_000_000),
  notes: z.string().trim().max(1000).nullable().optional(),
});

const getLeadAccessScope = (ctx: { user: { id: number; role: "user" | "manager" | "admin" } }) => ({
  userId: ctx.user.id,
  role: ctx.user.role,
});

const assertTaskAssignmentPermission = (
  ctx: { user: { id: number; role: "user" | "manager" | "admin" } },
  assignedToUserId?: number | null,
) => {
  if (ctx.user.role !== "admin" && assignedToUserId && assignedToUserId !== ctx.user.id) {
    throw new Error("Managers can only assign tasks to themselves.");
  }
};

const notifyLeadStageChange = async (input: {
  actorName: string;
  leadId: number;
  leadName?: string | null;
  stage: string;
  statusReason?: string | null;
}) => {
  await notifyOwner(buildLeadStageOwnerNotification(input)).catch(() => false);
};

const toLeadIdentity = (lead: unknown) =>
  lead as {
    fullName?: string | null;
    telegramUserId?: number | null;
    telegramUsername?: string | null;
  };

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),
  dashboard: router({
    overview: protectedProcedure.query(async ({ ctx }) => getDashboardSnapshot(getLeadAccessScope(ctx))),
    managers: protectedProcedure.query(async ({ ctx }) => listManagers(getLeadAccessScope(ctx))),
    pipeline: protectedProcedure.query(async ({ ctx }) => getLeadPipelineSummary(getLeadAccessScope(ctx))),
    funnel: protectedProcedure.query(async ({ ctx }) => getLeadFunnelAnalytics(getLeadAccessScope(ctx))),
    acquisition: protectedProcedure.query(async ({ ctx }) => getLeadAcquisitionAnalytics(getLeadAccessScope(ctx))),
    spendEntries: adminProcedure.query(async () => listAdSpendEntries()),
    saveSpendEntry: adminProcedure.input(adSpendEntryInput).mutation(async ({ ctx, input }) => {
      const saved = await upsertAdSpendEntry({
        ...input,
        createdByUserId: ctx.user.id,
      });

      await notifyOwner({
        title: `Ad spend updated: ${input.source} / ${input.campaign}`,
        content: `Пользователь ${ctx.user.name ?? ctx.user.openId} обновил safe-mode spend для ${input.source} / ${input.campaign} / ${input.creative}. Новое значение: $${input.spendUsd}.`,
      }).catch(() => false);

      return saved;
    }),
    automationsHealth: protectedProcedure.query(async () => getAutomationRunMetrics()),
  }),
  leads: router({
    list: protectedProcedure
      .input(leadListInput.optional())
      .query(async ({ ctx, input }) => listLeads(input, getLeadAccessScope(ctx))),
    detail: protectedProcedure
      .input(z.object({ leadId: z.number().int().positive() }))
      .query(async ({ ctx, input }) => getLeadDetail(input.leadId, getLeadAccessScope(ctx))),
    updateStage: protectedProcedure.input(leadStageInput).mutation(async ({ ctx, input }) => {
      const detail = await getLeadDetail(input.leadId, getLeadAccessScope(ctx));
      const scopedLead = detail?.lead ? toLeadIdentity(detail.lead) : null;
      const result = await updateLeadStage({
        leadId: input.leadId,
        stage: input.stage,
        statusReason: input.statusReason,
        actorUserId: ctx.user.id,
        accessScope: getLeadAccessScope(ctx),
      });

      await notifyLeadStageChange({
        actorName: ctx.user.name ?? ctx.user.openId,
        leadId: input.leadId,
        leadName: scopedLead?.fullName,
        stage: input.stage,
        statusReason: input.statusReason,
      });

      return result;
    }),
    addNote: protectedProcedure.input(leadNoteInput).mutation(async ({ ctx, input }) => {
      return addLeadNote({
        leadId: input.leadId,
        authorUserId: ctx.user.id,
        note: input.note,
        isPrivate: input.isPrivate,
        accessScope: getLeadAccessScope(ctx),
      });
    }),
    createTask: protectedProcedure.input(leadTaskInput).mutation(async ({ ctx, input }) => {
      assertTaskAssignmentPermission(ctx, input.assignedToUserId);

      return createLeadTask({
        leadId: input.leadId,
        title: input.title,
        description: input.description,
        assignedToUserId: ctx.user.role === "admin" ? input.assignedToUserId : ctx.user.id,
        dueAt: input.dueAt,
        priority: input.priority,
        accessScope: getLeadAccessScope(ctx),
      });
    }),
    linkTelegramIdentity: adminProcedure.input(linkTelegramLeadInput).mutation(async ({ input }) => {
      return updateLeadTelegramIdentity(input);
    }),
  }),
  automations: router({
    list: protectedProcedure.query(async () => listAutomationRules()),
    setStatus: adminProcedure.input(automationStatusInput).mutation(async ({ input, ctx }) => {
      const updated = await updateAutomationRuleStatus(input);
      await notifyOwner({
        title: `Automation ${input.ruleId} switched to ${input.status}`,
        content: `Пользователь ${ctx.user.name ?? ctx.user.openId} изменил статус automation rule #${input.ruleId} на ${input.status}.`,
      }).catch(() => false);
      return updated;
    }),
    executeNow: adminProcedure
      .input(z.object({ ruleId: z.number().int().positive().optional() }).optional())
      .mutation(async ({ input, ctx }) => {
        const result = await executeAutomationRunsNow({
          actorUserId: ctx.user.id,
          ruleId: input?.ruleId,
        });

        await notifyOwner({
          title: "Automation execution started",
          content: `Пользователь ${ctx.user.name ?? ctx.user.openId} запустил execution-layer automation${input?.ruleId ? ` для rule #${input.ruleId}` : " для всех активных правил"}. Обработано правил: ${result.processedRules}, отправлено: ${result.sentCount}, ошибок: ${result.failedCount}.`,
        }).catch(() => false);

        return result;
      }),
    metrics: protectedProcedure.query(async () => getAutomationRunMetrics()),
  }),
  broadcasts: router({
    list: protectedProcedure.query(async () => listBroadcasts()),
    createDraft: adminProcedure.input(broadcastDraftInput).mutation(async ({ ctx, input }) => {
      const draft = await createBroadcastDraft({
        ...input,
        createdByUserId: ctx.user.id,
      });

      await notifyOwner({
        title: `Broadcast draft created: ${input.title}`,
        content: `Создан новый broadcast draft для сегмента ${input.segment ?? "all"}. Автор: ${ctx.user.name ?? ctx.user.openId}.`,
      }).catch(() => false);

      return draft;
    }),
    dispatchNow: adminProcedure
      .input(z.object({ broadcastId: z.number().int().positive() }))
      .mutation(async ({ ctx, input }) => {
        const result = await dispatchBroadcastNow({
          broadcastId: input.broadcastId,
          actorUserId: ctx.user.id,
        });

        await notifyOwner({
          title: `Broadcast dispatched: #${input.broadcastId}`,
          content: `Пользователь ${ctx.user.name ?? ctx.user.openId} запустил реальную Telegram-рассылку broadcast #${input.broadcastId}. Целей: ${result.totalTargets}, успешно: ${result.sentCount}, ошибок: ${result.failedCount}.`,
        }).catch(() => false);

        return result;
      }),
  }),
  telegram: router({
    profile: protectedProcedure.query(async () => getTelegramBotProfile()),
    sendTestMessage: adminProcedure.input(telegramTestMessageInput).mutation(async ({ ctx, input }) => {
      const result = await sendTelegramMessage({
        chatId: input.chatId,
        text: input.text,
      });

      await notifyOwner({
        title: "Telegram test message sent",
        content: `Пользователь ${ctx.user.name ?? ctx.user.openId} отправил тестовое Telegram-сообщение в chat ${input.chatId}.`,
      }).catch(() => false);

      return result;
    }),
    sendLeadPing: protectedProcedure.input(telegramLeadPingInput).mutation(async ({ ctx, input }) => {
      const detail = await getLeadDetail(input.leadId, getLeadAccessScope(ctx));
      if (!detail?.lead) {
        throw new Error("Lead not found or access denied.");
      }

      const lead = toLeadIdentity(detail.lead);
      const chatId = lead.telegramUserId ?? lead.telegramUsername;
      if (!chatId) {
        throw new Error("Lead has no Telegram identity linked yet.");
      }

      const result = await sendTelegramMessage({
        chatId,
        text: input.text,
      });

      await logLeadCommunication({
        leadId: input.leadId,
        channel: "telegram",
        direction: "outbound",
        status: "sent",
        templateKey: ctx.user.role === "admin" ? "manual-admin-ping" : "manual-manager-ping",
        subject: "Manual Telegram ping",
        content: input.text,
        externalMessageId: String((result as { message_id?: number }).message_id ?? ""),
        sentAt: new Date(),
        createdByUserId: ctx.user.id,
      });

      await notifyOwner({
        title: `Telegram ping sent to lead #${input.leadId}`,
        content: `Пользователь ${ctx.user.name ?? ctx.user.openId} отправил ручное Telegram-сообщение лиду ${lead.fullName ?? `#${input.leadId}`}.`,
      }).catch(() => false);

      return result;
    }),
    findLinkedLead: adminProcedure
      .input(z.object({ telegramUserId: z.number().int().positive().nullable().optional(), telegramUsername: z.string().trim().nullable().optional() }))
      .query(async ({ input }) => getLeadByTelegramIdentity(input)),
  }),
  referrals: router({
    create: adminProcedure.input(referralInput).mutation(async ({ input, ctx }) => {
      const referral = await createReferralInvite({
        leadId: input.leadId,
        code: input.code,
        status: "pending",
        rewardLabel: input.rewardLabel ?? null,
        rewardValueUsd: input.rewardValueUsd ?? null,
      });

      await notifyOwner({
        title: `Referral code created for lead #${input.leadId}`,
        content: `Пользователь ${ctx.user.name ?? ctx.user.openId} создал referral code ${input.code}.`,
      }).catch(() => false);

      return referral;
    }),
  }),
});

export type AppRouter = typeof appRouter;
