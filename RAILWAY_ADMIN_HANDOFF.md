# Railway Admin Handoff

# DEPRECATED — historical handoff

> Этот документ сохранён как промежуточный handoff периода миграции. Для актуального standalone-контура используйте `FINAL_STANDALONE_HANDOFF.md`, а этот файл считайте исторической сводкой.

Этот документ фиксирует текущее состояние внешнего контура для админ-панели **Midea Digital Contour Admin** и даёт короткий маршрут дальнейших действий.

## Current access points

| Назначение | URL | Текущее состояние |
| --- | --- | --- |
| Railway service domain | [midea-digital-contour-admin-production.up.railway.app](https://midea-digital-contour-admin-production.up.railway.app) | отвечает `HTTP 200`, приложение доступно |
| Целевой custom domain | [admin.midea-alba.uz](https://admin.midea-alba.uz) | пока возвращает Railway fallback `HTTP 404` |
| Local dev preview in Manus | доступен через Management UI | dev server работает, TypeScript/LSP без ошибок |

## What is already confirmed

| Проверка | Результат |
| --- | --- |
| Standalone runtime админки на Railway | подтверждён по service domain |
| Railway deploy сервиса `midea-digital-contour-admin` | есть рабочий production deploy |
| Cloudflare DNS для `admin.midea-alba.uz` | указывает на `h7tq7iiv.up.railway.app` |
| Railway DNS status | `DNS_RECORD_STATUS_PROPAGATED` |
| Railway certificate status | `CERTIFICATE_STATUS_TYPE_VALIDATING_OWNERSHIP` |
| Railway redeploy trigger через account token | выполнен успешно |

## Main blocker right now

Оставшийся блокер находится не в коде приложения и не в DNS-записи Cloudflare. После перепривязки домена, обновления CNAME и принудительного redeploy Railway всё ещё держит custom domain в состоянии `VALIDATING_OWNERSHIP`, а `https://admin.midea-alba.uz` возвращает `x-railway-fallback: true`.

## Recommended next steps

1. Подождать, пока Railway завершит edge binding / certificate issuance для `admin.midea-alba.uz`.
2. Если статус не изменится, в Railway support / project diagnostics передать три факта: `DNS propagated`, `currentValue = requiredValue = h7tq7iiv.up.railway.app`, `certificateStatus = VALIDATING_OWNERSHIP`.
3. После смены статуса на issued повторно проверить `https://admin.midea-alba.uz` обычным `curl -I` без fallback-заголовка.
4. При необходимости перепроверить токены и доступы по файлу `EXTERNAL_TOKEN_LINKS.md`.

## Files to review in this repo

| Файл | Назначение |
| --- | --- |
| `RAILWAY_API_NOTES.md` | полная хронология API-проверок, rebind, DNS update и redeploy retry |
| `EXTERNAL_TOKEN_LINKS.md` | прямые ссылки на создание токенов и минимально достаточные права |
| `todo.md` | история выполненных и оставшихся задач |

## Important practical note

Если потребуется ручная проверка Railway UI, в браузере Manus сейчас нет активной Railway-сессии; откроется экран логина. Поэтому для UI-only проверки GitHub linkage или project settings потребуется либо ручной вход пользователя, либо дальнейшая работа через уже выданные API-токены.

## Update — 2026-04-13: Cloudflare proxy validation for `admin.midea-alba.uz`

Проведена дополнительная внешняя проверка после API-переключения DNS-записи `admin.midea-alba.uz` в режим `proxied=true` на стороне Cloudflare.

| Проверка | Фактический результат | Значение для контура |
| --- | --- | --- |
| Cloudflare DNS record update | Применился успешно: `CNAME admin.midea-alba.uz -> h7tq7iiv.up.railway.app`, `proxied=true` | Публичный домен теперь проходит через Cloudflare edge |
| HTTPS на `admin.midea-alba.uz` | Ответ приходит с `server: cloudflare` | Пользовательский TLS на внешнем периметре поднимается уже через Cloudflare |
| Origin routing | Ответ остаётся `HTTP/2 404` с `x-railway-fallback: true` | Railway по-прежнему не матчится на host `admin.midea-alba.uz` |
| Следующий потенциальный обход | Host header / DNS override / SNI override через Cloudflare Origin Rules | Это отдельный класс конфигурации; обычного proxied CNAME недостаточно |

Практический вывод: **простое включение Cloudflare proxy не завершает standalone-контур**. Оно закрывает только внешний TLS-слой, но не устраняет Railway fallback на origin-routing. Полное закрытие `admin.midea-alba.uz` теперь зависит либо от того, что Railway начнёт корректно принимать custom host самостоятельно, либо от наличия Cloudflare-доступа уровня Origin Rules / Host+SNI override.

Дополнительно подтверждено, что имеющийся Cloudflare API token достаточно уверенно работает для DNS-операций, но запросы к rulesets/origin-rules API возвращают authentication error. Поэтому следующий шаг по Host/SNI override нельзя надёжно выполнить полностью автоматически в текущем доступе без более широких Cloudflare permissions или интерактивного входа в Dashboard.
