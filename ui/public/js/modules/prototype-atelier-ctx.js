// @ts-check
// Estado compartilhado do Ateliê de protótipos. Fica num objeto único para que os módulos do Ateliê
// (principal, seleção múltipla, mensagens do iframe) leiam e gravem o mesmo estado sem ciclos de importação.

export const ctx = {
  slug: "",
  protoId: "",
  screen: "home",
  data: /** @type {any} */ (null),
  versions: /** @type {any[]} */ ([]),
  /** Componentes do DS usados pelas telas deste protótipo (GET .../prototypes/:id/components). */
  components: /** @type {{ components: any[] }} */ ({ components: [] }),
  node: /** @type {any} */ (null),
  viewportWidth: 1280,
  list: /** @type {any[]} */ ([]),
  options: /** @type {any} */ ({ components: [], mcpServer: "", onSelect: null, onDelete: null }),
  pendingPid: "",
  tree: /** @type {any[]} */ ([]),
  /** Seleção múltipla: `pids` (vazio = seleção simples) e `anchor` (início do intervalo do Shift). */
  multi: { pids: /** @type {string[]} */ ([]), anchor: "" },
};

/** Ações que dependem do iframe e da tela; o módulo principal as registra ao carregar. */
export const host = {
  post: /** @type {(message: object) => void} */ (() => {}),
  reload: /** @type {() => void} */ (() => {}),
  details: /** @type {() => void} */ (() => {}),
  move: /** @type {(pid: string, targetPid: string, position: string) => any} */ (() => {}),
  tree: /** @type {(tree: any[]) => void} */ (() => {}),
};
