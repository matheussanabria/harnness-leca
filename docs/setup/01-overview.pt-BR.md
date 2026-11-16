# 01. Visão geral: o que o Harness faz

O Harness traz o modelo de **Projetos** do Claude Chat (instruções, memória, arquivos de contexto, histórico de conversas e tarefas agendadas) para as ferramentas de programação com IA que você já usa: **Claude Code**, **Codex**, **Gemini / Antigravity** e **opencode**. O armazenamento e a orquestração são locais. Motores configurados na nuvem podem receber contexto do projeto.

Guias desta série: [02 Instalação](02-installation.pt-BR.md) | [03 Mecanismos e credenciais](03-engines-and-credentials.pt-BR.md) | [04 Primeira sincronização](04-first-sync.pt-BR.md) | [05 Adotar projetos existentes](05-adopt-existing-projects.pt-BR.md). Agentes devem começar por [docs/agents/BOOTSTRAP.md](../agents/BOOTSTRAP.pt-BR.md).

## A ideia em uma imagem

```
        seu trabalho em qualquer mecanismo          harness                         de volta aos mecanismos
  Claude Code  ~/.claude/projects/*.jsonl  --\                                  /--> ~/.claude/.../memory/MEMORY.md
  Codex        ~/.codex/sessions/*.jsonl   ---+--> importar --> projects/<slug>/ ---+--> conhecimento do Gemini / Antigravity
  Antigravity  ~/.gemini/.../brain         ---+    (redigir)    chats/*.md        \--> claude --resume (sessões reidratadas)
  opencode     ~/.local/share/opencode/*.db --/                memory.md
                                                               instructions.md
```

1. **Importação** converte o armazenamento privado de conversas de cada mecanismo para um formato Markdown legível (`projects/<slug>/chats/YYYY-MM-DD-title.md`). Segredos, e-mails, CPF e números de telefone são ocultados durante a importação.
2. **Extração** (opcional) propõe fatos duradouros, regras e decisões com base nessas conversas. Você revisa as propostas na interface web antes que qualquer item seja incluído em `memory.md`.
3. **Exportação** grava a memória organizada no contexto nativo de cada mecanismo, para que uma nova sessão já conheça o projeto.

## Conceitos principais

| Conceito | Onde | Significado |
|---|---|---|
| Projeto | `projects/<slug>/` | Um espaço de trabalho: instruções, memória, contexto, conversas e rotinas agendadas |
| Projeto ativo | `projects/.active` | Uma linha com o slug que o hook injeta no Claude Code a cada mensagem |
| Arquivos globais | `global/instructions.md`, `global/memory.md` | Aplicam-se a todos os projetos |
| Aliases | `projects/.sources.json` | Nomes adicionais de pastas que direcionam conversas a um projeto |
| Mecanismo | Claude, Codex, Gemini, opencode, Ollama | Ferramentas que produzem conversas ou respondem na interface web |

## O que é local e o que tem controle de versão

O repositório contém apenas o **processo** (hook, interface, importadores, modelo e documentação). Estes itens ficam na sua máquina e são ignorados pelo Git: `projects/*` (exceto `_template`), `global/instructions.md`, `global/memory.md`, `global/.env`, registros e estado da interface.

## Comandos principais

| Comando | O que faz |
|---|---|
| `npm run ui` | Interface web em `http://localhost:4321` (projetos, chat, revisão de memória e estúdio) |
| `npm run sync` | Atualiza conversas do Claude Code, Gemini/Antigravity e opencode |
| `npm run export:context` | Exporta a memória organizada para o contexto nativo dos mecanismos |
| `npm run export:claude-sessions` | Recria conversas como sessões para `claude --resume` |
| `node tools/adopt-project.js --path <folder>` | Adiciona ao Harness um projeto existente |
| `npm test` / `npm run check` | Suíte de testes / verificação de sintaxe e integridade |

## Suporte a plataformas

**Por enquanto, somente Windows.** O hook do Claude Code é um script PowerShell (`.claude/hooks/load-project.ps1`). A interface e as ferramentas Node funcionam onde quer que o Node 22.13+ funcione, mas ainda não existe uma versão bash equivalente do hook (item pendente).

## Privacidade em resumo

- O Harness nunca armazena nem copia os logins dos seus mecanismos (consulte [03](03-engines-and-credentials.pt-BR.md)).
- A ocultação de dados é heurística, não uma garantia. Revise `chats/` antes de compartilhar qualquer arquivo dessa pasta.
- Seus projetos não vão para o Git porque `projects/*` é ignorado.
