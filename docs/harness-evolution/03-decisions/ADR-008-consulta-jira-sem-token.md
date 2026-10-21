---
id: ADR-008
titulo: "Consulta ao Jira por script local, com redação de dados pessoais"
status: proposta
data: 2026-10-21
historias: [EP-05.07]
owner: opencode/jira
tags: [harness-evolution, adr, jira, lgpd]
---

# ADR-008: Consulta ao Jira por script local, com redação de dados pessoais

## Contexto
O Harness lê as histórias do Jira por meio do snapshot `doc/scrum/_jira-dis.json`. A partir da EP-05.07, existe também leitura ao vivo: o servidor regenera o snapshot chamando a API REST v2 do Jira com `JIRA_BASE_URL`/`JIRA_PAT` do ambiente.

Três restrições definem o problema:
1. **Credencial.** O PAT do Jira só pode viver em variável de ambiente e nunca no chat, no código ou no contexto de um agente.
2. **Volume.** O snapshot tem 4,1 MB, 473 issues e 199 com comentários: não cabe no contexto de um modelo gratuito.
3. **Dado pessoal.** Os comentários trazem **CPF de paciente** (ex.: `DIS-3`, "Ver CPF 46957448053"), nome, e-mail e telefone de servidores da Secretaria Municipal de Saúde. Enviar isso a um provedor de modelo externo é um problema de LGPD, não apenas de custo.

## Decisão
1. **O agente nunca recebe credencial e nunca chama a API do Jira.** A leitura ao vivo acontece no servidor do Harness, com o PAT do ambiente, e o resultado é gravado no snapshot local.
2. **A consulta do agente é feita por script local** (`tools/jira-query.js`), que lê apenas o snapshot e devolve saída enxuta: `issue`, `sprint`, `search`, `status` e `summary`.
3. **A redação de dados pessoais é o padrão** (`tools/lib/jira-redact.js`): CPF, CNS, e-mail, telefone e data de nascimento. `--raw` existe para uso local estrito e nunca entra em prompt de modelo, rotina ou MCP.
4. **O panorama em `context/jira-resumo.md` é gerado por script**, sem comentários e sem caminho absoluto do repositório, para leitura sob demanda.
5. **MCP de Jira fica bloqueado** até decisão do PM sobre a pergunta 10.9 (LGPD): nenhum MCP ou rotina devolve comentários do Jira a um agente em nuvem sem essa decisão.

## Alternativas consideradas
| Alternativa | Prós | Contras |
|---|---|---|
| MCP de Jira de terceiros ligado ao agente | Zero código novo; o agente decide a transição | Leva PAT ou credencial ao caminho do agente; envia comentários (CPF) a nuvem; duplica a regra de transição do quadro; amplia o alcance de permissão |
| Modelo lendo o snapshot inteiro | Simples de descrever | 4,1 MB não cabem no contexto; dado pessoal de paciente vai ao provedor; desperdício de cota |
| Modelo chamando a API do Jira direto | Dados sempre frescos | PAT sai do ambiente; nenhum controle de redação, autorização ou auditoria |
| **Script local com redação (escolhida)** | Sem credencial no agente; saída enxuta; redação por padrão; auditoria local | Não dá escrita ao Jira (que segue bloqueada por identidade e destino) |

## Consequências
- **Mais fácil:** responder sobre Jira no chat ou em rotina sem give away do PAT; o panorama fica disponível para qualquer agente; a política de dados fica no código, não na instrução do agente.
- **Mais difícil:** o dado do agente pode estar velho até a próxima sincronização (a interface mostra a data da última atualização); a escrita no Jira continua fora de escopo, porque exige destino explícito, identidade e reconciliação.
- **A migrar:** nada. O formato do snapshot e do quadro local não muda; a consulta é uma camada nova ao lado da leitura existente.
- **Bloqueio assumido:** enquanto o PM não decidir a 10.9, MCP de Jira e rotinas com comentários para agente em nuvem ficam bloqueados e registrados no ledger.
