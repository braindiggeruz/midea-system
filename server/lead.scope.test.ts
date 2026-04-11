import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createUser(role: AuthenticatedUser["role"]): AuthenticatedUser {
  return {
    id: role === "admin" ? 1 : 2,
    openId: `${role}-user`,
    email: `${role}@example.com`,
    name: `${role} user`,
    loginMethod: "password",
    role,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };
}

function createContext(user: TrpcContext["user"]): TrpcContext {
  return {
    user,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: () => undefined,
    } as TrpcContext["res"],
  };
}

async function createCaller(role: AuthenticatedUser["role"]) {
  const { appRouter } = await import("./routers");
  return appRouter.createCaller(createContext(createUser(role)));
}

const originalDatabaseUrl = process.env.DATABASE_URL;

beforeAll(() => {
  process.env.DATABASE_URL = "";
});

afterAll(() => {
  process.env.DATABASE_URL = originalDatabaseUrl;
});

describe("lead access scope", () => {
  it("limits managers to their own leads in list and detail procedures", async () => {
    const caller = await createCaller("manager");

    const leads = await caller.leads.list();
    const visibleLeadIds = leads.map((lead) => lead.id);
    const visibleManagerIds = new Set(leads.map((lead) => lead.assignedManagerId));
    const forbiddenLead = await caller.leads.detail({ leadId: 1001 });
    const ownedLead = await caller.leads.detail({ leadId: 1002 });

    expect(visibleLeadIds).toEqual([1002]);
    expect(Array.from(visibleManagerIds)).toEqual([2]);
    expect(forbiddenLead).toBeNull();
    expect(ownedLead?.lead.fullName).toBe("Madinabonu Yusupova");
  });

  it("scopes funnel analytics to manager-owned leads", async () => {
    const managerCaller = await createCaller("manager");
    const adminCaller = await createCaller("admin");

    const managerFunnel = await managerCaller.dashboard.funnel();
    const adminFunnel = await adminCaller.dashboard.funnel();

    expect(managerFunnel[0]).toMatchObject({
      stage: "ad_click",
      total: 1,
      conversionFromStartPct: 100,
    });
    expect(managerFunnel.at(-1)).toMatchObject({
      stage: "sale_closed",
      total: 0,
    });
    expect(adminFunnel[0]?.total).toBeGreaterThan(managerFunnel[0]?.total ?? 0);
  });

  it("treats admin as owner-equivalent full access across lead list and detail views", async () => {
    const adminCaller = await createCaller("admin");

    const leads = await adminCaller.leads.list();
    const detail = await adminCaller.leads.detail({ leadId: 1003 });

    expect(leads.map((lead) => lead.id)).toEqual(expect.arrayContaining([1001, 1002, 1003, 1004]));
    expect(detail?.lead.fullName).toBe("Dilshod Karimov");
  });

  it("prevents managers from assigning lead tasks to another manager", async () => {
    const caller = await createCaller("manager");

    await expect(
      caller.leads.createTask({
        leadId: 1002,
        title: "Неверное назначение",
        assignedToUserId: 1,
      }),
    ).rejects.toThrow("Managers can only assign tasks to themselves.");
  });
});
