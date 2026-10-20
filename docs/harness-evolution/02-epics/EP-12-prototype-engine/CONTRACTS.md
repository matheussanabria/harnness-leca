# Contratos Tecnicos — Prototype Engine & Design System

[Voltar ao EP-12](README.md)

Este documento formaliza as interfaces TypeScript e schemas JSON utilizados por todos os modulos do Prototype Engine, servicos backend, agentes MCP e adaptadores de codigo.

---

## 1. Contratos do Design System Registry

```typescript
export type Framework = 'vanilla' | 'angular' | 'react';

export type ImplementationStatus = 'available' | 'generated' | 'validated';

export interface ComponentPropDefinition {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'object' | 'array' | 'enum';
  description?: string;
  default?: unknown;
  options?: string[]; // Para tipos enum
  required?: boolean;
}

export interface ComponentSlotDefinition {
  name: string;
  description?: string;
  allowedComponents?: string[]; // IDs de componentes permitidos
}

export interface ComponentEventDefinition {
  name: string;
  description?: string;
  payloadType?: string;
}

export interface ComponentImplementation {
  framework: Framework;
  entryFile: string;
  files: string[];
  dependencies: string[];
  styles?: string[];
  status: ImplementationStatus;
  lastValidatedAt?: string;
}

export interface DesignSystemComponent {
  id: string; // Ex: 'dis.annotation-list'
  version: string; // SemVer: '1.0.0'
  name: string; // 'Lista de Anotacoes'
  category: 'data-display' | 'inputs' | 'navigation' | 'layout' | 'feedback';
  description?: string;
  props: Record<string, ComponentPropDefinition>;
  slots: Record<string, ComponentSlotDefinition>;
  events: Record<string, ComponentEventDefinition>;
  tokensUsed: string[]; // Tokens de design referenciados
  dependencies: string[]; // IDs de outros componentes
  implementations: Record<Framework, ComponentImplementation | null>;
}
```

---

## 2. Contratos do Prototype Schema (`proto.json`)

```typescript
export interface PrototypeMetadata {
  id: string;
  schemaVersion: '2.0.0';
  title: string;
  description?: string;
  designSystemId: string; // Ex: 'procempa-dis'
  defaultScreenId: string;
  createdAt: string;
  updatedAt: string;
}

export interface PrototypeNodeBinding {
  propName: string;
  stateKey: string; // Ex: 'patient.allergies'
  transform?: string;
}

export interface PrototypeNodeEventAction {
  type: 'navigate' | 'setState' | 'emit' | 'openModal';
  target?: string;
  payload?: Record<string, unknown>;
}

export interface PrototypeNode {
  id: string; // Identificador unico do no na arvore (ex: 'node-header-1')
  componentId: string; // Referencia ao Registry (ex: 'dis.patient-header')
  componentVersion?: string;
  label?: string;
  props: Record<string, unknown>;
  bindings?: Record<string, PrototypeNodeBinding>;
  events?: Record<string, PrototypeNodeEventAction>;
  slotTargets?: Record<string, PrototypeNode[]>; // Filhos alocados em slots especificos
  children?: PrototypeNode[];
}

export interface PrototypeScreen {
  id: string; // Ex: 'tela-dispensacao'
  title: string;
  route?: string;
  htmlFile: string; // Ex: 'screens/tela-dispensacao.html'
  rootNodeId: string;
  nodes: Record<string, PrototypeNode>; // Mapa indexado para busca O(1)
  initialState?: Record<string, unknown>;
}

export interface PrototypeDefinition {
  metadata: PrototypeMetadata;
  screens: Record<string, PrototypeScreen>;
  globalState?: Record<string, unknown>;
  assets?: {
    css?: string[];
    js?: string[];
    fonts?: string[];
  };
}
```

---

## 3. Contratos de Mensagens da Sandbox (Bridge Preview <-> Host)

```typescript
export type SandboxMessageType =
  | 'INIT_PREVIEW'
  | 'PREVIEW_READY'
  | 'SELECT_NODE'
  | 'NODE_SELECTED'
  | 'HOVER_NODE'
  | 'MUTATE_PROPS'
  | 'PROPS_MUTATED'
  | 'NAVIGATE_SCREEN'
  | 'CONSOLE_ERROR';

export interface SandboxMessage<T = unknown> {
  source: 'harness-host' | 'harness-preview';
  type: SandboxMessageType;
  timestamp: number;
  payload: T;
}

export interface NodeSelectionPayload {
  nodeId: string;
  componentId: string;
  boundingRect: {
    top: number;
    left: number;
    width: number;
    height: number;
  };
}
```
