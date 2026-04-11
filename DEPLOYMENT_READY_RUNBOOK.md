# Deployment Ready Runbook

## Purpose

Этот документ фиксирует **deployment-ready** контур проекта **Midea Digital Contour Admin** для безопасной передачи в GitHub, запуска на Railway и подключения через Cloudflare без хардкода секретов и без изменения прикладной логики. Документ описывает только подготовленный рабочий путь; фактическое подключение к личным аккаунтам пользователя остаётся отдельным внешним шагом.

## Current Runtime Profile

| Layer | Current state | Notes |
| --- | --- | --- |
| Frontend | Vite + React 19 | Собирается через `pnpm build` |
| Backend | Express + tRPC | Bundling выполняется из `server/_core/index.ts` в `dist/index.js` |
| Database | MySQL/TiDB via `DATABASE_URL` | Доступ должен оставаться server-side only |
| Auth | Manus OAuth envs | Домены нельзя хардкодить; использовать текущую env-модель |
| Messaging | Telegram Bot API | Только через server runtime |
| Webhooks | amoCRM endpoint | Должен жить на серверном домене, а не на статическом frontend-hosting |

## Build and Start Commands

| Purpose | Command |
| --- | --- |
| Install dependencies | `pnpm install` |
| Development | `pnpm dev` |
| TypeScript check | `pnpm check` |
| Tests | `pnpm test` |
| Production build | `pnpm build` |
| Production start | `pnpm start` |

## Required Environment Variables

| Variable | Required for | Public or server | Comment |
| --- | --- | --- | --- |
| `DATABASE_URL` | Database connection | Server | Обязателен для production runtime |
| `JWT_SECRET` | Session signing | Server | Обязателен |
| `TELEGRAM_BOT_TOKEN` | Broadcasts and automations | Server | Обязателен для messaging-функций |
| `AMOCRM_WEBHOOK_SECRET` | Safe-mode webhook authorization | Server | Рекомендуется как обязательный для production |
| `OAUTH_SERVER_URL` | OAuth backend | Server | Системная переменная |
| `VITE_OAUTH_PORTAL_URL` | Login portal | Public build-time | Системная переменная |
| `VITE_APP_ID` | OAuth app id | Public build-time | Системная переменная |
| `BUILT_IN_FORGE_API_KEY` | Internal platform APIs | Server | Если рантайм поддерживает эти вызовы |
| `BUILT_IN_FORGE_API_URL` | Internal platform APIs | Server | Если рантайм поддерживает эти вызовы |
| `VITE_FRONTEND_FORGE_API_KEY` | Frontend platform access | Public build-time | Использовать только если окружение совместимо |
| `VITE_FRONTEND_FORGE_API_URL` | Frontend platform access | Public build-time | Использовать только если окружение совместимо |

## GitHub Preparation

Подготовка к GitHub уже сделана на уровне структуры проекта: production scripts присутствуют, тестовый набор запускается одной командой, а чувствительные значения не должны коммититься в репозиторий. Перед экспортом нужно убедиться, что в репозиторий не попадают реальные `.env` файлы, локальные выгрузки секретов и пользовательские токены.

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | Экспортировать код в новый репозиторий `braindiggeruz/midea-system` через панель управления | Репозиторий создаётся без секретов |
| 2 | Проверить `.gitignore` и отсутствие `.env` в staged files | Нет утечки credentials |
| 3 | Добавить этот runbook и Telegram operations doc в репозиторий | Инфраструктурная документация хранится рядом с кодом |
| 4 | Настроить branch protection для `main` | Случайные прямые правки ограничены |
| 5 | Подключить Railway к GitHub repository | Автодеплой может запускаться по push |

## Railway Deployment Template

Railway подходит для этого проекта лучше, чем purely static hosting, потому что приложению нужен постоянный **server runtime** для tRPC, Telegram transport и amoCRM webhook endpoint. Если пользователь всё же хочет внешний hosting-провайдер, нужно помнить о возможных несовместимостях; встроенный hosting Manus остаётся более предсказуемым вариантом.

| Setting | Value |
| --- | --- |
| Root directory | repository root |
| Install command | `pnpm install` |
| Build command | `pnpm build` |
| Start command | `pnpm start` |
| Health expectation | Приложение должно поднимать Express runtime без фиксированного хардкода порта |
| Port handling | Railway сам задаёт порт окружением; сервер не должен хардкодить номер порта |

### Railway Secret Mapping

| Railway variable | Source | Mandatory |
| --- | --- | --- |
| `DATABASE_URL` | Production database | Yes |
| `JWT_SECRET` | Secrets manager | Yes |
| `TELEGRAM_BOT_TOKEN` | BotFather / existing secret | Yes |
| `AMOCRM_WEBHOOK_SECRET` | New generated secret | Yes |
| `OAUTH_SERVER_URL` | Existing OAuth setup | Yes |
| `VITE_OAUTH_PORTAL_URL` | Existing OAuth setup | Yes |
| `VITE_APP_ID` | Existing OAuth setup | Yes |
| `BUILT_IN_FORGE_API_KEY` | Platform-specific | Conditional |
| `BUILT_IN_FORGE_API_URL` | Platform-specific | Conditional |
| `VITE_FRONTEND_FORGE_API_KEY` | Platform-specific | Conditional |
| `VITE_FRONTEND_FORGE_API_URL` | Platform-specific | Conditional |

## Cloudflare Layer

Cloudflare в данном проекте должен использоваться как **DNS / proxy / TLS edge layer**, а не как единственный compute-runtime для всего приложения. Причина в том, что панель зависит от Express server, tRPC, webhook processing и Telegram delivery, а это не эквивалентно чистому статическому SPA.

| Recommended Cloudflare role | Why |
| --- | --- |
| DNS management | Удобно привязать пользовательский домен к Railway или встроенному hosting |
| Proxy / TLS | Можно скрыть origin, выдать SSL и управлять кэш-политикой |
| WAF / rate limiting | Подходит для защиты публичных webhook и admin-surface |
| Not primary runtime | Без отдельной адаптации проект не следует переносить в Pages-only или Workers-only режим |

## Safe Production Checklist

| Check | Expected result |
| --- | --- |
| `pnpm test` | Все vitest проходят |
| `pnpm check` | Нет TypeScript ошибок |
| Broadcast manual dispatch | Успешно отправляет сообщения и пишет delivery logs |
| Automation execute now | Создаёт `automationRuns` и `leadCommunications` |
| amoCRM webhook | Отклоняет пустые payload и неверный secret, принимает валидные запросы |
| OAuth login | Redirect flow работает без хардкода домена |

## External Steps Still Requiring User Access

| Task | Why it cannot be completed autonomously |
| --- | --- |
| Создание/подключение личного GitHub repository | Нужен доступ к аккаунту пользователя или явная операция экспорта через UI |
| Настройка Railway project/token/secrets | Нужны production credentials и доступ к аккаунту Railway |
| Настройка Cloudflare zone/DNS | Нужен доступ к домену и аккаунту Cloudflare |

## Recommended Order

Сначала следует экспортировать код в GitHub, затем поднять server runtime в Railway, после этого завести production secrets, проверить webhook и Telegram transport на production URL, и только затем подключать Cloudflare как внешний доменный и защитный слой. Такой порядок снижает риск ситуаций, когда домен уже переключён, а origin ещё не готов принимать webhook или авторизационный трафик.
