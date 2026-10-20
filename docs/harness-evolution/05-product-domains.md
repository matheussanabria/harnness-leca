# Kanban, Mapa, Componentes e Auditoria

## Kanban SDLC

Criar board default com doze raias e IDs estáveis separados de rótulos. Posição é `order`; ocultar não apaga; desativar impede transições. Impedimento é transversal; a raia é projeção opcional.

- Toda movimentação autorizada grava histórico atomicamente.
- Backend valida transições.
- Drag-and-drop e botões acessíveis chamam o mesmo comando.
- Contagem/pontos são projeções; filtros não alteram dados.

## Mapa em Camadas

A arquitetura de seis abas é aproveitável. Dividir CSS por shell, navegação, réplica, detalhes e responsividade. Uma chave estável conecta campo, comportamento, regra, endpoint, serviço, controller, repository, DTO, entidade, tabela/coluna, teste, legado e decisão.

Sem capturas, só é possível preparar tokens e harness. Aceite exige imagens, resolução, escala, conteúdo e estado iguais.

## Componentes

Formalizar o checklist atual como `ComponentMilestones` e manter `stage` como projeção. Acrescentar identidade, versão, origem, responsável e referências tipadas. “No Chat” envia `ChatContextRef`, sem duplicar texto.

## Auditoria

Separar regra cadastrada, cenário planejado, artefato gerado, execução e aprovação. Coleção Postman sem asserções não é cobertura automatizada; geração sem execução não é sucesso. Decisão sobre legado registra autor, data, justificativa e referência.

## AI-First

Políticas por raia apontam para agentes/skills. Gatilhos começam desativados. Execução recebe chave idempotente, contexto mínimo, permissões herdadas e estado `requested/running/succeeded/failed/cancelled/awaiting_approval`.

