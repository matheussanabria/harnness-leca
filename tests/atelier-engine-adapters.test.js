// @ts-check
const test = require("node:test");
const assert = require("node:assert/strict");

const {
  formatGeminiContents,
  formatOpenCodeMessages,
  parseGeminiCandidate,
  parseStructuredToolCallsFallback,
  buildGeminiModelTurn,
} = require("../ui/server/services/atelier-engine-adapters.service");

test("atelier-engine-adapters: formatGeminiContents mapeia turnos user, model e function response", () => {
  const history = [
    { role: "user", text: "Crie a home" },
    {
      role: "model",
      text: "Planejando...",
      toolCalls: [{ name: "atelier_plan", args: { steps: [] } }],
    },
    {
      role: "tool",
      toolResults: [{ name: "atelier_plan", result: { ok: true } }],
    },
  ];

  const contents = formatGeminiContents(history);
  assert.equal(contents.length, 3);
  assert.equal(contents[0].role, "user");
  assert.equal(contents[0].parts[0].text, "Crie a home");

  assert.equal(contents[1].role, "model");
  assert.equal(contents[1].parts[0].text, "Planejando...");
  assert.equal(contents[1].parts[1].functionCall.name, "atelier_plan");

  assert.equal(contents[2].role, "function");
  assert.equal(contents[2].parts[0].functionResponse.name, "atelier_plan");
  assert.deepEqual(contents[2].parts[0].functionResponse.response.content, { ok: true });
});

test("atelier-engine-adapters: formatOpenCodeMessages mapeia para formato OpenAI", () => {
  const history = [
    { role: "user", text: "Oi" },
    {
      role: "model",
      toolCalls: [{ name: "atelier_write_screen", args: { screenId: "home", htmlContent: "<div></div>" } }],
    },
    {
      role: "tool",
      toolResults: [{ name: "atelier_write_screen", result: { ok: true } }],
    },
  ];

  const messages = formatOpenCodeMessages(history, "Instruções do sistema");
  assert.equal(messages.length, 4);
  assert.equal(messages[0].role, "system");
  assert.equal(messages[1].role, "user");
  assert.equal(messages[2].role, "assistant");
  assert.equal(messages[2].tool_calls[0].function.name, "atelier_write_screen");
  assert.equal(messages[3].role, "tool");
  assert.equal(messages[3].name, "atelier_write_screen");
});

test("atelier-engine-adapters: parseGeminiCandidate extrai functionCall e ignora thought interno", () => {
  const candidate = {
    content: {
      parts: [
        { text: "Raciocínio interno...", thought: true },
        { text: "Vou criar o arquivo agora." },
        { functionCall: { name: "atelier_write_screen", args: { screenId: "home", htmlContent: "<h1>Ok</h1>" } } },
      ],
    },
  };

  const parsed = parseGeminiCandidate(candidate);
  assert.equal(parsed.text, "Vou criar o arquivo agora.");
  assert.equal(parsed.toolCalls.length, 1);
  assert.equal(parsed.toolCalls[0].name, "atelier_write_screen");
  assert.equal(parsed.toolCalls[0].args.screenId, "home");
});

test("atelier-engine-adapters: parseStructuredToolCallsFallback extrai tags de ferramenta em saídas de texto", () => {
  const rawText = `Vou planejar as telas primeiro:
<ferramenta nome="atelier_plan">
{
  "steps": [{"id": "s1", "title": "Menu lateral", "status": "pending"}]
}
</ferramenta>
Aguardando feedback.`;

  const parsed = parseStructuredToolCallsFallback(rawText);
  assert.equal(parsed.toolCalls.length, 1);
  assert.equal(parsed.toolCalls[0].name, "atelier_plan");
  assert.equal(parsed.toolCalls[0].args.steps[0].id, "s1");
  assert.ok(!parsed.text.includes("<ferramenta"));
  assert.ok(parsed.text.includes("Vou planejar"));
});

test("atelier-engine-adapters: buildGeminiModelTurn invoca fetch com payload correto", async () => {
  let capturedUrl = "";
  let capturedBody = null;

  const mockFetch = async (url, options) => {
    capturedUrl = String(url);
    capturedBody = JSON.parse(options.body);
    return {
      ok: true,
      json: async () => ({
        candidates: [
          {
            content: {
              parts: [
                { text: "Tudo pronto." },
                { functionCall: { name: "atelier_complete", args: { summary: "Feito" } } },
              ],
            },
          },
        ],
      }),
    };
  };

  const modelTurn = buildGeminiModelTurn({
    key: "fake-key",
    model: "gemini-3.8-flash",
    fetchFn: mockFetch,
  });

  const res = await modelTurn([{ role: "user", text: "Finalize" }], new AbortController().signal);
  assert.ok(capturedUrl.includes("gemini-3.8-flash:generateContent"));
  assert.ok(capturedBody.tools[0].functionDeclarations);
  assert.equal(res.toolCalls[0].name, "atelier_complete");
  assert.equal(res.text, "Tudo pronto.");
});
