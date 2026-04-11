import { ENV } from "./_core/env";

const TELEGRAM_API_BASE = "https://api.telegram.org";

type TelegramApiResponse<T> = {
  ok: boolean;
  result?: T;
  description?: string;
};

type TelegramReplyMarkup = {
  inline_keyboard: Array<Array<{ text: string; url: string }>>;
};

type TelegramBotProfile = {
  id: number;
  is_bot: boolean;
  first_name: string;
  username?: string;
  can_join_groups?: boolean;
  can_read_all_group_messages?: boolean;
  supports_inline_queries?: boolean;
};

export type TelegramDeliveryInput = {
  chatId: string | number;
  text: string;
  imageUrl?: string | null;
  parseMode?: "Markdown" | "MarkdownV2" | "HTML";
  ctaLabel?: string | null;
  ctaUrl?: string | null;
};

const requireTelegramToken = () => {
  if (!ENV.telegramBotToken) {
    throw new Error("TELEGRAM_BOT_TOKEN is not configured.");
  }

  return ENV.telegramBotToken;
};

const buildReplyMarkup = (ctaLabel?: string | null, ctaUrl?: string | null): TelegramReplyMarkup | undefined => {
  if (!ctaLabel || !ctaUrl) {
    return undefined;
  }

  return {
    inline_keyboard: [[{ text: ctaLabel, url: ctaUrl }]],
  };
};

async function telegramRequest<T>(method: string, payload?: Record<string, unknown>): Promise<T> {
  const token = requireTelegramToken();
  const response = await fetch(`${TELEGRAM_API_BASE}/bot${token}/${method}`, {
    method: payload ? "POST" : "GET",
    headers: payload
      ? {
          "content-type": "application/json",
        }
      : undefined,
    body: payload ? JSON.stringify(payload) : undefined,
  });

  if (!response.ok) {
    throw new Error(`Telegram API request failed with status ${response.status}`);
  }

  const data = (await response.json()) as TelegramApiResponse<T>;
  if (!data.ok || !data.result) {
    throw new Error(data.description ?? "Telegram API returned an invalid response");
  }

  return data.result;
}

export async function getTelegramBotProfile() {
  return telegramRequest<TelegramBotProfile>("getMe");
}

export async function sendTelegramMessage(input: {
  chatId: string | number;
  text: string;
  parseMode?: "Markdown" | "MarkdownV2" | "HTML";
  ctaLabel?: string | null;
  ctaUrl?: string | null;
}) {
  return telegramRequest("sendMessage", {
    chat_id: input.chatId,
    text: input.text,
    parse_mode: input.parseMode,
    reply_markup: buildReplyMarkup(input.ctaLabel, input.ctaUrl),
    disable_web_page_preview: true,
  });
}

export async function sendTelegramPhotoMessage(input: TelegramDeliveryInput) {
  if (!input.imageUrl) {
    throw new Error("imageUrl is required for sendTelegramPhotoMessage");
  }

  return telegramRequest("sendPhoto", {
    chat_id: input.chatId,
    photo: input.imageUrl,
    caption: input.text,
    parse_mode: input.parseMode,
    reply_markup: buildReplyMarkup(input.ctaLabel, input.ctaUrl),
  });
}

export async function sendTelegramRichMessage(input: TelegramDeliveryInput) {
  if (input.imageUrl) {
    return sendTelegramPhotoMessage(input);
  }

  return sendTelegramMessage(input);
}
