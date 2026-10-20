# 06 - Segurança, Qualidade e Governança (F1)

**Status:** Aprovado em F1 | **Data:** 2026-10-19 | **Escopo:** Diretrizes Transversais HIA

---

## 1. Diretrizes Estritas de Segurança

### 1.1 Allowlist de Scripts e Executáveis
- Somente scripts previamente catalogados no Automation Registry (`schemas/hia-tool.schema.json`) podem ser executados pelo Script Executor.
- Argumentos passados a qualquer comando CLI devem ser estritamente validados contra os JSON Schemas da ferramenta, com sanitização de caracteres especiais de subshell (`|`, `&`, `;`, `$`, `` ` ``).
- Processos são disparados exclusivamente via `child_process.spawn` com `shell: false` e caminhos absolutos, garantindo imunidade contra injeção de comandos via `cmd.exe`.

### 1.2 Prevenção de Path Traversal
- Qualquer referência a arquivos deve ser resolvida via `path.resolve` e conferida contra a raiz do repositório ou contra `projects/<slug>/`.
- Tentativas de navegação que escapem para diretórios de sistema (`C:\Windows`, raiz da unidade ou diretórios de outros usuários) resultam em rejeição imediata com erro seguro (`SecurityError`).

### 1.3 Proteção e Ofuscação de Segredos
- Integração obrigatória com `tools/lib/redact.js`.
- Nenhuma chave de API (`AI Studio`, `OpenRouter`, senhas, tokens de túnel ou PINs de acesso remoto) pode ser gravada em logs de telemetria, eventos JSONL ou enviada a modelos locais/nuvem.

### 1.4 Ações Destrutivas
- Proibição absoluta de operações destrutivas autônomas (`rm`, `del`, `git clean`, remoção de bancos ou tabelas).
- Qualquer remoção exige confirmação explícita do desenvolvedor na interface antes da execução.

---

## 2. Padrões de Código e Arquitetura

### 2.1 Limite Rígido de Linhas (Anti-Monólito)
- Conforme regra obrigatória do `AGENTS.md` e `CLAUDE.md`:
  - **Alvo ideal:** 150 a 200 linhas por arquivo.
  - **Teto máximo estrito:** 250 a 300 linhas.
- Nenhum novo arquivo do pacote `tools/lib/hia/` poderá exceder 300 linhas. Módulos que crescerem além desse limite devem ser decompostos em submódulos coesos em subpastas (`hia/tools/`, `hia/formatters/`, etc.).

### 2.2 Padrão de Ícones Visuais (Sem Emojis)
- É proibido o uso de emojis na interface visual, logs estruturados ou código novo.
- Todos os elementos visuais devem utilizar exclusivamente ícones vetoriais do FontAwesome (`fa-solid` / `fa-regular`).

---

## 3. Critérios de Qualidade e Gates de Aceite

1. **Gate Estático (`npm run check`):** Toda entrega incremental deve passar com zero erros sintáticos em arquivos `.js` e `.json`.
2. **Gate de Testes (`node --test`):** Todo novo módulo do HIA deve acompanhar sua respectiva suíte de testes em `tests/` (`hia-registry.test.js`, `hia-context.test.js`, etc.).
3. **Reversibilidade e Fallback:** O sistema deve operar plenamente mesmo com `HIA_ROUTING_ENABLED=false`, garantindo que nenhuma alteração quebre o fluxo anterior dos motores CLI.
