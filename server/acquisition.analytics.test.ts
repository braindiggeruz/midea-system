import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createUser(role: AuthenticatedUser["role"]): AuthenticatedUser {
  return {
    id: role === "admin" ? 1 : 2,
    openId: `${role}-user`,
    email: `${role}@example.com`,
    name: `${role} user`,
    loginMethod: "manus",
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

describe("acquisition analytics", () => {
  it("includes safe-mode spend and CPL for admin-level access", async () => {
    const caller = await createCaller("admin");
    const analytics = await caller.dashboard.acquisition();

    expect(analytics).toHaveLength(3);

    expect(analytics[0]).toMatchObject({
      source: "telegram_ads",
      campaign: "spring-launch",
      creative: "video-a",
      leadCount: 2,
      quizCompletedCount: 2,
      qualifiedCount: 2,
      saleClosedCount: 0,
      conversionToQuizPct: 100,
      conversionToQualifiedPct: 100,
      conversionToSalePct: 0,
      projectedRevenueUsd: 2200,
      averageLeadScore: 90,
      spendUsd: 480,
      cplUsd: 240,
      spendEntryId: 1,
    });
    expect(analytics[0]?.segments).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ segment: "alba", total: 1 }),
        expect.objectContaining({ segment: "combo", total: 1 }),
      ]),
    );

    expect(analytics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          source: "google_search",
          campaign: "air-purifier-quiz",
          creative: "search-rsa-1",
          leadCount: 1,
          spendUsd: 210,
          cplUsd: 210,
          conversionToQuizPct: 100,
          conversionToQualifiedPct: 0,
        }),
        expect.objectContaining({
          source: "instagram_reels",
          campaign: "consult-soft-launch",
          creative: "reel-b",
          leadCount: 1,
          spendUsd: 96,
          cplUsd: 96,
          conversionToQualifiedPct: 100,
        }),
      ]),
    );
  });

  it("keeps manager analytics scoped to owned leads and hides spend-backed CPL", async () => {
    const caller = await createCaller("manager");
    const analytics = await caller.dashboard.acquisition();

    expect(analytics).toEqual([
      expect.objectContaining({
        source: "google_search",
        campaign: "air-purifier-quiz",
        creative: "search-rsa-1",
        leadCount: 1,
        quizCompletedCount: 1,
        qualifiedCount: 0,
        saleClosedCount: 0,
        conversionToQuizPct: 100,
        conversionToQualifiedPct: 0,
        spendUsd: null,
        cplUsd: null,
        spendEntryId: null,
      }),
    ]);
  });
});
