// rastreio/config: the project-specific facts the gate needs (paths, file names, id conventions).
// Phase 1 ships only the built-in saude-dispensacao preset; phase 2 replaces it with
// projects/<slug>/rastreio.config.json plus validation. Gates read this object, never fixed paths.
import { join } from 'node:path';

const JAVA_PKG = ['br', 'com', 'procempa', 'saude', 'dispensacao'];

export function dispensacaoConfig(root) {
  const api = join(root, 'dispensacao-novo', 'dispensacao-api', 'src');
  const pkg = JAVA_PKG.join('/');
  return {
    root,
    docs: { features: join(root, 'doc', 'sistema', 'features'), postman: join(root, 'doc', 'postman') },
    ids: { regra: 'RN', placeholder: 'DIS-NOVA-' },
    arquivos: { rastreio: 'rastreio.yml', regras: 'regras.md', mapa: 'mapa-camadas.json', status: '_status.md' },
    stacks: {
      junit: {
        main: join(api, 'main', 'java', ...JAVA_PKG),
        test: join(api, 'test', 'java', ...JAVA_PKG),
        relTest: `src/test/java/${pkg}/`,
        raizes: [`src/main/java/${pkg}/`, `src/test/java/${pkg}/`],
      },
      karma: { raiz: join(root, 'dispensacao-novo', 'dispensacao-web', 'src', 'app'), prefixo: 'web:' },
    },
  };
}
