# Épico 03 — Modo Shadow

## Visão Geral
Módulo de interceptação passiva que monitora os pedidos enviados pelo usuário, executa a classificação local em segundo plano (background não bloqueante) e registra os insights sem afetar a resposta do motor ativo (Claude, Codex, Gemini ou OpenCode).

## Histórias de Usuário
- [03.01](03.01-shadow-interceptor.md): Interceptor não-bloqueante no fluxo de chat com zero fallback para nuvem.
