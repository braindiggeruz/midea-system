# Deprecated Documentation Index

## Canonical document

Актуальным источником для передачи проекта в полностью внешний контур пользователя является документ `FINAL_STANDALONE_HANDOFF.md`. Именно он должен использоваться как основной handoff по инфраструктуре **GitHub + Railway + Cloudflare + домены пользователя**.

## Deprecated documents

| Документ | Статус | Причина |
| --- | --- | --- |
| `DEPLOYMENT_READY_RUNBOOK.md` | Deprecated | Содержит исторические шаги миграции и ранние допущения по auth/env-контуру |
| `TELEGRAM_INTEGRATION_OPERATIONS.md` | Deprecated | Содержит ранние operational notes и старые платформенные оговорки |
| `STANDALONE_RAILWAY_PLAN.md` | Deprecated after migration | Отражает план миграции, а не финальное состояние |
| `STANDALONE_RAILWAY_AUDIT.md` | Historical audit | Полезен как журнал проверки, но не как финальная инструкция |
| `RAILWAY_ADMIN_HANDOFF.md` | Historical handoff | Нужен только как промежуточная стадия между миграцией и финальным standalone handoff |

## Usage rule

Если в deprecated-файлах и в `FINAL_STANDALONE_HANDOFF.md` встречаются расхождения, приоритет всегда имеет `FINAL_STANDALONE_HANDOFF.md`. Устаревшие документы не должны использоваться как production-source-of-truth без отдельной актуализации.
