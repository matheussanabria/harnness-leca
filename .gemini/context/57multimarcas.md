# Contexto do Projeto: 57multimarcas
Data de Sincronização: 2026-10-20 | Conversas Salvas: 93

## Instruções
# Instruções do projeto
<!-- Equivale ao campo "Instruções" do projeto: como o Claude deve se comportar aqui. -->

## Execução e Ambiente Local

### Frontend Web (React / Vite)
- **Diretório:** `57multimarcas-web`
- **Comando:** `npm run dev`
- **URL Local:** `http://localhost:8081`
- **Porta:** `8081`

### Backend API (Spring Boot)
- **Diretório:** `57multimarcas-api`
- **Comando:** `mvn spring-boot:run`
- **URL Local:** `http://localhost:8080`
- **Porta:** `8080`

### Rotas Principais
- Início: `http://localhost:8081/`
- Veículos: `http://localhost:8081/veiculos`
- Estoque: `http://localhost:8081/estoque`

## Memórias Ativas
# Memória do projeto
<!-- Equivale ao campo "Memória". Atualizada pelo Claude durante as conversas. Formato: - [AAAA-MM-DD] fato -->

- [2026-10-15] A aplicação web roda localmente na URL padrão http://localhost:8081 (React/Vite em 57multimarcas-web via 'npm run dev'). A API backend roda em http://localhost:8080 (Spring Boot em 57multimarcas-api via 'mvn spring-boot:run').
- [2026-10-15] `C:/Users/matheuss.rodrigues/git/57multimarcas` é a pasta do workspace (não é repositório git): contém os repos `57multimarcas-web` e `57multimarcas-api`, além de `docs/`, `infra/`, `tools/` e `docker-compose.local.yml`. Comandos git devem rodar dentro de cada repo (ex.: `git -C 57multimarcas-web status`).
- [2026-10-15] O MCP do design system é o `cod-design-system`, definido no `.mcp.json` da raiz do workspace (`tools/cod-design-system-mcp`).
- [2026-10-15] O projeto "57multimarcas" tem um MCP stdio próprio, `cod-design-system`, em `tools/cod-design-system-mcp`. Ele está registrado em `.mcp.json` na raiz do projeto e tem os módulos `docs.js`, `tools.js` e `server.js`. O MCP do projeto dispensacao serviu de modelo.
- [2026-10-15] A fonte de verdade do design system é `docs/design-system/Framework de componentes próprio/Design System v2.dc.html`. O arquivo "Design System v2 (standalone).html" é um bundle compilado, e o extrator também o lê.
- [2026-10-15] O design system tem 50 componentes, 54 ícones e 2 temas: `cod` (padrão) e `m57`.
- [2026-10-15] A listagem de boilerplates do Angular tem mais de 150 arquivos. O `styles/components.css` junta o CSS dos 50 componentes.
- [2026-10-15] Regra: Atualizar o design system: substituir o `Design System v2.dc.html` e rodar `npm run extract` na pasta do MCP.
- [2026-10-15] Regra: O usuário quer economizar tokens dos agentes. As tools devem devolver só o necessário, com granularidade fina, em vez de despejar tudo.
- [2026-10-15] Regra: Os kits são separados por framework. React recebe tsx e css, sem html e sem angular. Angular recebe ts, html e css, sem react. HTML recebe html, css e js.
- [2026-10-15] Regra: Cada kit deve incluir só os tokens que o CSS do componente realmente usa.
- [2026-10-15] Regra: Nunca usar `--no-verify` nem editar hooks compartilhados para pular testes; numa execução pontual, usar variável de ambiente (ex.: `MAVEN_ARGS` com exclusão dos testes de container).
- [2026-10-15] O snapshot do design system fica em `data/design-system.json`, dentro da pasta do MCP. Ele é gerado por `npm run extract` (`scripts/extract.mjs`) e validado por `npm test`.
- [2026-10-15] Decisão: Adotar modelo branch-por-ambiente com 5 branches padronizadas por repositório (dev, test, hom, prod, hotfix), cada uma com build próprio e promoção/deploy manuais por merge.
- [2026-10-15] Decisão: Usar o EasyPanel já existente na VPS para deploy e hospedagem do front, em vez de Jenkins, hospedagem de site e Traefik/stack manual, que eram redundantes.
- [2026-10-15] Decisão: Centralizar ordenação A-Z e paginação no back-end/banco (abolindo listagens soltas e migrando selects totais para async/combobox), para não duplicar regra nem travar o navegador conforme o banco cresce.
- [2026-10-15] Decisão: Converter para WebP no navegador antes do upload, e não na API, porque o Java não escreve WebP nativamente sem biblioteca com binários nativos problemática na imagem Docker da VPS.
- [2026-10-15] Decisão: Login com Google ponta a ponta via @react-oauth/google no front e validação do ID token no Spring Boot (chaves públicas + audience), emitindo JWT próprio em /api/auth/google.

## Regras
# Regras e preferências candidatas

> Gerado por tools/extract-artifacts.js em 2026-10-19. **Sugestões para revisão**: nada aqui foi copiado para memory.md ou instructions.md.

- [2026-10-18] Ações destrutivas (como remover arquivos ou diretórios, excluir tabelas ou dados permanentes) NUNCA devem ser executadas sem solicitar permissão explícita e receber a confirmação do usuário no chat. — _- <contexto_do_harness> Aviso: o texto abaixo (instruções e memórias) _ (2026-10-18)
- [2026-10-18] REGRA CRÍTICA PARA AÇÕES DESTRUTIVAS: É expressamente PROIBIDO remover ou deletar arquivos ou diretórios (ex.: rm, del, rmdir, Remove-Item, git clean, drop/truncate de tabelas ou bancos) sem autorização prévia. — _- <contexto_do_harness> Aviso: o texto abaixo (instruções e memórias) _ (2026-10-18)
- [2026-10-18] Sempre liste com precisão os itens que seriam excluídos, explique a justificativa e solicite a confirmação explícita do usuário no chat antes de realizar qualquer remoção. — _- <contexto_do_harness> Aviso: o texto abaixo (instruções e memórias) _ (2026-10-18)
- [2026-10-17] Ações destrutivas (como remover arquivos ou diretórios, excluir tabelas ou dados permanentes) NUNCA devem ser executadas sem solicitar permissão explícita e receber a confirmação do usuário no chat. — _- <contexto_do_harness> Aviso: o texto abaixo (instruções e memórias) _ (2026-10-17)
- [2026-10-17] REGRA CRÍTICA PARA AÇÕES DESTRUTIVAS: É expressamente PROIBIDO remover ou deletar arquivos ou diretórios (ex.: rm, del, rmdir, Remove-Item, git clean, drop/truncate de tabelas ou bancos) sem autorização prévia. — _- <contexto_do_harness> Aviso: o texto abaixo (instruções e memórias) _ (2026-10-17)
- [2026-10-17] Sempre liste com precisão os itens que seriam excluídos, explique a justificativa e solicite a confirmação explícita do usuário no chat antes de realizar qualquer remoção. — _- <contexto_do_harness> Aviso: o texto abaixo (instruções e memórias) _ (2026-10-17)
- [2026-10-17] Ações destrutivas (como remover arquivos ou diretórios, excluir tabelas ou dados permanentes) NUNCA devem ser executadas sem solicitar permissão explícita e receber a confirmação do usuário no chat. — _- <contexto_do_harness> Aviso: o texto abaixo (instruções e memórias) _ (2026-10-17)
- [2026-10-17] REGRA CRÍTICA PARA AÇÕES DESTRUTIVAS: É expressamente PROIBIDO remover ou deletar arquivos ou diretórios (ex.: rm, del, rmdir, Remove-Item, git clean, drop/truncate de tabelas ou bancos) sem autorização prévia. — _- <contexto_do_harness> Aviso: o texto abaixo (instruções e memórias) _ (2026-10-17)
- [2026-10-17] Sempre liste com precisão os itens que seriam excluídos, explique a justificativa e solicite a confirmação explícita do usuário no chat antes de realizar qualquer remoção. — _- <contexto_do_harness> Aviso: o texto abaixo (instruções e memórias) _ (2026-10-17)
- [2026-10-12] pode sim, mas podemomos "granularizar" um pouco mias, por exemplo, o boilerplate react, não precisa do boilerplate html já que esta em JSX, ams segue precisando do css, e não precisa do angular, já o angular só nao precisa do react. — _<browser_instruction># Claude in Chrome browser automation You have ac_ (2026-10-12)
- [2026-10-04] ### E tem uma regra que eu considero fundamental: — _Leia C:\\Users\\matheuss.rodrigues\\OneDrive\\Verificações\\Documentos\\Obsi_ (2026-10-04)
- [2026-09-02] Manual tbm, pois tenho como boa pratica commits atomicos, para preservar os principio solid e cleancode, então para a  mesma feature haveriam multiplos commit/push, mesma regra de erros humanos podem acontecer, então vamos deixar manual — _eu já tenho vps e hospedagem, tenho dominio e posibilidade de criar su_ (2026-09-02)
- [2026-05-21] Beleza, agora preciso do 5w2h aplicado ao diretório atual, então vamos criar uma identidade para sabermos do contexto sempre que acessado do diretorio raiz — _Explique-me usando o método 5w2h quem é voce_ (2026-05-21)
