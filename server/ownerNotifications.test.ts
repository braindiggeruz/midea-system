import { describe, expect, it } from "vitest";
import {
  buildLeadStageOwnerNotification,
  isHotLeadStage,
} from "./ownerNotifications";

describe("ownerNotifications", () => {
  it("recognizes hot lead stages", () => {
    expect(isHotLeadStage("manager_contacted")).toBe(true);
    expect(isHotLeadStage("proposal_sent")).toBe(true);
    expect(isHotLeadStage("quiz_completed")).toBe(false);
  });

  it("formats quiz completion notifications for the owner", () => {
    const payload = buildLeadStageOwnerNotification({
      actorName: "Admin User",
      leadId: 42,
      leadName: "Aziza Karimova",
      stage: "quiz_completed",
    });

    expect(payload).toEqual({
      title: "Quiz completed: Aziza Karimova (#42)",
      content:
        "Пользователь Admin User перевёл лида Aziza Karimova (#42) в стадию quiz_completed. Лид завершил квиз и готов к следующему qualification step.",
    });
  });

  it("formats hot lead notifications with status reason", () => {
    const payload = buildLeadStageOwnerNotification({
      actorName: "Manager One",
      leadId: 77,
      leadName: "Nodira",
      stage: "proposal_sent",
      statusReason: "Согласовал выезд замерщика",
    });

    expect(payload.title).toBe("Hot lead: Nodira (#77)");
    expect(payload.content).toContain("горячую стадию proposal_sent");
    expect(payload.content).toContain("Причина: Согласовал выезд замерщика.");
  });

  it("formats closed sale notifications", () => {
    const payload = buildLeadStageOwnerNotification({
      actorName: "Owner",
      leadId: 5,
      stage: "sale_closed",
    });

    expect(payload).toEqual({
      title: "Closed sale: #5",
      content:
        "Пользователь Owner закрыл сделку по лиду #5. Стадия обновлена на sale_closed.",
    });
  });
});
