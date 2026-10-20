// @ts-check
import { createEngine } from "./prototype-canvas/canvas-engine.js";
import { bindInteractions } from "./prototype-canvas/canvas-interactions.js";
import { mountToolbar } from "./prototype-canvas/canvas-toolbar.js";
import { createPlay } from "./prototype-canvas/canvas-play.js";
import { frameForScreen } from "./prototype-canvas/canvas-model.js";
import { itemIframe } from "./prototype-canvas/canvas-items-view.js";

/**
 * Fachada do modo canvas do Ateliê. O controlador do Ateliê conversa só com esta API:
 * montar/desmontar, rotear mensagens da ponte (postMessage) e falar com o quadro selecionado.
 */
export function createCanvasMode(options) {
  const { host, slug, protoId, screens, viewportWidth, onFrameSelect, notify } = options;
  let inspectorOn = options.inspector !== false;
  const renderUrl = (screen) => `/api/project/${encodeURIComponent(slug)}/design/prototypes/${encodeURIComponent(protoId)}/render/${encodeURIComponent(screen)}`;
  const engine = createEngine({ host, slug, protoId, screens, viewportWidth, renderUrl, onSelectFrame: (frame) => onFrameSelect?.(frame.screen, frame) });
  const interactions = bindInteractions(engine, { onInteract: (frame) => { postModeTo(frame, "inspect"); onFrameSelect?.(frame.screen, frame); } });
  const toolbar = mountToolbar(engine, { play: () => play.start(selectedFrameId()), "to-code": () => selectionToCode() });
  const play = createPlay(engine, interactions, toolbar, {
    onFocus: (frame) => onFrameSelect?.(frame.screen, frame),
    onStart: () => broadcastMode("play"),
    onStop: () => broadcastMode(restMode()),
  });
  let lastSelection = null;
  engine.root.classList.toggle("is-live", !inspectorOn);
  engine.renderAll();
  requestAnimationFrame(() => engine.fit(false));
  engine.root.addEventListener("cv-select", (e) => {
    if (!play.active) toolbar.setToCodeEnabled(!!lastSelection?.html);
  });

  /** Modo da ponte em cada quadro: "play" executa a tela de verdade, "inspect" só seleciona. */
  function postModeTo(frame, mode) {
    itemIframe(engine.els.get(frame.id))?.contentWindow?.postMessage({ type: "HARNESS_PROTO_MODE", mode }, "*");
  }
  /** Modo dos quadros fora do Iniciar: inspetor ligado seleciona, desligado executa. */
  const restMode = () => (inspectorOn ? "inspect" : "play");
  function broadcastMode(mode) {
    engine.doc.items.filter((i) => i.kind === "frame").forEach((frame) => postModeTo(frame, mode));
  }

  const selectedFrameId = () => (engine.selected?.kind === "frame" ? engine.selected.id : null);

  function selectionToCode() {
    if (!lastSelection?.html) return;
    const frame = engine.selected;
    const x = frame ? frame.x + frame.w + 80 : 0;
    const y = frame ? frame.y : 0;
    const name = lastSelection.pid || lastSelection.tag || "componente";
    engine.add("code", { name, lang: "html", code: lastSelection.html, tab: "code", x, y });
    notify?.("Elemento copiado para um bloco de código.");
  }

  /** Retorna true quando a mensagem já foi tratada e o Ateliê não deve processá-la. */
  function handleMessage(event) {
    const data = event.data;
    const frame = engine.frameOfWindow(event.source);
    if (!frame || !data || typeof data !== "object") return false;
    if (data.type === "HARNESS_PROTO_GOTO" && data.screen) {
      if (play.active) return play.goto(data.screen) || true;
      const target = frameForScreen(engine.doc, data.screen);
      if (target) { engine.select(target.id); engine.fit(true, [target]); }
      return true;
    }
    if (data.type === "HARNESS_PROTO_KEY") {
      if (data.key === "Escape" && play.active) play.stop();
      return true;
    }
    if (play.active) return true;
    if (data.type === "HARNESS_PROTO_SELECT") {
      lastSelection = data;
      toolbar.setToCodeEnabled(!!data.html);
      if (engine.selectedId !== frame.id) engine.select(frame.id);
      return false;
    }
    if (data.type === "HARNESS_PROTO_READY") postModeTo(frame, play.active ? "play" : restMode());
    if (data.type === "HARNESS_PROTO_READY" || data.type === "HARNESS_PROTO_TREE") return engine.selectedId !== frame.id;
    return false;
  }

  function postToSelected(message) {
    const frame = engine.selected?.kind === "frame" ? engine.selected : null;
    itemIframe(engine.els.get(frame?.id))?.contentWindow?.postMessage(message, "*");
  }

  function reloadSelected() {
    const frame = engine.selected?.kind === "frame" ? engine.selected : null;
    const iframe = itemIframe(engine.els.get(frame?.id));
    if (!iframe) return false;
    iframe.src = renderUrl(frame.screen);
    return true;
  }

  return {
    engine, handleMessage, postToSelected, reloadSelected,
    get playing() { return play.active; },
    setInspector(on) {
      inspectorOn = on;
      engine.root.classList.toggle("is-live", !on);
      if (!play.active) broadcastMode(restMode());
    },
    startPlay: (screen) => play.start(frameForScreen(engine.doc, screen)?.id),
    destroy() {
      play.stop();
      interactions.dispose();
      engine.saver.flush();
      host.innerHTML = "";
    },
  };
}
