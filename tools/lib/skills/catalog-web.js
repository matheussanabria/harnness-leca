// @ts-check
// Catálogo de templates de skills para repositórios web.

const WEB_TEMPLATES = [
    {
      name: "anti-patterns",
      title: "Anti-Patterns Frontend",
      description: "Práticas a evitar no frontend (vazamentos RxJS, tipagem any, seletores CSS frágeis, recriação desnecessária de componentes e mutação de estado).",
      templateMd: `---
name: anti-patterns
description: >-
  Práticas proibidas ou desaconselhadas no desenvolvimento frontend deste
  projeto. Use ao revisar código, criar componentes ou refatorar para
  garantir ausência de memory leaks, mutação indevida de estado ou any.
version: 1.0.0
---

# Anti-Patterns Frontend

Lista de anti-patterns específicos deste repositório frontend.

## 1. Vazamento de Memória em Subscrições RxJS
- ❌ **Proibido**: Fazer \`.subscribe()\` em componentes sem gerenciar o cancelamento.
- ✅ **Recomendado**: Usar \`takeUntilDestroyed()\` (Angular 16+) ou \`async\` pipe no template.

## 2. Tipagem Frágil e Uso de \`any\`
- ❌ **Proibido**: Usar \`any\` em payloads de API ou modelos de formulário.
- ✅ **Recomendado**: Criar interfaces/tipos TypeScript fortes para cada DTO e ViewModel.

## 3. Manipulação Direta do DOM
- ❌ **Proibido**: Usar \`document.getElementById\` ou \`querySelector\` dentro dos componentes.
- ✅ **Recomendado**: Usar view queries (\`viewChild\`) ou bindings declarativos no template.
`,
      references: [
        {
          name: "rxjs-services.md",
          content: "# Cuidados com RxJS e Services\n\nDiretrizes de ciclo de vida e cancelamento de subscriptions.\n",
        },
        {
          name: "css-performance.md",
          content: "# Performance e Estilização\n\nEvitar seletores globais profundos e re-renders causados por CSS.\n",
        },
      ],
    },
    {
      name: "boas-praticas",
      title: "Boas Práticas Frontend",
      description: "Boas práticas de arquitetura e implementação frontend (Signals, standalone components, Services desacoplados, tratamento de erros e Clean Code).",
      templateMd: `---
name: boas-praticas
description: >-
  Boas práticas de arquitetura, componentes e reatividade moderna. Use ao
  construir novas telas, serviços de integração e componentes reutilizáveis.
version: 1.0.0
---

# Boas Práticas Frontend

Diretrizes arquiteturais para o frontend deste projeto.

## 1. Reatividade e Signals
- Prefira Signals (\`signal\`, \`computed\`) para estado local de componentes.
- Use RxJS para fluxos assíncronos complexos e comunicação HTTP, convertendo para signals com \`toSignal\` onde apropriado.

## 2. Componentes Focados e Clean Code
- Mantenha componentes com menos de 200 linhas de código.
- Separe componentes inteligentes (containers de tela/negócio) de componentes burros/visuais (apenas inputs/outputs).

## 3. Feedback ao Usuário e Acessibilidade
- Sempre exiba estados de loading, erro e vazio (empty states).
- Mantenha navegação acessível via teclado e contraste compatível com WCAG AA.
`,
      references: [
        {
          name: "components.md",
          content: "# Padrão de Componentes\n\nDiretrizes de estruturação de componentes reutilizáveis.\n",
        },
        {
          name: "signals.md",
          content: "# Uso de Signals\n\nGuia de transição e utilização de signals na aplicação.\n",
        },
      ],
    },
    {
      name: "design-systems",
      title: "Design System & Convenções Visuais",
      description: "Paleta de cores, tipografia, espaçamento, grids e regras de componentes visuais do projeto.",
      templateMd: `---
name: design-systems
description: >-
  Paleta de cores, tipografia, grid/espaçamento e regras de componentes
  visuais do frontend deste projeto. Use ao escrever CSS de componente,
  ao escolher cores/tamanhos ou criar novos componentes visuais.
version: 1.0.0
---

# Design System & Convenções Visuais

Convenções visuais e biblioteca de componentes adotada no projeto.

## 1. Paleta de Cores e Tokens
- Use as cores definidas na identidade visual do projeto.
- Não crie variações arbitrárias de cores sem validação com o design.

## 2. Espaçamentos e Grid
- Mantenha múltiplos de 4px / 8px nos espaçamentos (padding e margin).
- Utilize o sistema de grid padronizado para manter a consistência entre telas.

## 3. Botões e Ações
- Botão primário para a ação principal da tela.
- Botões secundários ou outline para ações acessórias.
- Cores de destaque para ações críticas (excluir/cancelar).
`,
      references: [
        {
          name: "colors.md",
          content: "# Tabela de Cores\n\nValores hexadecimais e classes utilitárias do projeto.\n",
        },
        {
          name: "grid-spacing.md",
          content: "# Grid e Espaçamentos\n\nEscala de espaçamento padrão do layout.\n",
        },
      ],
    },
    {
      name: "infra-qualidade",
      title: "Infraestrutura & Qualidade Frontend",
      description: "Estrutura de pastas, comandos de execução/build, linters, checklist de code review e ambientes de execução.",
      templateMd: `---
name: infra-qualidade
description: >-
  Estrutura de pastas, build, scripts e critérios de qualidade do frontend.
  Use ao rodar comandos locais, validar builds ou revisar Pull Requests.
version: 1.0.0
---

# Infraestrutura & Qualidade

Diretrizes de tooling e processo de qualidade do projeto.

## 1. Comandos Principais
- \`npm start\` / \`ng serve\`: Inicia o servidor local de desenvolvimento.
- \`npm run build\`: Gera o pacote de produção.
- \`npm test\`: Executa a suíte de testes automatizados.

## 2. Checklist de Code Review
- [ ] O código compila sem erros ou avisos graves de TypeScript.
- [ ] Não há \`console.log\` ou dados sensíveis residuais.
- [ ] As novas funcionalidades possuem testes ou critérios de aceite validados.
`,
      references: [
        {
          name: "folder-structure.md",
          content: "# Estrutura de Pastas\n\nOrganização de src/, features/, shared/ e assets/.\n",
        },
        {
          name: "commands.md",
          content: "# Comandos Úteis\n\nScripts npm disponíveis no package.json.\n",
        },
      ],
    },
    {
      name: "padroes-codigo",
      title: "Padrões de Código Frontend",
      description: "Padrões de nomenclatura, organização de arquivos, convenções TypeScript e templates HTML.",
      templateMd: `---
name: padroes-codigo
description: >-
  Padrões de nomenclatura, organização de arquivos, tipagem TypeScript e
  estilização de templates para o frontend. Use ao nomear arquivos, classes,
  seletores e variáveis neste projeto.
version: 1.0.0
---

# Padrões de Código Frontend

Convenções de nomenclatura e escrita adotadas pelo time.

## 1. Nomenclatura de Arquivos
- Componentes: \`nome-da-feature.component.ts\` e \`.html\`, \`.css\`
- Serviços: \`nome-do-dominio.service.ts\`
- Modelos: \`nome-do-recurso.model.ts\` ou \`.dto.ts\`
- Utilitários: \`nome-da-funcao.util.ts\`

## 2. Nomenclatura no Código
- Classes e Interfaces: PascalCase (\`PacienteDetalheComponent\`, \`PacienteDto\`)
- Métodos e Variáveis: camelCase (\`carregarPaciente\`, \`idPaciente\`)
- Constantes: UPPER_SNAKE_CASE (\`API_TIMEOUT_MS\`)
`,
      references: [
        {
          name: "naming.md",
          content: "# Nomenclatura Completa\n\nTabela detalhada com exemplos reais de nomes aceitos.\n",
        },
        {
          name: "structure.md",
          content: "# Ordem de Membros na Classe\n\nPropriedades, signals, construtor, lifecycle hooks e métodos.\n",
        },
      ],
    },
];

module.exports = { WEB_TEMPLATES };
