export const ENV = {
  appName: process.env.VITE_APP_TITLE ?? "Midea Digital Contour Admin",
  appUrl:
    process.env.APP_BASE_URL ??
    process.env.PUBLIC_APP_URL ??
    process.env.RAILWAY_PUBLIC_DOMAIN ??
    "",
  sessionSecret: process.env.SESSION_SECRET ?? process.env.JWT_SECRET ?? "",
  databaseUrl: process.env.DATABASE_URL ?? "",
  adminEmail:
    process.env.STANDALONE_ADMIN_EMAIL?.trim().toLowerCase() ??
    process.env.ADMIN_EMAIL?.trim().toLowerCase() ??
    "",
  adminPassword:
    process.env.STANDALONE_ADMIN_PASSWORD ?? process.env.ADMIN_PASSWORD ?? "",
  adminName:
    process.env.STANDALONE_ADMIN_NAME ?? process.env.ADMIN_NAME ?? "",
  isProduction: process.env.NODE_ENV === "production",
  serviceGatewayUrl:
    process.env.SERVICE_GATEWAY_URL ??
    process.env.STANDALONE_SERVICE_GATEWAY_URL ??
    "",
  serviceGatewayApiKey:
    process.env.SERVICE_GATEWAY_API_KEY ??
    process.env.STANDALONE_SERVICE_GATEWAY_API_KEY ??
    "",
  telegramBotToken: process.env.TELEGRAM_BOT_TOKEN ?? "",
  ownerNotificationWebhookUrl:
    process.env.OWNER_NOTIFICATION_WEBHOOK_URL ?? "",
  ownerNotificationTelegramChatId:
    process.env.OWNER_NOTIFICATION_TELEGRAM_CHAT_ID ?? "",
};
