# Telegram Integration Operations

# DEPRECATED — do not use as primary handoff

> Этот документ сохранён как историческая операционная заметка. Для актуального standalone-контура используйте `FINAL_STANDALONE_HANDOFF.md`, а этот файл рассматривайте только как архив ранней конфигурации.

## Purpose

Этот документ фиксирует рабочий контур Telegram-интеграции в проекте **Midea Digital Contour Admin**, правила хранения секретов и безопасный порядок эксплуатации broadcast и automation execution. Документ нужен для того, чтобы серверная часть, деплой и последующая передача проекта в GitHub, Railway и Cloudflare выполнялись без хардкода токенов и без утечки чувствительных данных.

## Secret Handling Policy

| Environment variable | Scope | Purpose | Storage rule | Rotation rule |
| --- | --- | --- | --- | --- |
| `TELEGRAM_BOT_TOKEN` | Server only | Авторизация вызовов Telegram Bot API для `getMe`, `sendMessage`, `sendPhoto` и rich delivery | Хранить только в secrets-management платформы и в production secrets Railway/Manus, никогда не коммитить в код и не сохранять в клиентских переменных | Ротировать при любом подозрении на утечку, смене владельца бота или передаче доступа подрядчику |
| `JWT_SECRET` | Server only | Подпись cookie-сессий и auth-контекста | Только в серверных secrets | Ротировать по регламенту безопасности и при подозрении на компрометацию |
| `DATABASE_URL` | Server only | Подключение к TiDB/MySQL | Только в secrets, не писать в README и примеры с реальным значением | Ротировать при смене БД или инцидентах доступа |
| `BUILT_IN_FORGE_API_KEY` | Server only | Встроенные серверные API платформы | Только в серверном окружении | Ротировать по политике платформы |
| `VITE_FRONTEND_FORGE_API_KEY` | Client runtime | Ограниченный frontend-доступ к platform APIs | Использовать только как уже управляемую системную переменную, не дублировать вручную | Следовать жизненному циклу платформы |
| `OAUTH_SERVER_URL`, `VITE_OAUTH_PORTAL_URL`, `VITE_APP_ID` | Auth infra | OAuth-контур платформы | Использовать из системного окружения, не хардкодить домены в коде | Менять только через secrets/config management |

## Non-Negotiable Rules

| Rule | Explanation |
| --- | --- |
| No hardcode | Реальные токены, chat IDs администраторов, webhook secrets и database credentials не должны попадать ни в `client/`, ни в `README`, ни в test snapshots |
| Server-only Bot API | Любые вызовы Telegram Bot API выполняются только на сервере через `server/telegram.ts` |
| No token logging | Нельзя выводить токен полностью в консоль, в browser logs, в network logs и в сообщения об ошибках |
| Minimal exposure | Во frontend допускается только работа через tRPC-процедуры; сам токен никогда не должен передаваться браузеру |
| Controlled notifications | Массовые рассылки и automation execution запускаются только из admin-only процедур |
| Delivery logging | Результаты отправки фиксируются в `leadCommunications` и `automationRuns`, чтобы команда видела sent/failed состояние |

## Current Integration Topology

Серверный транспорт Telegram вынесен в `server/telegram.ts`. Этот слой отвечает за безопасственную сборку Bot API URL, отправку текстовых и rich-сообщений, поддержку CTA-кнопок и image-based delivery. Серверный orchestration layer находится в `server/db.ts`, где реализованы массовый dispatch рассылок и execution-layer автоматизаций с повторными попытками, записью результатов и созданием lead events.

Слой API опубликован через `server/routers.ts`. Для административных действий доступны защищённые процедуры, которые позволяют получить профиль бота, отправить тестовое сообщение, выполнить ping по конкретному лиду, запустить broadcast dispatch и вручную инициировать automation execution. Это гарантирует, что прямой доступ к Bot API остаётся только внутри серверной части.

## Broadcast Workflow

| Step | Component | Result |
| --- | --- | --- |
| 1 | `broadcasts.createDraft` | Создаёт черновик рассылки с сегментом, текстом, изображением и CTA |
| 2 | `broadcasts.dispatchNow` | Находит адресуемые лиды, у которых есть `telegramUserId` или `telegramUsername` |
| 3 | `server/telegram.ts` | Отправляет сообщение в Telegram через rich delivery transport |
| 4 | `leadCommunications` | Фиксирует `sent` или `failed` статус для каждого лида |
| 5 | `leadEvents` | Записывает событие `broadcast_sent` для аудита действий |
| 6 | `notifyOwner` | Посылает owner-alert о запуске и результате рассылки |

## Automation Workflow

| Step | Component | Result |
| --- | --- | --- |
| 1 | `automationRules` | Хранит активные и paused правила |
| 2 | `automations.executeNow` | Запускает одно правило или все активные правила вручную |
| 3 | Rule matcher в `server/db.ts` | Определяет подходящих лидов по температуре, стадии и давности активности |
| 4 | `server/telegram.ts` | Выполняет отправку follow-up сообщения с retry |
| 5 | `automationRuns` | Сохраняет sent/failed результат исполнения |
| 6 | `leadCommunications` и `leadEvents` | Формируют полный аудит коммуникации и срабатывания automation |

## Rotation and Incident Response

Если появляется подозрение, что `TELEGRAM_BOT_TOKEN` утёк, бот ведёт себя аномально или к проекту получил доступ новый подрядчик, необходимо немедленно перевыпустить токен через BotFather, обновить secret через интерфейс управления secrets и затем повторно прогнать серверный тест проверки `getMe`. После ротации нужно убедиться, что `telegram.bot-token.test.ts` снова проходит, а административная тестовая отправка возвращает успешный ответ.

## Deployment Notes

Для Railway и других production-сред токен должен добавляться как server-side secret с тем же именем `TELEGRAM_BOT_TOKEN`. Во frontend-конфигурацию он не выносится. При переносе проекта в GitHub нельзя добавлять `.env` с реальными значениями; допустимы только шаблоны без секретов и документация по required env names.

Поскольку пользователь предпочитает связку GitHub и Cloudflare Pages, необходимо учитывать, что Telegram transport должен продолжать жить в серверной части. Если фронтенд будет публиковаться отдельно, серверный runtime для tRPC и Bot API должен оставаться в совместимой среде, например Railway или встроенном hosting-окружении платформы.

## Operational Validation Checklist

| Check | Expected result |
| --- | --- |
| `pnpm check` | TypeScript проходит без ошибок |
| `pnpm test` | Vitest проходит, включая live-проверку `TELEGRAM_BOT_TOKEN` |
| `telegram.profile` | Возвращает профиль реального бота |
| `telegram.sendTestMessage` | Успешно отправляет тестовое сообщение в указанный chat |
| `broadcasts.dispatchNow` | Создаёт delivery logs и обновляет статус рассылки |
| `automations.executeNow` | Создаёт `automationRuns` и outbound communication logs |

## Next Hardening Tasks

В текущей версии рекомендуется дополнительно реализовать строгий row-level access для manager-пользователей, расширить покрытие vitest на admin-only процедуры и добавить отдельную инфраструктурную памятку для GitHub, Railway и Cloudflare secret mapping.
