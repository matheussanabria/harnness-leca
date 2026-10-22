// @ts-check
// Contrato do item de memória (EP-13.02): um fato por arquivo, lido e escrito de forma determinística.
// A biblioteca não toca no disco (o I/O fica com store.js, 13.03); aqui só mora o contrato:
//   - frontmatter mínimo próprio, uma linha "chave: valor" por campo, sem biblioteca YAML;
//   - ordem fixa dos campos: name, description, type, created, updated, source, hash;
//   - hash: 8 primeiros caracteres do sha1 do texto normalizado de description + "\n" + corpo;
//   - validação do contrato (RF4) e normalização de texto (RF3).
const crypto = require("crypto");

/** @typedef {"user" | "feedback" | "project" | "reference"} TipoItem */
/** @typedef {{ name: string, description: string, type: TipoItem, created: string, updated: string, source: string, hash: string }} MetaItem */
/** @typedef {{ campo: string, mensagem: string }} ErroContrato */
/** @typedef {{ meta: MetaItem, body: string }} Item */

// Ordem fixa do frontmatter (RF2) e os quatro tipos aceitos pelo contrato.
const CAMPOS = /** @type {readonly string[]} */ (["name", "description", "type", "created", "updated", "source", "hash"]);
const TIPOS = /** @type {readonly string[]} */ (["user", "feedback", "project", "reference"]);
const MAX_DESCRIPTION = 140;
const KEBAB = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const DATA = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Normaliza um texto para comparação: minúsculas, sem acento, espaços colapsados, sem datas e sem pontuação final.
 * Datas saem porque o mesmo fato escrito em dias diferentes continua sendo o mesmo fato.
 * @param {unknown} texto
 * @returns {string}
 */
function normalize(texto) {
  return String(texto ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s*\d{4}-\d{2}-\d{2}[.,]?/g, " ")
    .replace(/\s+/g, " ")
    .replace(/[.;:!?,;'"“”\s]+$/, "")
    .trim();
}

/**
 * Hash do item: 8 primeiros caracteres do sha1 do texto normalizado de description + "\n" + corpo normalizado.
 * @param {unknown} description
 * @param {unknown} body
 * @returns {string}
 */
function hashOf(description, body) {
  const texto = `${normalize(description)}\n${normalize(body)}`;
  return crypto.createHash("sha1").update(texto, "utf8").digest("hex").slice(0, 8);
}

/**
 * Gera um nome kebab-case a partir de uma frase: "Ações destrutivas pedem confirmação" -> "acoes-destrutivas-pedem-confirmacao".
 * @param {unknown} texto
 * @returns {string}
 */
function slugify(texto) {
  return String(texto ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Confere se a data existe no calendário (AAAA-MM-DD).
 * @param {string} data
 * @returns {boolean}
 */
function dataValida(data) {
  const [a, m, d] = data.split("-").map(Number);
  const dt = new Date(Date.UTC(a, m - 1, d));
  return dt.getUTCFullYear() === a && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

/**
 * Valida o contrato do item (RF4). Lista vazia significa item válido; a lista traz um erro por regra quebrada.
 * @param {Partial<MetaItem> | null | undefined} meta
 * @param {unknown} [body]
 * @returns {ErroContrato[]}
 */
function validate(meta, body = "") {
  /** @type {ErroContrato[]} */
  const erros = [];
  const m = meta || {};
  const nome = String(m.name ?? "").trim();
  const descricao = String(m.description ?? "").trim();
  const tipo = String(m.type ?? "").trim();
  const criada = String(m.created ?? "").trim();
  const atualizada = String(m.updated ?? "").trim();
  const origem = String(m.source ?? "").trim();
  const hash = String(m.hash ?? "").trim();
  const corpo = String(body ?? "");

  if (!nome) erros.push({ campo: "name", mensagem: "name obrigatório" });
  else if (!KEBAB.test(nome)) erros.push({ campo: "name", mensagem: "name fora do padrão kebab-case" });

  if (!descricao) erros.push({ campo: "description", mensagem: "description obrigatório" });
  else if (/[\r\n]/.test(descricao)) erros.push({ campo: "description", mensagem: "description tem que ser uma linha só" });
  else if (descricao.length > MAX_DESCRIPTION) erros.push({ campo: "description", mensagem: `description com mais de ${MAX_DESCRIPTION} caracteres` });

  if (!tipo) erros.push({ campo: "type", mensagem: "type obrigatório" });
  else if (!TIPOS.includes(tipo)) erros.push({ campo: "type", mensagem: `type inválido: use ${TIPOS.join(", ")}` });

  for (const [campo, valor] of [["created", criada], ["updated", atualizada]]) {
    if (!valor) erros.push({ campo, mensagem: `${campo} obrigatório` });
    else if (!DATA.test(valor)) erros.push({ campo, mensagem: `${campo} fora do formato AAAA-MM-DD` });
    else if (!dataValida(valor)) erros.push({ campo, mensagem: `${campo} não é uma data que existe` });
  }

  if (!origem) erros.push({ campo: "source", mensagem: "source obrigatório" });

  // O hash é calculado pelo serializador e nunca escrito à mão: se ele não confere, o item foi mexido por fora.
  if (!hash) erros.push({ campo: "hash", mensagem: "hash obrigatório (é calculado pelo serializador)" });
  else if (hash !== hashOf(descricao, corpo)) erros.push({ campo: "hash", mensagem: "hash não confere com description + corpo" });

  if (tipo === "feedback" || tipo === "project") {
    if (!/\*\*Why:\*\*/.test(corpo)) erros.push({ campo: "body", mensagem: "feedback e project exigem **Why:**" });
    if (!/\*\*How to apply:\*\*/.test(corpo)) erros.push({ campo: "body", mensagem: "feedback e project exigem **How to apply:**" });
  }

  return erros;
}

/**
 * Lê um item de memória. Devolve { meta, body } quando o contrato é válido; devolve a lista de erros caso contrário.
 * O frontmatter é mínimo e próprio: uma linha "chave: valor" por campo, e um comentário "# ..." depois do valor é ignorado.
 * @param {unknown} text
 * @returns {Item | ErroContrato[]}
 */
function parseItem(text) {
  const bruto = String(text ?? "").replace(/^\uFEFF/, "");
  const partes = bruto.match(/^---[ \t]*\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n([\s\S]*))?$/);
  if (!partes) return [{ campo: "frontmatter", mensagem: "o item precisa ter um bloco --- ... --- no começo" }];

  /** @type {Record<string, string>} */
  const crud = {};
  for (const linha of String(partes[1]).split(/\r?\n/)) {
    const t = linha.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf(":");
    if (i < 1) return [{ campo: "frontmatter", mensagem: `linha de frontmatter inválida: "${linha}"` }];
    const chave = t.slice(0, i).trim();
    const valor = t.slice(i + 1).replace(/\s+#.*$/, "").trim();
    if (!CAMPOS.includes(chave)) return [{ campo: "frontmatter", mensagem: `campo desconhecido no frontmatter: "${chave}"` }];
    crud[chave] = valor;
  }

  /** @type {MetaItem} */
  const meta = {
    name: crud.name || "",
    description: crud.description || "",
    type: /** @type {TipoItem} */ (crud.type || ""),
    created: crud.created || "",
    updated: crud.updated || "",
    source: crud.source || "",
    hash: crud.hash || "",
  };
  const body = String(partes[2] ?? "").trim();

  const erros = validate(meta, body);
  if (erros.length) return erros;
  return { meta, body };
}

/**
 * Escreve o item: frontmatter na ordem fixa (RF2) e hash recalculado sobre description + corpo.
 * Não valida nem recusa entrada: quem grava em disco valida antes (e o lint aponta o que está fora do contrato).
 * @param {Partial<MetaItem> | null | undefined} meta
 * @param {unknown} [body]
 * @returns {string}
 */
function serializeItem(meta, body = "") {
  const m = meta || {};
  const corpo = String(body ?? "").trim();
  /** @type {Record<string, string>} */
  const valores = {
    name: String(m.name ?? "").trim(),
    description: String(m.description ?? "").trim(),
    type: String(m.type ?? "").trim(),
    created: String(m.created ?? "").trim(),
    updated: String(m.updated ?? "").trim(),
    source: String(m.source ?? "").trim(),
    hash: hashOf(String(m.description ?? "").trim(), corpo),
  };
  const linhas = ["---"];
  for (const campo of CAMPOS) linhas.push(`${campo}: ${valores[campo]}`);
  linhas.push("---");
  return corpo ? `${linhas.join("\n")}\n${corpo}\n` : `${linhas.join("\n")}\n`;
}

module.exports = { parseItem, serializeItem, normalize, hashOf, slugify, validate };
