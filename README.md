# Harness Leca

Replica a experiência e a arquitetura de **Projetos** do Claude Chat (instruções, memória, contexto, chats e tarefas programadas) para **Claude Code**, **Gemini/Antigravity** e **opencode**.

Tudo roda localmente na sua máquina, com preservação total de privacidade. The backend and CLIs have no runtime dependencies; new UI screens are React islands built with Vite (see [ADR-011](docs/harness-evolution/03-decisions/ADR-011-frontend-react-typescript-vite.md)).

---

## 🚀 Comandos Rápidos

| Comando | Descrição |
|---|---|
| `npm run ui` | Inicia a interface web local em `http://localhost:4321` |
| `npm run ui:dev` | Igual ao `ui`, mas reinicia o servidor sozinho ao salvar arquivos de `ui/server`, `tools/lib` ou `tools/ds-docs` (usa o `--watch` do Node, sem dependências). Mudanças em `ui/public` só pedem recarregar o navegador (Ctrl+F5) |
| `npm run ui:dev:remote -- --pin 123456` | Igual ao `ui:dev`, mas com acesso remoto (`--remote`, escuta em 0.0.0.0). Passe `--pin` para o PIN não mudar a cada reinício; sem ele um PIN novo é sorteado e o celular perde o acesso. O túnel (`npm run remote:tunnel`) é outro processo e continua de pé, mas fica alguns segundos sem resposta enquanto o servidor reinicia |
| `npm run sync` | Sincroniza conversas dos 3 motores (Claude, Gemini e opencode) para o harness |
| `npm run adopt -- --path <pasta>` | Adota um projeto já existente: detecta a stack e cria `instructions.md`, `memory.md` e o apelido de conversas (veja `docs/setup/05-adopt-existing-projects.md`) |
| `npm run export:context` | Exporta memórias, regras e tópicos para o contexto nativo do Claude Code e Gemini |
| `npm run export:claude-sessions` | Converte os chats do harness em sessões `.jsonl` para o `claude --resume` |
| `npm test` | Executa os testes automatizados da suíte (`node:test`) |
| `npm run check` | Valida a sintaxe e a integridade de todos os scripts |
| `npm run build:web` | Builds the React islands (`ui/web`) into `ui/public/dist` |
| `npm run dev:web` | Rebuilds the islands on save; run it next to `npm run ui:dev` and reload the browser |
| `npm run types:web` / `npm run lint:web` | TypeScript check and Biome lint of `ui/web` |
| `npm run e2e:web` | E2E of the island foundation in headless Edge (own server on port 4399) |

---

## 📚 Documentação

- **Getting started (English):** [overview](docs/setup/01-overview.md), [installation](docs/setup/02-installation.md), [engines and credentials](docs/setup/03-engines-and-credentials.md), [first import, sync and export](docs/setup/04-first-sync.md), [adopting existing projects](docs/setup/05-adopt-existing-projects.md).
- **For AI agents:** [docs/agents/BOOTSTRAP.md](docs/agents/BOOTSTRAP.md) (setup and first sync) and [docs/agents/ADOPTION.md](docs/agents/ADOPTION.md) (adopting a project).
- 📐 **[docs/sdlc/README.md](file:///c:/Users/matheuss.rodrigues/git/harness-leca/docs/sdlc/README.md):** Especificação oficial de requisitos de software (SDLC), domínios de negócio (DDD), regras de negócio, RFs e RNFs.
- 🗺️ **[MAPA.md](file:///c:/Users/matheuss.rodrigues/git/harness-leca/MAPA.md):** Mapa arquitetural detalhado do código e das responsabilidades de cada arquivo.
- 📖 **[SETUP.md](file:///c:/Users/matheuss.rodrigues/git/harness-leca/SETUP.md):** Guia completo de instalação, arquitetura, importadores, rotinas programadas e restauração de contexto.
- 🤖 **[AGENTS.md](file:///c:/Users/matheuss.rodrigues/git/harness-leca/AGENTS.md):** Instruções de operação para agentes autônomos (Antigravity/Gemini e similares).
- 🧠 **[CLAUDE.md](file:///c:/Users/matheuss.rodrigues/git/harness-leca/CLAUDE.md):** Regras de memória, contexto e comportamento para o Claude Code.

---

## 🛠️ Restauração de PC / Nova Máquina

Se você restaurou seu computador ou clonou o harness em outra máquina:

1. **Restaurar memórias e regras nos agentes:**
   ```bash
   npm run export:context
   ```
2. **Reidratar o histórico de conversas do Claude Code:**
   ```bash
   npm run export:claude-sessions
   ```
3. **Continuar conversas anteriores:**
   ```bash
   claude --resume
   ```
