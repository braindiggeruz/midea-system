# Deployment Doc Findings

## Railway official docs

Официальная документация Railway подтверждает, что платформа поддерживает три типа compute: **services** для долгоживущих веб-приложений и API, **cron jobs** для периодических задач и **functions** для однофайлового TypeScript-кода. Для текущего проекта правильной моделью является именно **service**, потому что панели нужны Express runtime, tRPC и webhook processing.

Railway рекомендует управлять секретами и конфигурацией через **variables**, а средами — через **environments**. Build/deploy контур строится вокруг настройки сборки и деплоя сервиса, а не вокруг статического хостинга.

Источник: `https://docs.railway.com/build-deploy`

## Cloudflare official docs

Официальная документация Cloudflare по onboarding домена подтверждает, что после подключения домена Cloudflare становится **reverse proxy** и **DNS provider** для сайта. Для полного onboarding требуется: отключить DNSSEC перед переносом, добавить домен в Cloudflare, проверить DNS records, обновить nameservers у регистратора, а затем завершить SSL/TLS setup.

Документация также подчёркивает, что DNS-записи нужно сверять с текущим провайдером и внимательно выбирать proxy status для A/AAAA/CNAME-записей. Это важно для сценария, где origin будет жить в Railway, а Cloudflare будет выполнять роль DNS, TLS и защитного edge-слоя.

Источник: `https://developers.cloudflare.com/fundamentals/manage-domains/add-site/`
