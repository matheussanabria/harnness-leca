// @ts-check
// Camada de I/O em disco para itens de memória (EP-13.03).
// Lê e grava arquivos de memória tolerando BOM e validando o contrato.
const fs = require("fs");
const path = require("path");
const { parseItem } = require("./item");

/** @typedef {import("./item").Item} Item */
/** @typedef {import("./item").ErroContrato} ErroContrato */
/** @typedef {{ path: string, relPath: string, item?: Item, errors?: ErroContrato[] }} LeituraItem */

/**
 * Resolve o diretório raiz de memória para o escopo dado.
 * @param {string} rootDir Diretório raiz do projeto/workspace
 * @param {string} [slug] Slug do projeto ou vazio para global
 * @returns {string}
 */
function resolveMemoryDir(rootDir, slug) {
  if (!slug || slug === "global") {
    return path.join(rootDir, "global", "memory");
  }
  return path.join(rootDir, "projects", slug, "memory");
}

/**
 * Varre recursivamente um diretório procurando arquivos .md.
 * @param {string} dir
 * @returns {string[]}
 */
function walkMdFiles(dir) {
  if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) return [];
  /** @type {string[]} */
  const results = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...walkMdFiles(full));
    } else if (entry.isFile() && entry.name.endsWith(".md")) {
      results.push(full);
    }
  }
  return results;
}

/**
 * Lê todos os itens de memória de um escopo.
 * Devolve itens válidos e relata itens com erros de contrato sem interromper.
 * @param {string} memoryDir Diretório base da memória (ex: projects/<slug>/memory)
 * @returns {{ valid: Array<{ file: string, relPath: string, item: Item }>, invalid: Array<{ file: string, relPath: string, errors: ErroContrato[] }> }}
 */
function listItems(memoryDir) {
  if (!fs.existsSync(memoryDir)) {
    return { valid: [], invalid: [] };
  }

  const files = walkMdFiles(memoryDir);
  /** @type {Array<{ file: string, relPath: string, item: Item }>} */
  const valid = [];
  /** @type {Array<{ file: string, relPath: string, errors: ErroContrato[] }>} */
  const invalid = [];

  for (const file of files) {
    const relPath = path.relative(memoryDir, file).replace(/\\/g, "/");
    // Ignora índices antigos ou arquivos de índice que fiquem dentro da pasta
    if (path.basename(file).startsWith("index") || path.basename(file).startsWith("memory.")) continue;

    const raw = fs.readFileSync(file, "utf8");
    const parsed = parseItem(raw);
    if (Array.isArray(parsed)) {
      invalid.push({ file, relPath, errors: parsed });
    } else {
      valid.push({ file, relPath, item: parsed });
    }
  }

  return { valid, invalid };
}

/**
 * Salva um item de memória aplicando regras de deduplicação e gravação atômica (RF2).
 * @param {string} memoryDir Diretório base da memória
 * @param {{ name: string, description: string, type: import("./item").TipoItem, body?: string, source?: string }} request
 * @param {{ update?: string, forceNew?: boolean, today?: string }} [options]
 * @returns {{ status: "criado" | "atualizado" | "recusado", path: string, reason: string, item?: Item }}
 */
function saveItem(memoryDir, request, options = {}) {
  const { isSimilar } = require("./dedupe");
  const { serializeItem, hashOf } = require("./item");
  const today = options.today || new Date().toISOString().slice(0, 10);
  const body = request.body || "";
  const targetHash = hashOf(request.description, body);

  const { valid } = listItems(memoryDir);

  // Regra 1: hash igual recusa imediatamente (RF2)
  const exactMatch = valid.find((v) => v.item.meta.hash === targetHash);
  if (exactMatch) {
    return {
      status: "recusado",
      path: `memory/${exactMatch.relPath}`,
      reason: `item idêntico já existe com mesmo hash (${exactMatch.item.meta.name})`,
    };
  }

  // Regra 2: name igual faz upsert (RF2)
  const sameName = valid.find((v) => v.item.meta.name === request.name);
  if (sameName) {
    const updatedMeta = {
      name: sameName.item.meta.name,
      description: request.description,
      type: request.type,
      created: sameName.item.meta.created,
      updated: today,
      source: request.source || sameName.item.meta.source,
      hash: targetHash,
    };
    const content = serializeItem(updatedMeta, body);
    const destFile = sameName.file;

    // Escrita atômica via temp file
    const tempFile = `${destFile}.${Date.now()}.tmp`;
    fs.writeFileSync(tempFile, content, "utf8");
    fs.renameSync(tempFile, destFile);

    return {
      status: "atualizado",
      path: `memory/${sameName.relPath}`,
      reason: `item atualizado por nome existente`,
      item: { meta: updatedMeta, body },
    };
  }

  // Regra 3: parecido acima de 0.8 exige --update ou --force-new (RF2)
  if (!options.forceNew) {
    const similar = valid.find((v) => isSimilar(v.item.meta.description, request.description, 0.8));
    if (similar && options.update !== similar.item.meta.name) {
      return {
        status: "recusado",
        path: `memory/${similar.relPath}`,
        reason: `item similar encontrado (${similar.item.meta.name}). Use --update ${similar.item.meta.name} ou --force-new.`,
      };
    }
  }

  // Se --update foi fornecido explicitamente para outro item
  if (options.update) {
    const targetItem = valid.find((v) => v.item.meta.name === options.update);
    if (!targetItem) {
      return {
        status: "recusado",
        path: "",
        reason: `item especificado em --update não foi encontrado: ${options.update}`,
      };
    }
    const updatedMeta = {
      name: targetItem.item.meta.name,
      description: request.description,
      type: request.type,
      created: targetItem.item.meta.created,
      updated: today,
      source: request.source || targetItem.item.meta.source,
      hash: targetHash,
    };
    const content = serializeItem(updatedMeta, body);
    const destFile = targetItem.file;

    const tempFile = `${destFile}.${Date.now()}.tmp`;
    fs.writeFileSync(tempFile, content, "utf8");
    fs.renameSync(tempFile, destFile);

    return {
      status: "atualizado",
      path: `memory/${targetItem.relPath}`,
      reason: `item ${targetItem.item.meta.name} atualizado via --update`,
      item: { meta: updatedMeta, body },
    };
  }

  // Novo item criado
  const typeDir = path.join(memoryDir, request.type);
  fs.mkdirSync(typeDir, { recursive: true });
  const destFile = path.join(typeDir, `${request.name}.md`);
  const relPath = `${request.type}/${request.name}.md`;

  const newMeta = {
    name: request.name,
    description: request.description,
    type: request.type,
    created: today,
    updated: today,
    source: request.source || "user:direct",
    hash: targetHash,
  };
  const content = serializeItem(newMeta, body);

  const tempFile = `${destFile}.${Date.now()}.tmp`;
  fs.writeFileSync(tempFile, content, "utf8");
  fs.renameSync(tempFile, destFile);

  return {
    status: "criado",
    path: `memory/${relPath}`,
    reason: `novo item gravado com sucesso`,
    item: { meta: newMeta, body },
  };
}

module.exports = {
  resolveMemoryDir,
  listItems,
  saveItem,
};

