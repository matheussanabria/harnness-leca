# Workflow F2 a F7 - Implementacao incremental

Pre-condicao: plano da F1 aprovado.

1. Escolher o menor incremento funcional do backlog; registrar `claim` e `start`.
2. Criar a feature flag que desliga o recurso e preserva o fluxo anterior.
3. Implementar em modulos coesos (SRP), arquivos de ate 300 linhas, reutilizando servicos existentes.
4. Escrever testes antes ou junto; rodar a suite do repositorio (`npm run check` e testes).
5. Validar seguranca: allowlist, validacao de argumentos, path traversal, isolamento por projeto, segredos.
6. Medir contra a linha de base e registrar em `08-results-and-metrics.md`.
7. Atualizar `07-implementation-progress.md`; `complete --evidence` com o comando ou arquivo de prova.
8. Entregar o incremento e parar; nao encadear a proxima etapa sem pedido.
