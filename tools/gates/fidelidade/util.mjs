// fidelidade/util: value normalization shared by both adapters and the comparison.

// Icon names compare by their bare name: "fa-solid fa-magnifying-glass" and "faMagnifyingGlass" are the same icon.
const ALIAS = { search: 'magnifying-glass', 'calendar-days': 'calendar', 'calendar-alt': 'calendar', 'calendar-day': 'calendar' };
const NAO_ICONE = new Set(['solid', 'regular', 'brands', 'fw', 'lg', 'sm', 'xs', '2x', 'check', 'caret-down']);

export function nomeIcone(bruto) {
  if (!bruto) return null;
  const nome = String(bruto).replace(/^fa-/, '').trim();
  return ALIAS[nome] || nome;
}

// "fa-solid fa-magnifying-glass ds-icon" -> "magnifying-glass" (first icon class that is not a style or size class).
export function iconeDeClasses(classesDoEl) {
  for (const c of classesDoEl) {
    if (!c.startsWith('fa-')) continue;
    const n = c.slice(3);
    if (!NAO_ICONE.has(n)) return nomeIcone(n);
  }
  return null;
}

// faMagnifyingGlass -> magnifying-glass
export const iconeDeSimbolo = (simbolo) =>
  nomeIcone(String(simbolo).replace(/^fa/, '').replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase());

export const normTexto = (s) => (s == null ? null : String(s).replace(/\*/g, '').replace(/\s+/g, ' ').trim());

export function larguraPx(valor) {
  const m = /(\d+(?:\.\d+)?)\s*px/.exec(String(valor || ''));
  return m ? Number(m[1]) : null;
}

// Angular boolean input: `required`, `[required]="true"`, `[required]="cond"` are on; `[required]="false"` is off.
export function booleano(attrs, nome) {
  if (nome in attrs) return attrs[nome] !== 'false';
  if (`[${nome}]` in attrs) return attrs[`[${nome}]`].trim() !== 'false';
  return false;
}

// Static text of an Angular input; a bound input (`[label]="x"`) is unknown (undefined), not empty.
export function textoEstatico(attrs, nome) {
  if (nome in attrs) return normTexto(attrs[nome]);
  if (`[${nome}]` in attrs) return undefined;
  return null;
}
