// @ts-check
// DAI HQ — Gerenciador Central de Atalhos de Teclado do Escritório Virtual

export function setupOfficeShortcuts({ switchMode, toggleCursor, onInteract, onStandUp, isSeated }) {
  window.addEventListener("keydown", (e) => {
    const activeTag = document.activeElement ? document.activeElement.tagName.toLowerCase() : "";
    if (activeTag === "input" || activeTag === "textarea" || document.activeElement?.getAttribute("contenteditable") === "true") {
      return;
    }

    const k = e.key.toLowerCase();
    const code = e.code;

    // 1. Alternância de Cursor do Mouse (Alt, Tab ou M)
    if (k === "m" || k === "tab" || code === "AltLeft" || code === "AltRight") {
      e.preventDefault();
      toggleCursor();
      return;
    }

    // 2. Atalhos de Cômodos e Modos (Teclas 1 a 6 e Mnemônicos)
    if (k === "1") {
      e.preventDefault();
      switchMode("third_person");
    } else if (k === "2") {
      e.preventDefault();
      switchMode("first_person");
    } else if (k === "3") {
      e.preventDefault();
      switchMode("workstation");
    } else if (k === "4" || k === "g") {
      // 4 ou G -> Sala de Guerra (War Room)
      e.preventDefault();
      switchMode("war_room");
    } else if (k === "5" || k === "o") {
      // 5 ou O -> Diorama 360 Orbital
      e.preventDefault();
      switchMode("orbit");
    } else if (k === "6" || k === "z") {
      // 6 ou Z -> Modo Retrô 2.5D Habbo
      e.preventDefault();
      switchMode("2d");
    } else if (k === "c") {
      // Alternância rápida 1ª <-> 3ª Pessoa
      e.preventDefault();
      const currentMode = document.getElementById("btnMode1stPerson")?.classList.contains("active") ? "first_person" : "third_person";
      switchMode(currentMode === "third_person" ? "first_person" : "third_person");
    } else if (k === "e") {
      // Interação ou Levantar
      if (isSeated()) {
        onStandUp();
      } else {
        onInteract();
      }
    } else if (k === "h") {
      e.preventDefault();
      window.dispatchEvent(new CustomEvent("dai:toggleHud"));
    } else if (code === "Escape") {
      if (document.pointerLockElement) {
        document.exitPointerLock();
      }
      if (isSeated()) {
        onStandUp();
      }
    }
  });
}
