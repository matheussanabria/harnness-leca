# Notas de desenvolvimento — EP-12 Prototype Engine

Atualizado em 2026-10-19 após a homologação do Marco M3.

## Entrega

- `proto.json` v2 é a fonte semântica das telas, nós, estado, bindings e navegação.
- O protótipo DIS modular possui as telas `home`, `prescricao` e `autorizacao` com navegação circular declarativa.
- Os datasets clínicos ficam em `design/prototypes/dis-modular/data/` e não dependem do runtime DataChef legado.
- O mesmo modelo gera saídas Vanilla, Angular 18 e React 18+ por adaptadores separados.
- Studio, inspetor e rastreabilidade resolvem o caminho tela → nó → componente → boilerplate → código.

## Decisões preservadas

- HTMLs legados permanecem imutáveis como fonte de migração e comparação.
- Renderização de protótipo ocorre em iframe sandbox com CSP e nonce.
- Identificadores canônicos usam `data-node-id`, mantendo leitura compatível de `data-pid`.
- Alterações visuais usam fingerprint, conflito 409 e mutação não destrutiva.
- Cada adaptador de framework é um serviço coeso e independente.
- A reconstrução F4 é testada em diretório temporário; ela não pode sobrescrever o fixture homologado do piloto.
- `prototype-pilot-dis.service.js` recompõe idempotentemente as telas e a navegação F7 após uma reconstrução.

## Evidências

- Marco M1: `tests/marco-m1-validation.test.js`.
- Marco M2: `tests/marco-m2-validation.test.js`.
- Piloto DIS: `tests/prototype-pilot-dis.test.js`.
- Isolamento da reconstrução: `tests/prototype-reconstruction.test.js`.
- Marco M3: `tests/marco-m3-validation.test.js`.
- Relatório final: `reports/M3-validation-report.md`.

## Pendências fora do escopo do EP-12

- O gate global `npm run types` ainda possui erros transversais em módulos anteriores ao fechamento do épico.
- A suíte automatizada valida contratos, geração, navegação e integridade; um aceite visual em navegador real continua recomendado como hardening.
- Os documentos HTML/JSON gerados podem ultrapassar 300 linhas; a regra anti-monólito permanece aplicada aos serviços e módulos de código-fonte mantidos manualmente.
