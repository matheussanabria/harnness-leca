# Runbook de Comandos de Coordenação CLI

Este guia descreve as operações canônicas do ledger de coordenação via linha de comando.

## Operações do Ciclo de Vida

### 1. Inicialização e Status
```powershell
# Inicializar o ledger de coordenação do projeto
node tools/coordination.js init --project <slug>

# Consultar o status consolidado de todas as histórias e responsáveis
node tools/coordination.js status --project <slug>

# Consultar a caixa de entrada (inbox) de mensagens do provedor
node tools/coordination.js inbox --provider <gemini|codex|claude|opencode> --project <slug>
```

### 2. Posse e Execução (Claim & Start)
```powershell
# Reivindicar responsabilidade sobre a história (status -> claimed)
node tools/coordination.js claim <ID_HISTORIA> --provider <provedor> --project <slug>

# Iniciar o trabalho ativo na história (status -> in_progress)
node tools/coordination.js start <ID_HISTORIA> --provider <provedor> --project <slug>

# Sinalizar progresso contínuo em tarefas longas
node tools/coordination.js heartbeat <ID_HISTORIA> --provider <provedor> --project <slug>
```

### 3. Conclusão com Evidência
```powershell
# Concluir a história anexando o comando e resultado que provam o aceite
node tools/coordination.js complete <ID_HISTORIA> --provider <provedor> --evidence "node --test tests/suite.test.js: 12 passing" --project <slug>
```

### 4. Transferência e Comunicação (Handoff & Notify)
```powershell
# Transferir a posse da história para outro provedor com mensagem de contexto
node tools/coordination.js handoff <ID_HISTORIA> --provider <provedor_origem> --to <provedor_destino> --message "Contrato publicado em ui/server/... Pronto para consumo" --project <slug>

# Notificar outro provedor sem alterar a posse atual
node tools/coordination.js notify --provider <provedor_origem> --to <provedor_destino> --story <ID_HISTORIA> --message "Endpoints atualizados para teste de integração" --project <slug>
```

## Regras Canônicas
- O arquivo `projects/<slug>/coordination/state.json` é a **fonte canônica da verdade**.
- Arquivos como `STATUS.md`, `context/coordination.md` e `inbox/*.md` são projeções geradas automaticamente. Nunca os edite manualmente.
