# Domínio 05: Interface de Operação, Chat e Estúdio Visual
## Harness Leca — Especificação de Requisitos de Software

---

## 1. Visão do Domínio
O **Domínio de Interface de Operação e Estúdio** fornece ao usuário uma experiência visual moderna e local-first para interagir com seus projetos, conversar com qualquer motor sem custos de API, prototipar interfaces ("Vibe Studio") e acompanhar os agentes em um ambiente interativo (Escritório 2D/3D).

---

## 2. Requisitos Funcionais (RF)

- **RF-05.1 (Servidor HTTP Local Leve):** O sistema deve subir uma aplicação web local em `http://localhost:4321` sem dependência de frameworks pesados no backend (`ui/server.js`).
- **RF-05.2 (Navegação Central de Projetos):** A interface deve listar os projetos disponíveis, projeto ativo, conversas recentes e arquivos de contexto.
- **RF-05.3 (Chat Multi-Motor sem Chave de API Paga):** A interface deve permitir conversar diretamente com os motores instalados na máquina:
  - Claude Code via integração CLI local/plano contratado.
  - Gemini via AI Studio gratuito ou Bridge local.
  - OpenCode via porta local `63186`.
- **RF-05.4 (Injeção de Contexto em Tempo de Execução):** Toda mensagem disparada pelo chat da interface deve automaticamente anexar instruções, memórias do projeto ativo e arquivos relevantes no prompt.
- **RF-05.5 (Gravação Direta de Conversas):** As mensagens trocadas na interface web devem ser persistidas automaticamente na pasta `projects/<slug>/chats/` do projeto ativo.
- **RF-05.6 (Vibe Studio / Prototipagem Rápida):** A interface deve fornecer um canvas de visualização e edição de componentes HTML/CSS/JS em tempo real para prototipagem rápida.
- **RF-05.7 (Escritório Digital dos Agentes 2D/3D):** A interface deve disponibilizar uma representação visual (mapa 2D com Phaser/Canvas e sala 3D com Three.js) exibindo os agentes trabalhando em tempo real, suas tarefas e estado de raciocínio.

---

## 3. Regras de Negócio (RN)

- **RN-05.1 (Arquitetura Zero Bundlers no Frontend):** O frontend deve usar Vanilla JavaScript modular (ES Modules nativos nos navegadores), sem necessidade de Webpack, Vite ou build step.
- **RN-05.2 (Preservação de Responsividade):** O layout deve se adaptar fluidamente tanto para telas de desktop (modo painel duplo/tríplo) quanto para telas mobile e tablets.
- **RN-05.3 (Proteção contra Loops de Mensagens):** Respostas de agentes não devem disparar auto-mensagens recursivas sem confirmação expressa do usuário.

---

## 4. Requisitos Não Funcionais (RNF)

- **RNF-05.1 (Tempo de Inicialização do Servidor):** O servidor local (`npm run ui`) deve estar pronto para aceitar conexões em menos de 1 segundo.
- **RNF-05.2 (Design e Estética Premium):** O visual deve seguir paleta escura moderna, tipografia limpa (Google Fonts), contrastes WCAG AA e microanimações fluidas sem travamento no render 3D.
- **RNF-05.3 (Consumo de Memória do Servidor):** A instância do servidor Node.js em repouso deve consumir menos de 50MB de RAM.

---

## 5. Casos de Uso Principais

### UC-06: Sessão de Chat com Contexto Injetado
1. O desenvolvedor abre `http://localhost:4321`.
2. Seleciona o projeto ativo e clica em "Conversar com o Projeto".
3. Digita uma dúvida arquitetural.
4. O servidor compõe o prompt com as regras de `instructions.md` e memórias de `memory.md` e envia ao motor selecionado.
5. A resposta em streaming é renderizada e salva em `projects/<slug>/chats/<id>.json`.
