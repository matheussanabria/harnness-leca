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
- `MAPA.md`: índice da arquitetura e responsabilidades de cada arquivo para economia de tokens.

## Regras de comportamento
- Memória: quando aprender um fato durável (preferência, contexto, decisão), acrescente `- [AAAA-MM-DD] fato` em `memory.md` do projeto (ou global, se valer para todos). Não duplique; corrija entradas erradas.
- Chats: ao fim de uma conversa relevante, ou quando o usuário pedir, salve um resumo em `chats/`.
- Nunca altere `instructions.md` sem o usuário pedir.
- Trocar de projeto = editar `projects/.active`.
- **Modularidade & Eficiência de Tokens:** Mantenha arquivos de código entre 150 e 250 linhas (teto máximo de 300). Não crie ou expanda "God Files" monolíticos; decomponha responsabilidades (SRP) em submódulos e subpastas especializadas.
- **Padrão de Ícones (Proibição de Emojis):** Proibido o uso de emojis na UI e código; utilize exclusivamente ícones vetoriais do FontAwesome (`fa-solid` / `fa-regular`).
- **Mapa de Arquivos:** ao criar, mover, dividir ou remover arquivos, atualize o `MAPA.md` na mesma tarefa (caminho e o que o arquivo faz, na tabela da área correspondente). Tarefa que cria arquivos só está concluída com o `MAPA.md` atualizado.
