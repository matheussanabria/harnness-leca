# Harness: resumo do projeto

Idioma: **Português** | [English](PROJECT-BRIEF.md)

Retrato do repositório: 2026-11-16. Público: novos colaboradores e revisores externos usando LLMs.
Este documento descreve capacidades presentes no repositório; não certifica que todas as integrações funcionam em uma instalação nova.

## Propósito

O Harness é um ambiente de trabalho com prioridade para execução e armazenamento locais, destinado a desenvolvedores que utilizam vários motores de IA para programação. Organiza instruções, memória consolidada, arquivos de referência e histórico de conversas por projeto, permitindo continuar o trabalho entre ferramentas e sessões.

Além da gestão de conversas, o repositório inclui prototipação visual, quadros de projetos, fluxos de agentes, verificações de rastreabilidade e monitoramento de atividades. Essas capacidades apoiam um desenvolvedor que supervisiona o trabalho assistido por IA; sua existência não significa entrega totalmente autônoma.

## Capacidades e evidências

| Área | Responsabilidade | Fonte / navegação |
|---|---|---|
| Projetos | Organizar instruções, memória, contexto, conversas e rotinas; adotar repositórios existentes | [Visão geral](setup/01-overview.pt-BR.md), [adoção](setup/05-adopt-existing-projects.pt-BR.md) |
| Ingestão | Importar históricos para Markdown e ocultar padrões sensíveis reconhecidos | [Entrada da sincronização](../tools/sync.js) |
| Conhecimento | Consolidar memória, exportar contexto e reconstruir sessões Claude | [CLI de memória](../tools/memory.js), [exportação de contexto](../tools/export-context.js), [exportação de sessões](../tools/export-claude-sessions.js) |
| Chat | Selecionar adaptadores de motores e transmitir respostas com contexto do projeto | [Registro de motores](../tools/lib/engines/index.js) |
| Studio e design | Editar fontes e trabalhar com protótipos, sistemas de design, inspeção e quadros visuais | [Mapa do Studio](mapa/frontend/studio/studio-review-skills.md), [mapa do Ateliê](mapa/frontend/design/atelier.md), [mapa do Canvas](mapa/frontend/canvas/canvas-board-island.md) |
| Entrega | Gerenciar atividades Scrum, skills, fluxos e registros de coordenação | [Rotas por domínio](../ui/server/routes/index.js), [mapa de coordenação](mapa/backend/orchestration/coordination.md) |
| Qualidade e visibilidade | Registrar sessões, eventos e uso; oferecer verificações e gates de rastreabilidade | [Mapa de sessões](mapa/intelligence/runtime/sessions.md), [mapa de gates](mapa/tools/gates/harness-gates.md), [mapa de testes](mapa/tools/testing/running-tests.md) |

Os adaptadores de chat incluem Claude, Codex, Gemini, OpenCode e Ollama. A disponibilidade depende de instalação, autenticação e configuração. O `sync` padrão importa Claude Code, Gemini/Antigravity e OpenCode; a importação do histórico Codex é separada. Suporte a chat e cobertura da sincronização padrão são capacidades diferentes.

## Arquitetura e fluxo de informações

```text
Históricos dos motores -> importação e ocultação de dados sensíveis -> conversas do projeto
Conversas do projeto -> extração e revisão -> memória consolidada
Instruções + memória + contexto selecionado -> contexto do motor / chat
Interface no navegador -> rotas HTTP Node -> controladores e serviços
Serviços -> artefatos locais / repositórios externos de projetos / adaptadores de motores
```

A seleção de contexto varia por tela. Não se deve presumir que o chat do projeto, o Ateliê e as interações com quadros recebam contexto idêntico; consulte [contexto por superfície](architecture/pt-BR/01-contexto-do-chat-por-superficie.md).

| Local | Responsabilidade |
|---|---|
| `tools/`, `tools/lib/` | Operações CLI, importação/exportação, memória, adaptadores de motores e lógica compartilhada |
| `ui/server.js`, `ui/server/` | Entrada HTTP Node, rotas por domínio, controladores e serviços |
| `ui/public/` | Interface existente em HTML, CSS e JavaScript de navegador |
| `ui/web/` | Ilhas React/TypeScript compiladas com Vite para `ui/public/dist/` |
| `projects/<slug>/` | Conhecimento local e artefatos operacionais de cada projeto |
| `global/` | Configuração compartilhada e contexto local do usuário |
| `tests/`, `scripts/` | Testes automatizados, verificações de integridade e utilitários de desenvolvimento |
| `docs/` | Instalação, arquitetura, decisões, planos de evolução e mapas de responsabilidades |

O [package.json](../package.json) declara Node >=22.13. Backend e CLIs usam recursos nativos do Node; as dependências de frontend incluem React, Excalidraw e Mermaid. As ilhas React exigem instalação de dependências e compilação. O hook de contexto do Claude usa PowerShell; o roteiro documentado de entrada é voltado ao Windows.

## Limites de dados e execução

O conhecimento dos projetos é armazenado principalmente em arquivos locais, incluindo Markdown e JSON. As fontes de importação incluem históricos JSONL dos motores e o armazenamento SQLite do OpenCode. A configuração também pode apontar para um repositório externo do projeto; seus arquivos e a pasta do projeto no Harness são locais distintos.

A prioridade local descreve armazenamento e orquestração. Um motor configurado na nuvem pode receber contexto externamente. O Ollama oferece uma opção de motor local. A ocultação de dados sensíveis é heurística e não garante que o material importado possa ser compartilhado com segurança.

Um clone novo precisa de configuração própria, criação/adoção de projetos e preparação dos motores. Dados locais e credenciais não constituem um pacote de integração de novos colaboradores. Grave memória com `node tools/memory.js save`; não edite manualmente o índice de memória gerado.

## Estado atual e planos futuros

A tabela de capacidades se apoia nos pontos de entrada do código e nos mapas de módulos. Não afirma validação de ponta a ponta de todas as funcionalidades.

O [índice de arquitetura](architecture/pt-BR/README.md), datado de 2026-11-13, registra lacunas de contexto compartilhado de chat, resolução de configuração e cobertura de validação. Confira essas constatações no código antes de tratá-las como pendências atuais. O [índice de evolução](harness-evolution/00-index.md) contém planos e histórico de entregas; funcionalidades planejadas não estão automaticamente entregues.

A auditoria documental de 2026-11-16 encontrou instruções conflitantes de instalação, links específicos de uma máquina e falhas na validação do mapa. Este trabalho documental ainda não validou a instalação em uma máquina limpa.

Um futuro white paper, infográfico ou conjunto de slides deve usar este resumo como base factual e apresentar separadamente o planejamento validado: problema, capacidades atuais, arquitetura pretendida, marcos, dependências, riscos e medidas de sucesso. Datas e compromissos de entrega exigem um plano aprovado.

O [diagnóstico e plano inicial em português](harness-evolution/README.md) oferece contexto histórico. As propostas da Fase 0 não devem ser apresentadas como o estado atual das entregas.

## Caminhos de leitura

- **Revisão por outra LLM:** forneça este resumo e a pergunta específica. Acrescente uma página de arquitetura ou mapa de módulo relevante para sugestões de implementação.
- **Novo colaborador:** leia a [visão geral](setup/01-overview.pt-BR.md), a [instalação](setup/02-installation.pt-BR.md) e o [roteiro inicial](agents/BOOTSTRAP.pt-BR.md). Consulte também a seção de compilação React em [SETUP.md](../SETUP.md).
- **Localizar código:** comece por [MAPA.md](../MAPA.md), execute `node tools/mapa.js find <assunto>` e leia o mapa correspondente.
- **Entender a evolução:** leia o [índice de arquitetura](architecture/pt-BR/README.md) e o [índice de evolução](harness-evolution/00-index.md), distinguindo propostas de implementação.

Prompt sugerido para outra LLM:

> Avalie este projeto em relação a [objetivo]. Separe fatos fornecidos de suposições. Priorize sugestões por benefício, esforço e dependências. Identifique as evidências ausentes antes de recomendar implementação. Não presuma que os itens do planejamento já foram entregues.

Atualize este resumo quando capacidades, limites de execução ou decisões arquiteturais importantes mudarem. Confira afirmações nos pontos de entrada do código; mantenha os inventários detalhados nos mapas de módulos.

As versões em português e inglês devem ser atualizadas juntas. As referências ainda podem apontar para documentos disponíveis em apenas um idioma.
