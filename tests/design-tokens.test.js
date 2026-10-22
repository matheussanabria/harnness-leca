import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createProjectFixture } from './helpers/project-fixture.js';

const fixture = createProjectFixture();
const PROJECT_DS_DIR = path.join(fixture.dir, 'design', 'ds');
test.after(() => fixture.cleanup());

test('EP-12.09: Tokens CSS e Tema Base', async (t) => {
  await t.test('deve existir tokens.css com paletas e variáveis fundamentais', async () => {
    const tokensPath = path.join(PROJECT_DS_DIR, 'tokens.css');
    const content = await fs.readFile(tokensPath, 'utf8');

    assert.ok(content.length > 500, 'tokens.css deve ter conteúdo substancial');
    assert.ok(content.includes('--pure-0'), 'Deve conter --pure-0');
    assert.ok(content.includes('--blue-'), 'Deve conter escala de azuis');
    assert.ok(content.includes('--font-sans'), 'Deve conter definição tipográfica');
    assert.ok(content.includes('--space-'), 'Deve conter escala de espaçamentos');
  });

  await t.test('deve existir theme.css com mapeamento semântico', async () => {
    const themePath = path.join(PROJECT_DS_DIR, 'theme.css');
    const content = await fs.readFile(themePath, 'utf8');

    assert.ok(content.length > 500, 'theme.css deve ter conteúdo substancial');
    assert.ok(content.includes('--primary-interactive'), 'Deve mapear --primary-interactive');
    assert.ok(content.includes('--neutral-body'), 'Deve mapear --neutral-body');
    assert.ok(content.includes('--highlight-focus'), 'Deve mapear tokens de highlight');
  });
});
