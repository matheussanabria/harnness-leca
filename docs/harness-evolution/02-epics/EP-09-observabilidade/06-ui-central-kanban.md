# Proposta de UI para a Central de Conversas e Kanban

## Princípio de produto

A Central é uma apresentação do registro canônico. Ela não mantém uma cópia própria das sessões e não chama diretamente APIs específicas de motor.

## Estrutura

```text
Central de Sessões
├── Cabeçalho: projeto, busca global, atualização e resumo de atenção
├── Filtros: motor, execução, workflow, atenção, capacidade e período
├── Alternância de visão: Lista | Kanban
├── Conteúdo principal
│   ├── Lista/tabela paginada
│   └── Raias do workflow
└── Painel de detalhe: histórico, capacidades, execuções, eventos e ações
```

Todos os ícones previstos devem usar FontAwesome. Status também precisam de texto, forma ou padrão visual; cor isolada não é suficiente.

## Visão em lista

Colunas mínimas:

| Coluna | Conteúdo |
|---|---|
| Sessão | título, ID curto e confiança do vínculo |
| Projeto | projeto ou “não associado” |
| Motor | provedor e modo de origem |
| Workflow | estado atual e última transição |
| Execução | status da execução mais recente |
| Atenção | quantidade e maior severidade |
| Atualização | última observação e indicador de dado inferido |
| Ações | abrir, retomar/continuar, reconhecer, inspecionar |

Busca cobre título, IDs, projeto e artefato associado. Conteúdo integral das mensagens fica fora do índice inicial para reduzir exposição e custo.

## Visão Kanban

Raias padrão:

1. Não classificado
2. Planejamento
3. Aguardando aprovação
4. Aprovado
5. Implementação
6. Testes
7. Bloqueado
8. Concluído

Cancelados ficam em filtro/arquivo, não em raia operacional padrão. O usuário pode ocultar raias vazias, mas a ordem canônica não depende do Scrum.

### Cartão de sessão

- título e motor;
- projeto e associação inferida quando aplicável;
- status de execução separado;
- badge de atenção;
- última observação;
- ação primária coerente com a capacidade;
- indicação textual de “observado”, “inferido” ou “sem telemetria”.

Arrastar entre raias solicita transição de workflow e passa por validação no backend. Não altera status do motor e não encerra execução.

## Painel de detalhe

Abas propostas:

- **Resumo:** identidades, projeto, estados e capacidades;
- **Conversa:** artefato Markdown e atalho para o Chat;
- **Execuções:** tentativas, erros e cancelamento quando permitido;
- **Timeline:** eventos filtrados com origem e confiança;
- **Atenção:** bloqueios, aprovações e histórico de resolução.

## Ações e vocabulário

| Ação | Quando usar |
|---|---|
| Abrir conversa | Existe artefato legível |
| Retomar sessão | `resume=native` e ID válido |
| Continuar com contexto | `resume=context_replay` |
| Nova conversa relacionada | Retomada indisponível, mantendo vínculo explícito |
| Cancelar execução | Execução pertence ao Harness e capacidade atual permite |
| Responder aprovação | Item pendente e operador autorizado |

Nunca rotular “Continuar” como retomada nativa quando somente o histórico será reenviado.

## Estados de tela

- carregando com estrutura estável;
- vazio por ausência de sessões;
- vazio por filtros;
- fonte indisponível com dados persistidos ainda navegáveis;
- dados parciais com confiança explícita;
- SSE desconectado com horário da última atualização;
- erro de operação sem apagar a seleção atual.

## Acessibilidade e responsividade

- navegação completa por teclado em lista, filtros, cartões e painel;
- alternativa aos gestos de drag and drop;
- foco devolvido ao elemento acionador ao fechar o detalhe;
- `aria-live` moderado para aprovações e falhas novas;
- tabela no desktop e cartões equivalentes em viewport estreito;
- Kanban com rolagem horizontal controlável e visão de lista sempre disponível;
- respeito a redução de movimento no Escritório e transições.

## Reuso visual

Filtros, paginação e tabela partem dos módulos de conversas. Cartões e raias podem reutilizar a apresentação do Scrum, mas devem receber dados e comandos próprios do domínio de sessão.
