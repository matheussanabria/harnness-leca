// @ts-check
"use strict";

/**
 * In-page checks for the Atelier render review. Runs inside the browser through `page.evaluate`, so it must
 * stay self-contained: no imports and no references to anything outside the function body.
 *
 * It measures what the contract checks cannot: whether the rendered page overflows, whether text is readable on
 * the colour it actually sits on, and whether something fell back to browser defaults (unstyled links, Times).
 * @param {{ maxItems?: number }} [opts]
 */
function pageChecks(opts) {
  const max = (opts && opts.maxItems) || 8;
  const vw = window.innerWidth;

  const sel = (el) => {
    const id = el.id ? `#${el.id}` : "";
    const cls = typeof el.className === "string" && el.className.trim() ? `.${el.className.trim().split(/\s+/).slice(0, 2).join(".")}` : "";
    return `${el.tagName.toLowerCase()}${id}${cls}`;
  };
  const textOf = (el) => (el.textContent || "").replace(/\s+/g, " ").trim().slice(0, 40);
  const visible = (el) => {
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    return r.width > 0 && r.height > 0 && cs.visibility !== "hidden" && cs.display !== "none" && Number(cs.opacity) > 0;
  };
  const parse = (value) => {
    const m = /rgba?\(([^)]+)\)/.exec(value || "");
    if (!m) return null;
    const p = m[1].split(",").map((s) => parseFloat(s));
    return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 };
  };
  const lum = (c) => {
    const f = (v) => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; };
    return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b);
  };
  const over = (fg, bg) => ({ r: fg.r * fg.a + bg.r * (1 - fg.a), g: fg.g * fg.a + bg.g * (1 - fg.a), b: fg.b * fg.a + bg.b * (1 - fg.a), a: 1 });
  const ratio = (a, b) => { const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x); return (hi + 0.05) / (lo + 0.05); };
  const backdrop = (el) => {
    for (let n = el; n; n = n.parentElement) {
      const c = parse(getComputedStyle(n).backgroundColor);
      if (c && c.a > 0.99) return c;
      if (getComputedStyle(n).backgroundImage !== "none") return null; // gradient or image: cannot measure
    }
    return { r: 255, g: 255, b: 255, a: 1 };
  };

  const all = [...document.body.querySelectorAll("*")].filter(visible);

  // Horizontal overflow: the page scrolls sideways, or content pokes past the right edge.
  const offenders = all
    .filter((el) => el.getBoundingClientRect().right > vw + 1 && !el.closest("svg"))
    .map((el) => ({ element: sel(el), right: Math.round(el.getBoundingClientRect().right), text: textOf(el) }));
  const overflow = { scrollWidth: document.documentElement.scrollWidth, viewport: vw, scrolls: document.documentElement.scrollWidth > vw + 1, offenders: offenders.slice(0, max) };

  // Text readable on the colour it sits on.
  const lowContrast = [];
  for (const el of all) {
    const own = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
    if (!own) continue;
    const cs = getComputedStyle(el);
    const fg = parse(cs.color);
    const bg = backdrop(el);
    if (!fg || !bg) continue;
    const size = parseFloat(cs.fontSize);
    const large = size >= 24 || (size >= 18.66 && Number(cs.fontWeight) >= 700);
    const r = ratio(over(fg, bg), bg);
    if (r < (large ? 3 : 4.5)) lowContrast.push({ element: sel(el), ratio: Math.round(r * 100) / 100, needed: large ? 3 : 4.5, text: textOf(el) });
  }

  // Browser defaults leaking through: default link blue and Times.
  const unstyledLinks = all.filter((el) => el.tagName === "A" && ["rgb(0, 0, 238)", "rgb(85, 26, 139)"].includes(getComputedStyle(el).color)).map((el) => ({ element: sel(el), text: textOf(el) }));
  const defaultFont = all
    .filter((el) => [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim()) && /^"?Times/i.test(getComputedStyle(el).fontFamily))
    .map((el) => ({ element: sel(el), text: textOf(el) }));

  // Touch targets on narrow screens (inline text links are exempt).
  const smallTargets = vw <= 768
    ? all.filter((el) => /^(BUTTON|INPUT|SELECT|TEXTAREA)$/.test(el.tagName) || /\bbtn\b/.test(String(el.className))).filter((el) => { const r = el.getBoundingClientRect(); return r.height < 43.5 || r.width < 43.5; }).map((el) => ({ element: sel(el), size: `${Math.round(el.getBoundingClientRect().width)}x${Math.round(el.getBoundingClientRect().height)}`, text: textOf(el) }))
    : [];

  // In-page links that point at an id which does not exist.
  const brokenAnchors = [...document.querySelectorAll('a[href^="#"]')]
    .filter((a) => a.getAttribute("href").length > 1 && !document.getElementById(decodeURIComponent(a.getAttribute("href").slice(1))))
    .map((a) => ({ element: sel(a), href: a.getAttribute("href"), text: textOf(a) }));

  const structure = {
    h1: document.querySelectorAll("h1").length,
    landmarks: ["header", "nav", "main", "footer"].filter((t) => document.querySelector(t)),
    imagesWithoutAlt: document.querySelectorAll("img:not([alt])").length,
    controlsWithoutName: [...document.querySelectorAll("a,button")].filter((el) => visible(el) && !(el.textContent || "").trim() && !el.getAttribute("aria-label") && !el.getAttribute("title")).length,
  };

  const cut = (list) => ({ count: list.length, items: list.slice(0, max) });
  return { width: vw, overflow, lowContrast: cut(lowContrast), unstyledLinks: cut(unstyledLinks), defaultFont: cut(defaultFont), smallTargets: cut(smallTargets), brokenAnchors: cut(brokenAnchors), structure };
}

module.exports = { pageChecks };
