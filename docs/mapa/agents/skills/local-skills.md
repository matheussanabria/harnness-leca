---
domain: agents
module: skills
feature: local-skills
summary: Local skills under .agents/skills used by the harness.
paths: [.agents/skills/preparar-chat-sincronizacao/**, .agents/skills/harness-intelligence/**]
keywords: [skill, sync, chat, intelligence, dai]
updated: 2026-10-30
---
# Local skills

| File | Responsibility |
|---|---|
| `.agents/skills/preparar-chat-sincronizacao/` | Prepares a conversation as a reviewable preview of project, group, context, decisions and pending items before sync. |
| `.agents/skills/harness-intelligence/` | DAI skill (contract v2) driving phases F0 to F7 of Intelligence & Automation; mirror of `../dai/skills/orquestracao/harness-intelligence/`. |
