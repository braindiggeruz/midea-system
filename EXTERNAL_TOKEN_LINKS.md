# External Token Links and Minimum Permissions

Ниже собраны прямые ссылки и минимально достаточные права для автономного обслуживания внешнего контура проекта без лишних полномочий.

| Сервис | Прямая ссылка | Что выпускать | Минимально достаточные права |
| --- | --- | --- | --- |
| GitHub | [github.com/settings/personal-access-tokens/new](https://github.com/settings/personal-access-tokens/new) | Fine-grained personal access token | Доступ только к репозиторию `braindiggeruz/midea-system`; права **Contents: Read and write**, **Metadata: Read-only**, при необходимости **Actions: Read-only** |
| Railway | [railway.com/account/tokens](https://railway.com/account/tokens) | Account token для workspace-level API и project token для конкретного проекта | Для account token достаточно прав на чтение проекта и запуск deploy/redeploy; для project token — доступ к конкретному проекту `midea-digital-contour-admin` |
| Cloudflare | [dash.cloudflare.com/profile/api-tokens](https://dash.cloudflare.com/profile/api-tokens) | Custom API token | **Zone: Read**, **DNS: Edit** только для зоны `midea-alba.uz` |

## Recommended scope policy

Используйте **минимальный scope** и не переиспользуйте один токен для всех систем. Для GitHub достаточно токена, ограниченного одним репозиторием. Для Cloudflare не нужен глобальный ключ аккаунта; безопаснее использовать отдельный API token, ограниченный конкретной зоной. Для Railway практично держать **два уровня**: project token для повседневной автоматизации в пределах одного проекта и account token только для тех действий, где project token не хватает.

## Rotation guidance

| Токен | Когда ротировать |
| --- | --- |
| GitHub PAT | После handoff, смены команды, утечки или завершения миграции деплоя |
| Railway account/project token | После окончания настройки домена, при подозрении на утечку или перед передачей обслуживания другому инженеру |
| Cloudflare API token | После завершения DNS-работ, смены подрядчика или любых сомнений по безопасности |

## Practical note for this project

В текущем проекте уже подтвердилось, что для части Railway GraphQL-операций **project token** подходит для чтения доменных статусов, а **account token** дополнительно позволяет запускать `environmentTriggersDeploy`. Поэтому в эксплуатационной документации следует хранить оба токена раздельно и использовать их по принципу наименьших привилегий.
