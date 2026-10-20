# Contexto do Projeto: dai
Data de Sincronização: 2026-10-20 | Conversas Salvas: 16

## Instruções
# Instruções do projeto
<!-- Equivale ao campo "Instruções" do projeto: como o Claude deve se comportar aqui. -->

## Memórias Ativas
# Memória do projeto
<!-- Equivale ao campo "Memória". Atualizada pelo Claude durante as conversas. Formato: - [AAAA-MM-DD] fato -->

## Pendências

- [2026-10-14] Notas citadas pelo material do PM (Sobre Bruno, Domínios, Secretaria, Agenda) não estavam em `Downloads\PM`; as skills do PM dependem delas como configuração.
- [2026-10-14] PDF GERCON-4024 não pôde ser lido (falta poppler no ambiente); é só a origem do molde de história, já descrito no Modelo.
- [2026-10-14] Links quebrados pré-existentes em `README.md` e `CHEAT_SHEET.md` do DAI (pastas `logic/...` e `Git_Vault_Expert_Agent`) não foram tocados na refatoração.
- [2026-10-14] Regra "agente não aprova o próprio código" existe só como rule e check de gate; não há enforcement mecânico no hook.
- [2026-10-14] `code-review-checklist` não aponta para as skills `spec-templates` e `react-code-standards` (referência opcional, nunca adicionada).
- [2026-10-14] Extração de artefatos: 9 das 14 conversas do projeto seguem pendentes (5 extraídas em 2026-10-14, limite 5 por sessão).

## Decisões que afetam o fluxo

- [2026-10-14] `.claude/` do DAI fica fora de commits por decisão (config local com caminhos pessoais).
- [2026-10-14] Skills nascidas num projeto ficam dinâmicas por projeto (`where.project_config`), nunca generalizadas (origem: postman-bdd-tests do DIS).
- [2026-10-14] `memory/XX-*.md` do DAI está em uso (aprendizados de PRON-161 e 57M) e não deve ser apagado; comandos legados `workflows/*.md` já foram removidos.

## Regras
# Regras e preferências candidatas

> Gerado por tools/extract-artifacts.js em 2026-10-19. **Sugestões para revisão**: nada aqui foi copiado para memory.md ou instructions.md.

- [2026-10-07] Me  tira uma dúvida, alguma skill, agente, regra, entre outro declara o conteudo que deixei como boilerplate em memory\projects\57multimarcas\templates e em memory\projects\57multimarcas\best_practices — _<browser_instruction># Claude in Chrome browser automation You have ac_ (2026-10-07)
- [2026-10-06] converts v2 agents (tool mapping, embeds the `## Regra` text of each rule, Limits section); — _<browser_instruction># Claude in Chrome browser automation You have ac_ (2026-10-06)
- [2026-05-22] A verdade é que você não precisa escolher um ou o outro, pois eles trabalham juntos com propósitos complementares: — _Atualizei o README.md incluindo todos os 18 agentes do DevFlow AI SDLC_ (2026-05-22)
