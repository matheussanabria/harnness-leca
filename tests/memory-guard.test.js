const test = require("node:test");
const assert = require("node:assert/strict");
const { inspectSecrets } = require("../tools/lib/memory/guard");

test("inspectSecrets recusa PAT, API keys e tokens conhecidos sem ecoar o valor", () => {
  const ghp = "ghp_123456789012345678901234567890123456"; // allow-secret
  const sk = "sk-proj-123456789012345678901234567890"; // allow-secret
  const jwt = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c"; // allow-secret

  const vGhp = inspectSecrets("token github", ghp);
  assert.ok(vGhp.length > 0);
  assert.equal(vGhp.includes("chave de API"), true);

  const vSk = inspectSecrets("chave openai", sk);
  assert.ok(vSk.length > 0);
  assert.equal(vSk.includes("chave de API"), true);

  const vJwt = inspectSecrets("bearer token", jwt);
  assert.ok(vJwt.length > 0);
  assert.equal(vJwt.includes("JWT"), true);
});

test("inspectSecrets recusa dados pessoais como CPF, CNS, email e telefone", () => {
  const emailViol = inspectSecrets("contato", "usuario@empresa.com.br");
  assert.ok(emailViol.includes("e-mail"));

  const cpfViol = inspectSecrets("documento", "123.456.789-00");
  assert.ok(cpfViol.includes("CPF"));

  const telViol = inspectSecrets("telefone", "(11) 98765-4321");
  assert.ok(telViol.includes("telefone"));

  const cnsViol = inspectSecrets("cns paciente", "123 4567 8901 2345");
  assert.ok(cnsViol.includes("CNS"));
});

test("inspectSecrets aprova textos e documentações legítimas sem segredos", () => {
  const desc = "O usuário prefere componentes modulares e código sem emojis";
  const body = "**Why:**\nEvita poluição visual e mantém legibilidade.\n\n**How to apply:**\nUsar FontAwesome.";

  const viol = inspectSecrets(desc, body);
  assert.equal(viol.length, 0);
});
