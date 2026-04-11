import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import { NOT_ADMIN_ERR_MSG, UNAUTHED_ERR_MSG } from "../shared/const";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createUser(role: AuthenticatedUser["role"]): AuthenticatedUser {
  return {
    id: role === "admin" ? 99 : 12,
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

describe("router access control", () => {
  it("rejects protected procedures for unauthenticated callers", async () => {
    const caller = appRouter.createCaller(createContext(null));

    await expect(caller.dashboard.overview()).rejects.toMatchObject({
      message: UNAUTHED_ERR_MSG,
    });
  });

  it("rejects admin procedures for non-admin callers", async () => {
    const caller = appRouter.createCaller(createContext(createUser("user")));

    await expect(
      caller.broadcasts.dispatchNow({
        broadcastId: 1,
      }),
    ).rejects.toMatchObject({
      message: NOT_ADMIN_ERR_MSG,
    });
  });

  it("allows admins to reach admin-only validation layer", async () => {
    const caller = appRouter.createCaller(createContext(createUser("admin")));

    await expect(
      caller.broadcasts.dispatchNow({
        broadcastId: 0,
      }),
    ).rejects.not.toMatchObject({
      message: NOT_ADMIN_ERR_MSG,
    });
  });
});
