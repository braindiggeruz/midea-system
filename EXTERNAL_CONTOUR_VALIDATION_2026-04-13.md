# External Contour Validation — 2026-04-13

## Browser validation snapshots

### Cloudflare dashboard session

При прямом открытии `https://dash.cloudflare.com/` браузер попал на экран логина, а не в уже активную сессию. Это означает, что через текущую браузерную сессию нельзя быстро проверить или менять zone settings / origin rules в Cloudflare UI без отдельного ручного входа.

### Cloudflare Docs: Origin Rules settings

По официальной документации Cloudflare Origin Rules подтверждены следующие механизмы.

| Возможность | Что подтверждено docs | Практический смысл для `admin.midea-alba.uz` |
| --- | --- | --- |
| Host header override | Cloudflare умеет переписывать `Host` header запроса к origin | Это теоретически позволяет отправлять пользовательский трафик на Railway service domain, даже если публичный host остаётся `admin.midea-alba.uz` |
| DNS record override | Cloudflare умеет переопределять origin hostname для proxied-record | Это даёт теоретический способ отправлять запросы на другой upstream, не меняя публичный домен |
| SNI override | Cloudflare умеет отдельно переопределять SNI | Это критично для origin, где TLS зависит от правильного SNI |
| Host override dependency | Docs прямо отмечают, что при переписывании `Host` в большинстве случаев нужен и DNS record override | Для Railway-кейса одного только proxy часто недостаточно; нужен контролируемый origin-routing |

## Live validation through API and public HTTPS

Через Cloudflare API подтверждено, что запись `admin.midea-alba.uz` существует как `CNAME -> h7tq7iiv.up.railway.app` и может быть переведена в `proxied=true`.

После включения proxy внешний HTTPS уже обслуживается Cloudflare edge, что видно по заголовку `server: cloudflare`. Однако запросы на `https://admin.midea-alba.uz` всё равно возвращают Railway fallback `HTTP/2 404` с заголовком `x-railway-fallback: true`.

| Проверка | Результат | Вывод |
| --- | --- | --- |
| Cloudflare proxy enable | применилось успешно через API | edge TLS со стороны Cloudflare включён |
| `https://admin.midea-alba.uz` после proxy | `HTTP/2 404`, `server: cloudflare`, `x-railway-fallback: true` | Cloudflare edge работает, но Railway всё ещё не матчится на хост `admin.midea-alba.uz` |
| Railway app service domain | ранее уже подтверждён `HTTP 200` | origin-приложение живо, блокер остаётся на доменном bind / host-routing |

## Practical interpretation

На текущий момент простой перевод DNS-записи в Cloudflare proxied mode **не закрывает** внешний контур полностью. Он исправляет пользовательский TLS-handshake на внешнем периметре, но не устраняет Railway host fallback.

Следовательно, реальный остаточный внешний блокер сейчас один из двух:

1. Railway так и не завершил корректный custom-domain host binding для `admin.midea-alba.uz`.
2. Для обхода Railway binding потребуется более сильная Cloudflare-конфигурация уровня **Origin Rules** с Host/SNI override, а не только обычный proxied CNAME.
