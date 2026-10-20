# Domínio 04: Reidratação e Interoperabilidade de Agentes
## Harness Leca — Especificação de Requisitos de Software

---

## 1. Visão do Domínio
O **Domínio de Reidratação e Interoperabilidade** permite que o conhecimento consolidado no Harness retorne ativamente aos agentes autônomos. Ele transforma o histórico arquivado em contexto operacional direto para o Claude Code, Gemini/Antigravity e outros ambientes de desenvolvimento.

---

## 2. Requisitos Funcionais (RF)

- **RF-04.1 (Exportação de Contexto Nativo):** O comando `npm run export:context` deve injetar as memórias e regras do projeto ativo nos arquivos de contexto padrão dos agentes (`AGENTS.md`, `.claude/rules`, ou arquivos de contexto do Gemini).
- **RF-04.2 (Geração de Sessões Reidratáveis do Claude Code):** O comando `npm run export:claude-sessions` (`tools/export-claude-sessions.js`) deve converter conversas arquivadas em arquivos `.jsonl` compatíveis nativamente com a pasta de sessões do Claude Code (`~/.claude/sessions/`).
- **RF-04.3 (Continuidade Transparente de Sessão):** O usuário deve ser capaz de abrir um terminal e digitar `claude --resume` para continuar uma conversa que originalmente foi importada ou mantida pelo Harness.
- **RF-04.4 (Preservação de IDs de Sessão):** As sessões exportadas devem manter identificadores consistentes para evitar criação de sessões duplicadas na lista de retomada do CLI.
- **RF-04.5 (Injeção de Metadados de Origem):** Ao reidratar uma sessão, o cabeçalho deve sinalizar qual motor e qual projeto deram origem àquele histórico.

---

## 3. Regras de Negócio (RN)

- **RN-04.1 (Conformidade com o Protocolo Claude Code CLI):** O schema dos arquivos `.jsonl` gerados deve espelhar exatamente a estrutura interna esperada pelo Claude Code (campos `sessionId`, `type`, `message`, `timestamp`, `costUSD`, etc.).
- **RN-04.2 (Fidelidade do Contexto Operacional):** A exportação de contexto para system prompt deve respeitar o teto de tokens recomendado, priorizando memórias recentes e instruções fundamentais sobre notas secundárias.
- **RN-04.3 (Não Degradação de Sessões Ativas):** Se uma sessão estiver em execução ativa no momento da exportação, o arquivo em uso não deve ser truncado ou corrompido.

---

## 4. Requisitos Não Funcionais (RNF)

- **RNF-04.1 (Velocidade de Exportação):** A exportação completa de sessões de um projeto deve levar menos de 3 segundos para até 100 conversas.
- **RNF-04.2 (Portabilidade de Sistema Operacional):** Caminhos de arquivos no JSONL de sessões devem ser formatados adequadamente para Windows (backslashes escapadas) e Unix/macOS conforme a máquina de execução.

---

## 5. Casos de Uso Principais

### UC-05: Restauração de Ambiente após Formatação / Nova Máquina
1. O desenvolvedor clona o repositório do Harness Leca em um computador recém-formatado.
2. Executa `npm run export:context` para configurar os prompts dos agentes.
3. Executa `npm run export:claude-sessions` para recriar as sessões na pasta `~/.claude/sessions/`.
4. Digita `claude --resume` no terminal e retoma imediatamente o trabalho de onde parou na máquina anterior, sem perda de contexto.
