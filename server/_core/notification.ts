import { TRPCError } from "@trpc/server";
import { ENV } from "./env";

export type NotificationPayload = {
  title: string;
  content: string;
};

const TITLE_MAX_LENGTH = 1200;
const CONTENT_MAX_LENGTH = 20000;

const trimValue = (value: string): string => value.trim();
const isNonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;

const validatePayload = (input: NotificationPayload): NotificationPayload => {
  if (!isNonEmptyString(input.title)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Notification title is required.",
    });
  }

  if (!isNonEmptyString(input.content)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Notification content is required.",
    });
  }

  const title = trimValue(input.title);
  const content = trimValue(input.content);

  if (title.length > TITLE_MAX_LENGTH) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Notification title must be at most ${TITLE_MAX_LENGTH} characters.`,
    });
  }

  if (content.length > CONTENT_MAX_LENGTH) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Notification content must be at most ${CONTENT_MAX_LENGTH} characters.`,
    });
  }

  return { title, content };
};

async function sendWebhookNotification(payload: NotificationPayload) {
  if (!ENV.ownerNotificationWebhookUrl) {
    return false;
  }

  try {
    const response = await fetch(ENV.ownerNotificationWebhookUrl, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      console.warn(
        `[Notification] Webhook delivery failed (${response.status} ${response.statusText})${
          detail ? `: ${detail}` : ""
        }`
      );
      return false;
    }

    return true;
  } catch (error) {
    console.warn("[Notification] Webhook delivery error:", error);
    return false;
  }
}

async function sendTelegramNotification(payload: NotificationPayload) {
  if (!ENV.telegramBotToken || !ENV.ownerNotificationTelegramChatId) {
    return false;
  }

  try {
    const response = await fetch(
      `https://api.telegram.org/bot${ENV.telegramBotToken}/sendMessage`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          chat_id: ENV.ownerNotificationTelegramChatId,
          text: `*${payload.title}*\n\n${payload.content}`,
          parse_mode: "Markdown",
          disable_web_page_preview: true,
        }),
      }
    );

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      console.warn(
        `[Notification] Telegram delivery failed (${response.status} ${response.statusText})${
          detail ? `: ${detail}` : ""
        }`
      );
      return false;
    }

    return true;
  } catch (error) {
    console.warn("[Notification] Telegram delivery error:", error);
    return false;
  }
}

export async function notifyOwner(
  payload: NotificationPayload
): Promise<boolean> {
  const validated = validatePayload(payload);

  const webhookDelivered = await sendWebhookNotification(validated);
  if (webhookDelivered) {
    return true;
  }

  const telegramDelivered = await sendTelegramNotification(validated);
  if (telegramDelivered) {
    return true;
  }

  console.info("[Notification] No standalone delivery channel configured.", {
    title: validated.title,
  });
  return false;
}
