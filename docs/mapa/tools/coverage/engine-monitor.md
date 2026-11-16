---
domain: tools
module: coverage
feature: engine-monitor
summary: Engine presence polling, activity classification, state machine and thresholds.
paths: [tools/lib/engine-monitor/activity-classifier.js, tools/lib/engine-monitor/activity-machine.js, tools/lib/engine-monitor/monitor.service.js, tools/lib/engine-monitor/presence-cli.js, tools/lib/engine-monitor/presence-opencode.js, tools/lib/engine-monitor/thresholds.js]
keywords: [engine monitor, presence, activity, OpenCode, CLI, thresholds]
updated: 2026-11-16
---
# Engine monitor

| File | Responsibility |
|---|---|
| `tools/lib/engine-monitor/activity-classifier.js` | EN: Maps observed engine commands and events to activity categories. PT: Classifica comandos e eventos observados dos mecanismos em categorias de atividade. |
| `tools/lib/engine-monitor/activity-machine.js` | EN: Advances engine activity states with time decay and dwell rules. PT: Atualiza estados de atividade dos mecanismos com decaimento temporal e permanência. |
| `tools/lib/engine-monitor/monitor.service.js` | EN: Coordinates presence probes, activity classification and monitor state. PT: Coordena sondagens de presença, classificação de atividade e estado do monitor. |
| `tools/lib/engine-monitor/presence-cli.js` | EN: Detects recent session presence for command-line engines. PT: Detecta presença recente de sessão nos mecanismos de linha de comando. |
| `tools/lib/engine-monitor/presence-opencode.js` | EN: Checks local opencode server presence and health without reading config endpoints. PT: Verifica presença e saúde do servidor opencode local sem consultar endpoints de configuração. |
| `tools/lib/engine-monitor/thresholds.js` | EN: Loads and validates engine-monitor timing thresholds with defaults. PT: Carrega e valida limiares temporais do monitor com valores padrão. |
