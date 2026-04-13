import { describe, expect, it } from "vitest";

import { requestJsonWithCurl } from "./testHttp";

describe("TELEGRAM_BOT_TOKEN", () => {
  it("валиден и возвращает данные реального бота через getMe", async () => {
    const token = process.env.TELEGRAM_BOT_TOKEN;

    expect(token, "TELEGRAM_BOT_TOKEN должен быть задан в env").toBeTruthy();

    const response = await requestJsonWithCurl<{
      ok: boolean;
      result?: {
        id: number;
        is_bot: boolean;
        first_name: string;
        username?: string;
      };
      description?: string;
    }>(`https://api.telegram.org/bot${token}/getMe`);

    expect(response.status).toBe(200);
    expect(response.json.ok, response.json.description ?? "Telegram API вернул ошибку").toBe(true);
    expect(response.json.result?.is_bot).toBe(true);
    expect(response.json.result?.id).toBeTypeOf("number");
    expect(response.json.result?.first_name).toBeTruthy();
    expect(response.json.result?.username).toBe("mideasystembot");
  }, 15_000);
});
