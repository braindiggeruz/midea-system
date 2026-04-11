# Railway CLI Deploy Findings

Источник: https://docs.railway.com/cli/deploying

## Ключевые выводы

- `railway up` загружает текущую директорию и запускает build/deploy в Railway.
- Для автоматизированного деплоя можно использовать `RAILWAY_TOKEN=<project-token> railway up`.
- Project token ограничен deployment-related действиями и привязан к конкретному environment.
- Для деплоя в конкретный проект без link можно использовать `railway up --project <project-id> --environment production`.
- Для multi-service проекта можно явно указать сервис: `railway up --service <service-name>`.
- Для CI-подобного запуска полезен режим `--ci`, а для фонового старта — `-d` / `--detach`.
- `railway redeploy` подходит для повторного запуска того же deployment после изменения переменных окружения.

## Уточнение по сервисам

Источник: https://docs.railway.com/cli/service

Команда `railway service` используется для привязки и управления конкретным сервисом в уже существующем Railway project. Для явного выбора сервиса можно использовать форму `railway service <service-name>`, а для проверки состояния — `railway service status` или `railway service status --all`. Это означает, что безопасная схема деплоя для текущего проекта — сначала связать CLI с нужным project/environment, затем выбрать или привязать нужный service, и только после этого выполнять `railway up`, при необходимости указывая service name явно.

## Аутентификация CLI по официальной документации

Источник: https://docs.railway.com/cli

Официальная документация Railway CLI прямо разделяет типы токенов и переменные окружения: для **project-level actions** нужно использовать `RAILWAY_TOKEN`, а для **account/workspace token** — `RAILWAY_API_TOKEN`. Следовательно, предыдущая проверка account token через `RAILWAY_TOKEN` была некорректной; корректный следующий шаг — повторить `railway link` и команды project management с `RAILWAY_API_TOKEN`, а project token использовать для deployment-команд, где нужен именно project-scoped доступ.
