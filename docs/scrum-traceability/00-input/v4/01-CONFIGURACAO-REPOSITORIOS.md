# CONFIGURACAO-REPOSITORIOS — preencher antes de enviar ao agente

> **Preencha apenas os caminhos abaixo**. Não há necessidade de informar os caminhos nesta conversa.

```yaml
repositories:
  harness:
    path: "<COLE_AQUI_O_CAMINHO_ABSOLUTO_DO_HARNESS_LECA>"
    github: "matheussanabria/harnness-leca"
    branch: "auto-detectar"  # não trocar de branch durante a revisão
  dai:
    path: "<COLE_AQUI_O_CAMINHO_ABSOLUTO_DO_HARNESS_DAI>"
    github: "matheussanabria/harness-dai"
    branch: "auto-detectar"  # não trocar de branch durante a revisão
```

Exemplos válidos de `path` no Windows: `C:/Users/usuario/git/harnness-leca` ou `D:/repos/harness-dai`.
Se o agente estiver executando no WSL, utilizar caminhos acessíveis no ambiente dele, como `/mnt/c/Users/usuario/git/...`.

## Regras de resolução

1. Usar os caminhos deste arquivo como fonte principal, **sem inferir diretórios**.
2. Validar existência, acesso e identidade Git em ambos os caminhos usando somente comandos de leitura (`git rev-parse --show-toplevel`, `git remote -v`, `git branch --show-current`, `git rev-parse HEAD`, `git status --short`).
3. Não executar `git checkout`, `git pull`, `git fetch`, `git reset`, instalações, exports, scripts geradores, hooks ou qualquer comando com efeitos colaterais.
4. Se um caminho for inválido, registrar bloqueio e seguir com o repositório acessível; não procurar automaticamente por credenciais ou pastas pessoais.
5. Não modificar arquivos dos repositórios. O relatório da investigação deve ser escrito fora deles, em diretório de saída definido pelo operador; se não houver permissão, responder no chat.
6. Identificar código real, testes e docs pelo commit atual; não presumir que a branch atual seja `main` ou `dev`.
7. Nunca expor segredos, variáveis de ambiente, tokens ou conteúdo sensível no relatório.
