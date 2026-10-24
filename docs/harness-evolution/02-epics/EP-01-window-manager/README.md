---
id: EP-01
titulo: Window Manager híbrido
prioridade: P0
status: concluído
depende: [EP-00]
tags: [harness-evolution, epico]
---

# EP-01: Window Manager híbrido

[Voltar ao índice](../../00-index.md)

## Objetivo
Transformar os painéis contextuais existentes em janelas gerenciáveis.

## Execução
Registro de janelas, adaptador de interações, gerenciador de foco, barra de tarefas, minimização, restauração, arrastar, redimensionar, docking e persistência. Captura de teclado e cursor integrada aos controles de câmera.

## Entrega
Infraestrutura compartilhada usada primeiro pela Estação Gemini e depois por DAI HQ e Datacenter.

## Aceite do épico
Abrir três painéis, alternar foco, minimizar, restaurar, redimensionar e recarregar o workspace sem perder o estado visual nem os dados dos módulos.

## Entrega incremental

| Sprint técnica | Histórias | Resultado |
|---|---|---|
| WM-1 | 01.01 a 01.03 | Registro, adaptação de painéis, foco e câmera |
| WM-2 | 01.04 a 01.06 | Minimização, barra de tarefas e janelas móveis |
| WM-3 | 01.07 a 01.08 | Docking e persistência |
| WM-4 | 01.09 a 01.10 | Responsividade e workspaces nomeados |

Agrupamentos técnicos, não estimativas de duração.

## Histórias
| ID | Título | Depende de | Status |
|---|---|---|---|
| [01.01](01.01-registro-modulos.md) | Registro de módulos e janelas | 00.01, 00.02 | **concluída** |
| [01.02](01.02-adaptador-estacoes.md) | Adaptador das estações existentes | 01.01 | **concluída** |
| [01.03](01.03-foco-camadas-camera.md) | Foco, camadas e integração com câmera | 01.02 | **concluída** |
| [01.04](01.04-minimizar-restaurar.md) | Minimizar, restaurar e fechar | 01.02 | **concluída** |
| [01.05](01.05-barra-tarefas.md) | Barra de tarefas | 01.04 | **concluída** |
| [01.06](01.06-mover-redimensionar.md) | Mover, redimensionar e maximizar | 01.03 | **concluída** |
| [01.07](01.07-docking-abas.md) | Docking, abas e divisão de tela | 01.06 | **concluída** |
| [01.08](01.08-persistencia.md) | Persistência e restauração | 01.06 | **concluída** |
| [01.09](01.09-layouts-responsivos.md) | Layouts responsivos | 01.07 | **concluída** |
| [01.10](01.10-workspaces-nomeados.md) | Workspaces nomeados | 01.08 | **concluída** |
| [01.11](01.11-fiacao-window-manager-escritorio.md) | Wire the Window Manager facade into the office UI | 01.05, 01.08, 01.10 | **planejada** |
| [01.12](01.12-host-multi-janela-docking.md) | Multi-window host and docking in the office | 01.11 | **planejada** |

## Contratos iniciais
Contrato conceitual. Antes de implementar, o EP-00 precisa confirmar se já existe gerenciamento de painéis e como os módulos são representados. O projeto usa ES Modules sem build; o contrato vira JSDoc ou um `.d.ts` em `ui/public/js/types/`.

```ts
type WindowPresentation = 'sidebar' | 'floating' | 'docked' | 'maximized'
type WindowVisibility = 'visible' | 'minimized'

interface WindowInstance {
  id: string
  moduleId: string
  projectId?: string
  resourceId?: string
  presentation: WindowPresentation
  visibility: WindowVisibility
  bounds?: { x: number; y: number; width: number; height: number }
}

interface WindowManagerActions {
  open: (moduleId: string, resourceId?: string) => void
  focus: (windowId: string) => void
  minimize: (windowId: string) => void
  restore: (windowId: string) => void
  close: (windowId: string) => void
  maximize: (windowId: string) => void
}
```

Pontos em aberto para a 01.01: ordem de empilhamento (`zIndex` explícito ou ordem do array), janela única ou múltipla por módulo, e se `projectId` vem do estado global ou é obrigatório no `open`.

## Piloto
[Estação Gemini](piloto-estacao-gemini.md). Depois do piloto, DAI HQ e Datacenter migram usando a mesma infraestrutura.
