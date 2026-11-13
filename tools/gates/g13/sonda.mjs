// g13/sonda: functions that run INSIDE the page (they are serialized, so they must not use outer variables).
// Each returns plain data. Read-only: nothing here clicks, types or changes the page.

// Geometry and rendered label of each item (one argument: playwright passes a single value). item = { id, proto: '#css', chave?, texto? }; lado = 'proto' | 'codigo'.
export function sondaGeometria({ itens, lado }) {
  const norm = (s) => String(s || '').replace(/\*/g, '').replace(/\s+/g, ' ').trim();
  const visivel = (el) => { const b = el.getBoundingClientRect(); const cs = getComputedStyle(el); return b.width > 0 && b.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none' && !el.closest('[hidden]'); };
  const rotuloDe = (el) => {
    const cel = el.closest('.ds-info > div');
    const c = cel && cel.querySelector('.ds-info__label');
    if (c) return norm(c.textContent);
    const l = el.id ? document.querySelector('label[for="' + el.id + '"]') : null;
    if (l) return norm(l.textContent);
    const host = el.closest('[idexterno],[ng-reflect-id-externo]');
    const hl = host && host.querySelector('label');
    return hl ? norm(hl.textContent) : null;
  };
  return itens.map((it) => {
    let el = null;
    if (it.texto) el = [...document.querySelectorAll('button')].find((b) => norm(b.textContent) === norm(it.texto) && visivel(b)) || null;
    else if (lado === 'proto') el = document.querySelector(it.proto);
    else {
      el = document.getElementById(it.chave);
      if (!el) {
        const host = document.querySelector('[formcontrolname="' + it.chave + '"],[idexterno="' + it.chave + '"],[ng-reflect-id-externo="' + it.chave + '"]');
        el = host ? (host.matches('input,select,textarea,button') ? host : host.querySelector('input,select,textarea,button') || host) : null;
      }
    }
    if (!el) return { id: it.id, achou: false };
    const b = el.getBoundingClientRect();
    return { id: it.id, achou: true, visivel: visivel(el), largura: Math.round(b.width), altura: Math.round(b.height), desabilitado: !!el.disabled, rotulo: it.texto ? norm(el.textContent) : rotuloDe(el) };
  });
}

// What the item shows: registry cells, every label of the calculation block, notices and whether the preview ran.
export function sondaTela() {
  const norm = (s) => String(s || '').replace(/\*/g, '').replace(/\s+/g, ' ').trim();
  const item = document.querySelector('ds-dispensation-item');
  const cadastro = [];
  if (item) {
    for (const lab of item.querySelectorAll('.dis-item__top .ds-info__label')) {
      const valor = lab.parentElement && lab.parentElement.querySelector('.ds-info__value');
      cadastro.push({ rotulo: norm(lab.textContent), valor: valor ? norm(valor.textContent) : '' });
    }
  }
  const bloco = item && item.querySelector('[id$="-calculo"]');
  const rotulos = bloco ? [...bloco.querySelectorAll('.ds-info__label, label, legend')].map((l) => norm(l.textContent)).filter(Boolean) : [];
  const avisos = [...document.querySelectorAll('ngb-alert, .ds-alert, .alert')].map((a) => norm(a.textContent));
  const temPrevia = !!document.querySelector('#entregaAtual, input[formcontrolname="entregaAtual"]');
  return { cadastro, rotulos, avisos, temPrevia, temItem: !!item, temBloco: !!bloco };
}
