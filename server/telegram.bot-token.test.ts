import { describe, expect, it } from "vitest";

describe("TELEGRAM_BOT_TOKEN", () => {
  it("валиден и возвращает данные реального бота через getMe", async () => {
    const token = process.env.TELEGRAM_BOT_TOKEN;

    expect(token, "TELEGRAM_BOT_TOKEN должен быть задан в env").toBeTruthy();

    const response = await fetch(`https://api.telegram.org/bot${token}/getMe`);
    expect(response.ok).toBe(true);

    const payload = (await response.json()) as {
      ok: boolean;
      result?: {
        id: number;
        is_bot: boolean;
        first_name: string;
        username?: string;
      };
      description?: string;
    };

    expect(payload.ok, payload.description ?? "Telegram API вернул ошибку").toBe(true);
    expect(payload.result?.is_bot).toBe(true);
    expect(payload.result?.id).toBeTypeOf("number");
    expect(payload.result?.first_name).toBeTruthy();
    expect(payload.result?.username).toBe("mideasystembot");
  }, 15000);
});
