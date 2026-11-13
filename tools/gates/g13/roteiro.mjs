// g13/roteiro: reads and validates a test script (roteiro) of the screen check.
//
// {
//   "schema": 1, "titulo": "...",
//   "app": { "url": "http://localhost:8180/", "api": "/api/medicamentos" },
//   "prototipo": { "html": "design/prototipos/dis-paciente/prototipo.html", "tela": "nova-prescricao-medicamentos",
//                  "medicamento": "dipirona", "valores": { "por-blister": "30", "quantidade": "2", "dias": "60" } },
//   "caso": { "medicamento": "Dipirona", "valores": { "tamanhoEmbalagem": "30", "quantidadePorTempo": "2", "tratamentoDias": "60" } },
//   "itens": [ { "id": "medicamento", "proto": "#medicamento", "chave": "medicamento" },
//              { "id": "embalagem", "proto": "#por-blister", "chave": "tamanhoEmbalagem", "quando": "exigeEmbalagem" },
//              { "id": "cancelar", "proto": "#cancelar", "texto": "Cancelar" } ],
//   "viewports": [1024, 768, 375]
// }
// `quando` names a flag of the oracle (exigeEmbalagem, exigePosologia, calculaPrevia): the item is compared only if true.
import { readFileSync } from 'node:fs';

const FLAGS = new Set(['exigeEmbalagem', 'exigePosologia', 'calculaPrevia']);

export function leRoteiro(arquivo) {
  const j = JSON.parse(readFileSync(arquivo, 'utf8').replace(/^﻿/, ''));
  const erros = [];
  if (!j.app?.url) erros.push('app.url ausente');
  if (!j.caso?.medicamento) erros.push('caso.medicamento ausente (nome ou código do medicamento a testar)');
  if (!Array.isArray(j.itens) || !j.itens.length) erros.push('itens vazio');
  for (const it of j.itens || []) {
    if (!it.id || !(it.proto || it.texto)) erros.push(`item sem id ou sem proto/texto: ${JSON.stringify(it)}`);
    if (!it.chave && !it.texto) erros.push(`item "${it.id}" precisa de chave ou texto para achar na tela`);
    if (it.quando && !FLAGS.has(it.quando)) erros.push(`item "${it.id}": quando "${it.quando}" desconhecido (${[...FLAGS].join(', ')})`);
  }
  if (erros.length) throw new Error(`roteiro inválido (${arquivo}): ${erros.join('; ')}`);
  return { viewports: [1024, 768, 375], api: '/api/medicamentos', ...j, app: { api: '/api/medicamentos', ...j.app } };
}
