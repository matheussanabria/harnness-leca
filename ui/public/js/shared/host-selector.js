// @ts-check
// Host selector in the header (EP-23.06): shows the host in use and the saved hosts (local, VPS...) with their
// state, opens another host in this tab, and adds or removes hosts. Each host has its own data: opening another
// one simply loads that host's interface, which asks for its own PIN when needed. Nothing is copied between hosts.

const STATE = {
  online: { icon: "fa-solid fa-circle-check", text: "no ar" },
  offline: { icon: "fa-solid fa-circle-xmark", text: "fora do ar" },
  incompatible: { icon: "fa-solid fa-triangle-exclamation", text: "versão incompatível" },
  locked: { icon: "fa-solid fa-lock", text: "PIN incorreto ou ausente" },
};

/** @param {string} s */
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

/** One host row. @param {any} h */
export function hostRowHtml(h) {
  const st = STATE[/** @type {keyof typeof STATE} */ (h.status?.state)] || STATE.offline;
  const version = h.status?.version ? ` · ${esc(h.status.version)}` : "";
  const open = h.status?.state === "online" || h.status?.state === "locked"
    ? `<a class="host-open" href="${esc(h.url)}/" rel="noopener"><i class="fa-solid fa-arrow-up-right-from-square" aria-hidden="true"></i> Abrir</a>`
    : "";
  return `<li class="host-row" data-host="${esc(h.id)}">
    <div class="host-main"><strong>${esc(h.name)}</strong> <span class="host-url">${esc(h.url)}</span></div>
    <div class="host-state host-${esc(h.status?.state || "offline")}"><i class="${st.icon}" aria-hidden="true"></i> ${st.text}${version}${h.tokenHint ? ` · PIN ${esc(h.tokenHint)}` : ""}</div>
    <div class="host-actions">${open}<button type="button" class="host-remove" data-remove="${esc(h.id)}"><i class="fa-solid fa-trash-can" aria-hidden="true"></i> Remover</button></div>
  </li>`;
}

/** Popover body. @param {{ current: { name: string, version: string }, hosts: any[] }} data */
export function hostPanelHtml(data) {
  const rows = data.hosts.length ? data.hosts.map(hostRowHtml).join("") : '<li class="host-empty">Nenhum outro host salvo.</li>';
  return `<div class="host-current"><i class="fa-solid fa-server" aria-hidden="true"></i> Em uso: <strong>${esc(data.current.name)}</strong>${data.current.version ? ` · ${esc(data.current.version)}` : ""}</div>
    <ul class="host-list">${rows}</ul>
    <form class="host-form" data-host-form>
      <label>Nome <input name="name" required maxlength="60" placeholder="Desktop-VPS"></label>
      <label>URL <input name="url" required placeholder="https://harness.seu-dominio.com"></label>
      <label>PIN do host <input name="token" type="password" autocomplete="off" placeholder="opcional"></label>
      <button type="submit"><i class="fa-solid fa-plus" aria-hidden="true"></i> Salvar host</button>
      <p class="host-hint">Host remoto só por HTTPS ou Tailscale. O PIN fica neste servidor e serve só para ver se o host está no ar.</p>
      <p class="host-error" role="alert" hidden></p>
    </form>`;
}

/** @param {string} url @param {RequestInit} [init] */
async function call(url, init) {
  const res = await fetch(url, init);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

/** Mounts the button in the header's right slot. Safe to call twice. */
export function mountHostSelector() {
  if (typeof document === "undefined" || document.getElementById("btnHostSelector")) return;
  const slot = document.querySelector("[data-app-header] [data-slot='right']");
  if (!slot) return;
  const wrap = document.createElement("div");
  wrap.className = "host-selector";
  wrap.innerHTML = `<button type="button" id="btnHostSelector" class="btn-host-selector" aria-haspopup="dialog" aria-expanded="false" title="Host em uso e outros hosts">
      <i class="fa-solid fa-server" aria-hidden="true"></i> <span class="hdr-label">Host</span></button>
    <div class="host-panel" role="dialog" aria-label="Hosts do Harness" hidden></div>`;
  slot.prepend(wrap);
  const button = /** @type {HTMLButtonElement} */ (wrap.querySelector("button"));
  const panel = /** @type {HTMLElement} */ (wrap.querySelector(".host-panel"));

  async function refresh() {
    panel.innerHTML = '<p class="host-loading"><i class="fa-solid fa-spinner fa-spin" aria-hidden="true"></i> Conferindo os hosts...</p>';
    try {
      const data = await call("/api/hosts");
      panel.innerHTML = hostPanelHtml(data);
      button.querySelector(".hdr-label").textContent = data.current.name;
    } catch (error) {
      panel.innerHTML = `<p class="host-error" role="alert">${esc(/** @type {any} */ (error).message)}</p>`;
    }
  }
  const close = () => { panel.hidden = true; button.setAttribute("aria-expanded", "false"); };
  /** Keeps the panel under the button and inside the viewport, wherever the header wraps the button. */
  const place = () => {
    const r = button.getBoundingClientRect();
    const width = panel.offsetWidth || 380;
    panel.style.top = `${Math.round(r.bottom + 6)}px`;
    panel.style.left = `${Math.round(Math.min(Math.max(16, r.left), window.innerWidth - width - 16))}px`;
  };
  button.addEventListener("click", () => {
    const opening = panel.hidden;
    panel.hidden = !opening;
    button.setAttribute("aria-expanded", String(opening));
    if (opening) {
      place();
      void refresh().then(place);
    }
  });
  window.addEventListener("resize", () => { if (!panel.hidden) place(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !panel.hidden) { close(); button.focus(); } });
  document.addEventListener("click", (e) => { if (!panel.hidden && !wrap.contains(/** @type {Node} */ (e.target))) close(); });
  panel.addEventListener("click", async (e) => {
    const remove = /** @type {HTMLElement} */ (e.target).closest?.("[data-remove]");
    if (!remove) return;
    await call("/api/hosts/remove", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: remove.getAttribute("data-remove") }) }).catch(() => {});
    void refresh();
  });
  panel.addEventListener("submit", async (e) => {
    e.preventDefault();
    const form = /** @type {HTMLFormElement} */ (e.target);
    const fields = Object.fromEntries(new FormData(form));
    try {
      await call("/api/hosts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(fields) });
      void refresh();
    } catch (error) {
      const out = /** @type {HTMLElement} */ (form.querySelector(".host-error"));
      out.textContent = /** @type {any} */ (error).message;
      out.hidden = false;
    }
  });
}
