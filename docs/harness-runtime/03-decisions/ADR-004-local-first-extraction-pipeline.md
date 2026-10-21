# ADR-004 — Pipeline de Extração Local-First

## Status
Aprovado

## Contexto
A extração de artefatos (memórias, regras, decisões, termos de domínio) a partir das conversas dos projetos é uma tarefa recorrente e de baixo risco de alucinação estrutural: o resultado é sempre uma **sugestão** gravada em `projects/<slug>/context/`, sujeita a revisão humana, e nunca é escrito automaticamente em `memory.md` ou `instructions.md`.

Executar essa tarefa com LLMs em nuvem consome cota de engines pagos, envia conteúdo de conversas a terceiros e adiciona latência a um fluxo que roda em lote.

## Decisão
Adotar um pipeline de extração local-first:
1. O motor local (Ollama) é a primeira opção para extração estruturada, com o modelo compacto `qwen3.5:4b` como padrão.
2. A extração estruturada (decisões, regras, termos, resumo) usa contrato estrito validado localmente (`schemas/runtime-extraction.schema.json`); payload fora do contrato é rejeitado, não aceito parcialmente.
3. A extração de artefatos em Markdown usa resposta em texto livre (`generateText`), sem `format: json`, porque o formato esperado pela CLI é seções Markdown.
4. A escrita continua sendo apenas em `projects/<slug>/context/extraido-memorias.md`, como sugestão revisável.
5. Falha do motor local **não** aciona fallback para nuvem: a conversa permanece pendente no estado de extração e é reprocessada depois.

## Consequências
- **Positivas:** Zero consumo de cota para o fluxo de extração; conteúdo das conversas permanece na máquina; contrato determinístico e testável sem rede.
- **Negativas / Riscos:** Modelos compactos produzem extrações menos completas que modelos grandes; a dependência do daemon local exige instalação e RAM livre; a revisão humana continua obrigatória.
- **Mitigações:** Prompt de sistema determinístico com formato explícito; validação estrita; testes com mocks cobrindo o caminho feliz e os casos de falha; estado de pendência que evita perda de trabalho.
