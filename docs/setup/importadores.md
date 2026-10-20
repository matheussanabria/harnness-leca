# Importadores e extração de conversas

Parte do [guia de instalação](../../SETUP.md) do Harness Leca.

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

## Importar conversas do Antigravity / Gemini

O Antigravity guarda os transcripts de sessões em `~/.gemini/antigravity-ide/brain/<uuid>/.system_generated/logs/transcript.jsonl`. O importador detecta automaticamente o projeto de cada conversa e converte para o formato do harness:

```bash
# 1. ver todas as sessões disponíveis no Gemini e o projeto detectado
node tools/import-gemini-chats.js --list

# 2. simular a importação das conversas de um projeto (não grava nada)
node tools/import-gemini-chats.js --project saude-dispensacao --dry-run

# 3. importar todas as conversas detectadas para o projeto
node tools/import-gemini-chats.js --project saude-dispensacao

# 4. ou importar uma sessão específica pelo ID
node tools/import-gemini-chats.js --from 39c79beb --project saude-dispensacao

# 5. ou auto-importar todas as sessões detectadas para seus respectivos projetos
node tools/import-gemini-chats.js --all-projects
```

- A interface (`http://localhost:4321`) exibe tanto chats do Claude (`✱ Claude`) quanto do Gemini (`✦ Gemini`).
- As chamadas de ferramenta e raciocínio (`:::thinking`) são totalmente preservadas e exibidas em accordions.

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
- **`--engine opencode`** faz a extração com um modelo do OpenCode em vez do Claude (não gasta a cota do Claude). Padrão: `opencode/deepseek-v4.1-flash-free`. Veja os modelos com `opencode models`.
  - **Só modelos gratuitos** (`opencode/...-free`) rodam sem pedir licença: groq, openrouter e os demais usam as suas chaves e podem custar; para usá-los de propósito, `--allow-paid`.
  - **Isolamento:** o modelo roda numa pasta temporária vazia, com um agente que só tem leitura; escrita, comandos, web e diretórios externos são negados (testado: pedidos de escrever, executar e ler fora da pasta foram recusados e nada foi criado). Não dá para tirar *todas* as ferramentas: o plano gratuito do OpenCode devolve 403 para agentes sem nenhuma, e essa é uma regra do serviço.
  - Cada conversa é gravada e marcada como analisada **assim que termina**; se a execução cair no meio, o que já foi feito fica. Em falha do serviço (ex.: limite de uso), tenta uma segunda vez e, se falhar de novo, a conversa continua pendente.
  - Cerca de 15 a 20 s por conversa. O conteúdo vai para o modelo do OpenCode (serviço externo), já com segredos e dados pessoais redigidos.
- O modo `--llm` envia um resumo de cada conversa (com segredos já redigidos) ao modelo via `claude -p`, **sem ferramentas habilitadas**, e é opcional por isso. Evite em projetos com dados de terceiros, como saúde, sem necessidade.
- Para promover algo à memória, copie manualmente a linha revisada para `memory.md`.

