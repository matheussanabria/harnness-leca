/**
 * Tipagens Estritas do Escritório Virtual DAI HQ (Harness Leca)
 * Padrão inspirado nas diretrizes do dispensacao-web / TypeScript Strict
 * Zero dependências externas — interpretado nativamente pela IDE e TypeScript Language Server.
 */

export interface Position3D {
  x: number;
  y: number;
  z: number;
}

export interface AgentSkill {
  id: string;
  name: string;
  category?: string;
  level?: 'basic' | 'intermediate' | 'expert';
}

export interface AgentTask {
  id: string;
  title: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  assignedTo?: string;
  progress?: number;
}

export interface Agent {
  id: string;
  name: string;
  engine: 'claude' | 'gemini' | 'opencode';
  role: string;
  status: 'idle' | 'working' | 'thinking' | 'offline';
  color?: string;
  avatarMesh?: any;
  currentTask?: AgentTask | null;
  skills?: AgentSkill[];
  position?: Position3D;
  seatId?: string;
}

export interface InteractionItem {
  id: string;
  name: string;
  type: 'desk' | 'seat' | 'screen' | 'war_room' | 'agent' | 'door';
  position: Position3D;
  action: (item: InteractionItem) => void;
  mesh?: any;
  tooltipText?: string;
}

export interface OrchestrationState {
  project: string;
  activeEngine: string;
  agents: Agent[];
  tasks: AgentTask[];
  workflows: Array<{
    id: string;
    name: string;
    currentStage: string;
    status: string;
  }>;
  journal: Array<{
    timestamp: string;
    level: 'info' | 'warn' | 'error';
    message: string;
    source: string;
  }>;
}

export interface SceneContext {
  scene: any; // THREE.Scene
  camera: any; // THREE.PerspectiveCamera
  renderer: any; // THREE.WebGLRenderer
  cssRenderer?: any; // CSS3DRenderer
  orbitControls?: any;
  cameraController?: any;
  interactionManager?: any;
  seatManager?: any;
}
