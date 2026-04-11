from pathlib import Path

path = Path('/home/ubuntu/midea-digital-contour-admin/server/routers.ts')
text = path.read_text()

text = text.replace(
'''  getLeadByTelegramIdentity,
  getLeadDetail,
  getLeadPipelineSummary,
  listAutomationRules,
''',
'''  getLeadAcquisitionAnalytics,
  getLeadByTelegramIdentity,
  getLeadDetail,
  getLeadFunnelAnalytics,
  getLeadPipelineSummary,
  listAutomationRules,
''')

insert_after = '''const referralInput = z.object({
  leadId: z.number().int().positive(),
  code: z.string().trim().min(4).max(64),
  rewardLabel: z.string().trim().max(255).optional(),
  rewardValueUsd: z.string().trim().max(32).optional(),
});
'''
helper_block = '''const referralInput = z.object({
  leadId: z.number().int().positive(),
  code: z.string().trim().min(4).max(64),
  rewardLabel: z.string().trim().max(255).optional(),
  rewardValueUsd: z.string().trim().max(32).optional(),
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
  await notifyOwner({
    title: `Lead #${input.leadId} moved to ${input.stage}`,
    content: `Пользователь ${input.actorName} перевёл лида ${input.leadName ?? `#${input.leadId}`} в стадию ${input.stage}${input.statusReason ? `. Причина: ${input.statusReason}` : ""}.`,
  }).catch(() => false);
};
'''

if insert_after not in text:
    raise SystemExit('referral input block not found')
text = text.replace(insert_after, helper_block)

text = text.replace(
'''  dashboard: router({
    overview: protectedProcedure.query(async () => getDashboardSnapshot()),
    managers: protectedProcedure.query(async () => listManagers()),
    pipeline: protectedProcedure.query(async () => getLeadPipelineSummary()),
    automationsHealth: protectedProcedure.query(async () => getAutomationRunMetrics()),
  }),
''',
'''  dashboard: router({
    overview: protectedProcedure.query(async ({ ctx }) => getDashboardSnapshot(getLeadAccessScope(ctx))),
    managers: protectedProcedure.query(async ({ ctx }) => listManagers(getLeadAccessScope(ctx))),
    pipeline: protectedProcedure.query(async ({ ctx }) => getLeadPipelineSummary(getLeadAccessScope(ctx))),
    funnel: protectedProcedure.query(async ({ ctx }) => getLeadFunnelAnalytics(getLeadAccessScope(ctx))),
    acquisition: protectedProcedure.query(async ({ ctx }) => getLeadAcquisitionAnalytics(getLeadAccessScope(ctx))),
    automationsHealth: protectedProcedure.query(async () => getAutomationRunMetrics()),
  }),
''')

text = text.replace(
'''  leads: router({
    list: protectedProcedure.input(leadListInput.optional()).query(async ({ input }) => listLeads(input)),
    detail: protectedProcedure
      .input(z.object({ leadId: z.number().int().positive() }))
      .query(async ({ input }) => getLeadDetail(input.leadId)),
    updateStage: protectedProcedure.input(leadStageInput).mutation(async ({ ctx, input }) => {
      const result = await updateLeadStage({
        leadId: input.leadId,
        stage: input.stage,
        statusReason: input.statusReason,
        actorUserId: ctx.user.id,
      });

      return result;
    }),
    addNote: protectedProcedure.input(leadNoteInput).mutation(async ({ ctx, input }) => {
      return addLeadNote({
        leadId: input.leadId,
        authorUserId: ctx.user.id,
        note: input.note,
        isPrivate: input.isPrivate,
      });
    }),
    createTask: protectedProcedure.input(leadTaskInput).mutation(async ({ input }) => {
      return createLeadTask({
        leadId: input.leadId,
        title: input.title,
        description: input.description,
        assignedToUserId: input.assignedToUserId,
        dueAt: input.dueAt,
        priority: input.priority,
      });
    }),
    linkTelegramIdentity: adminProcedure.input(linkTelegramLeadInput).mutation(async ({ input }) => {
      return updateLeadTelegramIdentity(input);
    }),
  }),
''',
'''  leads: router({
    list: protectedProcedure
      .input(leadListInput.optional())
      .query(async ({ ctx, input }) => listLeads(input, getLeadAccessScope(ctx))),
    detail: protectedProcedure
      .input(z.object({ leadId: z.number().int().positive() }))
      .query(async ({ ctx, input }) => getLeadDetail(input.leadId, getLeadAccessScope(ctx))),
    updateStage: protectedProcedure.input(leadStageInput).mutation(async ({ ctx, input }) => {
      const detail = await getLeadDetail(input.leadId, getLeadAccessScope(ctx));
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
        leadName: detail?.lead?.fullName,
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
''')

text = text.replace(
'''    sendLeadPing: adminProcedure.input(telegramLeadPingInput).mutation(async ({ ctx, input }) => {
      const detail = await getLeadDetail(input.leadId);
      if (!detail?.lead) {
        throw new Error("Lead not found.");
      }

      const chatId = detail.lead.telegramUserId ?? detail.lead.telegramUsername;
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
        templateKey: "manual-admin-ping",
        subject: "Manual Telegram ping",
        content: input.text,
        externalMessageId: String((result as { message_id?: number }).message_id ?? ""),
        sentAt: new Date(),
        createdByUserId: ctx.user.id,
      });

      return result;
    }),
''',
'''    sendLeadPing: protectedProcedure.input(telegramLeadPingInput).mutation(async ({ ctx, input }) => {
      const detail = await getLeadDetail(input.leadId, getLeadAccessScope(ctx));
      if (!detail?.lead) {
        throw new Error("Lead not found or access denied.");
      }

      const chatId = detail.lead.telegramUserId ?? detail.lead.telegramUsername;
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
        content: `Пользователь ${ctx.user.name ?? ctx.user.openId} отправил ручное Telegram-сообщение лиду ${detail.lead.fullName}.`,
      }).catch(() => false);

      return result;
    }),
''')

path.write_text(text)
