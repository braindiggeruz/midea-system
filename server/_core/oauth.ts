import type { Express, Request, Response } from "express";

export function registerAuthRoutes(app: Express) {
  app.get("/api/oauth/callback", (_req: Request, res: Response) => {
    res.redirect(302, "/login?reason=oauth_removed");
  });

  app.get("/api/auth/status", (_req: Request, res: Response) => {
    res.json({
      mode: "standalone",
      oauthProvider: null,
      ok: true,
    });
  });
}
