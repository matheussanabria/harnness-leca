# M2 — Registro de Decisões Arquiteturais (ADRs - Fase 0)

> **Documento:** Registro de Decisões Arquiteturais para o M2 (Centro de Orquestração)  
> **Status:** Aprovado  
> **Contexto:** Alinhamento com a arquitetura nativa e sem dependências do Harness Leca

---

## ADR 01: Padrão de Comunicação em Tempo Real do Centro de Orquestração

### Contexto
O Centro de Orquestração requer atualização contínua de eventos e estados operacionais (início/fim de execuções, passos de ferramentas, status de processos dev e sincronizações).
O projeto possui diretriz rigorosa de **zero dependências npm externas** no Node.js (`package.json`).

### Alternativas Avaliadas
1. **Polling HTTP periódico (ex: a cada 2-5 segundos)**:
   - *Prós:* Simples de implementar.
   - *Contras:* Alto overhead de I/O em disco, latência perceptível no grafo 3D, consumo desnecessário de CPU mesmo sem eventos.
2. **WebSockets (`ws` ou `socket.io`)**:
   - *Prós:* Comunicação bidirecional contínua de baixa latência.
   - *Contras:* Exigiria adicionar uma biblioteca externa ao `package.json` ou implementar um servidor WebSocket RFC 6455 artesanal com parsing de frames e masking, aumentando a complexidade de manutenção desnecessariamente para uma comunicação onde 95% do tráfego é servidor -> cliente.
3. **Server-Sent Events (SSE) via `node:http` nativo**:
   - *Prós:* 100% nativo do Node.js, suportado nativamente pelo browser com `EventSource`, auto-reconexão nativa pelo browser, compatível com HTTP/1.1 e proxies, padrão já adotado com sucesso em `/api/chat` e `/api/project/:slug/services/logs`. Ações do cliente (operações) continuam utilizando requisições `POST` HTTP padrão autenticadas por PIN.

### Decisão
**Adotar Server-Sent Events (SSE)** em `/api/orchestration/stream` para streaming de eventos e estado reativo do servidor para o cliente, complementado por requisições HTTP normais (`GET` para consultas pontuais e `POST` para comandos de controle).

---

## ADR 02: Modelo de Estado e Persistência do Event Engine

### Contexto
Precisamos armazenar histórico de eventos observados e projetar o estado atual dos agentes, execuções e tarefas, sobrevivendo a pequenas desconexões e permitindo consultas paginadas e auditoria.

### Alternativas Avaliadas
1. **Memória Volátil Pura (`Map` em Node.js)**:
   - *Prós:* Velocidade máxima, zero I/O.
   - *Contras:* Perde todo o histórico e estado ao reiniciar o servidor ou crashar.
2. **Banco de Dados Externo (PostgreSQL, MongoDB, Redis)**:
   - *Prós:* Recursos avançados de query e replicação.
   - *Contras:* Viola a premissa de execução local autocontida e zero dependências do Harness Leca.
3. **`node:sqlite` Nativo do Node 22 (em arquivo `orchestration.db` ou `events.jsonl` circular)**:
   - *Prós:* O Node >= 22.13 inclui `node:sqlite` nativo na biblioteca padrão (já utilizado em `tools/lib/engines/opencode.js` e `tools/import-opencode-chats.js`). Permite consultas SQL com índices, persistência rápida em arquivo local e zero pacotes npm adicionais.

### Decisão
**Utilizar armazenamento leve em arquivo append-only / `node:sqlite` local no diretório do projeto** ou estrutura circular em memória com snapshot em disco para persistência do log de eventos canônicos e projeção de estado consolidado.

---

## ADR 03: Separação Estrita entre Dados Observados, Eventos Explícitos e Inferências

### Contexto
A auditoria técnica (M2_AUDIT.md) comprovou que implementações anteriores utilizavam heurísticas como forçar `activeCount = 1` no Claude Code com mensagens hardcoded estáticas. O Centro de Orquestração tem como requisito de governança não inventar atividades nem simular execuções inexistentes.

### Alternativas Avaliadas
1. **Manter heurísticas unificadas sob o status `"active"`**:
   - *Prós:* A interface sempre parece "viva" e dinâmica.
   - *Contras:* Destrói a confiabilidade operacional e induz o usuário a acreditar que uma tarefa está rodando quando o processo já morreu.
2. **Contrato Canônico com Campo `confidence` Explícito**:
   - *Prós:* Toda entidade e evento carrega o nível de confiança: `explicit`, `observed`, `inferred`, `unknown`. A interface 3D e o painel 2D utilizam estilos visuais diferentes (cores sólidas para explicit, pontilhado/translúcido para inferred, badge de advertência para unknown).

### Decisão
**Implementar o modelo de confiança canônico obrigatório**. Nenhuma inferência será mascarada como fato e nenhuma ausência de telemetria será convertida em ociosidade (`idle`).

---

## ADR 04: Integração do Grafo 3D no Cenário Existente

### Contexto
O M2 deve exibir o grafo espacial de agentes, tarefas e relações no ambiente 3D sem quebrar o Main Workspace (M0) nem a Sala de Guerra (M1).

### Alternativas Avaliadas
1. **Criar uma nova cena 3D separada com recarregamento de página**:
   - *Prós:* Isolamento completo de código.
   - *Contras:* Experiência fragmentada; destrói a continuidade de caminhar pelo escritório e sentar na mesa de conferência.
2. **Submódulo Integrado (`OrchestrationGraph` / `WarRoomTacticalScreen`)**:
   - *Prós:* O Centro de Orquestração funciona como a central tática integrada à Sala de Guerra e ao modo de exploração 3D. Os nós do grafo são adicionados em um grupo do Three.js dedicado (`OrchestrationGroup`), com raycasting e destaque sincronizados com o drawer lateral de detalhes 2D. Preserva todos os modos de câmera (3ª pessoa, 1ª pessoa, órbita e 2.5D).

### Decisão
**Integrar o Centro de Orquestração como submódulo espacial desacoplado** em `ui/public/js/office3d/orchestration-graph.js`, renderizando entidades operacionais com `THREE.Group` e shaders/materiais reutilizáveis, totalmente sincronizado com o painel de inspeção 2D.
