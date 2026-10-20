// @ts-check
// Script de ponte (bridge) para o DevTools do app inspecionado e busca de componente por nome.
import { $, showToast, copyToClipboard } from "../shared/dom.js";
import { ist } from "./inspector-store.js";
import { normalizeComponentName } from "./inspector-dom.js";
import { getEffectiveProjectSlug } from "./inspector-mode.js";
import { renderInspectorCard } from "./inspector-card.js";

/**
 * Copia o script para o usuário colar no DevTools do app com travas de segurança e desativação fácil
 */
export function copyClickBridgeScript() {
  const script = `(() => {
  if (window === window.top) {
    alert("⚠️ ATENÇÃO:\\nVocê colou o script no contexto 'top' (página principal do Harness).\\n\\nPara inspecionar o app:\\n1. No topo do Console (DevTools), clique no seletor que está 'top'\\n2. Selecione 'studioIframe'\\n3. Cole o script novamente e pressione Enter.");
    return;
  }
  if (window.__harnessActive) {
    window.__harnessActive = false;
    document.getElementById('__harness_hover_box__')?.remove();
    document.getElementById('__harness_inspector_badge__')?.remove();
    console.log('%c🔍 Harness Inspector: DESATIVADO.', 'color:#ef4444;font-weight:bold;');
    return;
  }
  window.__harnessActive = true;
  console.log('%c🔍 Harness Inspector: ATIVO NO FRAME! Passe o mouse e clique nos elementos do app. Pressione ESC para desativar.', 'color:#10b981;font-weight:bold;font-size:12px;');

  window.addEventListener('message', (ev) => {
    if (ev.data && ev.data.type === 'HARNESS_DEACTIVATE_INSPECTOR') {
      window.__harnessActive = false;
      document.getElementById('__harness_hover_box__')?.remove();
      document.getElementById('__harness_inspector_badge__')?.remove();
      console.log('🔍 Inspetor desativado pelo Harness.');
    }
  });

  let box = document.getElementById('__harness_hover_box__');
  if (!box) {
    box = document.createElement('div');
    box.id = '__harness_hover_box__';
    box.style.cssText = 'position:fixed;pointer-events:none;z-index:2147483647;border:2px solid #3b82f6;background:rgba(59,130,246,0.18);border-radius:4px;display:none;transition:all 0.05s ease;';
    document.body.appendChild(box);
  }

  let badge = document.getElementById('__harness_inspector_badge__');
  if (!badge) {
    badge = document.createElement('div');
    badge.id = '__harness_inspector_badge__';
    badge.style.cssText = 'position:fixed;top:10px;right:10px;z-index:2147483647;background:#ef4444;color:#fff;font-family:sans-serif;font-size:11px;font-weight:bold;padding:4px 10px;border-radius:20px;cursor:pointer;box-shadow:0 2px 8px rgba(0,0,0,0.4);border:2px solid #fff;';
    badge.textContent = '✕ Desativar Inspetor (ESC)';
    badge.onclick = () => {
      window.__harnessActive = false;
      box?.remove();
      badge.remove();
      console.log('🔍 Inspetor desativado via badge.');
      window.parent.postMessage({ type: 'HARNESS_INSPECTOR_CLOSED' }, '*');
    };
    document.body.appendChild(badge);
  }

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && window.__harnessActive) {
      window.__harnessActive = false;
      box?.remove();
      badge?.remove();
      console.log('🔍 Inspetor desativado via ESC.');
      window.parent.postMessage({ type: 'HARNESS_INSPECTOR_CLOSED' }, '*');
    }
  });

  document.addEventListener('mousemove', (e) => {
    if (!window.__harnessActive || !e.target || e.target === document.body) {
      if(box) box.style.display='none';
      return;
    }
    const r = e.target.getBoundingClientRect();
    box.style.top = r.top + 'px';
    box.style.left = r.left + 'px';
    box.style.width = r.width + 'px';
    box.style.height = r.height + 'px';
    box.style.display = 'block';
  }, { capture: true, passive: true });

  document.addEventListener('click', (e) => {
    if (!window.__harnessActive) return;
    e.preventDefault();
    e.stopPropagation();
    if(box) box.style.display='none';

    const target = e.target;
    let directText = '';
    if (target.childNodes) {
      for (let i = 0; i < target.childNodes.length; i++) {
        if (target.childNodes[i].nodeType === 3) directText += target.childNodes[i].nodeValue || '';
      }
    }
    directText = directText.replace(/\\s+/g, ' ').trim().slice(0, 200);

    const cleanAttrs = {};
    const cleanClasses = [];
    if (target.attributes) {
      for (let i = 0; i < target.attributes.length; i++) {
        const a = target.attributes[i];
        const n = a.name.toLowerCase();
        if (n.startsWith('_ngcontent') || n.startsWith('_nghost') || n.startsWith('ng-reflect') || n === 'ng-version') continue;
        if (n === 'class') {
          const clsList = a.value.trim().split(/\\s+/).filter(Boolean);
          for (let j = 0; j < clsList.length; j++) {
            if (!clsList[j].startsWith('ng-')) cleanClasses.push(clsList[j]);
          }
          if (cleanClasses.length) cleanAttrs['class'] = cleanClasses.join(' ');
        } else {
          cleanAttrs[n] = a.value;
        }
      }
    }

    let siblingIndex = 0;
    let sameTagSiblingIndex = 0;
    let prev = target.previousElementSibling;
    while (prev) {
      siblingIndex++;
      if (prev.tagName.toLowerCase() === target.tagName.toLowerCase()) sameTagSiblingIndex++;
      prev = prev.previousElementSibling;
    }

    let customTag = '';
    let owningComp = null;
    let childComp = null;

    if (window.ng) {
      try {
        owningComp = window.ng.getOwningComponent?.(target);
        childComp = window.ng.getComponent?.(target);
      } catch {}
    }

    let cur = target.parentElement;
    while (cur && cur !== document.body && cur !== document.documentElement) {
      if (window.ng && !owningComp) {
        try {
          owningComp = window.ng.getOwningComponent?.(cur);
        } catch {}
      }
      if (!customTag && cur.tagName && cur.tagName.includes('-')) {
        customTag = cur.tagName.toLowerCase();
      }
      cur = cur.parentElement;
    }

    const pathParts = [];
    let p = target;
    while (p && p.tagName && p !== document.documentElement) {
      let seg = p.tagName.toLowerCase();
      if (p.id) seg += '#' + p.id;
      else if (p.className && typeof p.className === 'string') {
        const cls = p.className.trim().split(/\\s+/).slice(0, 2).join('.');
        if (cls) seg += '.' + cls;
      }
      pathParts.unshift(seg);
      p = p.parentElement;
    }
    const domPath = pathParts.slice(-5).join(' > ');

    const compObj = owningComp || childComp;
    const rawCompName = compObj?.constructor?.name || '';
    const compName = rawCompName ? rawCompName.replace(/^[_ɵ]+/, '') : (customTag || target.tagName.toLowerCase());
    const childCompName = (childComp && childComp !== owningComp && childComp.constructor?.name)
      ? childComp.constructor.name.replace(/^[_ɵ]+/, '')
      : null;

    const snippet = target.outerHTML ? target.outerHTML.replace(/\\s+/g, ' ').slice(0, 220) : '';
    console.log('%c🔍 Enviado ao Studio:', 'color:#3b82f6;font-weight:bold;', compName, '(' + target.tagName.toLowerCase() + ')');

    window.parent.postMessage({
      type: 'HARNESS_INSPECT_COMPONENT',
      component: compName,
      childComponent: childCompName,
      selector: customTag || null,
      target: {
        tagName: target.tagName.toLowerCase(),
        text: directText,
        attributes: cleanAttrs,
        classes: cleanClasses,
        siblingIndex,
        sameTagSiblingIndex,
        domPath,
      },
      snippet,
    }, '*');
  }, { capture: true });
})();`;
  copyToClipboard(script, "Script copiado! Selecione studioIframe no Console antes de colar.");
}

/**
 * Resolve e exibe os detalhes de um componente por nome ou tag.
 * @param {string} identifier
 * @param {object} [extra]
 */
export async function inspectComponentByName(identifier, extra = {}) {
  const projectSlug = getEffectiveProjectSlug();
  if (!projectSlug) {
    showToast("Nenhum projeto ativo.");
    return;
  }

  const cleanId = normalizeComponentName(identifier);
  showToast(`Buscando ${cleanId}...`);
  try {
    const res = await fetch(`/api/project/${encodeURIComponent(projectSlug)}/inspect/resolve?component=${encodeURIComponent(cleanId)}`);
    const resolved = await res.json();

    if (!res.ok) {
      // Estado normal na UI: não gera erro vermelho no console
      const notFoundData = {
        component: cleanId,
        selector: extra.selector || extra.elementTag,
        found: false,
        standalone: false,
        files: {},
        templateType: "unknown",
        domPath: extra.domPath || cleanId,
        outerSnippet: extra.outerSnippet || `<${cleanId}>`,
        elementTag: extra.elementTag || cleanId,
        projectSlug,
        notFound: true,
        notFoundReason: resolved.error || `Componente '${cleanId}' não foi localizado no repositório.`,
        childComponent: extra.childComponent,
        target: extra.target,
      };
      ist.currentInspectedData = notFoundData;
      renderInspectorCard(notFoundData);
      return;
    }

    const data = {
      ...resolved,
      component: normalizeComponentName(resolved.className || cleanId),
      selector: resolved.selector || extra.selector,
      domPath: extra.domPath || cleanId,
      outerSnippet: extra.outerSnippet || `<${cleanId}>`,
      elementTag: extra.elementTag || extra.target?.tagName || "div",
      childComponent: extra.childComponent,
      target: extra.target,
      projectSlug,
    };

    ist.currentInspectedData = data;
    renderInspectorCard(data);
  } catch (err) {
    showToast("Erro ao conectar ao servidor para resolver componente.");
  }
}
