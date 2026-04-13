# Final Standalone Handoff — Midea x Cobalt

## Executive summary

Текущий контур проекта **переведён на внешний репозиторный и deployment-сценарий пользователя** настолько, насколько это возможно в рамках уже выполненных работ. Локальный git remote перепривязан на репозиторий пользователя `https://github.com/braindiggeruz/midea-system.git`, а standalone-auth и базовый Railway-ready runtime уже подготовлены в коде. При этом финальное закрытие инфраструктурного контура всё ещё упирается не в код приложения, а в внешний edge/domain слой для `admin.midea-alba.uz`.

На текущем этапе нужно различать две части. Первая часть — **маркетингово-продуктовая**: механика Telegram-розыгрыша Midea x Cobalt, сценарии прогрева, тексты бота, CTA, FAQ и рекламные концепции уже собраны. Вторая часть — **инфраструктурная**: GitHub-путь и Railway runtime подготовлены, но custom domain `admin.midea-alba.uz` пока не подтверждён Railway edge и требует отдельного дожима через Railway/Cloudflare.

## Current external contour

| Контур | Текущее состояние | Комментарий |
| --- | --- | --- |
| Git repository | `origin -> https://github.com/braindiggeruz/midea-system.git` | Локальный git-контур перепривязан на GitHub пользователя |
| Railway application runtime | Работает по service domain | Standalone-сборка и запуск подтверждены ранее по Railway service domain |
| Target admin domain | `admin.midea-alba.uz` | DNS указывает на Railway target, но внешний host всё ещё не матчится стабильно |
| Cloudflare zone | `midea-alba.uz` | Доступ для DNS-операций подтверждался, но права на Origin Rules были недостаточны |
| Telegram bot channel | `@mideasystembot` | Используется как основная входная точка в кампании |

## What is already detached

После повторного аудита видно, что **прямые OAuth-следы и клиентские редиректы на старый platform-login контур из прикладного кода убраны**. Актуальный `server/_core/env.ts` больше не опирается на `VITE_APP_ID`, `VITE_OAUTH_PORTAL_URL`, `OAUTH_SERVER_URL` и `OWNER_OPEN_ID` как на обязательные переменные, а использует standalone-переменные вида `APP_BASE_URL`, `SESSION_SECRET`, `STANDALONE_ADMIN_EMAIL`, `STANDALONE_ADMIN_PASSWORD` и `TELEGRAM_BOT_TOKEN`.

Дополнительно подтверждено, что в исходниках не осталось прямых текстовых следов старого OAuth-контура в рабочих файлах клиента и сервера. Повторный поиск показал остаточные упоминания только в документации и плановых материалах, а не в прикладной логике. Это означает, что **основной runtime и auth-контур уже выведены из прямой зависимости от старого login-flow**.

## What still needs to be treated as external blocker

Оставшийся блокер находится в доменном слое. Railway service domain отвечает, однако `admin.midea-alba.uz` всё ещё не даёт устойчивого рабочего внешнего доступа. Ранее уже подтверждалось состояние вида Railway fallback / validating ownership, а дополнительная проверка Cloudflare proxy не сняла проблему сопоставления origin host.

Отдельно важно, что в проекте всё ещё есть helper-слой с переменными `SERVICE_GATEWAY_URL` и `SERVICE_GATEWAY_API_KEY`. Эти переменные используются не для auth-входа, а для вспомогательных server-side интеграций: LLM, storage, maps, transcription и части data API. Если пользователю нужен **абсолютно чистый Railway-only контур без какого-либо внешнего gateway**, этот слой нужно либо перевести на его собственные сервисы, либо выключить там, где он фактически не нужен в production-цепочке кампании.

## Residual technical dependencies to resolve

| Область | Текущее состояние | Что сделать |
| --- | --- | --- |
| Custom domain `admin.midea-alba.uz` | DNS указывает на Railway, но внешний host не завершён | Дожать Railway domain binding или применить Cloudflare Origin Rule workaround |
| Cloudflare token scope | DNS-доступ был, Origin Rules — недостаточны | Выпустить новый API token с доступом к Zone Read, DNS Edit, Origin Rules Edit, Zone Settings Edit |
| Service gateway helpers | Используют `SERVICE_GATEWAY_URL` и `SERVICE_GATEWAY_API_KEY` | Либо оставить как отдельный внешний сервис пользователя, либо заменить/отключить |
| Documentation residue | В старых runbook-файлах ещё есть исторические упоминания прежней платформенной среды | Переписать или архивировать устаревшие документы и использовать этот handoff как основной |

## Recommended production env set

| Переменная | Назначение | Обязательность |
| --- | --- | --- |
| `APP_BASE_URL` | Канонический внешний base URL приложения | Да |
| `SESSION_SECRET` | Подпись cookie/session | Да |
| `DATABASE_URL` | Подключение к production БД | Да |
| `STANDALONE_ADMIN_EMAIL` | Логин первого администратора | Да |
| `STANDALONE_ADMIN_PASSWORD` | Пароль первого администратора | Да |
| `STANDALONE_ADMIN_NAME` | Имя администратора | Желательно |
| `TELEGRAM_BOT_TOKEN` | Telegram Bot API для кампаний, уведомлений и follow-up | Да |
| `OWNER_NOTIFICATION_WEBHOOK_URL` | Канал owner notifications, если нужен | Опционально |
| `OWNER_NOTIFICATION_TELEGRAM_CHAT_ID` | Telegram chat для owner notifications | Опционально |
| `SERVICE_GATEWAY_URL` | Внешний gateway для helper-интеграций | Опционально, если используются соответствующие функции |
| `SERVICE_GATEWAY_API_KEY` | Ключ к внешнему gateway | Опционально, если используются соответствующие функции |

## Campaign package status

Контентный пакет кампании **Midea x Cobalt для рынка Узбекистана** уже проработан: механика розыгрыша, воронка Telegram-бота, узбекоязычный прогрев, тексты CTA, дожимы, FAQ и рекламные концепции подготовлены. С практической точки зрения это означает, что маркетинговая часть может быть перенесена в production-контур сразу после фиксации финальных технических точек входа: рабочего домена, production bot webhook и постоянных env-переменных.

Для бота необходимо сохранить узбекоязычное приветствие и основной рекламный вход через Telegram. Для административного слоя, наоборот, предпочтителен русский интерфейс. Эта языковая схема уже соответствует ранее согласованной модели использования.

## Concrete next-step sequence

| Шаг | Действие | Ожидаемый результат |
| --- | --- | --- |
| 1 | Выпустить новый Cloudflare API token с полным доступом к нужным zone-level настройкам | Появляется возможность применить Origin Rules workaround или полноценно перепроверить DNS/origin слой |
| 2 | Повторно проверить custom domain в Railway и при необходимости инициировать rebind | Railway начинает корректно матчить `admin.midea-alba.uz` |
| 3 | Зафиксировать production env в Railway | Приложение поднимается без временных значений и ручных подстановок |
| 4 | Решить судьбу `SERVICE_GATEWAY_*` зависимостей | Либо остаются как внешний сервис пользователя, либо исключаются из production-функций |
| 5 | Перенести финальные bot/landing материалы в рабочий контур | Кампания готова к запуску без смешения с внутренними preview-контурами |

## Practical handoff note

Этот документ следует считать **основной точкой handoff** для пользователя. Старые документы, в которых ещё встречаются исторические упоминания прежней платформенной среды, лучше рассматривать как внутреннюю хронологию миграции, а не как актуальную production-инструкцию. Если требуется, следующим шагом можно целенаправленно переписать старые runbook-файлы под этот же standalone-стандарт и заархивировать устаревшие версии.
