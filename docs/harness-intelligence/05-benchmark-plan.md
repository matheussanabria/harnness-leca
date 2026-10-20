# 05 - Plano de Benchmark e Avaliação de Modelos Locais (F4)

**Status:** Aprovado em F4 | **Data:** 2026-10-19 | **Referência:** HIA-009

---

## 1. Objetivo

Avaliar empiricamente se modelos locais quantizados executados exclusivamente em CPU (AMD Ryzen 5 7430U, 6 núcleos / 12 threads) possuem acurácia e velocidade aceitáveis para absorver tarefas determinísticas e de apoio sem degradar a máquina e sem esgotar cotas semanais dos motores em nuvem.

---

## 2. Critérios de Viabilidade em Hardware Host

- **RAM Livre Mínima:** 3.000 MB livres durante toda a execução.
- **Teto de Threads:** 4 threads de inferência (preservando 8 threads lógicas para o sistema, editor e background jobs).
- **Latência Máxima:**
  - Extração de JSON: < 5s
  - Classificação de intenção: < 3s
  - Geração de testes unitários simples: < 15s
- **Taxa de Alucinação / Falha de Formato:** 0% em tarefas estritas de JSON.

---

## 3. Datasets de Teste Versionados (`tests/fixtures/benchmark/`)

1. **`json-extraction.json`:**
   - Extração estruturada de dados a partir de logs e mensagens de erro do Harness.
   - Avaliação: Validação estrita via `JSON.parse` e casamento de chaves.

2. **`intent-classification.json`:**
   - 20 frases reais de usuários categorizadas entre: `git_status`, `check_repo`, `coordination_info`, `explore_context`, `complex_code`.
   - Avaliação: Acurácia percentual em relação ao gabarito.

3. **`code-test-generation.json`:**
   - Código JS de 10 linhas para gerar bloco `node:test` assertivo.
   - Avaliação: Código gerado executável sem syntax error.

---

## 4. Modelos Candidatos

| Modelo | Tamanho em Disco | RAM em Inferência | Contexto Recomendado | Foco Principal |
|---|---|---|---|---|
| `qwen2.5-coder:1.5b` | ~980 MB | ~1.4 GB | 2.048 tokens | Classificação rápida e JSON extraction |
| `qwen2.5-coder:3b` | ~1.9 GB | ~2.5 GB | 2.048 tokens | Refatorações curtas e testes |
| `deepseek-r1:1.5b` | ~1.1 GB | ~1.6 GB | 2.048 tokens | Raciocínio local preliminar |

---

## 5. Procedimento de Execução

O benchmark pode ser executado via CLI:
```bash
node tools/lib/hia/benchmark.js --dataset json-extraction --model qwen2.5-coder:1.5b
```

Caso o daemon do Ollama não esteja ativo no momento, o runner reporta a ausência do serviço de forma limpa, permitindo execução contínua em CI/CD sem falsos positivos.
