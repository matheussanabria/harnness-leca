# Contrato Padrão da História

Toda história deve ser um documento autossuficiente para que um agente receba apenas a história que vai implementar sem necessitar ler todo o repositório.

## Template

```markdown
---
id: EP-XX.YY
titulo: "Título claro e objetivo"
epico: EP-XX
prioridade: P0 # P0 | P1 | P2
status: planejada # planejada | pronta | em-andamento | em-revisao | concluida | bloqueada
dependencias: []
owns: [] # globs de arquivos que a historia pode tocar; duas historias com escopos sobrepostos nao rodam em paralelo
har: [] # IDs equivalentes do backlog de origem, se houver
tags: [harness-evolution, historia]
---

# EP-XX.YY: Título

## 1. Identificação
- **Épico:** [EP-XX](../README.md)
- **Prioridade:** P0
- **Dependências:** nenhuma
- **Bloqueia:** nenhuma

## 2. Contexto
Estado atual e problema observado. Cite arquivos e linhas com evidência no código.

## 3. Objetivo
Comportamento esperado do ponto de vista do usuário final ou sistema.

## 4. Requisitos
**Funcionais**
- RF1: ...

**Não funcionais**
- Limite estrito de 250 a 300 linhas por arquivo.
- Separação de responsabilidades (SRP: DOM/UI, rede/HTTP, regras de negócio isoladas).
- Ícones exclusivamente FontAwesome. Nenhum emoji.
- Sem regressão em fluxos e módulos existentes.

## 5. Arquitetura
Componentes, contratos, dados e pontos de integração. Se envolver decisão transversal, referencie o ADR em `03-decisions/`.

## 6. Implementação
Passos atômicos e incrementais. Cada passo deixa a suíte de testes verde.
1. ...

## 7. Testes
| Tipo | Cenário | Comando ou arquivo |
|---|---|---|
| Unitário | ... | `node --test tests/...` |
| Integração | ... | `node --test tests/...` |

## 8. Critérios de aceite
- [ ] Condição objetiva e verificável 1.
- [ ] Condição objetiva e verificável 2.

## 9. Riscos
- **Compatibilidade:** ...
- **Segurança:** ...
- **Rollback:** ...

## 10. Evidências
Preencher obrigatoriamente ao concluir.
- Arquivos alterados:
- Comandos executados e resultado:
- Testes aprovados:
```
