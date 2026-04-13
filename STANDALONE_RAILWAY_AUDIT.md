# Аудит зависимостей админки от Manus

# HISTORICAL AUDIT — not the current source of truth

> Этот аудит отражает состояние проекта до выполнения ключевых шагов отвязки. Для актуального standalone-состояния используйте `FINAL_STANDALONE_HANDOFF.md`.

## Ключевой вывод

Текущая админка **не является standalone-приложением**. Она может запускаться на Railway только частично, но архитектурно опирается на платформенные Manus-компоненты в трёх основных слоях: **аутентификация**, **runtime/build tooling** и **встроенные platform APIs**.

## Обнаруженные критические зависимости

| Слой | Файл/точка | Что именно завязано на Manus | Последствие для Railway |
| --- | --- | --- | --- |
| Аутентификация | `client/src/const.ts` | Формирует login URL через `VITE_OAUTH_PORTAL_URL` и `VITE_APP_ID` с редиректом на `/api/oauth/callback` | Пользователь уходит на `manus.im` при входе |
| Аутентификация | `client/src/main.tsx` | Глобально редиректит `UNAUTHORIZED` на `getLoginUrl()` | Любая просроченная сессия возвращает пользователя в Manus OAuth |
| Аутентификация | `client/src/_core/hooks/useAuth.ts` | Хранит `manus-runtime-user-info` и использует Manus login redirect | Клиентская auth-модель платформенно-специфична |
| Аутентификация | `server/_core/index.ts` | Регистрирует `registerOAuthRoutes(app)` | Сервер Railway поднимает Manus OAuth callback |
| Аутентификация | `server/_core/oauth.ts` | Меняет код OAuth на токен через Manus SDK и создаёт сессию по `openId` | Вход полностью зависит от Manus OAuth backend |
| Аутентификация | `server/_core/sdk.ts` | Использует `OAUTH_SERVER_URL`, `VITE_APP_ID`, `GetUserInfo`, `GetUserInfoWithJwt` | Серверная auth-цепочка не может быть самостоятельной |
| Схема данных | `drizzle/schema.ts` | Таблица `users` основана на `openId` как обязательном уникальном идентификаторе | Для standalone-auth нужна миграция модели пользователя |
| Runtime/build | `vite.config.ts` | Подключает `vite-plugin-manus-runtime`, debug collector и manus-host allowlist | Сборка и dev-runtime содержат платформенные вставки |
| Зависимости | `package.json` | Содержит `vite-plugin-manus-runtime` | Требуется удаление из standalone-варианта |
| Platform API | `server/_core/notification.ts` | Отправляет owner notifications через `BUILT_IN_FORGE_API_URL`/`BUILT_IN_FORGE_API_KEY` | Эта функция не будет работать вне Manus |
| Platform API | `server/storage.ts` | Использует Forge storage proxy | Нужна замена на S3/Railway-compatible storage |
| Platform API | `server/_core/dataApi.ts` | Использует built-in Data API Manus | Нужна замена на внешние API/собственные интеграции |
| Клиентские артефакты | `client/public/__manus__/debug-collector.js` | Платформенный debug collector и `/__manus__/logs` | Не нужен для standalone production |

## Подтверждённые env-зависимости

Текущий `server/_core/env.ts` опирается на следующие платформенные переменные:

| Переменная | Назначение | Статус для standalone Railway |
| --- | --- | --- |
| `VITE_APP_ID` | Manus OAuth app id | Убрать |
| `OAUTH_SERVER_URL` | Manus OAuth backend | Убрать |
| `OWNER_OPEN_ID` | Идентификатор владельца Manus | Убрать или заменить локальной моделью администратора |
| `BUILT_IN_FORGE_API_URL` | Manus platform API base URL | Убрать/заменить |
| `BUILT_IN_FORGE_API_KEY` | Доступ к Manus platform APIs | Убрать/заменить |

## Подтверждённые UI-следы Manus

- Вход ведёт на `manus.im`.
- Сессия и ошибки авторизации жёстко редиректят в Manus OAuth.
- В коде присутствуют компоненты и тексты вида `Login with Manus`.
- В localStorage используется ключ `manus-runtime-user-info`.

## Что нужно сделать для полной отвязки

1. Заменить Manus OAuth на самостоятельную auth-схему.
2. Перестроить таблицу `users`, чтобы идентичность не зависела от `openId`.
3. Удалить Manus runtime plugin и debug artifacts из production-контура.
4. Убрать или заменить все вызовы Forge/Manus API.
5. Настроить самостоятельные env-переменные и поток входа полностью внутри Railway.

## Предварительное архитектурное направление

Наиболее прямой путь — перевести админку на **локальную cookie-based auth** с таблицей пользователей и паролем/хешем в БД, отдельным login endpoint и собственным session JWT, подписанным `JWT_SECRET`. Это позволит сохранить серверный стек Express + tRPC + Railway без внешней зависимости от Manus OAuth.
