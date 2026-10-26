import test from "node:test";
import assert from "node:assert/strict";
import { createWindowContainer, OfficeWindowHost } from "../ui/public/js/window-manager/window-host.js";

// Mock mínimo de DOM para Node.js
function mockDomElement(tagName = "div") {
  const listeners = {};
  const children = [];
  const classList = new Set();
  const attributes = {};
  const styles = {};

  return {
    tagName,
    className: "",
    id: "",
    innerHTML: "",
    style: {
      setProperty: (k, v) => { styles[k] = v; },
      getPropertyValue: (k) => styles[k],
      zIndex: ""
    },
    classList: {
      add: (c) => classList.add(c),
      remove: (c) => classList.delete(c),
      toggle: (c, val) => {
        if (val === undefined) {
          if (classList.has(c)) classList.delete(c);
          else classList.add(c);
        } else if (val) classList.add(c);
        else classList.delete(c);
      },
      contains: (c) => classList.has(c)
    },
    setAttribute: (k, v) => { attributes[k] = v; },
    getAttribute: (k) => attributes[k],
    appendChild: (child) => { children.push(child); return child; },
    remove: function() {
      // noop in mock
    },
    querySelector: function(sel) {
      if (sel.startsWith("#") || sel.startsWith(".") || sel.startsWith("[")) {
        return mockDomElement("div");
      }
      return null;
    },
    addEventListener: (event, handler) => {
      listeners[event] = listeners[event] || [];
      listeners[event].push(handler);
    }
  };
}

test("createWindowContainer monta container com ícone FontAwesome e data-attributes", () => {
  globalThis.document = {
    createElement: (tag) => mockDomElement(tag)
  };

  const win = {
    id: "win-test-1",
    moduleId: "gemini",
    title: "Estação Gemini",
    icon: "fa-solid fa-brain"
  };

  const el = createWindowContainer(win);
  assert.equal(el.getAttribute("data-window-id"), "win-test-1");
  assert.equal(el.getAttribute("data-module-id"), "gemini");
  assert.ok(el.innerHTML.includes("fa-solid fa-brain"));
  assert.ok(!el.innerHTML.includes("undefined"));
});

test("OfficeWindowHost cria e remove contêineres quando janelas abrem e fecham", () => {
  const root = mockDomElement("main");
  let listener = null;
  const state = {
    activeWindowId: null,
    windows: []
  };

  const wm = {
    store: {
      get: (id) => state.windows.find((w) => w.id === id),
      setBounds: () => {}
    },
    subscribe: (fn) => {
      listener = fn;
      return () => { listener = null; };
    },
    getState: () => state,
    focus: () => {},
    close: (id) => {
      state.windows = state.windows.filter((w) => w.id !== id);
      if (listener) listener(state);
    }
  };

  const host = new OfficeWindowHost({ rootElement: root, wm });
  host.start();
  assert.equal(host.windows.size, 0);

  // Abre duas janelas simultâneas
  state.windows.push({
    id: "win-1",
    moduleId: "gemini",
    visibility: "visible",
    presentation: "floating"
  });
  state.windows.push({
    id: "win-2",
    moduleId: "scrum",
    visibility: "visible",
    presentation: "floating"
  });
  listener(state);

  assert.equal(host.windows.size, 2);
  assert.ok(host.windows.has("win-1"));
  assert.ok(host.windows.has("win-2"));

  // Minimiza uma janela
  state.windows[0].visibility = "minimized";
  listener(state);

  assert.equal(host.windows.size, 1);
  assert.ok(!host.windows.has("win-1"));
  assert.ok(host.windows.has("win-2"));

  host.destroy();
  assert.equal(host.windows.size, 0);
});
