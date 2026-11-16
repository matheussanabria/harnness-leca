# Catálogo de Comandos e Scripts (package.json)

[Read in English](COMANDOS.en.md).

Guia de referência detalhado de todos os scripts definidos no `package.json` do Harness, agrupados por área de responsabilidade.

---

## 1. Interface Web, Servidores & Acesso Remoto

Comandos para inicialização da UI local, desenvolvimento com recarga automática e acesso externo.

| Comando | Descrição | Parâmetros & Detalhes |
|---|---|---|
| `npm run ui` | Inicia o servidor HTTP do Harness na porta padrão (`http://localhost:4321`). | Backend nativo em Node.js sem dependências de runtime. Serve o dashboard, chats e APIs. |
| `npm run ui:dev` | Inicia a interface com reinicialização automática (`--watch-path`). | Monitora mudanças em `ui/server`, `tools/lib` e `tools/ds-docs`. Mudanças em `ui/public` requerem recarregar a página. |
| `npm run ui:dev:remote` | Modo de desenvolvimento escutando em todas as interfaces (`0.0.0.0`) com autenticação via PIN. | Aceita `-- --pin 123456` para fixar o PIN e evitar reautenticação após reinicializações. |
| `npm run remote` | Executa o servidor em modo de escuta de rede local (`0.0.0.0`) com proteção por PIN. | Gera PIN de 6 dígitos exibido no terminal e QR Code. |
| `npm run remote:tunnel` | Cria um túnel HTTPS público temporário via Cloudflare Quick Tunnel. | Permite acesso seguro de fora da rede local (ex: celular em 4G/5G). |
| `npm run opencode` | Inicia o serviço do OpenCode em segundo plano (`opencode serve --port 63186`). | Utiliza a senha configurada em `global/.env` (`OPENCODE_SERVER_PASSWORD`). |

---

## 2. Frontend React & Ilhas (ADR-011)

Scripts para compilação, validação de tipos, lint e testes da camada de interface moderna (`ui/web`).

| Comando | Descrição | Parâmetros & Detalhes |
|---|---|---|
| `npm run build:web` | Compila as ilhas React via Vite para produção. | Gera os arquivos empacotados em `ui/public/dist/`. |
| `npm run dev:web` | Compila as ilhas React em modo contínuo (*watch*). | Recompila automaticamente alterações feitas em `ui/web/`. |
| `npm run types:web` | Checagem de tipagem estática TypeScript. | Executa `tsc -p ui/web` e `tsc -p ui/web/tsconfig.node.json`. |
| `npm run lint:web` | Análise estática e formatação de código com Biome. | Executa `biome check ui/web`. |
| `npm run e2e:web` | Testes End-to-End da fundação das ilhas React. | Roda Playwright com Microsoft Edge headless validando ciclo de vida em `#/lab`. |
| `npm run lint:proto` | Linter Biome focado em protótipos de projetos. | Aceita `--project <slug> [--proto <id>] [--fix]`. |
| `npm run visual:proto` | Teste de regressão visual comparativa do Atelier. | Compara screenshots de telas com baselines em diferentes resoluções. |

---

## 3. Sincronização, Memória e Contexto de IA

Operações para integrar o Harness com os motores de IA (Claude Code, Gemini/Antigravity e OpenCode).

| Comando | Descrição | Parâmetros & Detalhes |
|---|---|---|
| `npm run sync` | Sincroniza históricos de conversas dos 3 motores para `projects/<slug>/chats/`. | Identifica chats novos e atualizações incrementais. |
| `npm run sync:dry` | Executa a sincronização em modo de simulação. | Não realiza alterações em disco (`--dry-run`). |
| `npm run adopt` | Adota um diretório existente transformando-o em projeto gerenciado. | Aceita `-- --path <caminho>` e `--dry-run`. |
| `npm run export:context` | Exporta regras, instruções e memórias para o contexto nativo dos agentes. | Gera arquivos de injeção para Claude Code e Antigravity/Gemini. |
| `npm run export:claude-sessions` | Converte os chats do Harness em sessões `.jsonl`. | Permite retomar conversas no terminal via `claude --resume`. |

---

## 4. Coordenação Multiagente & Automação (HIA)

Protocolo de coordenação concorrente de agentes autônomos e registro de automações.

| Comando | Descrição | Subcomandos & Parâmetros |
|---|---|---|
| `npm run coordination` | CLI do protocolo de coordenação entre agentes de IA. | Operações: `inbox`, `claim`, `start`, `heartbeat`, `complete`, `handoff`, `notify`, `status`. |
| `npm run hia` | CLI do Harness Intelligence & Automation. | Comandos: `list` (ferramentas registradas), `info <toolId>`, `run <toolId>`. |

---

## 5. Rotinas e Agendamentos em Background

Execução de tarefas programadas por cron e integração com o sistema operacional.

| Comando | Descrição | Parâmetros & Detalhes |
|---|---|---|
| `npm run routines` | Executa rotinas vencidas dos projetos (`projects/<slug>/scheduled/*.md`). | Aceita `--project <slug>`, `--now <arquivo>`, `--dry-run` e `--log`. |
| `npm run routines:list` | Lista o status das rotinas agendadas. | Mostra periodicidade, última execução e próxima execução prevista. |
| `npm run schedule:windows` | Gerencia a tarefa agendada no Windows Task Scheduler. | Aceita `--apply` (cria/atualiza tarefa horária), `--status` e `--remove`. |

---

## 6. Qualidade, Testes e Verificação de Tipos

Portões de qualidade pré-commit e validação contínua de código.

| Comando | Descrição | Parâmetros & Detalhes |
|---|---|---|
| `npm run check` | Validação rápida de sintaxe sem dependências. | Checa sintaxe de todos os arquivos `.js` e validade de `.json`. |
| `npm test` | Executa a suíte de testes unitários do repositório. | Roda `node --test "tests/*.test.js"`. |
| `npm run regressao` | **Portão de qualidade pré-commit obrigatório**. | Executa em cadeia: `check` -> `test` -> verificação de integridade -> `types:baseline`. |
| `npm run types` | Checagem de tipagem JSDoc (`@ts-check`) no backend. | Executa `tsc` em pasta temporária em cache sem adicionar dependências globais. |
| `npm run types:baseline` | Compara erros de tipagem com o baseline aceito. | Falha se a dívida de tipos crescer além de `quality/types-baseline.json`. |
| `npm run types:baseline:update` | Atualiza o baseline de erros aceitos. | Grava a contagem atual como o novo ponto de partida (`--update`). |
| `npm run setup:hooks` | Configura o Git para utilizar os hooks locais. | Aponta `core.hooksPath` para `.githooks`. |

