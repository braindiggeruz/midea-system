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
| Railway compute mode | Persistent service | Для проекта нужен именно long-running service, а не static-only runtime |
| Cloudflare role | DNS + reverse proxy + TLS edge | Не заменяет origin runtime приложения |

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
| Runtime type | Railway Service |
| Install command | `pnpm install` |
| Build command | `pnpm build` |
| Start command | `pnpm start` |
| Health expectation | Приложение должно поднимать Express runtime без фиксированного хардкода порта |
| Port handling | Railway сам задаёт порт окружением; сервер не должен хардкодить номер порта |
| Repo connection | Подключить GitHub repository и включить autodeploy только после заполнения обязательных env |
| Variables | Все production secrets задаются через Railway Variables, а не через `.env` в репозитории |

### Railway repository connect flow

| Step | Action | Verification |
| --- | --- | --- |
| 1 | Экспортировать проект в GitHub-репозиторий пользователя | В репозитории видны актуальные файлы проекта и история handoff |
| 2 | В Railway создать новый проект и выбрать deploy from GitHub repo | Railway видит repository root без дополнительного monorepo path |
| 3 | До первого deploy заполнить обязательные Variables | Сборка не падает на старте из-за отсутствующих secrets |
| 4 | Проверить, что install/build/start команды определились как `pnpm install`, `pnpm build`, `pnpm start` | Railway service собирается без ручного обхода |
| 5 | После первого успешного deploy открыть Railway-generated domain и проверить HTTP 200 / UI load | Origin отвечает до подключения custom domain |
| 6 | Только после этого включать autodeploy и переходить к custom domain | Снижается риск бесконечных redelivery и поломки webhook на сыром окружении |

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

### Cloudflare onboarding sequence

| Step | User action | Expected result |
| --- | --- | --- |
| 1 | Подготовить домен у регистратора и временно отключить DNSSEC | Cloudflare onboarding не ломается на этапе переноса nameservers |
| 2 | Добавить apex domain в Cloudflare | Создаётся DNS zone проекта |
| 3 | Сверить DNS records с текущим провайдером и вручную добавить пропущенные записи | Не теряются рабочие записи сайта, почты и сервисов |
| 4 | Добавить записи для origin из Railway согласно выданным инструкциям Railway по custom domain | Трафик идёт на production origin |
| 5 | Выставить proxy status только для веб-трафика, а чувствительные сервисные записи оставлять DNS-only при необходимости | Снижается риск неожиданных проблем с webhook или сервисными endpoint |
| 6 | Обновить nameservers у регистратора на Cloudflare nameservers | Cloudflare становится authoritative DNS provider |
| 7 | После успешного делегирования завершить SSL/TLS setup и только затем включать дополнительные edge-защиты | Пользователь получает корректный HTTPS-контур |

### Cloudflare webhook routing policy

| Endpoint type | Recommended mode | Reason |
| --- | --- | --- |
| Admin panel and app domain | Proxied through Cloudflare | Даёт TLS edge, WAF и скрытие origin |
| Public webhook endpoint | Начинать с proxied only если webhook provider стабильно работает через Cloudflare; при проблемах подписи/доставки временно переводить конкретную запись или маршрут в DNS-only/bypass strategy | Нельзя допускать потерю критичных webhook из-за слишком агрессивного edge-слоя |
| Mail-related DNS records | DNS only | Иначе легко сломать почтовую доставку |
| Service verification / debug subdomains | DNS only | Удобно для диагностики origin вне proxy-слоя |

Отдельно нужно проверить, что после включения Cloudflare webhook endpoints по-прежнему получают валидный метод, body и заголовки, а проверка подписи или secret не ломается. Для production-панели рекомендуется сначала включить умеренный набор защит: SSL/TLS, базовый WAF, rate limiting на публичные маршруты и запрет лишних методов там, где они не нужны. Более агрессивные transform/rules и bot-fighting настройки лучше включать только после реального smoke-test webhook и OAuth redirect flow.

## Related Handoff Documents

| Document | Purpose |
| --- | --- |
| `EXTERNAL_TOKEN_LINKS.md` | Прямые ссылки на создание токенов GitHub, Railway и Cloudflare, а также минимально достаточные права |
| `RAILWAY_ADMIN_HANDOFF.md` | Текущий статус внешнего Railway-контура, рабочие URL и ближайшие действия по custom domain |
| `RAILWAY_API_NOTES.md` | Подробные результаты API-проверок, rebind, DNS update и redeploy retry |

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
| Настройка Railway custom domain | Требуется управление конкретным Railway project/service и его domain settings |
| Настройка Cloudflare zone/DNS/nameservers | Нужен доступ к домену, регистратору и аккаунту Cloudflare |
| Финальное включение WAF, rate limiting и production SSL policy | Требует решения пользователя по security posture и доступ к Cloudflare dashboard |

## Recommended Order

Сначала следует экспортировать код в GitHub, затем поднять **Railway Service** как production origin, после этого завести production secrets, проверить webhook и Telegram transport на Railway URL, и только затем подключать Cloudflare как внешний доменный и защитный слой. После перевода nameservers нужно отдельно перепроверить SSL/TLS, OAuth redirects, webhook URLs и доступность панели по целевому домену. Такой порядок снижает риск ситуаций, когда домен уже переключён, а origin ещё не готов принимать webhook или авторизационный трафик.
