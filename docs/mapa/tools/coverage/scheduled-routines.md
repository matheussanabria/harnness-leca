---
domain: tools
module: coverage
feature: scheduled-routines
summary: Scheduled routine parsing, execution and Windows Task Scheduler integration.
paths: [tools/run-scheduled.js, tools/schedule-windows.js, tools/lib/routines.js]
keywords: [scheduled, routines, tasks, Windows, cron, lock]
updated: 2026-11-16
---
# Scheduled routines

| File | Responsibility |
|---|---|
| `tools/run-scheduled.js` | EN: Lists and runs due project routines, with dry-run and file logging options. PT: Lista e executa rotinas vencidas dos projetos, com simulação e registro em arquivo. |
| `tools/schedule-windows.js` | EN: Previews, installs, checks or removes the Windows scheduled task for routines. PT: Pré-visualiza, instala, consulta ou remove a tarefa agendada de rotinas no Windows. |
| `tools/lib/routines.js` | EN: Parses, schedules, locks and runs validated project routine actions. PT: Interpreta, agenda, bloqueia e executa ações validadas de rotina do projeto. |
