# 02 - Diretrizes obrigatorias

1. Ler `AGENTS.md`, `CLAUDE.md`, `MAPA.md`, `README.md`, `SETUP.md` e instrucoes aplicaveis, conforme existirem.
2. Usar `MAPA.md` para localizar modulos, contratos e pontos de integracao.
3. Inspecionar o codigo real antes de assumir que algo existe ou esta ausente.
4. Reutilizar servicos, padroes, scripts e interfaces existentes.
5. Evitar frameworks, dependencias, camadas e agentes adicionais sem justificativa tecnica.
6. Priorizar automacao deterministica antes de propor chamadas a LLM.
7. Considerar limites de CPU, memoria, concorrencia e contexto.
8. Garantir isolamento por projeto, permissoes, seguranca e compatibilidade retroativa.
9. Nao executar operacoes destrutivas, instalacoes, alteracoes de configuracao global ou chamadas pagas sem autorizacao.
10. Registrar evidencias e distinguir fatos observados de hipoteses.
11. Nao usar nuvem como fallback automatico sem respeitar autorizacao e orcamento.
12. Preferir modificacoes pequenas, incrementais, testaveis e reversiveis.

## Seguranca e qualidade

- Scripts com allowlist e validacao de argumentos; protecao contra command injection e path traversal.
- Isolamento entre projetos; segredos nunca enviados a modelos sem autorizacao.
- Acoes destrutivas exigem aprovacao.
- Alteracoes de codigo passam pelos testes apropriados.
- Novas funcoes com feature flag; roteamento desabilitavel mantendo o fluxo anterior.
- Arquivos de codigo ate 300 linhas, sem emojis; icones apenas FontAwesome (regras do `AGENTS.md`).
