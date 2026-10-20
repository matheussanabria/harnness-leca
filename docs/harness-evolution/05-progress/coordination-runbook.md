# Runbook de coordenação automática

O ledger é inicializado uma vez e suas projeções são atualizadas a cada comando.

```powershell
node tools/coordination.js init --project harness-leca
node tools/coordination.js status --project harness-leca
node tools/coordination.js inbox --provider codex --project harness-leca
node tools/coordination.js claim EP-05.02 --provider codex --project harness-leca
node tools/coordination.js start EP-05.02 --provider codex --project harness-leca
node tools/coordination.js heartbeat EP-05.02 --provider codex --project harness-leca
node tools/coordination.js complete EP-05.02 --provider codex --evidence "node --test tests/*.test.js" --project harness-leca
```

Para transferir uma história:

```powershell
node tools/coordination.js handoff EP-05.02 --provider codex --to gemini --message "Revisar integração visual" --project harness-leca
```

Para apenas comunicar sem alterar o responsável:

```powershell
node tools/coordination.js notify --provider codex --to gemini --story EP-05.02 --message "Contrato pronto para consumo" --project harness-leca
```

Use `sync` quando um agente antigo tiver alterado o índice mestre sem passar pela CLI. A sincronização importa novas histórias e conclusões, mas não reabre itens nem remove eventos.

Claude e OpenCode possuem inboxes para manter o contrato completo, mas permanecem inativos. O ledger rejeita claim, conclusão e handoff destinados a eles enquanto essa política não for alterada deliberadamente.
