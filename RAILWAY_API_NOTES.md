# Railway API Notes

- Public GraphQL endpoint: `https://backboard.railway.com/graphql/v2`.
- Account/workspace tokens use header `Authorization: Bearer <TOKEN>`.
- Project tokens use header `Project-Access-Token: <TOKEN>`.
- Переданный project token успешно валидирован и даёт доступ к проекту `f273c761-ce40-4aa2-a6d8-7490c3e257a0` и environment `9caa05f0-b0fd-4aba-b284-19b5f8ce18e1`.
- Переданный account token на запрос `me` вернул `Not Authorized`, поэтому для текущих действий используется project token.
- Сервис админки: `midea-digital-contour-admin`, serviceId `5ae8aa1f-e096-4a89-8204-28f1d4361d0c`.
- Запрос списка доменов: `domains(projectId, environmentId, serviceId)`.
- По текущей проверке у админки есть Railway domain `midea-digital-contour-admin-production.up.railway.app`.
- Custom domain у админки: `admin.midea-alba.uz`.
- DNS CNAME уже указывает на `gn366fjx.up.railway.app`, статус DNS — propagated.
- Сертификат custom domain пока не выпущен окончательно: `CERTIFICATE_STATUS_TYPE_VALIDATING_OWNERSHIP`.
- Для проверки текущего production deployment используется запрос `deployments(input, first)` с фильтром `successfulOnly`.
- Для запуска нового деплоя доступна мутация `environmentTriggersDeploy(input)`.

## Domains API detail

Официальный запрос списка доменов сервиса имеет вид `domains(projectId, environmentId, serviceId)`, где возвращаются `serviceDomains` и `customDomains`. Для custom domain статус берётся из `status.dnsRecords` и `status.certificateStatus`. Для поддомена Railway ожидает CNAME на Railway service domain; статусы DNS: `PENDING`, `VALID`, `INVALID`; статусы сертификата: `PENDING`, `ISSUED`, `FAILED`.

## Confirmed check on 2026-04-11

Корректная сигнатура GraphQL для deployment list: `deployments(input: DeploymentListInput!, first: Int)`. В `input` передаются `projectId`, `serviceId`, `environmentId`; для latest active deployment используется `status: { successfulOnly: true }`.

Текущая проверка Railway API по доменам подтвердила следующее.

| Тип | Значение | Наблюдение |
| --- | --- | --- |
| Service domain | `midea-digital-contour-admin-production.up.railway.app` | опубликован Railway |
| Custom domain | `admin.midea-alba.uz` | привязан к сервису |
| DNS target | `gn366fjx.up.railway.app` | `requiredValue` совпадает с `currentValue` |
| DNS status | `DNS_RECORD_STATUS_PROPAGATED` | Railway видит запись как распространённую |
| Certificate status | `CERTIFICATE_STATUS_TYPE_VALIDATING_OWNERSHIP` | SSL ещё не активирован |

Согласно Railway Docs, после корректной DNS-настройки Railway обычно выпускает Let's Encrypt сертификат в течение примерно часа. Однако для проксируемых доменов через Cloudflare (orange cloud) Railway может не суметь выпустить собственный сертификат. В таком режиме трафик Cloudflare → Railway всё равно может быть зашифрован стандартным сертификатом `*.up.railway.app`, а в Cloudflare рекомендуется режим SSL/TLS `Full`, поскольку `Full (Strict)` не будет работать ожидаемым образом, пока Railway не выпустит сертификат на сам custom domain.

## Confirmed deployment and live routing check (2026-04-11)

- Упрощённый GraphQL-запрос `deployments(input: ..., first: 1)` успешно вернул latest successful deployment без ошибок схемы.
- Подтверждённый deployment:
  - `id`: `e7e5ca1b-a3a6-4abf-81a0-1a6d8eff99ab`
  - `status`: `SUCCESS`
  - `createdAt`: `2026-04-11T04:42:22.594Z`
  - `staticUrl`: `admin.midea-alba.uz`
- Railway service URL `https://midea-digital-contour-admin-production.up.railway.app` отвечает `HTTP/2 200` и отдаёт приложение, значит сам production deploy жив.
- Проверка `https://admin.midea-alba.uz` с `curl -k` показывает не приложение, а Railway edge fallback:
  - `HTTP/2 404`
  - body: `{"status":"error","code":404,"message":"Application not found"...}`
  - `x-railway-fallback: true`
  - серверный сертификат сейчас выпущен только на `CN=*.up.railway.app`
- Практический вывод: проблема уже не в сборке и не в runtime приложения. Сейчас узкое место — привязка custom domain на стороне Railway edge / certificate issuance. Домен резолвится в сторону Railway, но Railway ещё не завершил ownership/certificate binding для host `admin.midea-alba.uz`.
- Безопасный следующий шаг, если статус не изменится после ожидания окна выпуска сертификата: удалить и заново добавить custom domain в Railway, затем повторно проверить DNS status, certificate status и ответ `https://admin.midea-alba.uz`.

## Domain rebind result (2026-04-11, follow-up)

- Выполнена перепривязка custom domain `admin.midea-alba.uz` через Railway GraphQL:
  - старый custom domain id: `022494e7-87c2-4f93-8aa1-b1967a3756ad`
  - новый custom domain id: `d4839c6b-c9d8-402a-8fa4-17c0a05b0890`
- После повторного `customDomainCreate` Railway выдал **новый required target** для DNS: `h7tq7iiv.up.railway.app`.
- Фактический DNS у поддомена по-прежнему указывает на **старое** значение `gn366fjx.up.railway.app`, поэтому перепривязка на стороне Railway сама по себе ещё не завершила выпуск сертификата.
- Повторная проверка `domains(...)` после перепривязки показала:
  - `domain`: `admin.midea-alba.uz`
  - `dnsRecords.hostlabel`: `admin`
  - `dnsRecords.requiredValue`: `h7tq7iiv.up.railway.app`
  - `dnsRecords.currentValue`: `gn366fjx.up.railway.app`
  - `certificateStatus`: `CERTIFICATE_STATUS_TYPE_VALIDATING_OWNERSHIP`
- Повторная проверка `https://admin.midea-alba.uz` всё ещё возвращает Railway fallback `HTTP/2 404` с `x-railway-fallback: true`, что согласуется с незавершённой доменной привязкой.
- Актуальный практический вывод: теперь узкое место уже не в Railway deploy и не в самом приложении, а в **обновлении DNS-записи `admin` на новый Railway target**. Пока DNS не будет переключён с `gn366fjx.up.railway.app` на `h7tq7iiv.up.railway.app`, Railway не сможет завершить ownership/certificate binding для нового domain binding.

## Cloudflare DNS update result (2026-04-11, API follow-up)

- Новый Cloudflare API token успешно прошёл усиленную vitest-проверку: чтение зоны `midea-alba.uz` и доступ к `DNS Records API` подтверждены.
- Через Cloudflare API обновлена DNS-запись `admin.midea-alba.uz`:
  - `zoneId`: `d6c376e0b51c35159d0caa38514044a9`
  - `recordId`: `2bfa6252f4b6f3c554712807d7668bd3`
  - `target`: `h7tq7iiv.up.railway.app`
  - `proxied`: `false`
  - `ttl`: `1` (automatic)
- Публичная проверка через DNS-over-HTTPS уже подтверждает новый CNAME:
  - `admin.midea-alba.uz -> h7tq7iiv.up.railway.app`
- Сразу после переключения записи и новый Railway target `https://h7tq7iiv.up.railway.app`, и custom domain `https://admin.midea-alba.uz` всё ещё отвечают Railway edge fallback `HTTP/2 404` с `x-railway-fallback: true`.
- Практический вывод на этот момент: DNS уже переключён корректно, но Railway edge/domain binding ещё не сошёлся с новым target. Следующий шаг — повторно проверить статус custom domain в Railway API спустя небольшое окно распространения и убедиться, что `certificateStatus` ушёл из `VALIDATING_OWNERSHIP`.

## Post-switch validation snapshot (2026-04-11, after propagation checks)

Повторная проверка после короткого окна ожидания подтвердила, что DNS уже смотрит на новый Railway target. Через `getent` и DNS-over-HTTPS поддомен `admin.midea-alba.uz` разрешается в `h7tq7iiv.up.railway.app`, то есть Cloudflare DNS-изменение фактически вступило в силу.

| Проверка | Результат | Вывод |
| --- | --- | --- |
| `admin.midea-alba.uz` CNAME | `h7tq7iiv.up.railway.app` | DNS обновлён корректно |
| `https://admin.midea-alba.uz` | `HTTP/2 404`, `x-railway-fallback: true` | custom domain ещё не сматчен Railway edge |
| TLS для `admin.midea-alba.uz` | сертификат `CN=*.up.railway.app` | сертификат на custom domain ещё не выпущен |
| `https://h7tq7iiv.up.railway.app` | `HTTP/2 404`, `x-railway-fallback: true` | новый target пока не начал обслуживать приложение |
| `https://midea-digital-contour-admin-production.up.railway.app` | `HTTP/2 200` | production deploy самого приложения жив |

Практический вывод после всех изменений: приложение на Railway работает, DNS уже переведён на новый target, однако новый custom-domain binding на стороне Railway edge всё ещё не активировался. Оставшийся блокер теперь сосредоточен не в коде, не в Cloudflare DNS и не в runtime dev-сервера, а в завершении Railway domain binding / certificate issuance для `admin.midea-alba.uz`.

## Final Railway API re-check (2026-04-13)

Через сохранённый Railway project token выполнена повторная GraphQL-проверка по `customDomain(id, projectId)` и `domains(projectId, environmentId, serviceId)` для сервиса `midea-digital-contour-admin`.

| Поле | Актуальное значение | Вывод |
| --- | --- | --- |
| `customDomain.id` | `d4839c6b-c9d8-402a-8fa4-17c0a05b0890` | активная перепривязанная запись Railway |
| `domain` | `admin.midea-alba.uz` | тот же custom domain |
| `serviceId` | `5ae8aa1f-e096-4a89-8204-28f1d4361d0c` | домен по-прежнему привязан к сервису админки |
| `requiredValue` | `h7tq7iiv.up.railway.app` | Railway ожидает новый target |
| `currentValue` | `h7tq7iiv.up.railway.app` | Railway уже видит корректный DNS |
| `dns status` | `DNS_RECORD_STATUS_PROPAGATED` | DNS-блокер снят |
| `certificateStatus` | `CERTIFICATE_STATUS_TYPE_VALIDATING_OWNERSHIP` | оставшийся блокер сейчас на стороне Railway certificate / edge binding |

Практический вывод после финальной API-проверки: с нашей стороны DNS уже выставлен корректно, custom domain привязан к правильному сервису, а оставшаяся проблема больше не выглядит как ошибка кода, Cloudflare DNS или неверного target. На текущий момент узкое место находится на стороне Railway edge binding / certificate issuance для `admin.midea-alba.uz`.

## Redeploy retry via Railway API (2026-04-13)

После финального подтверждения DNS была выполнена ещё одна безопасная корректирующая попытка: запуск redeploy через мутацию `environmentTriggersDeploy`.

| Проверка | Результат |
| --- | --- |
| `environmentTriggersDeploy` с project token | `Bad Access` |
| `environmentTriggersDeploy` с account token | `true` |
| `https://admin.midea-alba.uz` после redeploy trigger | всё ещё `HTTP/2 404` и `x-railway-fallback: true` |
| Railway `domains(...)` после redeploy trigger | `requiredValue=currentValue=h7tq7iiv.up.railway.app`, `DNS_RECORD_STATUS_PROPAGATED`, `certificateStatus=CERTIFICATE_STATUS_TYPE_VALIDATING_OWNERSHIP` |

Итог после redeploy-попытки: даже принудительный redeploy сервиса не перевёл custom domain в активное состояние и не сдвинул выпуск сертификата дальше стадии `VALIDATING_OWNERSHIP`. Это ещё сильнее подтверждает, что оставшийся блокер находится на стороне Railway edge/certificate pipeline, а не в коде приложения, DNS-записи Cloudflare или runtime-конфигурации standalone-админки.

## Additional TLS recheck (2026-04-13, later)

После дополнительного ожидания была выполнена ещё одна точечная прямая проверка обоих доменов.

| Проверка | Результат | Вывод |
| --- | --- | --- |
| `https://midea-digital-contour-admin-production.up.railway.app` | `HTTP/2 200`, `server: railway-edge`, `x-powered-by: Express` | origin админки жив и продолжает обслуживать приложение |
| `https://admin.midea-alba.uz` | `curl: (35) error:0A000126:SSL routines::unexpected eof while reading` | custom domain уже спотыкается непосредственно на TLS/edge-handshake, а не доходит до нормального HTTP-ответа |

Этот сдвиг от `HTTP 404 x-railway-fallback` к TLS EOF не указывает на проблему в коде приложения. Наоборот, он дополнительно усиливает вывод, что остаточный дефект находится на стороне Railway custom-domain edge / certificate issuance pipeline.
