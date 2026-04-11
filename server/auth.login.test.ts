import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

const mocked = vi.hoisted(() => ({
  getUserByEmail: vi.fn(),
  upsertUser: vi.fn(),
  verifyPassword: vi.fn(),
  createSessionToken: vi.fn(),
}));

vi.mock("./db", () => ({
  getUserByEmail: mocked.getUserByEmail,
  upsertUser: mocked.upsertUser,
}));

vi.mock("./_core/password", () => ({
  verifyPassword: mocked.verifyPassword,
}));

vi.mock("./_core/sdk", () => ({
  sdk: {
    createSessionToken: mocked.createSessionToken,
  },
}));

import { appRouter } from "./routers";
import { COOKIE_NAME, ONE_YEAR_MS } from "../shared/const";

type CookieCall = {
  name: string;
  value: string;
  options: Record<string, unknown>;
};

function createContext(): { ctx: TrpcContext; cookies: CookieCall[] } {
  const cookies: CookieCall[] = [];

  const ctx: TrpcContext = {
    user: null,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      cookie: (name: string, value: string, options: Record<string, unknown>) => {
        cookies.push({ name, value, options });
      },
      clearCookie: vi.fn(),
    } as unknown as TrpcContext["res"],
  };

  return { ctx, cookies };
}

const mockUser = {
  id: 7,
  openId: "local:admin@example.com",
  email: "admin@example.com",
  passwordHash: "hashed-secret",
  name: "Admin",
  loginMethod: "password",
  role: "admin" as const,
  isActive: 1,
  createdAt: new Date("2026-04-10T00:00:00.000Z"),
  updatedAt: new Date("2026-04-10T00:00:00.000Z"),
  lastSignedIn: new Date("2026-04-10T00:00:00.000Z"),
};

describe("auth.login", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates a standalone session cookie for a valid email/password login", async () => {
    const { ctx, cookies } = createContext();
    mocked.getUserByEmail.mockResolvedValue(mockUser);
    mocked.verifyPassword.mockResolvedValue(true);
    mocked.createSessionToken.mockResolvedValue("signed-session-token");
    mocked.upsertUser.mockResolvedValue({ ...mockUser, lastSignedIn: new Date() });

    const caller = appRouter.createCaller(ctx);
    const result = await caller.auth.login({
      email: "ADMIN@example.com",
      password: "supersecret123",
    });

    expect(mocked.getUserByEmail).toHaveBeenCalledWith("admin@example.com");
    expect(mocked.verifyPassword).toHaveBeenCalledWith("supersecret123", "hashed-secret");
    expect(mocked.createSessionToken).toHaveBeenCalledWith(mockUser);
    expect(mocked.upsertUser).toHaveBeenCalledWith(
      expect.objectContaining({
        openId: mockUser.openId,
        email: mockUser.email,
        loginMethod: "password",
        role: "admin",
        isActive: 1,
      })
    );

    expect(result.success).toBe(true);
    expect(result.user).toMatchObject({
      id: 7,
      email: "admin@example.com",
      role: "admin",
      isActive: true,
    });

    expect(cookies).toHaveLength(1);
    expect(cookies[0]).toMatchObject({
      name: COOKIE_NAME,
      value: "signed-session-token",
      options: {
        httpOnly: true,
        secure: true,
        sameSite: "none",
        path: "/",
        maxAge: ONE_YEAR_MS,
      },
    });
  });

  it("rejects invalid credentials", async () => {
    const { ctx, cookies } = createContext();
    mocked.getUserByEmail.mockResolvedValue(mockUser);
    mocked.verifyPassword.mockResolvedValue(false);

    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.auth.login({
        email: "admin@example.com",
        password: "wrong-password",
      })
    ).rejects.toThrow("Неверный email или пароль");

    expect(mocked.createSessionToken).not.toHaveBeenCalled();
    expect(cookies).toHaveLength(0);
  });
});
