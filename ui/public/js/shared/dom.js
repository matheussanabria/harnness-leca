// @ts-check

/**
 * Utilitários de DOM, escape, formatação e diálogos compartilhados no frontend.
 */

export const $ = (id) => document.getElementById(id);

export const esc = (s) =>
  String(s || "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[c]));

export const clean = (t) =>
  String(t || "")
    .replace(/<!\x2d\x2d[\s\S]*?-\x2d>/g, "")
    .replace(/^# .*\n?/, "")
    .trim();

export const fmt = (ms) =>
  new Date(ms).toLocaleDateString("pt-BR", { day: "numeric", month: "short" }).replace(".", "");

export function autoGrow(el) {
  if (!el) return;
  el.style.height = "auto";
  el.style.height = Math.min(el.scrollHeight, 180) + "px";
}

export function copyToClipboard(text, toastMsg = "Copiado para a área de transferência!") {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(() => {
      showToast(toastMsg);
    }).catch(() => {
      promptFallback(text);
    });
  } else {
    promptFallback(text);
  }
}

function promptFallback(text) {
  window.prompt("Copie o texto abaixo (Ctrl+C):", text);
}

export function showToast(msg, duration = 3000) {
  const toast = $("syncToast");
  if (!toast) return;
  toast.textContent = msg;
  toast.style.display = "inline-block";
  toast.style.opacity = "1";
  clearTimeout(toast._timeout);
  toast._timeout = setTimeout(() => {
    toast.style.opacity = "0";
    setTimeout(() => {
      if (toast.style.opacity === "0") toast.style.display = "none";
    }, 300);
  }, duration);
}

export const section = (title, tag, body, more) =>
  `<div class="sec"><h4>${title}${tag ? `<span class="tag">${tag}</span>` : ""}</h4>${body}${more ? `<div class="more" onclick="${more}()">Ver tudo</div>` : ""}</div>`;

export function openDlg(title, text, html) {
  const dbody = $("dbody");
  const dt = $("dt");
  const dlg = $("dlg");
  if (!dbody || !dlg) return;

  dbody.onclick = null;
  dbody.oninput = null; // ouvintes do diálogo de revisão não vazam para os outros
  if (dt) dt.textContent = title;
  
  // Importação dinâmica de md caso necessária
  const mdRender = window.md ? window.md : (t) => `<p>${esc(t)}</p>`;
  dbody.innerHTML = html || (text && text.trim() ? mdRender(text) : '<p class="empty">Vazio</p>');
  dlg.classList.toggle("wide", !!html);
  
  if (typeof dlg.showModal === "function") {
    dlg.showModal();
  }

  // Mensagens longas: limita a altura e oferece "Ver mais / Ver menos".
  document.querySelectorAll("#dbody .clip").forEach((c) => {
    if (c.scrollHeight <= c.clientHeight + 4) return;
    c.classList.add("fade");
    const b = document.createElement("button");
    b.className = "toggle";
    b.textContent = "Ver mais";
    b.onclick = () => {
      const o = c.classList.toggle("open");
      b.textContent = o ? "Ver menos" : "Ver mais";
    };
    c.after(b);
  });
}
