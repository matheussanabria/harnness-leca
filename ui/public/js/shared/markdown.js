import { esc } from "./dom.js";
import { stashCodeBlocks, renderCodeCard } from "./markdown-code.js";

/**
 * Markdown básico com suporte completo a listas (-, *, +, •, 1.), blocos de código, títulos, tabelas e citações.
 * @param {string} t
 */
export function md(t) {
  if (!t) return "";
  /** @type {Array<{ filePath?: string, lang?: string, content: string }>} */
  const code = [];
  t = stashCodeBlocks(t.replace(/\u0000/g, ""), code);

  // Links http(s): [texto](url) e URLs soltas (guardados à parte para o itálico/negrito não mexer neles).
  const links = [];
  const stash = (url, label) => {
    links.push(`<a href="${url}" target="_blank" rel="noopener noreferrer">${label}</a>`);
    return `\u0001${links.length - 1}\u0001`;
  };

  const inline = (s) =>
    esc(s)
      .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, (_, l, u) => stash(u, l))
      .replace(/(^|[\s(])(https?:\/\/[^\s<)\u0001]+)/g, (_, pre, u) => pre + stash(u, u))
      .replace(/\*\*(.+?)\*\*/g, "<b>$1</b>")
      .replace(/(^|\W)_(.+?)_(?=\W|$)/g, "$1<i>$2</i>")
      .replace(/`(.+?)`/g, "<code>$1</code>")
      .replace(/\u0001(\d+)\u0001/g, (_, i) => links[i]);

  const lines = t.split("\n");
  const out = [];

  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    const cell = (r) =>
      r
        .trim()
        .replace(/^\||\|$/g, "")
        .split("|")
        .map((c) => c.trim());

    if (/^\s*\|.*\|\s*$/.test(l) && /^\s*\|[\s:|-]+\|\s*$/.test(lines[i + 1] || "")) {
      const head = cell(l);
      i += 2;
      const rows = [];
      while (i < lines.length && /^\s*\|.*\|\s*$/.test(lines[i])) {
        rows.push(cell(lines[i++]));
      }
      i--;
      out.push(
        "<table><tr>" +
          head.map((c) => `<th>${inline(c)}</th>`).join("") +
          "</tr>" +
          rows.map((r) => "<tr>" + r.map((c) => `<td>${inline(c)}</td>`).join("") + "</tr>").join("") +
          "</table>"
      );
    } else if (/^#{1,3} /.test(l)) {
      const n = l.match(/^#+/)[0].length;
      out.push(`<h${n + 1}>${inline(l.replace(/^#+ /, ""))}</h${n + 1}>`);
    } else if (/^\s*([*\-+]\s+|[•⁃◦▪▫]\s*)/.test(l)) {
      const items = [];
      while (i < lines.length && /^\s*([*\-+]\s+|[•⁃◦▪▫]\s*)/.test(lines[i])) {
        const line = lines[i];
        const isNested = /^( {2,}|\t+)/.test(line);
        const text = line.replace(/^\s*([*\-+]\s+|[•⁃◦▪▫]\s*)/, "");
        if (isNested && items.length > 0) {
          items[items.length - 1] += `<ul><li>${inline(text)}</li></ul>`;
        } else {
          items.push(`<li>${inline(text)}</li>`);
        }
        i++;
      }
      i--;
      out.push(`<ul>${items.join("")}</ul>`);
    } else if (/^\s*\d+\.\s+/.test(l)) {
      const items = [];
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) {
        const line = lines[i];
        const isNested = /^( {2,}|\t+)/.test(line);
        const text = line.replace(/^\s*\d+\.\s+/, "");
        if (isNested && items.length > 0) {
          items[items.length - 1] += `<ol><li>${inline(text)}</li></ol>`;
        } else {
          items.push(`<li>${inline(text)}</li>`);
        }
        i++;
      }
      i--;
      out.push(`<ol>${items.join("")}</ol>`);
    } else if (/^\s*>\s*/.test(l)) {
      const bq = [];
      while (i < lines.length && /^\s*>\s*/.test(lines[i])) {
        bq.push(inline(lines[i].replace(/^\s*>\s*/, "")));
        i++;
      }
      i--;
      out.push(`<blockquote>${bq.join("<br>")}</blockquote>`);
    } else if (/^\u0000\d+\u0000$/.test(l.trim())) {
      const idx = parseInt(l.trim().slice(1, -1), 10);
      out.push(renderCodeCard(code[idx]));
    } else {
      out.push(l.trim() ? "<p>" + inline(l) + "</p>" : "");
    }
  }
  return out.join("");
}

/**
 * Lê o formato do importador: turnos "## Você/Claude/Gemini/opencode" + blocos ":::tool ... :::" (processamento interno).
 * @param {string} src
 */
export function parseChat(src) {
  const items = [];
  let who = null;
  let buf = [];
  const flush = () => {
    const text = buf.join("\n").trim();
    buf = [];
    if (text && who) items.push({ who, text });
  };
  const lines = src.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (/^## (Você|Claude|Gemini|Antigravity|opencode|Codex|Ollama)\s*$/i.test(l)) {
      flush();
      who = /^## Você\s*$/i.test(l)
        ? "user"
        : /Claude/i.test(l)
          ? "claude"
          : /opencode/i.test(l)
            ? "opencode"
            : /Codex/i.test(l)
              ? "codex"
              : /Ollama/i.test(l)
                ? "ollama"
                : "gemini";
      continue;
    }
    const m = l.match(/^:::(tool|thinking)\s*(.*)$/);
    if (m && who) {
      flush();
      const body = [];
      i++;
      while (i < lines.length && lines[i] !== ":::") body.push(lines[i++]);
      const [name, hint, err] = m[1] === "thinking" ? ["Raciocínio", "", ""] : (m[2] || "").split(" | ");
      const txt = body.join("\n");
      const k = txt.indexOf("\n--- resultado\n");
      const input = (k >= 0 ? txt.slice(0, k) : txt).replace(/^--- entrada\n/, "");
      const tool = {
        name,
        hint: hint || "",
        error: err === "erro",
        input,
        result: k >= 0 ? txt.slice(k + 15) : "",
        thinking: m[1] === "thinking",
      };
      const last = items[items.length - 1];
      if (last && last.who === "internal") last.tools.push(tool);
      else items.push({ who: "internal", tools: [tool] });
      continue;
    }
    buf.push(l);
  }
  flush();
  return items;
}

/**
 * Renderiza o histórico de chat em HTML com balões e blocos expansíveis de ferramentas.
 * @param {string} src
 */
export function renderChat(src) {
  return (
    '<div class="chat">' +
    parseChat(src)
      .map((it) => {
        if (it.who === "user") {
          return `<div class="msg user"><div class="who">Você</div><div class="bubble"><div class="clip">${md(it.text.replace(/<\/?pasted_content[^>]*>/g, ""))}</div></div></div>`;
        }
        if (it.who === "claude") {
          return `<div class="msg claude"><div class="who">✱ Claude</div><div class="bubble"><div class="clip">${md(it.text)}</div></div></div>`;
        }
        if (it.who === "opencode") {
          return `<div class="msg opencode"><div class="who">◆ OpenCode</div><div class="bubble"><div class="clip">${md(it.text)}</div></div></div>`;
        }
        if (it.who === "gemini") {
          return `<div class="msg gemini"><div class="who">✦ Gemini</div><div class="bubble"><div class="clip">${md(it.text)}</div></div></div>`;
        }
        if (it.who === "codex") {
          return `<div class="msg codex"><div class="who">▸ Codex</div><div class="bubble"><div class="clip">${md(it.text)}</div></div></div>`;
        }
        if (it.who === "ollama") {
          return `<div class="msg ollama"><div class="who">▣ Ollama Local</div><div class="bubble"><div class="clip">${md(it.text)}</div></div></div>`;
        }
        // Metadados HIA não são processamento interno: o cartão do turno já os mostra.
        const tools = it.tools.filter((t) => !/^hia-/.test(t.name));
        if (!tools.length) return "";
        const n = tools.length;
        const errs = tools.filter((t) => t.error).length;
        const names = [...new Set(tools.map((t) => t.name))].slice(0, 4).join(", ");
        return (
          `<details class="internal"><summary>⚙ Processamento interno · ${n} ${n === 1 ? "etapa" : "etapas"}${errs ? ` · ${errs} com erro` : ""}<span class="names">${esc(names)}</span></summary>` +
          tools
            .map(
              (t) =>
                `<details class="step${t.error ? " err" : ""}"><summary><b>${esc(t.name)}</b> <span>${esc(t.hint)}</span></summary>` +
                (t.thinking
                  ? `<pre>${esc(t.input)}</pre>`
                  : `<div class="lbl">Entrada</div><pre>${esc(t.input)}</pre><div class="lbl">Resultado</div><pre>${esc(t.result || "(vazio)")}</pre>`) +
                "</details>"
            )
            .join("") +
          "</details>"
        );
      })
      .join("") +
    "</div>"
  );
}

/**
 * Extrai campos básicos do cabeçalho YAML / frontmatter de um chat .md.
 * @param {string} content
 */
export function parseFrontmatter(content) {
  const meta = { title: "", motor: "", modelo: "", sessao: "", turns: 0 };
  const fmMatch = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!fmMatch) return meta;
  const lines = fmMatch[1].split(/\r?\n/);
  for (const line of lines) {
    const colon = line.indexOf(":");
    if (colon > 0) {
      const key = line.slice(0, colon).trim().toLowerCase();
      const val = line.slice(colon + 1).trim().replace(/^["']|["']$/g, "");
      if (key === "title" || key === "titulo") meta.title = val;
      else if (key === "motor") meta.motor = val;
      else if (key === "modelo" || key === "model") meta.modelo = val;
      else if (key === "sessao" || key === "session") meta.sessao = val;
      else if (key === "turns" || key === "mensagens") meta.turns = parseInt(val, 10) || 0;
    }
  }
  return meta;
}
