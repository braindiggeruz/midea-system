import { describe, expect, it } from "vitest";
import {
  extractAmoLeadId,
  extractPrimaryAmoLead,
  inferAmoEventName,
  inferLeadStageFromAmoPayload,
  isAmoCrmWebhookAuthorized,
  isLocalLeadStage,
  isValidAmoWebhookPayload,
} from "./amocrm";

describe("amocrm webhook helpers", () => {
  it("accepts requests without secret by default and enforces it when configured", () => {
    const previousSecret = process.env.AMOCRM_WEBHOOK_SECRET;

    delete process.env.AMOCRM_WEBHOOK_SECRET;
    expect(isAmoCrmWebhookAuthorized(undefined)).toBe(true);

    process.env.AMOCRM_WEBHOOK_SECRET = "safe-mode-secret";
    expect(isAmoCrmWebhookAuthorized("safe-mode-secret")).toBe(true);
    expect(isAmoCrmWebhookAuthorized("wrong-secret")).toBe(false);

    if (previousSecret === undefined) {
      delete process.env.AMOCRM_WEBHOOK_SECRET;
    } else {
      process.env.AMOCRM_WEBHOOK_SECRET = previousSecret;
    }
  });

  it("detects local stages directly", () => {
    expect(isLocalLeadStage("quiz_completed")).toBe(true);
    expect(isLocalLeadStage("sale_closed")).toBe(true);
    expect(isLocalLeadStage("closed_won")).toBe(false);
  });

  it("extracts primary lead from nested amoCRM payloads", () => {
    const payload = {
      leads: {
        status: [{ id: 12345, status_name: "Qualified" }],
      },
    };

    expect(extractPrimaryAmoLead(payload)).toEqual({ id: 12345, status_name: "Qualified" });
    expect(extractAmoLeadId(payload)).toBe("12345");
    expect(inferAmoEventName(payload)).toBe("leads.status");
    expect(isValidAmoWebhookPayload(payload)).toBe(true);
    expect(isValidAmoWebhookPayload({})).toBe(false);
  });

  it("maps qualification-like amoCRM statuses to quiz_completed", () => {
    const payload = {
      leads: {
        status: [{ id: 9001, status_name: "Qualified after quiz" }],
      },
    };

    expect(inferLeadStageFromAmoPayload(payload)).toBe("quiz_completed");
  });

  it("maps proposal and won signals to local contour stages", () => {
    expect(
      inferLeadStageFromAmoPayload({
        lead: { id: 501, status_name: "Commercial proposal sent" },
      })
    ).toBe("proposal_sent");

    expect(
      inferLeadStageFromAmoPayload({
        lead: { id: 777, status_name: "Closed won" },
      })
    ).toBe("sale_closed");
  });
});
