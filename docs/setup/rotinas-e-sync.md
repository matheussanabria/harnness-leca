# Rotinas, revisão de memória e sincronização

Parte do [guia de instalação](../../SETUP.md) do Harness Leca.

## Rotinas (tarefas recorrentes)

Cada rotina é um arquivo em `projects/<projeto>/scheduled/*.md`, com um cabeçalho simples (veja `projects/_template/scheduled/exemplo-extrair-pendentes.md`):

| Campo | Valores |
|---|---|
| `acao` | `sync` (importa as conversas novas), `extrair` (sugestões de memória das pendentes), `sync-extrair` (os dois, em ordem) ou `prompt` (um texto livre, que vai no corpo do arquivo) |
| `intervalo` | de `15m` a `90d` (`m`, `h`, `d`) |
| `ativa` | `true` ou `false` |
| `engine`, `modelo` | `claude` ou `opencode`; para o opencode, só modelos `opencode/...-free` (veja a seção da extração) |
| `limite` | quantas conversas analisar por execução (1 a 200; padrão 10) |

As ações são fixas: o arquivo **nunca** fornece um comando, só escolhe uma ação e seus parâmetros (validados). A ação `prompt` recebe, como dado, as instruções, a memória e os títulos das conversas recentes do projeto, e grava o resultado (já redigido) em `scheduled/resultados/`.

```bash
node tools/run-scheduled.js --list                         # rotinas, última execução e próxima
node tools/run-scheduled.js                                # roda as que venceram, em todos os projetos
node tools/run-scheduled.js --project dai --now extrair-pendentes   # roda uma agora, fora do prazo
node tools/run-scheduled.js --dry-run                      # mostra o que rodaria
```

- O estado fica em `projects/<projeto>/routines-state.json`. Uma rotina que falha tenta de novo em até 1 hora (ou no intervalo, se for menor), e uma falha não impede as outras. Uma trava impede duas execuções ao mesmo tempo no mesmo projeto.
- **Execução automática no Windows:** `node tools/schedule-windows.js` mostra o comando; `--apply` cria no Agendador de Tarefas uma tarefa horária (`HarnessLeca-Rotinas`) que roda `run-scheduled.js --log`, e só executa o que venceu. `--status` e `--remove` consultam e apagam. A tarefa roda com o seu usuário e só com a sessão aberta. A saída vai para `global/routines.log` (local). Em Linux/macOS, agende o mesmo comando no cron.
- Nada disso acontece sozinho até você criar a tarefa: sem ela, as rotinas só rodam quando você chama `run-scheduled.js`.

## Revisar as sugestões de memória

A extração (`extract-artifacts.js --llm` ou a skill `extrair-artefatos`) só **sugere** memórias, regras, decisões e termos em `context/extraido-memorias.md`. Quem decide o que entra na memória é você, na interface: no cartão **Memória** aparece "🧠 Revisar N sugestões".

- **✅ Promover** acrescenta `- [AAAA-MM-DD] texto` em `projects/<projeto>/memory.md` (regras, decisões e termos ganham o prefixo `Regra:`, `Decisão:`, `Termo:`). **✏️ Editar** promove com o texto ajustado. **❌ Descartar** só registra; descartar uma página inteira pede confirmação.
- Filtros por categoria, busca e paginação (25 por página). A mesma sugestão vinda de várias conversas aparece uma vez.
- O que já foi revisado (ou já está na `memory.md`) não volta, nem quando a conversa é reanalisada. O estado fica em `projects/<projeto>/memory-review.json`.
- O texto promovido passa pelo mesmo `redact` dos chats (segredos, e-mail, CPF, telefone) e vira uma linha só (até 600 caracteres).
- **Consolidar antes de revisar** (recomendado quando há centenas de sugestões):

  ```bash
  node tools/consolidate-memory.js --project dai --dry-run --max 20    # só mostra o resultado, não grava
  node tools/consolidate-memory.js --project dai --max 20              # grava
  node tools/consolidate-memory.js --project dai --desfazer            # traz as originais de volta
  ```

  Um modelo (padrão: opencode gratuito; `--engine claude` usa a sua cota) junta as sugestões que dizem a mesma coisa, descarta o passageiro e, com `--max N`, escolhe as N mais importantes de cada categoria. Cada frase consolidada guarda de quais sugestões originais veio. As consolidadas ficam em `context/memorias-consolidadas.md` e aparecem na revisão; as originais saem da lista, mas **nada é apagado**: `--desfazer` as traz de volta (o que você já promoveu ou descartou continua). O modelo só gera sugestões: nada vai para a `memory.md` sem a sua revisão. Medido no `dai`: 181 sugestões viraram 112 só juntando repetidas e 48 com `--max 12`, em cerca de 4 minutos. Para ver o que cada passo faz com o texto, use `--dry-run` primeiro.
- **Cuidado com o tamanho:** a `memory.md` vai junto em **toda mensagem**. A tela mostra o tamanho atual e avisa acima de 8 KB. Promova o que realmente vale; descarte o resto.

## Sincronizar os 3 motores (um comando)

`tools/sync.js` atualiza de uma vez as conversas do **Claude Code**, do **Gemini/Antigravity** e do **opencode** nos projetos que já existem em `projects/`. Nunca cria projeto novo.

```bash
node tools/sync.js                            # todos os motores, todos os projetos
node tools/sync.js --project dai              # só um projeto
node tools/sync.js --engine claude,opencode   # só alguns motores
node tools/sync.js --dry-run                  # mostra o que mudaria, sem gravar
node tools/sync.js --no-extract               # não roda a extração local depois
```

Também funciona como `npm run sync` e, no Claude Code, como `/sync` (aceita os mesmos argumentos).

O que ele faz:
1. **Associa cada conversa a um projeto** pelo nome do projeto no caminho da pasta de trabalho (`.../git/57multimarcas` vai para o projeto `57multimarcas`). Pastas sem projeto correspondente são listadas como ignoradas.
2. **Importa** com o importador de cada motor (`import-claude-code-chats.js`, `import-gemini-chats.js`, `import-opencode-chats.js`), regravando só o que mudou.
3. **Roda a extração local** (regras, documentos, arquivos tocados; sem modelo e sem custo) nos projetos que receberam algo.
4. **Mostra o que falta analisar** por projeto: conversas novas e as que continuaram depois da análise.

Para associar uma pasta de nome diferente a um projeto, crie `projects/.sources.json` (fica só na sua máquina):

```json
{ "saude-prontuario": ["prontuario"], "framework-componentes": ["framework de componentes"] }
```

Requisitos: Node 22.13 ou mais novo (antes disso o `node:sqlite` exigia a flag `--experimental-sqlite`; o opencode guarda as conversas em SQLite, lido pelo `node:sqlite` embutido). O `sync` só lê as tabelas de conversa do `opencode.db` e nunca abre `auth.json` nem credenciais.

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

