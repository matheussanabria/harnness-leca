# Matriz de Ownership e Fronteiras Multiagente

Em um projeto trabalhado simultaneamente por múltiplos agentes autônomos ou desenvolvedores, a concorrência direta nos mesmos arquivos é a principal causa de regressões, conflitos de merge e desvios arquiteturais.

## Princípios de Fronteira

1. **Separação Rígida por Camadas:**
   - **Trilha de Dados, Serviços e Sync:** Pertence a um único provedor (ex: Codex). Ele é responsável por publicar contratos de API (JSON schemas e exemplos).
   - **Trilha de Interface, DOM e Estilo:** Pertence a outro provedor (ex: Gemini). Ele consome os contratos fornecidos pela trilha de dados.
   - **Trilha de Integração:** Entrypoints compartilhados (`router.js`, `package.json`, índices de documentação) só são editados por um integrador designado ou em janela serializada.

2. **Regras de Não-Interferência:**
   - O agente de UI **nunca** edita controllers ou serviços para ajustar retornos de dados à sua conveniência. Se o contrato precisar de ajuste, faz-se um `handoff` ou `notify` para o dono do backend.
   - O agente de Backend **nunca** injeta HTML, classes CSS ou manipulação de DOM para compensar deficiências da interface.
   - Testes de backend e testes de frontend devem ser mantidos em arquivos separados (`*.service.test.js` vs `*.dom.test.js`).

3. **Arquivos Congelados para Decomposição:**
   - Qualquer arquivo que atinja o limiar de 250 a 300 linhas fica automaticamente classificado como "congelado".
   - Antes de adicionar qualquer nova funcionalidade, o responsável pela trilha deve decompor o arquivo extraindo módulos coesos em subpastas (`modules/`, `services/`, `components/`).
