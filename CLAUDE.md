# Harness Leca — arquitetura de projetos (estilo Claude Chat)

Este workspace replica Projetos do Claude Chat. A cada mensagem, um hook (`.claude/hooks/load-project.ps1`)
injeta automaticamente as instruções e memórias abaixo; não é preciso relê-las.

## Estrutura
- `global/instructions.md` e `global/memory.md`: valem para todos os projetos.
- `projects/.active`: slug do projeto ativo (uma linha).
- `projects/<slug>/instructions.md`: instruções do projeto.
- `projects/<slug>/memory.md`: memória do projeto.
- `projects/<slug>/context/`: arquivos de referência (planilhas, PDFs). Leia sob demanda.
- `projects/<slug>/chats/`: histórico de conversas (`AAAA-MM-DD-titulo.md`).
- `projects/<slug>/scheduled/`: tarefas recorrentes do projeto.
- `projects/_template/`: copie para criar um projeto novo.

## Regras de comportamento
- Memória: quando aprender um fato durável (preferência, contexto, decisão), acrescente `- [AAAA-MM-DD] fato` em `memory.md` do projeto (ou global, se valer para todos). Não duplique; corrija entradas erradas.
- Chats: ao fim de uma conversa relevante, ou quando o usuário pedir, salve um resumo em `chats/`.
- Nunca altere `instructions.md` sem o usuário pedir.
- Trocar de projeto = editar `projects/.active`.
