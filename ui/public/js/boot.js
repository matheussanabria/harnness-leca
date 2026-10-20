// @ts-check
// Carrega os blocos HTML (partials) no lugar dos marcadores [data-partial] e só então inicia o app,
// que espera encontrar todos os diálogos e painéis já no DOM.
const holders = /** @type {HTMLElement[]} */ ([...document.querySelectorAll("[data-partial]")]);

await Promise.all(
  holders.map(async (holder) => {
    const url = holder.dataset.partial || "";
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error("HTTP " + res.status);
      holder.replaceWith(document.createRange().createContextualFragment(await res.text()));
    } catch (err) {
      console.error("Falha ao carregar o bloco " + url, err);
      holder.textContent = "Falha ao carregar " + url;
    }
  })
);

await import("/js/app.js");
