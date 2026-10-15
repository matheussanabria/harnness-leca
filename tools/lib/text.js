// @ts-check
// Funções de texto usadas pelos importadores para montar nomes de arquivo e blocos do .md.
const { MAX_IO } = require("./limits");

// "Olá, Mundo!" -> "ola-mundo": minúsculas, sem acento, só [a-z0-9-], até 60 caracteres. Vazio vira "sem-titulo".
const slugify = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
  .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "sem-titulo";

// Corta entradas/resultados de ferramenta longos, avisando quantos caracteres ficaram de fora.
const clip = (s) => {
  s = String(s ?? "").trim();
  return s.length > MAX_IO ? `${s.slice(0, MAX_IO)}\n… (+${s.length - MAX_IO} caracteres)` : s;
};

// Linhas ":::" no conteúdo fechariam o bloco (:::tool, :::thinking) antes da hora: um espaço de largura zero as desarma.
const safe = (s) => clip(s).replace(/^:::/gm, "::​:");

module.exports = { slugify, clip, safe };
