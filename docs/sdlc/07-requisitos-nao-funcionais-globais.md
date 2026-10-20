# Domínio 07: Catálogo Global de Requisitos Não Funcionais (RNFs)
## Harness Leca — Especificação de Engenharia de Software

---

## 1. Visão Geral
Este documento estabelece as restrições arquiteturais, padrões de qualidade de código e diretrizes não funcionais que governam **todo e qualquer desenvolvimento** no Harness Leca.

---

## 2. Catálogo de Requisitos Não Funcionais (RNFs)

### 2.1 RNF-01: Arquitetura Anti-Monólito & Limites de Arquivo
- **RNF-01.1 (Teto de Linhas por Arquivo):** Arquivos de código-fonte (`.js`, `.css`, etc.) devem ter preferencialmente até **200 linhas**, com teto máximo inegociável de **250 a 300 linhas**.
- **RNF-01.2 (Proibição de "God Files"):** É expressamente proibido continuar injetando código no final de arquivos já grandes. Qualquer recurso novo deve ser decomposto em submódulos coesos em subpastas (`modules/`, `services/`, `controllers/`, `components/`).
- **RNF-01.3 (Princípio da Responsabilidade Única - SRP):** Nunca misturar renderização visual/canvas, manipulação de DOM, chamadas de rede/HTTP e regras de negócio no mesmo arquivo.

### 2.2 RNF-02: Eficiência de Tokens e Preservação de Janela de Contexto
- **RNF-02.1 (Minimização de Consumo de Tokens):** Arquivos enxutos e focados evitam saturação do contexto dos agentes LLM, reduzem drasticamente custos de inferência e previnem alucinações.
- **RNF-02.2 (Índices Leves de Navegação):** O projeto deve manter arquivos como `MAPA.md` e este `docs/sdlc/` para permitir que agentes localizem código sem varrer cegamente o disco.

### 2.3 RNF-03: Princípio Local-First & Privacidade Estrita
- **RNF-03.1 (Zero Telemetria Externa):** Nenhuma informação de código, histórico de chat ou memória de projeto pode ser enviada para servidores de telemetria de terceiros.
- **RNF-03.2 (Armazenamento em Formatos Abertos):** O estado deve residir integralmente em arquivos legíveis por humanos (`.json`, `.md`, `.jsonl`).

### 2.4 RNF-04: Portabilidade Multiplataforma
- **RNF-04.1 (Independência de Sistema Operacional):** O código deve ser 100% compatível e testado tanto em **Windows (PowerShell/CMD)** quanto em **Linux/macOS (Bash/Zsh)**, tratando corretamente barras de caminho (`path.join`, `path.resolve`).
- **RNF-04.2 (Zero Dependências de Compilação Nativa):** Os scripts devem rodar diretamente com Node.js LTS nativo, sem exigir ferramentas de compilação C++ (como `node-gyp`).

### 2.5 RNF-05: Confiabilidade e Testabilidade
- **RNF-05.1 (Test Runner Nativo):** A suíte de testes automatizados deve utilizar o test runner nativo do Node.js (`node:test`), executável via `npm test`, garantindo validação rápida em CI e ambiente local.
- **RNF-05.2 (Isolamento de Estado em Testes):** Testes nunca devem alterar arquivos de projetos reais; eles devem operar em diretórios temporários ou fixtures simuladas.

---

## 3. Matriz de Conformidade

| Dimensão | Alvo | Mecanismo de Garantia |
|---|---|---|
| **Tamanho de Arquivo** | <= 250 linhas | Validação via `npm run check` e inspeção contínua. |
| **Tempo de Startup da UI** | < 1000ms | Backend enxuto baseado no módulo `node:http`. |
| **Compatibilidade de Navegadores** | Chrome, Edge, Safari, Firefox | ES Modules nativos e CSS Variables modernos. |
| **Resiliência a Falhas** | Tratamento gracioso de erro | Try/catch com fallback e mensagens explicativas. |
