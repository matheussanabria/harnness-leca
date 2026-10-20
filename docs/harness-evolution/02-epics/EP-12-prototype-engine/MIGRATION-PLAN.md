# Plano de Migracao e Piloto — EP-12

[Voltar ao EP-12](README.md)

Este documento estabelece o roteiro de migracao seguro dos artefatos legados de Design System e Prototipos para a nova arquitetura do Prototype Engine.

---

## 1. Estrategia de Risco Zero

1. **Leitura Exclusiva dos Legados:**
   Os arquivos em `projects/saude-dispensacao/design/dis-design-system.html` e `dis-fluxo-paciente/Main.dc.html` serao tratados como somente leitura.
2. **Ambiente Isolado de Destino:**
   Novos artefatos estruturados serao emitidos em:
   - `projects/saude-dispensacao/design/ds/` (Componentes, tokens e kits modularizados)
   - `projects/saude-dispensacao/design/prototypes/dis-modular/` (Prototipo estruturado em `proto.json` e `screens/`)
3. **Paridade Garantida:**
   Nenhum componente ou tela e promovido a `validated` sem comparativo visual e funcional contra o baseline original.

---

## 2. Piloto do Componente `AnnotationList`

Antes de processar telas inteiras, o fluxo completo do motor sera validado com um unico componente piloto: **AnnotationList** (`dis.annotation-list`).

### Etapas do Piloto:
1. **Extracao:** Identificar o bloco HTML/CSS/JS correspondente no monólito `dis-design-system.html`.
2. **Registro:** Criar a entrada no Registry com props (`annotations`, `onAdd`, `onRemove`), slots e tokens.
3. **Boilerplate Vanilla:** Gerar os arquivos isolados:
   - `ds/components/annotation-list/annotation-list.html`
   - `ds/components/annotation-list/annotation-list.css`
   - `ds/components/annotation-list/annotation-list.js`
4. **Renderizacao no Harness:** Carregar no iframe de preview do Atelie via protocolo seguro.
5. **Reconhecimento no Inspetor:** Clicar no elemento no preview e verificar se o inspetor exibe seu ID canonico `dis.annotation-list` e propriedades editaveis.
6. **Geracao Multiframework:**
   - Gerar versao Angular Standalone (`annotation-list.component.ts`).
   - Gerar versao React Functional Component (`AnnotationList.tsx`).
7. **Homologacao:** Confirmar paridade de comportamento nos 3 alvos.
