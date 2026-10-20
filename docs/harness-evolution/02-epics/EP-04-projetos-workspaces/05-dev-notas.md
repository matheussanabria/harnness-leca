---
tags: [harness-evolution, ep-04, desenvolvimento, projetos]
atualizado: 2026-10-19
---

# EP-04 — Notas de desenvolvimento

## 04.01 Seleção de projeto centralizada

### Implementado
- Store frontend compartilhado para canonicalização, precedência, persistência e assinatura da seleção.
- Precedência única: query string válida → preferência local válida → ativo do backend → primeiro projeto.
- Sincronização confirmada com `POST /api/project/active` antes de publicar a troca.
- Fallback para o ativo do backend quando a preferência inicial não pode ser sincronizada.
- Serviço backend com validação case-insensitive e substituição atômica de `projects/.active`.
- Migração da interface principal e do Escritório para o mesmo contrato.

### Compatibilidade
- `state.P`, `state.S.active` e `officeState.activeProject` continuam disponíveis como projeções para consumidores legados.
- A rota `/api/project/active` foi preservada e agora retorna o slug canônico.
- Nenhum arquivo da frente de Chat do Gemini foi alterado.

### Evidências
- `node --test tests/project-selection.test.js tests/server.test.js tests/workspace-presets.test.js`: 18/18 aprovados.
- `npm run check`: 443 arquivos JavaScript e 10 JSON sem erro.
- `npm run types`: permanece vermelho por dívida preexistente; nenhum erro foi reportado nos arquivos novos da seleção centralizada.
- `npm test`: execução integral atingiu o limite de 180 segundos sem emitir falhas; a instabilidade global de encerramento/tempo permanece fora do escopo da história.

### Pendências
- A história 04.02 recebeu aceite e foi concluída.
- Teste manual entre abas pode complementar a cobertura quando o aceite em navegador global for executado.

## 04.02 Layouts nomeados

### Implementado
- Sessão de layouts nomeados sem dependência de DOM, vinculada por padrão ao projeto do seletor central.
- API pública `windowManager.workspaces` para listar, salvar, carregar, excluir, consultar estado e assinar mudanças.
- Isolamento de layouts customizados por projeto e limpeza do workspace ativo quando o contexto muda.
- Notificações somente após operações válidas; presets do sistema permanecem protegidos.
- Remapeamento entre IDs serializados e IDs reais devolvidos pela reabertura de janelas, inclusive módulos não singleton.

### Compatibilidade
- A API original de `WorkspacePresetManager` foi preservada.
- Nenhuma interface `office*` ou arquivo da frente do Gemini foi alterado.
- O novo módulo possui 107 linhas e mantém a fachada e o gerenciador de presets abaixo do teto arquitetural.

### Evidências
- `node --test tests/workspace-session.test.js tests/workspace-presets.test.js tests/window-manager.test.js tests/layout-persistence.test.js`: 18/18 aprovados.
- `npm run check`: 447 arquivos JavaScript e 10 JSON sem erro.
- Checagem de tipos focada: nenhum erro nos arquivos da 04.02; o typecheck global continua vermelho por débitos anteriores.

### Pendências
- A história 04.03 recebeu aceite e foi concluída.
- A interface visual para escolher layouts permanece na trilha Gemini; esta história publicou o contrato consumível.

## 04.03 Persistência de contexto do workspace

### Implementado
- Snapshot composto `_v: 1` com layout, filtros e recursos selecionados, isolado por projeto.
- API pública `windowManager.persistence` para salvar, restaurar e limpar o estado usando o projeto central por padrão.
- Persistência de `resourceId` nas janelas e restauração do conjunto exato de instâncias.
- Aplicação canônica de layout compartilhada por persistência e presets, com remapeamento de IDs não singleton.
- Validação integral antes de alterar a store; versão incompatível ou JSON corrompido preserva as janelas atuais.

### Compatibilidade
- Layouts `_v: 1` anteriores continuam válidos porque `resourceId` permanece opcional.
- Filtros e recursos são estado JSON opaco; consumidores continuam donos de suas regras de aplicação.
- Nenhum arquivo `chat*`, `office*` ou interface da trilha Gemini foi alterado.
- O novo módulo possui 118 linhas; todos os arquivos alterados permanecem abaixo de 300 linhas.

### Evidências
- `node --test tests/workspace-persistence.test.js tests/layout-persistence.test.js tests/workspace-presets.test.js tests/workspace-session.test.js tests/window-manager.test.js`: 23/23 aprovados.
- `npm run check`: 450 arquivos JavaScript e 10 JSON sem erro.
- Checagem de tipos focada: nenhum erro nos arquivos da 04.03; o typecheck global continua com débitos anteriores.

### Pendências
- A história 04.04 recebeu aceite e foi concluída.
- Consumidores visuais podem aplicar o contexto retornado por `restore` sem duplicar a persistência.

## 04.04 Templates de workspace

### Implementado
- Catálogo imutável com Desenvolvimento, Planejamento, Qualidade e Operações.
- IDs legados `dev`, `scrum` e `ops` preservados; novo ID `quality` adicionado.
- Composições canônicas: Codex + Studio; Scrum + Diário; Revisão + Studio; Datacenter + Orquestração.
- Módulo `review` registrado com metadados e ícone FontAwesome.
- `SYSTEM_WORKSPACES` continua reexportado por `workspace-presets.js` para compatibilidade.

### Compatibilidade
- Consumidores que carregam `dev`, `scrum` ou `ops` continuam funcionando.
- Presets antigos com módulos inexistentes foram corrigidos para o catálogo real.
- Nenhum template inclui Claude ou OpenCode; os módulos continuam no produto, mas fora dos templates desta execução.
- O catálogo possui 84 linhas e o gerenciador de presets foi reduzido de 225 para 105 linhas.

### Evidências
- `node --test tests/workspace-templates.test.js tests/workspace-presets.test.js tests/workspace-session.test.js tests/workspace-persistence.test.js tests/window-manager.test.js`: 21/21 aprovados.
- `npm run check`: 452 arquivos JavaScript e 10 JSON sem erro.
- Checagem de tipos focada: nenhum erro nos arquivos da 04.04.

### Pendências
- A história 04.05 recebeu aceite e foi concluída.
- A interface visual para seleção dos templates permanece na trilha Gemini.

## 04.05 Proteção de alterações não salvas

### Implementado
- Registro compartilhado e observável de pendências, com ID, rótulo e escopo opcional de projeto/workspace.
- Erro estruturado `UNSAVED_CHANGES`, incluindo a lista de fontes bloqueadoras.
- Guard aplicado antes da sincronização de projeto e antes da aplicação de workspace.
- Bypass compatível via `force: true`, reservado à interface após confirmação explícita.
- API pública `windowManager.unsaved` para `mark`, `clear`, `list`, `hasChanges` e `subscribe`.

### Compatibilidade
- Assinaturas existentes continuam válidas; as opções novas são aditivas.
- O guard não inclui UI nem descarta dados automaticamente.
- Nenhum arquivo `chat*`, `office*` ou consumidor visual do Studio foi alterado.
- Todos os arquivos de produção envolvidos permanecem abaixo de 200 linhas.

### Evidências
- 22/22 testes focados aprovados nos registros, seleção, sessão, presets e persistência.
- `npm run check`: 456 arquivos JavaScript e 10 JSON sem erro.
- Checagem de tipos focada dos módulos compartilhados sem erro; débitos anteriores em `drag-resize.js` e `window-store.js` permanecem catalogados.

### Handoff
- Gemini/EP-06 deve conectar o dirty state do Studio a `windowManager.unsaved` e apresentar os `blockers` antes de repetir uma transição com `force`.
- EP-04 encerra 5/5; seleção, persistência, templates e guard estão estabilizados para os consumidores.
