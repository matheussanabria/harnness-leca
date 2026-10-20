---
id: EP-XX.YY
titulo: ""
epico: EP-XX
prioridade: P0
status: planejada   # planejada | pronta | em-andamento | em-revisao | concluida | bloqueada
dependencias: []
har: []             # IDs equivalentes do backlog da Fase 0, se houver
tags: [harness-evolution, historia]
---

# EP-XX.YY: Título

## 1. Identificação
- **Épico:** [EP-XX](../README.md)
- **Prioridade:** P0
- **Dependências:** nenhuma
- **Bloqueia:** nenhuma

## 2. Contexto
Estado atual e problema observado. Cite arquivos e linhas quando houver evidência no código.

## 3. Objetivo
Comportamento esperado, do ponto de vista do usuário.

## 4. Requisitos
**Funcionais**
- RF1

**Não funcionais**
- Arquivos de até 300 linhas, sem misturar renderização, DOM, rede e regra de negócio.
- Ícones apenas FontAwesome. Nenhum emoji.
- Nenhuma regressão no modo 2.5D nem no painel tradicional.

## 5. Arquitetura
Componentes, contratos, dados e pontos de integração. Registrar em `03-decisions/` qualquer decisão que valha para mais de uma história.

## 6. Implementação
Passos incrementais. Cada passo deve deixar a aplicação funcionando.
1. ...

## 7. Testes
| Tipo | Cenário | Comando ou arquivo |
|---|---|---|
| Unitário | | `node --test tests/...` |
| Integração | | |
| E2E / navegador | | |
| Visual | | |

## 8. Critérios de aceite
- [ ] Condição objetiva e verificável.

## 9. Riscos
- **Compatibilidade:**
- **Segurança:**
- **Rollback:**

## 10. Evidências
Preencher ao concluir.
- Arquivos alterados:
- Comandos executados e resultado:
- Capturas:
