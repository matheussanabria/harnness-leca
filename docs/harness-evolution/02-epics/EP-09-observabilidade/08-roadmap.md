# Roadmap incremental e dependências

## Estratégia

Cada fase entrega um contrato verificável e reversível. A Central só ganha ações depois que descoberta, identidade, persistência e capacidades estiverem estáveis.

## Fases

| Fase | Entrega | Dependências | Gate de saída |
|---|---|---|---|
| F0 | Baseline, fixtures sanitizadas, idempotência do sync e reconciliação documental | EP-00 | Inventário, golden masters e colisões entre motores caracterizados |
| F1 | Portas de descoberta e catálogo de capacidades | EP-02.02, importadores | Quatro motores descobertos sem escrever nas fontes |
| F2 | Registro canônico e migração aditiva | F1, EP-04.01 | Reinício preserva identidade e vínculos |
| F3 | Event store, projetores e SSE recuperável | F2 | Cursor, replay e idempotência validados |
| F4 | Central em lista e Kanban somente leitura | F2, F3, EP-01 | Busca/filtros e estados ortogonais aceitos |
| F5 | Navegação e continuidade por capacidade | F4, EP-02.06, EP-03.03 | Cada motor executa somente ações verificadas |
| F6 | Atenção, notificações e aprovações | F3, EP-08.05 | Fila central auditável e badges consistentes |
| F7 | Migração do painel do Escritório e homologação | F4 a F6 | Paridade, acessibilidade, rollback e testes aprovados |

## Mapeamento para histórias

| História | Fases |
|---|---|
| 09.01 Descoberta e registro | F0 a F2 |
| 09.02 Eventos e recuperação | F3 |
| 09.03 Central e Kanban | F4 |
| 09.04 Navegação e retomada | F5 e integração de F7 |
| 09.05 Atenção e aprovações | F6 e homologação de F7 |

## Dependências entre épicos

- EP-01: janela, docking, foco, taskbar e layout.
- EP-02: modelos do chat e continuidade real por motor.
- EP-03: objetos e consumidores do Escritório.
- EP-04: seleção única de projeto.
- EP-08: políticas e decisões de workflow/aprovação.
- EP-10: consumirá saúde e atenção; não deve bloquear o núcleo da Central.

## Migração

1. Criar banco e schema sem alterar fontes.
2. Indexar sessões nativas e Markdown em modo dry-run comparável.
3. Persistir correspondências explícitas e deixar candidatas inferidas pendentes.
4. Habilitar consultas e SSE em paralelo ao Event Engine atual.
5. Migrar uma apresentação por vez: Central, Chat e Escritório.
6. Desativar projeções legadas somente após paridade registrada.

## Rollback

- feature flag restaura endpoints/renderizadores anteriores;
- banco novo pode permanecer sem ser consumido;
- nenhum rollback remove Markdown ou sessões nativas;
- migração de schema mantém backup transacional e versão anterior legível;
- falha em um adaptador não impede consulta das demais fontes.

## Riscos

| Risco | Mitigação |
|---|---|
| Fusão indevida de sessões | Identidade forte e associação inferida revisável |
| Status falso por `mtime` | Confiança explícita e estado `unknown` |
| Perda de eventos | SQLite, transação e cursor persistente |
| Ação oferecida sem suporte | Resolvedor único no backend e snapshot por sessão |
| Duplicação com Scrum | Domínios e persistências separados |
| Regressão do Chat | Compatibilidade com Markdown e testes por motor |
| Sobrescrita entre motores com o mesmo ID nativo | Chave composta por provedor, preservação das duas origens e teste de sync repetido |
| Aprovação exposta indevidamente | PIN, escopo, expiração e auditoria |
| UI monolítica | módulos por lista, Kanban, detalhe, filtros e comandos |

## Critério para iniciar implementação

- ADRs aceitos ou ajustados;
- contratos de domínio revisados;
- fixtures sanitizadas dos quatro motores disponíveis;
- história da fase detalhada com arquivos sob responsabilidade;
- testes de caracterização dos fluxos legados passando;
- baseline de sync repetido preservando Claude e Gemini sem alternância de arquivos;
- nenhuma dependência crítica marcada como presumida.
