# План полной отвязки админки от Manus для Railway

# DEPRECATED — migration plan only

> Этот документ отражает план миграции, а не финальное production-состояние. Для актуального standalone-контура используйте `FINAL_STANDALONE_HANDOFF.md`.

## Цель

Перевести админку на **самостоятельную эксплуатацию в Railway** без редиректов на `manus.im`, без Manus OAuth, без `vite-plugin-manus-runtime` и без обязательных вызовов к встроенным platform APIs.

## Целевая архитектура

| Контур | Было | Должно стать |
| --- | --- | --- |
| Вход | Manus OAuth через `VITE_OAUTH_PORTAL_URL` и `/api/oauth/callback` | Локальный экран логина `/login` + серверный `auth.login` mutation |
| Идентичность пользователя | `users.openId` как обязательный уникальный идентификатор | Локальный пользователь с `email`/`username` и password hash |
| Сессия | JWT/cookie, выдаваемые после Manus OAuth callback | JWT/cookie, выдаваемые после локальной проверки логина и пароля |
| Серверный bootstrap | `registerOAuthRoutes(app)` | Локальные auth endpoints без внешнего OAuth |
| Клиентский auth flow | `getLoginUrl()` уводит на Manus | SPA-логин внутри собственного домена |
| Runtime/build | `vite-plugin-manus-runtime` и `__manus__` debug collector | Обычный Vite без Manus runtime-плагина |
| Notification layer | `notifyOwner()` через Forge | Либо выключить, либо заменить на Telegram/direct integration |
| Platform API | Forge/Data API/Frontend Forge | Удалить или заменить внешними интеграциями |

## Минимально необходимый объём изменений

### 1. Аутентификация

Нужно заменить текущую цепочку:

- `client/src/const.ts`
- `client/src/_core/hooks/useAuth.ts`
- `client/src/main.tsx`
- `server/_core/oauth.ts`
- `server/_core/sdk.ts`
- `server/_core/index.ts`
- auth-часть в `server/routers.ts`

На собственный flow:

1. Создать публичную страницу `/login`.
2. Создать `auth.login` mutation с `emailOrUsername + password`.
3. Проверять пароль на сервере по bcrypt/argon2 hash.
4. После успешного входа выдавать ту же cookie-сессию, но уже без OAuth callback.
5. Оставить `auth.me` и `auth.logout`, чтобы фронтенд менялся минимально.

### 2. Схема базы данных

Текущая таблица `users` требует рефакторинга, так как `openId` сейчас обязательный и уникальный.

Предлагаемое изменение:

| Поле | Действие |
| --- | --- |
| `openId` | Сделать nullable или оставить как legacy nullable |
| `email` | Сделать основным логином и unique |
| `passwordHash` | Добавить |
| `isActive` | Добавить |
| `lastSignedIn` | Оставить |
| `role` | Оставить |
| `name` | Оставить |

Также нужен **seed/bootstrapping сценарий** для первого администратора Railway.

### 3. Bootstrap первого администратора

Так как после удаления Manus OAuth в систему нельзя будет войти автоматически, нужен один из двух безопасных вариантов:

| Вариант | Описание | Рекомендация |
| --- | --- | --- |
| `ADMIN_EMAIL` + `ADMIN_PASSWORD` через env | При первом старте сервер создаёт/обновляет администратора | Самый быстрый и практичный путь |
| Отдельный CLI seed script | Одноразовый запуск для создания первого admin | Хорош как дополнительный инструмент |

Рекомендуется реализовать **оба**: автоматический bootstrap по env и отдельный script для обслуживания.

### 4. Клиентский вход

Нужно убрать все редиректы на Manus и построить локальную UX-схему:

- неавторизованный пользователь видит `/login`;
- после логина попадает в `/`;
- `UNAUTHORIZED` больше не вызывает переход на `manus.im`, а делает локальный redirect на `/login`;
- тексты `Login with Manus` и `Please login with Manus to continue` заменяются на нейтральные Railway/self-hosted формулировки.

### 5. Удаление platform-specific зависимостей

#### Обязательное удаление из production-контура

- `vite-plugin-manus-runtime`
- `client/public/__manus__/debug-collector.js`
- special handling `/__manus__/logs` в Vite
- любые `VITE_FRONTEND_FORGE_*` зависимости, если они не нужны для рабочих функций админки
- `notifyOwner()` через Forge, если без него приложение должно оставаться рабочим

#### Что можно временно оставить как non-blocking

Если какие-то модули не влияют на вход и базовую работу админки, их можно временно изолировать feature-flag'ом, чтобы сначала получить самостоятельный login и доступ в проде.

## Порядок реализации

| Шаг | Изменение | Риск |
| --- | --- | --- |
| 1 | Обновить схему users и миграцию | Средний |
| 2 | Добавить password hashing и bootstrap admin | Средний |
| 3 | Переписать `auth.login/me/logout` | Средний |
| 4 | Удалить OAuth callback и Manus SDK из server bootstrap | Высокий |
| 5 | Переписать фронтендовый `useAuth`, `/login`, guards и redirect logic | Средний |
| 6 | Убрать Manus runtime plugin и platform-specific client env | Средний |
| 7 | Прогнать тесты, локальный запуск и Railway redeploy | Средний |

## Критический вывод

Полная отвязка **реализуема**, но это уже не «настройка Railway», а **рефакторинг auth + части платформенной инфраструктуры приложения**. Приложение нужно превратить из Manus-template-based app в обычный self-hosted Node/Vite/Express/tRPC сервис.

Следующий практический шаг: перейти к реализации собственного локального login-flow и миграции таблицы `users`.
