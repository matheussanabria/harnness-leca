# Contexto do Projeto: saude-dispensacao
Data de Sincronização: 2026-10-20 | Conversas Salvas: 183

## Instruções
# Instruções do projeto
<!-- Equivale ao campo "Instruções" do projeto: como o Claude deve se comportar aqui. -->

Projeto: DIS (Dispensação), sistema de saúde com web em Angular (`dispensacao-web`) e API em Spring Boot (`dispensacao-api`), no repositório `saude/dispensacao`. Histórias de usuário têm a chave `DIS-<n>` no Jira.

## Como trabalhar
- O backend é a fonte da verdade: regras de negócio e RBAC ficam nele; o frontend só reflete o que ele permite.
- Para componentes, estilos e lógica de tela, consulte o MCP `dis-design-system` antes de escrever markup.
- Antes de escrever testes ou JSON, leia o backend para obter nomes de campo e mensagens de erro exatos.
- Confirme com o usuário decisões que não são suas (nomes de rota, escopo de tela). Não mexa em outros projetos nem na branch `dis-444`.
- Não altere o código de `dispensacao-api` nem de `dispensacao-web` sem pedido explícito; documentação, mapas e design são livres.

## Git e segredos
- Não faça commit sem pedido. Quando pedido: Conventional Commits, sem linha de coautoria.
- Nunca commite `src/proxy.conf.json`, `doc/scrum/_jira-dis.json` nem valores reais em `environment.ts`. Não edite `dist/`.
- O PAT do Jira e outras credenciais só vivem em variável de ambiente, nunca no chat nem no código.

## Documentação, Jira e design
- Escrever ou publicar histórias: skills `requirements-engineering` e `jira-story-publishing` (ler antes de gravar, pré-visualizar, reler depois).
- Mapa em camadas das telas: skill `layer-map-exporter`, em `doc/sistema/features/<slug>/mapa-camadas.json`. Item sem evidência no código é `a-confirmar`.
- Protótipos: só entram os declarados em `design/design.json`; o HTML fonte em `design/` não é alterado (inspeção gera cópia `<artefato>-inspecao`).
- O quadro de histórias lê `doc/scrum/_jira-dis.json`, um snapshot gerado por script local; o Harness não consulta o Jira ao vivo.
- Não rode o motor `claude` para extração ou consolidação sem pedido; prefira opencode ou scripts.

## Memórias Ativas
# Memória do projeto
<!-- Equivale ao campo "Memória". Atualizada pelo Claude durante as conversas. Formato: - [AAAA-MM-DD] fato -->

## Ambiente
- [2026-10-15] Web (Angular): `ng serve --port 8180` em `dispensacao-novo/dispensacao-web`, URL http://localhost:8180 (rotas `/#/pacientes`, `/#/home`). API (Spring Boot): `mvn spring-boot:run` em `dispensacao-novo/dispensacao-api`, URL http://localhost:8080.
- [2026-10-15] O `ng serve` usa a config `development`: o `angular.json` troca `environment.ts` por `environment.development.ts`, que traz os placeholders `$SSO_URL`, `$SSO_REALM` e `$SSO_CLIENT_ID`. Esse arquivo está no `.gitignore`: correções valem só na máquina local.
- [2026-10-15] SSO = autenticação unificada via Keycloak.
- [2026-10-15] Docker no PowerShell: usar `docker build --no-cache` quando houver suspeita de cache corrompido; credenciais do Keycloak entram no build via `--build-arg`.

## Regras de trabalho
- [2026-10-15] O backend é a fonte absoluta da verdade (regras de negócio, inclusive financeiras, e RBAC); o frontend só reflete o que o backend permite/retorna, e o menu não aparece para quem não tem permissão.
- [2026-10-15] Componentes, estilos, esqueleto e lógica de tela vêm do MCP do design system (`dis-design-system`), não de markup inventado.
- [2026-10-15] Antes de escrever testes ou JSON, explorar o backend para obter nomes de campo e mensagens de erro exatos.
- [2026-10-15] Não commitar sem pedido explícito; Conventional Commits, sem linha de coautoria; nunca commitar `src/proxy.conf.json`, `doc/scrum/_jira-dis.json` nem valores reais em `environment.ts`; não editar `dist/` nem `~/.claude`.
- [2026-10-19] Decisões próprias do agente (nomes de rota, escopo de tela) são confirmadas com o usuário; não alterar arquivos de outros projetos nem a branch isolada `dis-444`.

## Documentação e Jira
- [2026-10-15] Histórias de usuário são do Jira com prefixo `DIS-`. `doc/DIS-*` tem os BDDs oficiais; `doc/postman/DIS-*` tem as evidências de teste.
- [2026-10-19] Coleta em massa do projeto DIS: script PowerShell local, API REST v2 do Jira interno e PAT em variável de ambiente, gerando `doc/scrum/_jira-dis.json` (não commitar). O Harness só lê esse snapshot e `doc/scrum/DIS-*/user-story.md`; a skill `jira-story-publishing` serve ao fluxo inverso (publicar).

## Design e protótipos
- [2026-10-19] A tela de protótipos lista só artefatos declarados no `design/design.json` do projeto e protótipos modulares em `design/prototypes/`; a geração reutiliza boilerplates pelo MCP `dis-design-system`.
- [2026-10-19] Inspecionar um artefato estático cria ou reutiliza a cópia modular `<artefato>-inspecao` no Ateliê; o HTML fonte em `design/` permanece imutável.
- [2026-10-19] O Studio de Vibecoding deve permitir exibir e alterar manualmente o código-fonte da aplicação, além de preview, modo de duas telas e inspetor.
- [2026-10-20] O app usa o MCP **dis-design-system**, configurado em `projects/saude-dispensacao/mcp.json`.
- [2026-10-20] A metodologia do usuário por funcionalidade é: protótipo → componentes do DS → boilerplate → implementação via MCP → documentação em camadas.
- [2026-10-20] O dispensacao documenta features em `doc/sistema/features/*/mapa-camadas.json` e o design system em `doc/design-system/`.
- [2026-10-20] Regra: Reproduzir cada problema antes de corrigir e confirmar hipóteses logando o payload real da ponte e as respostas das rotas.
- [2026-10-20] Regra: Adicionar teste de regressão para cada correção.
- [2026-10-20] Regra: Rodar `npm test` e `npm run check` ao final.

## Regras
# Regras e preferências candidatas

> Gerado por tools/extract-artifacts.js em 2026-10-20. **Sugestões para revisão**: nada aqui foi copiado para memory.md ou instructions.md.

- [2026-10-20] Ações destrutivas (como remover arquivos ou diretórios, excluir tabelas ou dados permanentes) NUNCA devem ser executadas sem solicitar permissão explícita e receber a confirmação do usuário no chat. — _- <contexto_do_harness> Aviso: o texto abaixo (instrucoes e memorias) _ (2026-10-20)
- [2026-10-20] Padrão de Ícones (Proibição Estrita de Emojis): É estritamente proibido o uso de emojis na interface visual e no código. Todos os ícones visuais e de navegação devem utilizar exclusivamente ícones vetoriais do FontAwesome (`<i class="fa-solid fa-..."></i>` ou `<i class="fa-regular fa-..."></i>`). — _- <contexto_do_harness> Aviso: o texto abaixo (instrucoes e memorias) _ (2026-10-20)
- [2026-10-20] Confirme com o usuário decisões que não são suas (nomes de rota, escopo de tela). Não mexa em outros projetos nem na branch `dis-444`. — _- <contexto_do_harness> Aviso: o texto abaixo (instrucoes e memorias) _ (2026-10-20)
- [2026-10-20] Não altere o código de `dispensacao-api` nem de `dispensacao-web` sem pedido explícito; documentação, mapas e design são livres. — _- <contexto_do_harness> Aviso: o texto abaixo (instrucoes e memorias) _ (2026-10-20)
- [2026-10-20] Não faça commit sem pedido. Quando pedido: Conventional Commits, sem linha de coautoria. — _- <contexto_do_harness> Aviso: o texto abaixo (instrucoes e memorias) _ (2026-10-20)
- [2026-10-20] Nunca commite `src/proxy.conf.json`, `doc/scrum/_jira-dis.json` nem valores reais em `environment.ts`. Não edite `dist/`. — _- <contexto_do_harness> Aviso: o texto abaixo (instrucoes e memorias) _ (2026-10-20)
- [2026-10-20] O PAT do Jira e outras credenciais só vivem em variável de ambiente, nunca no chat nem no código. — _- <contexto_do_harness> Aviso: o texto abaixo (instrucoes e memorias) _ (2026-10-20)
- [2026-10-20] REGRA CRITICA PARA ACOES DESTRUTIVAS: E expressamente PROIBIDO remover ou deletar arquivos ou diretorios sem autorizacao previa. — _- <contexto_do_harness> Aviso: o texto abaixo (instrucoes e memorias) _ (2026-10-20)
- [2026-10-20] Sempre liste com precisao os itens que seriam excluidos, explique a justificativa e solicite a confirmacao explicita do usuario antes de realizar qualquer remocao. — _- <contexto_do_harness> Aviso: o texto abaixo (instrucoes e memorias) _ (2026-10-20)
- [2026-10-19] Ações destrutivas (como remover arquivos ou diretórios, excluir tabelas ou dados permanentes) NUNCA devem ser executadas sem solicitar permissão explícita e receber a confirmação do usuário no chat. — _Teste no saude-dispensacao_ (2026-10-19)
- [2026-10-19] Padrão de Ícones (Proibição Estrita de Emojis): É estritamente proibido o uso de emojis na interface visual e no código. Todos os ícones visuais e de navegação devem utilizar exclusivamente ícones vetoriais do FontAwesome (`<i class="fa-solid fa-..."></i>` ou `<i class="fa-regular fa-..."></i>`). — _Teste no saude-dispensacao_ (2026-10-19)
- [2026-10-19] REGRA CRÍTICA PARA AÇÕES DESTRUTIVAS: É expressamente PROIBIDO remover ou deletar arquivos ou diretórios (ex.: rm, del, rmdir, Remove-Item, git clean, drop/truncate de tabelas ou bancos) sem autorização prévia. — _Teste no saude-dispensacao_ (2026-10-19)
- [2026-10-19] Sempre liste com precisão os itens que seriam excluídos, explique a justificativa e solicite a confirmação explícita do usuário no chat antes de realizar qualquer remoção. — _Teste no saude-dispensacao_ (2026-10-19)
- [2026-10-19] Ações destrutivas (como remover arquivos ou diretórios, excluir tabelas ou dados permanentes) NUNCA devem ser executadas sem solicitar permissão explícita e receber a confirmação do usuário no chat. — _Projeto saude-dispensacao_ (2026-10-19)
- [2026-10-19] Padrão de Ícones (Proibição Estrita de Emojis): É estritamente proibido o uso de emojis na interface visual e no código. Todos os ícones visuais e de navegação devem utilizar exclusivamente ícones vetoriais do FontAwesome (`<i class="fa-solid fa-..."></i>` ou `<i class="fa-regular fa-..."></i>`). — _Projeto saude-dispensacao_ (2026-10-19)
- [2026-10-19] REGRA CRÍTICA PARA AÇÕES DESTRUTIVAS: É expressamente PROIBIDO remover ou deletar arquivos ou diretórios (ex.: rm, del, rmdir, Remove-Item, git clean, drop/truncate de tabelas ou bancos) sem autorização prévia. — _Projeto saude-dispensacao_ (2026-10-19)
- [2026-10-19] Sempre liste com precisão os itens que seriam excluídos, explique a justificativa e solicite a confirmação explícita do usuário no chat antes de realizar qualquer remoção. — _Projeto saude-dispensacao_ (2026-10-19)
- [2026-10-19] Ações destrutivas (como remover arquivos ou diretórios, excluir tabelas ou dados permanentes) NUNCA devem ser executadas sem solicitar permissão explícita e receber a confirmação do usuário no chat. — _Permissão de edição em harness-leca_ (2026-10-19)
- [2026-10-19] Padrão de Ícones (Proibição Estrita de Emojis): É estritamente proibido o uso de emojis na interface visual e no código. Todos os ícones visuais e de navegação devem utilizar exclusivamente ícones vetoriais do FontAwesome (`<i class="fa-solid fa-..."></i>` ou `<i class="fa-regular fa-..."></i>`). — _Permissão de edição em harness-leca_ (2026-10-19)
- [2026-10-19] REGRA CRÍTICA PARA AÇÕES DESTRUTIVAS: É expressamente PROIBIDO remover ou deletar arquivos ou diretórios (ex.: rm, del, rmdir, Remove-Item, git clean, drop/truncate de tabelas ou bancos) sem autorização prévia. — _Permissão de edição em harness-leca_ (2026-10-19)
- [2026-10-19] Sempre liste com precisão os itens que seriam excluídos, explique a justificativa e solicite a confirmação explícita do usuário no chat antes de realizar qualquer remoção. — _Permissão de edição em harness-leca_ (2026-10-19)
- [2026-10-17] `npm test` e `npm run check` passam. Nenhum arquivo novo acima de ~250 linhas. Não faça commit. — _Prompt: Aba \"Design\" no harness-leca (fase 1: mapa e quadro do fluxo,_ (2026-10-17)
- [2026-10-17] Trate o `design.json` como dado não confiável.** Os campos `file` e `dsFolder` passam pelo mesmo confinamento de caminho. O `externalUrl` só pode ser `https://` e é renderizado como link com `rel="noopener noreferrer"`, nunca `javascript:`. — _Prompt: Aba \"Design\" no harness-leca (fase 1: mapa e quadro do fluxo,_ (2026-10-17)
- [2026-10-17] Sintoma: no painel "Edição Mecânica Direta", ao clicar em "Visualizar Diff" aparece: *"Edição direta não permitida neste nó: Elemento `<EntregasLiberadasComponent>` não encontrado no template."* O localizador está procurando uma **tag com o nome da classe**, que nunca existe num template. — _Prompt: Aba \"Design\" no harness-leca (fase 1: mapa e quadro do fluxo,_ (2026-10-17)
- [2026-10-17] Filtre o que o Angular adiciona em tempo de execução e que nunca está no template**: atributos `_ngcontent-*`, `_nghost-*`, `ng-reflect-*`, `ng-ver — _Prompt: Aba \"Design\" no harness-leca (fase 1: mapa e quadro do fluxo,_ (2026-10-17)
- [2026-10-17] Ações destrutivas (como remover arquivos ou diretórios, excluir tabelas ou dados permanentes) NUNCA devem ser executadas sem solicitar permissão explícita e receber a confirmação do usuário no chat. — _- <contexto_do_harness> Aviso: o texto abaixo (instruções e memórias) _ (2026-10-17)
- [2026-10-17] REGRA CRÍTICA PARA AÇÕES DESTRUTIVAS: É expressamente PROIBIDO remover ou deletar arquivos ou diretórios (ex.: rm, del, rmdir, Remove-Item, git clean, drop/truncate de tabelas ou bancos) sem autorização prévia. — _- <contexto_do_harness> Aviso: o texto abaixo (instruções e memórias) _ (2026-10-17)
- [2026-10-17] Sempre liste com precisão os itens que seriam excluídos, explique a justificativa e solicite a confirmação explícita do usuário no chat antes de realizar qualquer remoção. — _- <contexto_do_harness> Aviso: o texto abaixo (instruções e memórias) _ (2026-10-17)
- [2026-10-17] Ações destrutivas (como remover arquivos ou diretórios, excluir tabelas ou dados permanentes) NUNCA devem ser executadas sem solicitar permissão explícita e receber a confirmação do usuário no chat. — _- <contexto_do_harness> Aviso: o texto abaixo (instruções e memórias) _ (2026-10-17)
- [2026-10-17] REGRA CRÍTICA PARA AÇÕES DESTRUTIVAS: É expressamente PROIBIDO remover ou deletar arquivos ou diretórios (ex.: rm, del, rmdir, Remove-Item, git clean, drop/truncate de tabelas ou bancos) sem autorização prévia. — _- <contexto_do_harness> Aviso: o texto abaixo (instruções e memórias) _ (2026-10-17)
- [2026-10-17] Sempre liste com precisão os itens que seriam excluídos, explique a justificativa e solicite a confirmação explícita do usuário no chat antes de realizar qualquer remoção. — _- <contexto_do_harness> Aviso: o texto abaixo (instruções e memórias) _ (2026-10-17)
- [2026-10-17] Ações destrutivas (como remover arquivos ou diretórios, excluir tabelas ou dados permanentes) NUNCA devem ser executadas sem solicitar permissão explícita e receber a confirmação do usuário no chat. — _- <contexto_do_harness> Aviso: o texto abaixo (instruções e memórias) _ (2026-10-17)
- [2026-10-17] REGRA CRÍTICA PARA AÇÕES DESTRUTIVAS: É expressamente PROIBIDO remover ou deletar arquivos ou diretórios (ex.: rm, del, rmdir, Remove-Item, git clean, drop/truncate de tabelas ou bancos) sem autorização prévia. — _- <contexto_do_harness> Aviso: o texto abaixo (instruções e memórias) _ (2026-10-17)
- [2026-10-17] Sempre liste com precisão os itens que seriam excluídos, explique a justificativa e solicite a confirmação explícita do usuário no chat antes de realizar qualquer remoção. — _- <contexto_do_harness> Aviso: o texto abaixo (instruções e memórias) _ (2026-10-17)
- [2026-10-17] Ações destrutivas (como remover arquivos ou diretórios, excluir tabelas ou dados permanentes) NUNCA devem ser executadas sem solicitar permissão explícita e receber a confirmação do usuário no chat. — _- <contexto_do_harness> Aviso: o texto abaixo (instruções e memórias) _ (2026-10-17)
- [2026-10-17] REGRA CRÍTICA PARA AÇÕES DESTRUTIVAS: É expressamente PROIBIDO remover ou deletar arquivos ou diretórios (ex.: rm, del, rmdir, Remove-Item, git clean, drop/truncate de tabelas ou bancos) sem autorização prévia. — _- <contexto_do_harness> Aviso: o texto abaixo (instruções e memórias) _ (2026-10-17)
- [2026-10-17] Sempre liste com precisão os itens que seriam excluídos, explique a justificativa e solicite a confirmação explícita do usuário no chat antes de realizar qualquer remoção. — _- <contexto_do_harness> Aviso: o texto abaixo (instruções e memórias) _ (2026-10-17)
- [2026-10-13] Para tela origem da receita, vamos planejar a implementação do que esta pendente, verifique quais workflows e agentes devemos utilziar nessa tarefa, lembre-se de consultar o mcp do mapa — _<browser_instruction># Claude in Chrome browser automation You have ac_ (2026-10-13)
- [2026-10-13] O backend/servidor deve ser sempre a fonte de verdade, o front apenas consulta, não entendi o segundo tópico, oque seria o hashw — _<browser_instruction># Claude in Chrome browser automation You have ac_ (2026-10-13)
- [2026-10-13] No campo "primeira entrega", não precisa existir o texto abaixo "A primeira ..." e o btn de editar deve ficar ao lado do campo — _<browser_instruction># Claude in Chrome browser automation You have ac_ (2026-10-13)
- [2026-10-08] "name": "DIS-439 | Cenário 1 — Intervalo sempre contado em dias corridos", — _<browser_instruction># Claude in Chrome browser automation You have ac_ (2026-10-08)
- [2026-10-07] Regra de previstas a partir de hoje (D+0) em Entregas liberadas. — _<pasted_content id=\"3f9f\"> Contexto: DIS-443, branches DIS-443 do disp_ (2026-10-07)
- [2026-10-07] Nova versão, nunca sobrescrever — _<browser_instruction># Claude in Chrome browser automation You have ac_ (2026-10-07)
- [2026-10-02] xVamos planejar a implementação da tela de Nova prescricao, que vai consumir os endpoints criados, lembre-se de revsar @doc/auditoria.md @doc/DIS-443/user-story.md e @doc/legado/00-indice.md  use os agentes que achar necessário — _Precisamos analisar o fluxo para entrega de medicamentos e também o fl_ (2026-10-02)
- [2026-09-15] `user-story.md` enfase no final "E preciso que a entrega venha com teste que verifique a quantidade de entregas geradas. É o que impede a regra antiga de voltar numa migração futura sem ninguém notar. estao atendendo, se sim pode criar os testes no postman — _faça um code review no que esta em staged do dispensacao-api para ver _ (2026-09-15)
- [2026-09-15] `user-story.md` enfase no final "E preciso que a entrega venha com teste que verifique a quantidade de entregas geradas. É o que impede a regra antiga de voltar numa migração futura sem ninguém notar. estao atendendo, se sim pode criar os testes no postman — _faça um code review no que esta em staged do dispensacao-api para ver_ (2026-09-15)
- [2026-09-15] O cálculo deve considerar sempre dias corridos, independentemente do valor do intervalo. — _em user-story.md temos que atualizá-la_ (2026-09-15)
- [2026-09-15] • Critério 1: o cálculo das datas de entrega deve considerar sempre dias corridos. — _em user-story.md temos que atualizá-la_ (2026-09-15)
- [2026-09-15] • Critério 2: intervalos de retirada (30, 60, 90 dias ou outros) devem ser interpretados exclusivamente como quantidade de dias, nunca como meses civis. — _em user-story.md temos que atualizá-la_ (2026-09-15)
- [2026-09-15] Cenário: Intervalo é sempre contado em dias corridos — _em user-story.md temos que atualizá-la_ (2026-09-15)
- [2026-09-15] Tática 2 ([DIS-431](https://servicos.procempa.com.br/browse/DIS-431)) — Regra Formal de Recálculo — _em user-story.md temos que atualizá-la_ (2026-09-15)
- [2026-09-15] Implementar a regra de recálculo do cronograma sempre que a dispensação ocorrer após a data prevista. — _em user-story.md temos que atualizá-la_ (2026-09-15)
- [2026-09-15] • Critério 5: o cálculo da próxima entrega deve sempre considerar o intervalo definido a partir da data efetiva da retirada. — _em user-story.md temos que atualizá-la_ (2026-09-15)
- [2026-09-15] Cenário: Recálculo sempre usa a data efetiva da retirada — _em user-story.md temos que atualizá-la_ (2026-09-15)
- [2026-09-15] Se padronizarmos o cálculo sempre em dias corridos, eliminando mês civil, reduziremos dispersão artificial e inconsistência entre front/back. — _em user-story.md temos que atualizá-la_ (2026-09-15)
- [2026-09-15] E a diferença entre datas consecutivas deve ser sempre 90 dias — _em user-story.md temos que atualizá-la_ (2026-09-15)
- [2026-09-15] E o atraso nunca reduz a quantidade de retiradas pelo lado do tratamento: quem reduz é a validade da receita, que não se desloca — _em user-story.md temos que atualizá-la_ (2026-09-15)
- [2026-09-15] Esse saldo jamais será negativo, pois paciente não deve medicamento ao município. — _em user-story.md temos que atualizá-la_ (2026-09-15)
- [2026-09-15] Registro obrigatório de justificativa — _em user-story.md temos que atualizá-la_ (2026-09-15)
- [2026-09-15] O cálculo deve considerar sempre dias corridos, independentemente do valor do intervalo. — _em `user-story.md` temos que atualizá-la Contexto Hoje o cálculo de da_ (2026-09-15)
- [2026-09-15] • Critério 1: o cálculo das datas de entrega deve considerar sempre dias corridos. — _em `user-story.md` temos que atualizá-la Contexto Hoje o cálculo de da_ (2026-09-15)
- [2026-09-15] • Critério 2: intervalos de retirada (30, 60, 90 dias ou outros) devem ser interpretados exclusivamente como quantidade de dias, nunca como meses civis. — _em `user-story.md` temos que atualizá-la Contexto Hoje o cálculo de da_ (2026-09-15)
- [2026-09-15] Cenário: Intervalo é sempre contado em dias corridos — _em `user-story.md` temos que atualizá-la Contexto Hoje o cálculo de da_ (2026-09-15)
- [2026-09-15] Tática 2 ([DIS-431](https://servicos.procempa.com.br/browse/DIS-431)) — Regra Formal de Recálculo — _em `user-story.md` temos que atualizá-la Contexto Hoje o cálculo de da_ (2026-09-15)
- [2026-09-15] Implementar a regra de recálculo do cronograma sempre que a dispensação ocorrer após a data prevista. — _em `user-story.md` temos que atualizá-la Contexto Hoje o cálculo de da_ (2026-09-15)
- [2026-09-15] • Critério 5: o cálculo da próxima entrega deve sempre considerar o intervalo definido a partir da data efetiva da retirada. — _em `user-story.md` temos que atualizá-la Contexto Hoje o cálculo de da_ (2026-09-15)
- [2026-09-15] Cenário: Recálculo sempre usa a data efetiva da retirada — _em `user-story.md` temos que atualizá-la Contexto Hoje o cálculo de da_ (2026-09-15)
- [2026-09-15] Se padronizarmos o cálculo sempre em dias corridos, eliminando mês civil, reduziremos dispersão artificial e inconsistência entre front/back. — _em `user-story.md` temos que atualizá-la Contexto Hoje o cálculo de da_ (2026-09-15)
- [2026-09-15] E a diferença entre datas consecutivas deve ser sempre 90 dias — _em `user-story.md` temos que atualizá-la Contexto Hoje o cálculo de da_ (2026-09-15)
- [2026-09-15] E o atraso nunca reduz a quantidade de retiradas pelo lado do tratamento: quem reduz é a validade da receita, que não se desloca — _em `user-story.md` temos que atualizá-la Contexto Hoje o cálculo de da_ (2026-09-15)
- [2026-09-15] Esse saldo jamais será negativo, pois paciente não deve medicamento ao município. — _em `user-story.md` temos que atualizá-la Contexto Hoje o cálculo de da_ (2026-09-15)
- [2026-09-15] Registro obrigatório de justificativa — _em `user-story.md` temos que atualizá-la Contexto Hoje o cálculo de da_ (2026-09-15)
- [2026-08-20] dito isso podemos prosseguir para o desenvolvimento da `user-story.md`, mas lembre-se sempre respeitando nosso harness pessoal (DAI) e as  regras e boas praticas do projeto — _Preciso que voce prossiga o mapeamento inicado pelo claude sonnet00-in_ (2026-08-20)
- [2026-08-20] dito isso podemos prosseguir para o desenvolvimento da `user-story.md`, mas lembre-se sempre respeitando nosso harness pessoal (DAI) e as  regras e boas praticas do projeto — _Preciso que voce prossiga o mapeamento inicado pelo claude sonnet`00-i_ (2026-08-20)
- [2026-08-13] Coluna Categoria, vai ser um ou outro com base na regra de `regras-de-negocio-pagseguro.md` — _estava no meio deste planejamento quando meu tokens atingiram o limite_ (2026-08-13)
- [2026-08-13] Coluna Categoria, vai ser um ou outro com base na regra de `regras-de-negocio-pagseguro.md` — _estava no meio deste planejamento quando meu tokens atingiram o limite_ (2026-08-13)
