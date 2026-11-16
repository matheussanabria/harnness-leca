# 05. Adotar projetos existentes

Parte da [série de configuração](01-overview.pt-BR.md). Use este guia quando já houver uma base de código na sua máquina e você quiser organizá-la segundo a estrutura do Harness (instruções, memória, contexto e conversas), incluindo conversas anteriores de todos os mecanismos.

Leia em inglês: [05 Adopt projects you already have](05-adopt-existing-projects.md).

## O que significa "adotar"

Um projeto é adotado quando existe em `projects/<slug>/` com `instructions.md`, `memory.md`, `chats/`, `context/` e `scheduled/`, e o nome da pasta de origem é associado a esse slug. **Seu código nunca é movido nem modificado.** O Harness apenas lê arquivos de manifesto na pasta de origem.

## Um comando

```powershell
node tools/adopt-project.js --path C:\Users\you\git\my-app --dry-run   # prévia
node tools/adopt-project.js --path C:\Users\you\git\my-app             # executar
```

Opções:

| Opção | Efeito |
|---|---|
| `--path <folder>` | Pasta do projeto de origem (obrigatório) |
| `--slug <slug>` | Nome do projeto; por padrão, usa o nome da pasta normalizado para minúsculas |
| `--dry-run` | Mostra o que seria criado, sem gravar nada |
| `--activate` | Grava o slug em `projects/.active` |
| `--sync` | Em seguida executa `node tools/sync.js --project <slug>` para importar conversas |

Também está disponível como `npm run adopt -- --path <folder>`.

## O que o comando faz

1. **Detecta a tecnologia** em `package.json` (Angular, React, Next.js, Vue, NestJS, Express, TypeScript, Vite, Jest, ESLint...), `pom.xml` / `build.gradle` (versão do Java, Spring Boot, JUnit, Liquibase, Checkstyle), `pyproject.toml` / `requirements.txt` (Django, FastAPI, Flask, pytest), `go.mod`, `Cargo.toml`, `*.csproj`, Dockerfile e Compose. Também examina um nível de pasta abaixo para monorepos, ignora `node_modules`, `.git`, `dist` e semelhantes, e nunca segue links simbólicos.
2. **Cria** `projects/<slug>/` a partir do modelo.
3. **Escreve `instructions.md`** com a tecnologia detectada, os scripts detectados (dev, start, build, test, lint), um resumo do README, regras iniciais para o assistente e uma lista breve de **perguntas para você** (convenções de arquitetura, regras de branch, definição de pronto e áreas proibidas). Só afirma fatos encontrados no disco.
4. **Escreve `memory.md`** com fatos datados (tecnologia, scripts e se é um repositório Git).
5. **Adiciona um alias** a `projects/.sources.json` quando o nome da pasta difere do slug, para que as conversas sejam associadas corretamente.
6. **Nunca sobrescreve** um `instructions.md` ou `memory.md` existente.

## Depois da adoção

```powershell
node tools/sync.js --project my-app --dry-run
node tools/sync.js --project my-app
node tools/import-codex-chats.js --from my-app --project my-app      # Codex é separado
node tools/extraction-state.js --project my-app status
```

Depois abra `projects/my-app/instructions.md`, responda às perguntas "To confirm with the owner" e apague as linhas que não se aplicam. Esse arquivo pertence a você: o Harness e seus agentes nunca o editam sem que você peça.

## Vários projetos de uma vez

```powershell
foreach ($d in Get-ChildItem C:\Users\you\git -Directory) {
  node tools/adopt-project.js --path $d.FullName --dry-run
}
```

Revise a saída da simulação e execute novamente sem `--dry-run` nas pastas desejadas.

## Conversas iniciadas com outro nome de pasta

Se uma sessão antiga foi iniciada em `C:\old\app-v1`, mas o projeto se chama `my-app`, adicione `"my-app": ["app-v1"]` a `projects/.sources.json` ou direcione a importação diretamente:

```powershell
node tools/import-claude-code-chats.js --from app-v1 --project my-app
```

## Integração mais detalhada (opcional)

Para mapear a arquitetura, selecionar arquivos-chave e configurar agentes além da detecção de tecnologia, peça ao assistente que use a skill `project-onboarding-scanner` neste repositório. Agentes devem ler [docs/agents/ADOPTION.md](../agents/ADOPTION.pt-BR.md).
