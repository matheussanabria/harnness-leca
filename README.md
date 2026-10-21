# Harness Leca

Replica a experiência e a arquitetura de **Projetos** do Claude Chat (instruções, memória, contexto, chats e tarefas programadas) para **Claude Code**, **Gemini/Antigravity** e **opencode**.

Tudo roda localmente na sua máquina, sem dependências externas adicionais e com preservação total de privacidade.

---

## 🚀 Comandos Rápidos

| Comando | Descrição |
|---|---|
| `npm run ui` | Inicia a interface web local em `http://localhost:4321` |
| `npm run ui:dev` | Igual ao `ui`, mas reinicia o servidor sozinho ao salvar arquivos de `ui/server`, `tools/lib` ou `tools/ds-docs` (usa o `--watch` do Node, sem dependências). Mudanças em `ui/public` só pedem recarregar o navegador (Ctrl+F5) |
| `npm run ui:dev:remote -- --pin 123456` | Igual ao `ui:dev`, mas com acesso remoto (`--remote`, escuta em 0.0.0.0). Passe `--pin` para o PIN não mudar a cada reinício; sem ele um PIN novo é sorteado e o celular perde o acesso. O túnel (`npm run remote:tunnel`) é outro processo e continua de pé, mas fica alguns segundos sem resposta enquanto o servidor reinicia |
| `npm run sync` | Sincroniza conversas dos 3 motores (Claude, Gemini e opencode) para o harness |
| `npm run export:context` | Exporta memórias, regras e tópicos para o contexto nativo do Claude Code e Gemini |
| `npm run export:claude-sessions` | Converte os chats do harness em sessões `.jsonl` para o `claude --resume` |
| `npm test` | Executa os testes automatizados da suíte (`node:test`) |
| `npm run check` | Valida a sintaxe e a integridade de todos os scripts |

---

## 📚 Documentação

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
