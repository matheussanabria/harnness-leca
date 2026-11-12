// fidelidade/g12: derived status (ADR-016, slice 3). The G10 result per paired field gives the status of a map
// field (implementado or diverge); the typed `ui.st` of the map must agree with it. A status nobody can derive
// (a-confirmar, so-no-prototipo, ...) is manual and needs `motivo` and `revalidar_em`; an expired date is reported.
const AUTOMATICOS = new Set(['implementado', 'diverge']);

// campos: [{ id, mapa? }] of the pairing; diverge: { campoId: boolean } from G10 (any difference, declared or not).
export function derivaStatus(campos, diverge) {
  const porMapa = {};
  for (const c of campos) {
    const alvo = c.mapa || c.id;
    if (!(c.id in diverge)) continue;
    porMapa[alvo] = porMapa[alvo] === 'diverge' || diverge[c.id] ? 'diverge' : 'implementado';
  }
  return porMapa;
}

// telaMapa: a screen of mapa-camadas.json; derivado: output of derivaStatus; hoje: AAAA-MM-DD.
export function conferirG12(telaMapa, derivado, hoje) {
  const achados = [];
  for (const campo of telaMapa.campos || []) {
    const ui = campo.ui;
    if (!ui?.st) continue;
    const nome = `${telaMapa.id}: ${campo.id}`;
    const calculado = derivado[campo.id];
    if (calculado && AUTOMATICOS.has(ui.st)) {
      if (ui.st !== calculado) achados.push({ g: 'G12', m: `${nome}.ui.st: o mapa diz "${ui.st}", o G10 deriva "${calculado}"` });
      continue;
    }
    if (calculado) continue; // typed with another status while G10 has evidence: left to the author
    if (!ui.motivo) achados.push({ g: 'G12', m: `${nome}.ui.st "${ui.st}" é manual e não tem "motivo"` });
    if (!ui.revalidar_em) achados.push({ g: 'G12', m: `${nome}.ui.st "${ui.st}" é manual e não tem "revalidar_em"` });
    else if (ui.revalidar_em < hoje) achados.push({ g: 'G12', m: `${nome}.ui.st "${ui.st}" precisava de revalidação em ${ui.revalidar_em}` });
  }
  return achados;
}
