# Workflow F0 - Auditoria e diagnostico

Somente leitura. Nenhuma alteracao de producao.

1. Ler `AGENTS.md`, `CLAUDE.md`, `MAPA.md`, `README.md`, `SETUP.md`; verificar a convencao de `docs/`.
2. Consultar a caixa de entrada de coordenacao e registrar posse (`claim`, `start`).
3. Mapear motores e adaptadores (`tools/lib/engines/`), hooks (`.claude/hooks`), sincronizacao (`tools/sync.js`) e exportacao de contexto (`tools/export-context.js`).
4. Medir o payload real injetado por mensagem em cada motor; so entao concluir sobre duplicacao.
5. Inventariar scripts, MCPs e automacoes reutilizaveis (HIA-002).
6. Levantar metricas disponiveis por motor e como obter a linha de base (HIA-003).
7. Verificar Windows, WSL2, Docker e Ollama (somente consulta; sem instalar).
8. Produzir `01-current-state-audit.md` no formato de `references/05-formato-da-resposta.md`.
9. Encerrar com `complete --evidence` e aguardar revisao.
