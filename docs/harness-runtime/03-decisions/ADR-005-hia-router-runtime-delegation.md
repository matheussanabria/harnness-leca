# ADR-005 — Delegação Dinâmica do Roteador HIA para o Runtime Local

## Status
Aprovado

## Contexto
O HIA Router decide, para cada prompt, qual executor deve produzir a resposta: motor em nuvem, motor local, script ou humano. Na Fase 1, a camada Local-First existia, mas cobria apenas intenções curtas e estreitas, com limite de 1500 caracteres e um modelo pequeno (`qwen2.5-coder:1.5b`).

Com a Fase 2 entregue, as intenções de classificação e extração de artefatos passaram a ter contraparte local comprovada, com contrato estrito e testes.

## Decisão
1. A camada Local-First do `tools/lib/hia/router.js` passa a reconhecer as intenções de extração (`extrair artefatos`, `extrair entidades`, `extraia o json`, `classifique`, `resuma em poucas palavras`, `gere um teste simples`).
2. O limite de tamanho do prompt sobe de 1500 para 2500 caracteres, compatível com o orçamento de contexto do modelo local.
3. O alvo local passa a ser `ollama:qwen3.5:4b`, o mesmo modelo usado pelo pipeline de extração, alinhando decisão e execução.
4. A delegação só ocorre quando `getHardwareSnapshot().viable` for verdadeiro (RAM livre suficiente).
5. A decisão returned pelo roteador é sempre **explicada** (`reason`) e quantificada (`estimatedTokensSaved`), para que o comportamento seja auditável pelo painel de métricas.
6. **Sem escalonamento implícito:** o roteador não promove a tarefa para outro executor por conta própria. Se a execução local falhar, o dispatcher mantém o motor que o usuário pediu (com aviso explícito na conversa) — fallback **visível e solicitado**, diferente do fallback silencioso vedado no ADR-002, que vale para o classificador em modo shadow e para o pipeline de extração.

## Consequências
- **Positivas:** Menos consumo de cota em tarefas rotineiras; comportamento previsível e auditável; alinhamento entre decisão do roteador e modelo efetivamente usado.
- **Negativas / Riscos:** Prompts maiores aumentam o tempo de inferência local; `qwen3.5:4b` exige mais RAM que o modelo anterior e precisa estar instalado; rigor do regex pode incluir prompts que não se beneficiariam da execução local.
- **Mitigações:** Verificação de viabilidade de hardware antes da delegação; limite de contexto explícito; telemetria com duração e validade por inferência para auditoria; aviso explícito ao usuário quando a execução local cai no motor pedido.
