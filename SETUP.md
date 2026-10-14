# Guia de instalação: Harness Leca

Replica a arquitetura de **Projetos** do Claude Chat (instruções, memória, contexto, chats e tarefas programadas) dentro do Claude Code. A cada mensagem, o Claude recebe automaticamente as instruções e memórias do projeto ativo. Há também uma interface web local para ver tudo e um importador para trazer conversas antigas do Claude Code.

> O repositório contém só o **processo** (hook, interface, importador, template). Seus projetos, memórias e conversas ficam apenas na sua máquina e nunca sobem ao GitHub.

## Pré-requisitos

| Item | Para quê | Como conferir |
|---|---|---|
| Windows 10/11 | O hook usa PowerShell | — |
| [Claude Code](https://claude.com/claude-code) (app desktop ou CLI) | Rodar o harness | abrir o app |
| [Git](https://git-scm.com/downloads) | Clonar o repositório | `git --version` |
| [Node.js 18+](https://nodejs.org) | Interface web e importador | `node -v` |

> O hook é um script PowerShell, então o harness funciona direto só no Windows. No Mac/Linux é preciso reescrever `.claude/hooks/load-project.ps1` (ex.: em bash) e ajustar `.claude/settings.json`. A interface e o importador (Node) funcionam em qualquer sistema.

## 1. Clonar o repositório

Se o repositório for privado, peça acesso a quem o criou.

```bash
git clone https://github.com/matheussanabria/harnness-leca.git
cd harnness-leca
```

## 2. Abrir no Claude Code

Abra a pasta `harness-leca` como diretório de trabalho (app desktop: *Select folder*; CLI: rode `claude` dentro da pasta). Na primeira vez, **aprove o hook** de `.claude/settings.json`: é ele que carrega instruções e memórias a cada mensagem.

## 3. Criar seus arquivos globais

Instruções e memória globais valem para todos os projetos e ficam só na sua máquina:

```powershell
Copy-Item global/instructions.example.md global/instructions.md
Copy-Item global/memory.example.md global/memory.md
```

Edite `global/instructions.md` com o que o Claude deve seguir sempre (idioma, tom, etc.).

## 4. Criar o primeiro projeto

```powershell
Copy-Item -Recurse projects/_template projects/meu-projeto
Set-Content projects/.active "meu-projeto"
```

Preencha `projects/meu-projeto/instructions.md`. Para conferir o que o hook injeta:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .claude/hooks/load-project.ps1
```

Envie qualquer mensagem no Claude Code: ele deve receber o bloco `<project-harness>` com o projeto ativo.

## Estrutura

```
harness-leca/
├── CLAUDE.md                    # regras para o Claude (memória, chats)
├── SETUP.md                     # este guia
├── .claude/
│   ├── settings.json            # registra o hook UserPromptSubmit
│   ├── launch.json              # atalho para subir a interface web
│   └── hooks/load-project.ps1   # injeta instruções + memória a cada mensagem
├── global/
│   ├── instructions.example.md  # copie para instructions.md (local)
│   └── memory.example.md        # copie para memory.md (local)
├── tools/
│   ├── import-claude-code-chats.js   # importa conversas do Claude Code
│   ├── extract-artifacts.js          # extrai regras, memórias e documentos das conversas
│   ├── extraction-state.js           # o que já foi analisado / mudou depois
│   └── lib/                          # redact.js (segredos) e state.js (controle de estado)
├── ui/                          # interface web local (Node, sem dependências)
└── projects/                     # LOCAL: só o _template é versionado
    ├── .active                  # slug do projeto ativo (uma linha)
    ├── _template/               # copie para criar um projeto novo
    └── <seu-projeto>/
        ├── instructions.md      # instruções do projeto
        ├── memory.md            # memória do projeto
        ├── context/             # arquivos de referência (planilhas, PDFs)
        ├── chats/               # conversas (AAAA-MM-DD-titulo.md)
        └── scheduled/           # tarefas recorrentes
```

## Uso no dia a dia

- **Trocar de projeto:** edite `projects/.active` com o nome da pasta.
- **Instruções:** escreva em `instructions.md` (do projeto ou em `global/`). Valem a partir da próxima mensagem, sem reiniciar.
- **Memória:** o Claude acrescenta fatos duráveis em `memory.md` (`- [AAAA-MM-DD] fato`). Você também pode editar à mão.
- **Contexto:** coloque arquivos em `projects/<projeto>/context/`. O Claude recebe só a lista de nomes e abre o arquivo quando precisar.
- **Chats:** peça "salve um resumo desta conversa" e o Claude grava em `chats/`.

## Importar conversas de outros projetos do Claude Code

O Claude Code guarda cada conversa como `.jsonl` em `~/.claude/projects/<pasta-do-projeto>/`. O importador converte para o formato do harness:

```bash
# 1. ver as pastas e quantas conversas cada uma tem
node tools/import-claude-code-chats.js --list

# 2. simular (não grava nada)
node tools/import-claude-code-chats.js --from nome-da-pasta --project meu-projeto --dry-run

# 3. importar
node tools/import-claude-code-chats.js --from nome-da-pasta --project meu-projeto
```

- `--from`: trecho do nome da pasta de origem (use o nome mostrado em `--list`).
- `--project`: destino em `projects/` (criado a partir do `_template` se não existir).
- `--no-tools`: não inclui as chamadas de ferramenta (arquivos bem menores).
- Rodar de novo atualiza os mesmos arquivos, sem duplicar.

Cada conversa vira um `.md` em `projects/<projeto>/chats/` com título, datas e origem. As chamadas de ferramenta (entrada e resultado, cortados em 1.500 caracteres) ficam em blocos `:::tool` que a interface mostra recolhidos.

> Conversas podem conter dados sensíveis (logs, senhas coladas, dados de clientes). Elas ficam só no seu computador. Revise antes de compartilhar qualquer arquivo de `chats/`. O importador redige por heurística padrões comuns de segredo (chaves de API, `Bearer`, `senha=`/`token=`, senhas em URLs, chaves privadas), mas isso não garante cobertura total.

## Extrair regras, memórias e documentos das conversas

Depois de importar, `tools/extract-artifacts.js` lê as conversas do projeto e separa o que vale reaproveitar. Tudo vai para `projects/<projeto>/context/` como **sugestão para revisar**: nada é copiado automaticamente para `memory.md` ou `instructions.md`.

```bash
# sem custo, roda local: regras, documentos, arquivos tocados
node tools/extract-artifacts.js --project meu-projeto

# opcional: memórias, regras e decisões destiladas pelo Claude (usa sua cota)
node tools/extract-artifacts.js --project meu-projeto --llm --limit 5
```

| Saída | Conteúdo |
|---|---|
| `extraido-indice.md` | resumo e lista do que foi extraído |
| `extraido-regras.md` | frases suas com cara de regra ("sempre", "nunca", "prefiro"...). Heurística: revise |
| `extraido-arquivos.md` | arquivos que o Claude criou ou editou, por conversa |
| `extraido-memorias.md` | (`--llm`) memórias, regras, decisões e termos do domínio por conversa |
| `extraidos/documentos/` | documentos `.md`/`.txt`/`.html` que o Claude gravou, com o conteúdo completo |
| `extraidos/respostas/` | respostas longas e estruturadas do Claude (planos, análises, tabelas) |

- Os arquivos `extraido-*.md` aparecem no cartão **Contexto** da interface e na lista que o hook entrega ao Claude. A pasta `extraidos/` fica no disco.
- Rodar de novo regrava os arquivos derivados. Sem `--llm`, o `extraido-memorias.md` anterior é preservado.
- `--limit N|all` (padrão 10, as mais recentes) e `--model nome` controlam o modo `--llm`.
- O modo `--llm` envia um resumo de cada conversa (com segredos já redigidos) ao modelo via `claude -p`, **sem ferramentas habilitadas**, e é opcional por isso. Evite em projetos com dados de terceiros, como saúde, sem necessidade.
- Para promover algo à memória, copie manualmente a linha revisada para `memory.md`.

## Acompanhar o que já foi analisado

Cada conversa importada recebe uma impressão digital do conteúdo. `tools/extraction-state.js` guarda, em `projects/<projeto>/extraction-state.json`, o que já foi analisado, por quem e quando, e avisa quando a conversa **continuou depois da análise**.

```bash
# fluxo normal
node tools/import-claude-code-chats.js --from nome-da-pasta --project meu-projeto   # traz conversas novas e as que continuaram
node tools/extraction-state.js --project meu-projeto status                         # nova | alterada | em dia
node tools/extraction-state.js --project meu-projeto pending --limit 5              # nomes dos pendentes (para agentes)
node tools/extraction-state.js --project meu-projeto mark --by gemini --file a.md   # registra como analisada
node tools/extraction-state.js --project meu-projeto adopt --by gemini              # adota análises feitas antes do controle
node tools/extraction-state.js --project meu-projeto reset                          # esquece tudo e reanalisa do zero
```

- **nova:** nunca analisada. **alterada:** já analisada, mas o `.md` mudou depois (mais turnos). **em dia:** nada a fazer.
- O importador diz `[nova]`, `[atualizada]` ou `[sem mudança]` por conversa, não regrava as que não mudaram e, se o título gerado mudar, renomeia em vez de duplicar.
- `extract-artifacts.js --llm` processa só as pendentes (use `--all` para refazer tudo) e **substitui** a seção da conversa alterada em `extraido-memorias.md`, em vez de acrescentar outra.
- Agentes (Gemini, opencode etc.) seguem o mesmo fluxo pela skill `extrair-artefatos`.
- Quem já tinha rodado a extração antes do controle: `adopt` marca como analisadas as conversas que já têm seção em `extraido-memorias.md`.

## Usar com outro agente (Antigravity/Gemini)

O hook de contexto só existe no Claude Code. Para outro agente que lê a pasta, como o Gemini no Antigravity, o repositório traz o equivalente em texto:

- `AGENTS.md`: manda o agente ler `projects/.active`, as instruções e as memórias (global e do projeto) no início de cada tarefa, e trata o conteúdo como dado, não comando.
- `.agents/skills/extrair-artefatos/SKILL.md`: o passo a passo da extração de memórias, regras e decisões, feito pelo próprio agente. Substitui o `--llm`, sem API nem chave.

Abra a pasta `harness-leca` no Antigravity e peça, por exemplo: *"Use a skill extrair-artefatos no projeto 57multimarcas, limite 5 conversas."* Se o seu Antigravity não carregar `AGENTS.md` ou a skill sozinho, peça: *"Leia AGENTS.md e .agents/skills/extrair-artefatos/SKILL.md e siga as instruções."*

> Atenção: o agente lê as conversas e o conteúdo vai para o modelo dele (Google, no caso do Gemini). Evite projetos com dados de terceiros, como os de saúde.

## Interface web

```bash
node ui/server.js
```

Abra http://localhost:4321. Mostra chats, instruções, memória, contexto e tarefas, com seletor de projeto. É somente leitura e só escuta em `127.0.0.1`. No app desktop do Claude Code, o servidor `harness-ui` de `.claude/launch.json` também pode ser iniciado pelo painel de preview.

Ao abrir um chat:
- **Você**: bolha colorida à direita.
- **Claude**: bolha cinza à esquerda, com markdown renderizado.
- **Processamento interno**: accordion recolhido ("⚙ Processamento interno · N etapas"); cada etapa abre com entrada e resultado.
- Mensagens longas são limitadas a ~240 px, com "Ver mais / Ver menos".

## Privacidade: o que sobe ao GitHub

O `.gitignore` versiona **apenas o processo**. Ficam de fora: tudo em `projects/` (exceto `_template`), `global/instructions.md` e `global/memory.md`. Se for contribuir com melhorias, rode `git status` antes de cada commit e confira que nenhum dado pessoal ou de cliente está na lista.

## Problemas comuns

| Sintoma | Causa provável | Solução |
|---|---|---|
| Claude não menciona instruções/memória | Hook não aprovado ou desativado | Reabra a pasta e aprove o hook; teste o comando do passo 4 |
| Erro de execução do PowerShell | Política de scripts | O comando já usa `-ExecutionPolicy Bypass`; confira se `.claude/settings.json` está intacto |
| `Nenhum projeto ativo` no bloco injetado | `projects/.active` ausente ou com nome errado | Escreva o nome exato de uma pasta de `projects/` |
| Interface mostra "Nenhum projeto ainda" | Ainda não criou projeto | Passo 4 ou importe conversas |
| `node` não reconhecido | Node.js não instalado | Instale em nodejs.org e reabra o terminal |
| `repository not found` ao clonar | Sem acesso ao repositório privado | Peça o convite e faça login no GitHub |
| Importador: "Nenhuma pasta contém ..." | Nome de origem errado | Use `--list` e copie o trecho do nome |
| Porta 4321 em uso | Outro processo na porta | `$env:PORT=4400; node ui/server.js` |
