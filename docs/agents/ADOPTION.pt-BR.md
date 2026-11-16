# Harness: adoção de um projeto existente (procedimento do agente)

Público: um agente de IA solicitado a adequar uma base de código existente à estrutura do Harness. Pessoas: [docs/setup/05-adopt-existing-projects.pt-BR.md](../setup/05-adopt-existing-projects.pt-BR.md). As regras gerais são as mesmas de [BOOTSTRAP.pt-BR.md](BOOTSTRAP.pt-BR.md); em particular, o código-fonte é somente para leitura nesta tarefa e arquivos de credenciais nunca devem ser abertos.

English: [ADOPTION.md](ADOPTION.md).

## Estrutura de destino

```
projects/<slug>/
  instructions.md   # controlado pelo responsável; agentes nunca o editam sem solicitação
  memory.md         # um fato datado por linha: - [YYYY-MM-DD] fato
  context/          # arquivos de referência, sob demanda
  chats/            # conversas importadas
  scheduled/        # rotinas recorrentes
projects/.sources.json   # { "<slug>": ["<alias da pasta>"] }
```

## Procedimento

1. **Escolha o slug.** Use letras minúsculas, `[a-z0-9_-]`, no máximo 60 caracteres e não `_template`. Padrão: o nome da pasta.
2. **Pré-visualize.**
   ```powershell
   node tools/adopt-project.js --path <folder> --slug <slug> --dry-run
   ```
   Compare a stack detectada com o que aparece nos arquivos de manifesto. Se estiver incorreta ou vazia, não invente informações: faça a adoção mesmo assim e informe a lacuna no relatório.
3. **Adote.**
   ```powershell
   node tools/adopt-project.js --path <folder> --slug <slug>
   ```
   A ferramenta cria as pastas, grava `instructions.md` e `memory.md` somente se estiverem ausentes e adiciona o alias quando o nome da pasta difere do slug.
4. **Importe conversas.**
   ```powershell
   node tools/sync.js --project <slug> --dry-run
   node tools/sync.js --project <slug>
   node tools/import-codex-chats.js --from <folder name> --project <slug>
   ```
   Se sessões antigas usavam outro nome de pasta, use `--from <old name> --project <slug>` com o importador específico, em vez de alterar aliases sem verificar.
5. **Verifique.**
   ```powershell
   node tools/extraction-state.js --project <slug> status
   ```
   O esperado é que as conversas apareçam como pendentes. Zero conversas é aceitável para um projeto que nunca teve sessões de mecanismos.
6. **Aprofunde (somente se o usuário pedir).** Use a skill `project-onboarding-scanner` para mapear a arquitetura e selecionar arquivos-chave. Grave as descobertas em `projects/<slug>/context/` (por exemplo, `onboarding.md`), não no repositório de código-fonte nem em `instructions.md`.
7. **Relate** ao usuário: slug, stack detectada, arquivos criados, alias adicionado, conversas importadas por mecanismo e perguntas em aberto no `instructions.md` gerado que somente o responsável pode responder.

## Regras para conteúdo inicial

- Registre somente o que existe no disco. Qualquer informação desconhecida vira pergunta para o responsável, nunca um palpite.
- As entradas de `memory.md` são fatos duradouros (stack, comandos, decisões). Não inclua segredos, dados pessoais ou duplicatas; corrija entradas erradas em vez de acrescentar contradições.
- Nunca modifique o `instructions.md` de um projeto existente sem solicitação explícita.
- Se `projects/<slug>/` já existir, a adoção mantém os arquivos existentes. Informe isso no relatório.

## Adoção em lote

Execute as etapas 2 e 3 para cada pasta, mas primeiro peça ao usuário que aprove a lista de pastas e slugs. Não examine o disco inteiro à procura de candidatas: use as pastas indicadas pelo usuário ou listadas pelos comandos `--list`.

## Casos especiais

| Caso | Tratamento |
|---|---|
| Duas pastas com o mesmo nome | Atribua valores diferentes a `--slug`; cada uma recebe sua própria entrada de alias somente se o nome diferir do slug |
| Pasta dentro de `projects/` | A ferramenta a rejeita: escolha a pasta de origem real |
| Não é um repositório git | Permitido; a memória gerada informa isso |
| Monorepo | A detecção examina um nível de pastas; liste os subprojetos no relatório e pergunte se devem ser adotados separadamente |
| Mesmo slug já usado por outra pasta de origem | Pare e pergunte ao usuário; não mescle duas bases de código em um único projeto sem avisar |
