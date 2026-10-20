# Domínio 02: Ingestão e Sincronização Multi-Motor
## Harness Leca — Especificação de Requisitos de Software

---

## 1. Visão do Domínio
O **Domínio de Ingestão e Sincronização Multi-Motor** é o componente de integração contínua do Harness. Sua finalidade é escanear, extrair e normalizar conversas geradas em ferramentas com formatos e ciclos de vida heterogêneos (Claude Code CLI, Gemini/Antigravity IDE e OpenCode local).

---

## 2. Requisitos Funcionais (RF)

- **RF-02.1 (Sincronização Unificada CLI):** O sistema deve fornecer um comando central (`npm run sync` / `tools/sync.js`) que orquestra sequencialmente a varredura e importação dos 3 motores suportados.
- **RF-02.2 (Ingestão de Sessões Claude Code):** O sistema deve ler os arquivos `.jsonl` de sessões locais do Claude Code (`~/.claude/sessions`), decodificar seus passos e salvar como conversas do projeto correspondente.
- **RF-02.3 (Ingestão de Sessões Gemini/Antigravity):** O sistema deve inspecionar os diretórios de transcripts do Antigravity/Gemini (`.gemini/antigravity-ide/brain/<conv-id>`), extraindo mensagens do usuário, do modelo e chamadas de ferramentas.
- **RF-02.4 (Ingestão de Sessões OpenCode):** O sistema deve se conectar à instância local do OpenCode (ou ler seu armazenamento local), mapeando as sessões ativas para o projeto correto.
- **RF-02.5 (Normalização de Esquema de Chat):** O sistema deve converter qualquer formato de origem para a estrutura canônica do Harness (`id`, `title`, `created_at`, `updated_at`, `engine`, `messages[]`).
- **RF-02.6 (Associação Automática a Projetos):** O sistema deve mapear a conversa ao projeto correspondente com base no diretório de trabalho (`cwd`), caminhos de arquivos citados ou aliases em `projects/.sources.json`.

---

## 3. Regras de Negócio (RN)

- **RN-02.1 (Idempotência Estrita na Ingestão):** A reexecução da sincronização nunca deve duplicar conversas ou mensagens já existentes. Identificadores únicos (`sessionId` / `conversationId`) devem ser preservados.
- **RN-02.2 (Atualização Incremental de Conversas Vivas):** Se uma conversa já importada continuar ativa no motor de origem e receber novas mensagens, o Harness deve anexar os novos blocos preservando o histórico anterior.
- **RN-02.3 (Preservação de Evidências Técnicas):** Metadados de tool calls (comandos executados, diffs gerados e saídas de terminal) devem ser preservados na íntegra para permitir auditoria técnica posterior.
- **RN-02.4 (Fallback de Projeto Indefinido):** Se uma sessão não puder ser associada a nenhum projeto conhecido, ela deve ser direcionada para um projeto padrão (`global` ou `inbox`) ou sinalizada para associação manual.

---

## 4. Requisitos Não Funcionais (RNF)

- **RNF-02.1 (Performance de Varredura):** O processamento de um lote de até 500 conversas não deve consumir mais de 10 segundos em hardware de desenvolvimento padrão.
- **RNF-02.2 (Resiliência contra Arquivos Corrompidos):** Linhas JSON malformadas em arquivos `.jsonl` devem ser ignoradas com log de aviso sem interromper a importação do restante do arquivo.
- **RNF-02.3 (Isolamento de Processo):** Falhas em um motor (ex: OpenCode desligado) não devem impedir a sincronização dos outros dois motores (Claude e Gemini).

---

## 5. Casos de Uso Principais

### UC-03: Sincronização Periódica via CLI
1. O desenvolvedor executa `npm run sync`.
2. O sistema executa o importador do Claude Code, detectando novas sessões criadas no dia.
3. O sistema executa o importador do Gemini/Antigravity, atualizando sessões modificadas.
4. O sistema executa o importador do OpenCode.
5. Um relatório consolidado é exibido informando: `N conversas novas, M atualizadas, 0 erros`.
