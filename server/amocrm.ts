import { eq, or } from "drizzle-orm";
import { crmWebhookEvents, leadStages, leads, type Lead } from "../drizzle/schema";
import { createLeadEvent, getDb } from "./db";

export type AmoWebhookPayload = Record<string, unknown>;

const LOCAL_STAGES = new Set<string>(leadStages);

const toPlainRecord = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;

const toRecordArray = (value: unknown): Record<string, unknown>[] => {
  if (Array.isArray(value)) {
    return value.map((entry) => toPlainRecord(entry)).filter((entry): entry is Record<string, unknown> => Boolean(entry));
  }

  const record = toPlainRecord(value);
  if (!record) {
    return [];
  }

  return Object.values(record)
    .map((entry) => toPlainRecord(entry))
    .filter((entry): entry is Record<string, unknown> => Boolean(entry));
};

const toNonEmptyString = (value: unknown): string | null => {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return null;
};

const normalize = (value: unknown) => toNonEmptyString(value)?.toLowerCase() ?? "";

const hasOwnKeys = (payload: AmoWebhookPayload) => Object.keys(payload).length > 0;

export const isLocalLeadStage = (value: unknown): value is Lead["stage"] => {
  const normalized = toNonEmptyString(value);
  return normalized ? LOCAL_STAGES.has(normalized) : false;
};

export const isAmoCrmWebhookAuthorized = (providedSecret?: string | null) => {
  const expectedSecret = process.env.AMOCRM_WEBHOOK_SECRET?.trim();
  if (!expectedSecret) return true;
  return expectedSecret === (providedSecret?.trim() ?? "");
};

export const isValidAmoWebhookPayload = (payload: AmoWebhookPayload) =>
  hasOwnKeys(payload) && (Boolean(extractAmoLeadId(payload)) || inferAmoEventName(payload) !== "unknown");

export function inferAmoEventName(payload: AmoWebhookPayload): string {
  const event = toNonEmptyString(payload.event) ?? toNonEmptyString(payload.type);
  if (event) return event;

  const leadsRoot = toPlainRecord(payload.leads);
  if (leadsRoot) {
    if (Array.isArray(leadsRoot.status) || toPlainRecord(leadsRoot.status)) return "leads.status";
    if (Array.isArray(leadsRoot.add) || toPlainRecord(leadsRoot.add)) return "leads.add";
    if (Array.isArray(leadsRoot.update) || toPlainRecord(leadsRoot.update)) return "leads.update";
  }

  if (toPlainRecord(payload.contacts) || Array.isArray(payload.contacts)) return "contacts.update";
  return "unknown";
}

export function extractPrimaryAmoLead(payload: AmoWebhookPayload): Record<string, unknown> | null {
  const directLead = toPlainRecord(payload.lead);
  if (directLead) return directLead;

  const leadsRoot = toPlainRecord(payload.leads);
  if (!leadsRoot) return null;

  const candidates = [
    ...toRecordArray(leadsRoot.status),
    ...toRecordArray(leadsRoot.update),
    ...toRecordArray(leadsRoot.add),
    ...toRecordArray(leadsRoot),
  ];

  return candidates.find((candidate) => Boolean(toNonEmptyString(candidate.id) ?? toNonEmptyString(candidate.lead_id))) ?? null;
}

export function extractAmoLeadId(payload: AmoWebhookPayload): string | null {
  const lead = extractPrimaryAmoLead(payload);
  return (
    toNonEmptyString(lead?.id) ??
    toNonEmptyString(lead?.lead_id) ??
    toNonEmptyString(payload.lead_id) ??
    toNonEmptyString(payload.id)
  );
}

export function inferLeadStageFromAmoPayload(payload: AmoWebhookPayload): Lead["stage"] | null {
  const lead = extractPrimaryAmoLead(payload);
  const signals = [
    lead?.stage,
    lead?.status,
    lead?.status_name,
    lead?.status_label,
    lead?.pipeline_status,
    payload.stage,
    payload.status,
    payload.status_name,
    payload.event,
    payload.type,
  ];

  for (const signal of signals) {
    if (isLocalLeadStage(signal)) {
      return signal;
    }
  }

  const blob = signals.map((signal) => normalize(signal)).filter(Boolean).join(" ");
  if (!blob) return null;

  if (blob.includes("sale_closed") || blob.includes("won") || blob.includes("closed won") || blob.includes("successful")) {
    return "sale_closed";
  }

  if (blob.includes("proposal") || blob.includes("offer") || blob.includes("commercial") || blob.includes("quote")) {
    return "proposal_sent";
  }

  if (blob.includes("manager_contacted") || blob.includes("contacted") || blob.includes("contact") || blob.includes("in_work")) {
    return "manager_contacted";
  }

  if (blob.includes("quiz_completed") || blob.includes("qualified") || blob.includes("qualification") || blob.includes("quiz")) {
    return "quiz_completed";
  }

  if (blob.includes("lost") || blob.includes("declined") || blob.includes("cancel")) {
    return "lost";
  }

  return null;
}

const deriveTemperatureFromStage = (stage: Lead["stage"]): Lead["temperature"] => {
  if (stage === "sale_closed") return "won";
  if (stage === "lost") return "lost";
  if (["proposal_sent", "manager_contacted"].includes(stage)) return "hot";
  if (["quiz_completed", "lead_created", "reactivated"].includes(stage)) return "warm";
  return "cold";
};

export async function handleAmoCrmWebhook(payload: AmoWebhookPayload) {
  const eventName = inferAmoEventName(payload);
  const externalLeadId = extractAmoLeadId(payload);
  const mappedStage = inferLeadStageFromAmoPayload(payload);
  const db = await getDb();

  if (!db) {
    return {
      success: true,
      status: "received_demo" as const,
      eventName,
      externalLeadId,
      mappedStage,
      localLeadId: null,
    };
  }

  let localLeadId: number | null = null;
  let status = "received";

  if (externalLeadId) {
    const [matchedLead] = await db
      .select({ id: leads.id })
      .from(leads)
      .where(or(eq(leads.crmLeadId, externalLeadId), eq(leads.externalLeadId, externalLeadId)))
      .limit(1);

    localLeadId = matchedLead?.id ?? null;
  }

  if (localLeadId && mappedStage) {
    const timestamp = new Date();

    await db
      .update(leads)
      .set({
        stage: mappedStage,
        temperature: deriveTemperatureFromStage(mappedStage),
        lastInteractionAt: timestamp,
        updatedAt: timestamp,
        closedWonAt: mappedStage === "sale_closed" ? timestamp : null,
        lostAt: mappedStage === "lost" ? timestamp : null,
      })
      .where(eq(leads.id, localLeadId));

    await createLeadEvent({
      leadId: localLeadId,
      eventType: "crm_status_synced",
      title: `amoCRM sync: ${mappedStage}`,
      description: `Webhook ${eventName} синхронизировал лид ${externalLeadId} в стадию ${mappedStage}.`,
      actorType: "system",
      payloadJson: JSON.stringify({ eventName, externalLeadId, mappedStage, payload }),
    });

    status = "processed";
  } else if (localLeadId) {
    status = "logged";
  } else {
    status = "unmatched";
  }

  await db.insert(crmWebhookEvents).values({
    leadId: localLeadId,
    amoEventId: externalLeadId,
    eventName,
    payloadJson: JSON.stringify(payload),
    processedAt: new Date(),
    status,
    errorMessage: localLeadId || !externalLeadId ? null : "Lead not matched by crmLeadId/externalLeadId",
  });

  return {
    success: true,
    status,
    eventName,
    externalLeadId,
    mappedStage,
    localLeadId,
  };
}
