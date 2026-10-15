---
titulo: "Importar conversas novas e extrair memórias"
acao: sync-extrair        # sync | extrair | sync-extrair | prompt
intervalo: 12h            # de 15m a 90d (m = minutos, h = horas, d = dias)
ativa: false              # troque para true para valer
engine: opencode          # claude | opencode (só para extrair e prompt)
modelo: opencode/deepseek-v4.1-flash-free
limite: 10                # conversas analisadas por execução
---
Esta rotina é um exemplo e está desativada (ativa: false).

Ela importa as conversas novas dos 3 motores e extrai memórias, regras e decisões das pendentes com um modelo
gratuito do OpenCode. O resultado são SUGESTÕES: nada vai para memory.md sem a sua revisão na interface.

Para uma rotina de texto livre, use `acao: prompt` e escreva o prompt aqui no corpo; o resultado vai para
scheduled/resultados/. Veja o SETUP.md, seção "Rotinas".
