// @ts-check
// Catálogo de templates de skills para repositórios de API.

const API_TEMPLATES = [
    {
      name: "anti-patterns",
      title: "Anti-Patterns Backend (Java / Spring)",
      description: "Práticas proibidas no backend (violação de camadas, transações mal configuradas, N+1 em JPA, regras no Controller e exceções genéricas).",
      templateMd: `---
name: anti-patterns
description: >-
  Práticas proibidas ou desaconselhadas no backend Java/Spring Boot deste
  projeto. Use ao revisar código, criar endpoints REST ou implementar
  serviços de domínio para evitar problemas de concorrência, N+1 ou quebra de camada.
version: 1.0.0
---

# Anti-Patterns Backend (Java / Spring Boot)

Diretrizes de boas práticas e armadilhas a evitar no backend.

## 1. Regra de Negócio no Controller / Resource
- ❌ **Proibido**: Colocar lógicas de negócio, cálculos, validações complexas ou chamadas a múltiplos repositórios dentro da classe Controller/Resource.
- ✅ **Recomendado**: O Resource deve apenas receber o Request, chamar o Use Case / Service e retornar o DTO de resposta adequado.

## 2. Violação de Camadas e Exposição de Entidades JPA
- ❌ **Proibido**: Retornar entidades JPA (\`@Entity\`) diretamente nos endpoints REST.
- ✅ **Recomendado**: Use sempre Records ou DTOs específicos de resposta para isolar o contrato da API do modelo de banco de dados.

## 3. Problema do N+1 em Consultas JPA
- ❌ **Proibido**: Deixar coleções \`@OneToMany\` com fetch EAGER ou iterar sobre entidades disparando uma query por registro.
- ✅ **Recomendado**: Utilize \`JOIN FETCH\`, EntityGraph ou projeções específicas em queries customizadas.

## 4. Tratamento Genérico de Exceções
- ❌ **Proibido**: Fazer \`catch (Exception e)\` genérico engolindo o erro ou lançando \`RuntimeException\` genérica.
- ✅ **Recomendado**: Crie exceções de domínio tipadas (\`RecursoNaoEncontradoException\`, \`RegraDeNegocioException\`) tratadas globalmente no \`ApiExceptionHandler\` (\`@RestControllerAdvice\`).
`,
      references: [
        {
          name: "persistence-transactions.md",
          content: "# Transações e Persistência\n\nCuidados com @Transactional e isolamento de banco de dados.\n",
        },
        {
          name: "solid-layer-violations.md",
          content: "# Violações de Camada\n\nRegras estritas de dependência entre controllers, core e infra.\n",
        },
      ],
    },
    {
      name: "boas-praticas",
      title: "Boas Práticas Backend (Spring Boot)",
      description: "Diretrizes práticas de Controllers REST, Services de domínio, DTOs (Records), Repositories Spring Data JPA e Segurança.",
      templateMd: `---
name: boas-praticas
description: >-
  Boas práticas de arquitetura e implementação para o backend Java / Spring Boot.
  Use ao criar ou revisar Controllers/Resources, Services, Repositories e DTOs.
version: 1.0.0
---

# Boas Práticas Backend (Java / Spring Boot)

Convenções e arquitetura recomendadas para o backend do sistema.

## 1. Design RESTful
- Mantenha URIs substantivas no plural: \`/api/pacientes\`, \`/api/programas-saude\`.
- Use os verbos HTTP corretos: \`GET\` (consulta), \`POST\` (criação), \`PUT\` (substituição total), \`PATCH\` (atualização parcial), \`DELETE\` (remoção).
- Retorne os códigos de status adequados: \`200 OK\`, \`201 Created\`, \`204 No Content\`, \`400 Bad Request\`, \`404 Not Found\`, \`409 Conflict\`.

## 2. Services e Regras de Negócio
- Encapsule as regras no pacote de domínio (\`core\`).
- Isole integrações externas (APIs legadas, serviços governamentais) em adaptadores na camada de infraestrutura (\`infra\`).

## 3. Imutabilidade com Records
- Utilize Java Records para todos os DTOs de entrada e saída.
- Valide os dados de entrada usando anotações do Jakarta Bean Validation (\`@NotNull\`, \`@NotBlank\`, \`@Valid\`).
`,
      references: [
        {
          name: "rest-controllers.md",
          content: "# Padrão de Endpoints REST\n\nEstruturação de Resources, paginação e status codes.\n",
        },
        {
          name: "services-domain.md",
          content: "# Camada de Domínio e Use Cases\n\nOrganização de regras de negócio desacopladas do framework.\n",
        },
      ],
    },
    {
      name: "infra-qualidade",
      title: "Infraestrutura & Qualidade Backend",
      description: "Estrutura de pacotes Maven, build, Dockerfile, perfis application.yml, Checkstyle e testes JUnit 5 / Mockito.",
      templateMd: `---
name: infra-qualidade
description: >-
  Estrutura de pastas, build Maven, testes automatizados e ferramentas
  de qualidade do backend. Use ao rodar builds, configurar ambientes ou revisar PRs.
version: 1.0.0
---

# Infraestrutura & Qualidade Backend

Diretrizes de build, testes e qualidade de código do backend.

## 1. Comandos Principais
- \`mvn clean compile\`: Compila as classes Java e valida os tipos.
- \`mvn spring-boot:run\`: Inicia a aplicação localmente.
- \`mvn test\`: Roda os testes unitários e de integração com JUnit 5.
- \`mvn checkstyle:check\`: Executa a validação de regras estáticas de código.

## 2. Testes Automatizados
- Crie testes unitários para Services de domínio usando Mockito.
- Crie testes de integração (\`@WebMvcTest\` ou \`@SpringBootTest\`) para endpoints críticos.
- Mantenha cobertura adequada de testes nos cenários felizes e casos de exceção.
`,
      references: [
        {
          name: "folder-structure.md",
          content: "# Estrutura de Pacotes\n\nDivisão de control.api, core, infra e config.\n",
        },
        {
          name: "linters-checkers.md",
          content: "# Análise Estática com Checkstyle\n\nRegras ativas no checkstyle.xml do projeto.\n",
        },
      ],
    },
    {
      name: "padroes-codigo",
      title: "Padrões de Código Backend",
      description: "Padrões de nomenclatura Java, organização de classes, arquitetura em camadas e regras de dependência.",
      templateMd: `---
name: padroes-codigo
description: >-
  Padrões de formatação, nomenclatura e organização de código Java deste backend.
  Use ao nomear classes, pacotes, métodos ou verificar regras de camadas.
version: 1.0.0
---

# Padrões de Código Backend

Convenções de nomenclatura e camadas arquiteturais.

## 1. Nomenclatura de Classes
- Resources/Controllers: \`<Entidade>Resource\` (ex.: \`PacienteResource\`)
- Services: \`<Entidade>Service\` (ex.: \`DispensacaoService\`)
- Repositories: \`<Entidade>Repository\` (interface no core) e \`<Entidade>RepositoryImpl\` (no infra)
- DTOs / Requests / Responses: \`<Entidade>Dto\`, \`<CasoDeUso>Request\` (Records)
- Entidades JPA: \`<Entidade>\` sem sufixos (ex.: \`Receita\`, \`Usuario\`)

## 2. Regra de Dependência entre Camadas
- \`control.api\` depende de \`core\`.
- \`core\` é puro: não deve depender de controllers nem de detalhes técnicos de infraestrutura externa.
- \`infra\` implementa interfaces definidas em \`core\` (Repository Pattern / Ports and Adapters).
`,
      references: [
        {
          name: "naming.md",
          content: "# Convenções de Nomenclatura\n\nTabela detalhada de padrões aceitos no projeto.\n",
        },
        {
          name: "architecture-layers.md",
          content: "# Arquitetura de Camadas\n\nRegras estritas de visibilidade e importações entre pacotes.\n",
        },
      ],
    },
];

module.exports = { API_TEMPLATES };
