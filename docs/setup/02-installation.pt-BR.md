# 02. Instalação

Para instalar a interface React de forma reproduzível, execute `npm ci` na raiz e aguarde sua conclusão antes dos testes ou do build. Depois execute `npm run build:web`. Não instale dependências em paralelo com os testes: os testes de lint dos protótipos usam ferramentas instaladas. Consulte o [registro de validação](VALIDATION-2026-11-16.md) para o escopo testado e as limitações restantes.

Parte da [série de configuração](01-overview.pt-BR.md). Windows 10/11 apenas por enquanto.

Leia em inglês: [02 Installation](02-installation.md).

## Pré-requisitos

| Item | Para quê | Como conferir |
|---|---|---|
| Windows 10/11 + PowerShell | O hook do Claude Code é um script PowerShell | `$PSVersionTable.PSVersion` |
| [Git](https://git-scm.com/downloads) | Clonar o repositório | `git --version` |
| [Node.js 22.13+](https://nodejs.org) | Interface, importadores e sincronização (a importação do opencode usa o `node:sqlite` integrado) | `node -v` |
| CLI de pelo menos um mecanismo | Produz as conversas que você vai importar | consulte [03](03-engines-and-credentials.pt-BR.md) |

O backend Node e as ferramentas não têm dependências de runtime e usam módulos integrados do Node. As ilhas opcionais da interface React têm dependências npm: execute `npm install` antes de compilá-las com `npm run build:web`, conforme descrito em [SETUP.md](../../SETUP.md#react-islands-adr-011).

## 1. Clonar

```powershell
git clone <repository-url> harness-leca
cd harness-leca
```

Se o repositório for privado, peça o endereço e o acesso ao proprietário.

## 2. Criar seus arquivos globais locais

Estes arquivos são pessoais e ignorados pelo Git:

```powershell
Copy-Item global/instructions.example.md global/instructions.md
Copy-Item global/memory.example.md global/memory.md
```

Edite `global/instructions.md` com o que todos os assistentes devem sempre seguir (idioma, tom e regras de segurança).

## 3. Opcional: arquivo de ambiente

Crie `global/.env` (ignorado pelo Git) apenas para as configurações necessárias. As linhas seguem o formato `KEY=value`; `#` inicia um comentário. Uma variável já definida no ambiente do sistema tem precedência sobre o arquivo.

| Chave | Quando é necessária |
|---|---|
| `GEMINI_API_KEY` (ou `GOOGLE_API_KEY`) | Respostas imediatas do Gemini no chat da interface web (chave gratuita do Google AI Studio). Sem ela, a interface grava na fila `bridge/` |
| `ANTHROPIC_API_KEY` | Somente se você usar uma chave de API em vez do login por assinatura do Claude |
| `CLAUDE_BIN`, `CODEX_BIN`, `OPENCODE_BIN` | Caminho absoluto do executável quando ele não for encontrado em `PATH` |
| `OPENCODE_URL` | URL do servidor opencode se não estiver na porta padrão (63186) |
| `OLLAMA_URL` | Ollama em outra máquina (padrão `http://localhost:11434`) |

`global/.env.example` documenta as mesmas chaves. Nunca faça commit do `.env`.

## 4. Abrir a pasta no Claude Code e aprovar o hook

Execute `claude` dentro da pasta (ou abra-a no aplicativo desktop / extensão do VS Code). No primeiro uso, **aprove o hook** declarado em `.claude/settings.json`: ele injeta as instruções e a memória do projeto ativo antes de cada mensagem.

## 5. Ativar o hook de pré-commit do Git (contribuidores)

```powershell
npm run setup:hooks
```

## 6. Verificar

```powershell
node -v                 # 22.13 ou mais recente
npm test                # a suíte de testes deve passar
npm run check           # sintaxe e integridade de todos os scripts
npm run ui              # abrir http://localhost:4321
```

Para ver exatamente o que o hook injeta:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .claude/hooks/load-project.ps1
```

## 7. Criar seu primeiro projeto

Copie o modelo:

```powershell
Copy-Item -Recurse projects/_template projects/my-project
Set-Content projects/.active "my-project"
```

Ou adote uma pasta existente, o que também detecta a tecnologia e cria os arquivos iniciais: consulte [05](05-adopt-existing-projects.pt-BR.md).

Próximo: [03 Mecanismos e credenciais](03-engines-and-credentials.pt-BR.md).
