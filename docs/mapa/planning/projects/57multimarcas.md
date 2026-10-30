---
domain: planning
module: projects
feature: 57multimarcas
summary: Local Maven setup of the external 57multimarcas project, kept separate from the VPS deploy build.
paths: [SETUP.md]
keywords: [57multimarcas, maven, settings, nexus, dockerignore]
updated: 2026-10-30
---
# 57multimarcas Local Maven Setup

Lives outside this repository (workspace `C:/Users/matheuss.rodrigues/git/57multimarcas`, folder `57multimarcas-api/`). It keeps local builds off the Procempa proxy/Nexus without affecting the VPS deploy.

| File | Responsibility |
|---|---|
| `57multimarcas-api/settings-sandbox.xml` | Maven settings with public repositories (no corporate proxy). |
| `57multimarcas-api/.mvn/maven.config` | Local, ignored by git and Docker; holds `-s settings-sandbox.xml` for every `mvn`/`./mvnw` on the machine. |
| `57multimarcas-api/.dockerignore` | Keeps `.mvn/maven.config` out of the image; the VPS build uses default settings. |
| `57multimarcas-api/.gitignore` | Ignores `.mvn/maven.config`. |
