import type { NotificationPayload } from "./_core/notification";

export type LeadStageOwnerNotificationInput = {
  actorName: string;
  leadId: number;
  leadName?: string | null;
  stage: string;
  statusReason?: string | null;
};

const HOT_LEAD_STAGES = new Set(["manager_contacted", "proposal_sent"]);

const formatLeadLabel = (input: Pick<LeadStageOwnerNotificationInput, "leadId" | "leadName">) =>
  input.leadName?.trim() ? `${input.leadName.trim()} (#${input.leadId})` : `#${input.leadId}`;

const appendReason = (statusReason?: string | null) =>
  statusReason?.trim() ? ` Причина: ${statusReason.trim()}.` : "";

export const isHotLeadStage = (stage: string) => HOT_LEAD_STAGES.has(stage);

export function buildLeadStageOwnerNotification(
  input: LeadStageOwnerNotificationInput
): NotificationPayload {
  const leadLabel = formatLeadLabel(input);

  if (input.stage === "quiz_completed") {
    return {
      title: `Quiz completed: ${leadLabel}`,
      content: `Пользователь ${input.actorName} перевёл лида ${leadLabel} в стадию quiz_completed. Лид завершил квиз и готов к следующему qualification step.${appendReason(input.statusReason)}`,
    };
  }

  if (input.stage === "sale_closed") {
    return {
      title: `Closed sale: ${leadLabel}`,
      content: `Пользователь ${input.actorName} закрыл сделку по лиду ${leadLabel}. Стадия обновлена на sale_closed.${appendReason(input.statusReason)}`,
    };
  }

  if (isHotLeadStage(input.stage)) {
    return {
      title: `Hot lead: ${leadLabel}`,
      content: `Пользователь ${input.actorName} перевёл лида ${leadLabel} в горячую стадию ${input.stage}. Требуется быстрый контроль follow-up и результата менеджера.${appendReason(input.statusReason)}`,
    };
  }

  return {
    title: `Lead #${input.leadId} moved to ${input.stage}`,
    content: `Пользователь ${input.actorName} перевёл лида ${leadLabel} в стадию ${input.stage}.${appendReason(input.statusReason)}`,
  };
}
