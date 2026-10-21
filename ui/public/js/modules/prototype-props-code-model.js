// @ts-check
import { formatCss, formatHtml } from "./prototype-code-format.js";
/** Regras puras da aba de código do painel: abas disponíveis e o texto de cada uma. */

export const CODE_TABS = [["css", "CSS"], ["html", "HTML"], ["react", "React"], ["angular", "Angular"]];

/**
 * @param {string} tab
 * @param {{ cls: string, rule: string }} local classe e regra gravadas (sempre atuais)
 * @param {any} trace resposta do endpoint de rastreabilidade (pode ser null)
 * @returns {{ label: string, text: string }}
 */
export function pickCode(tab, local, trace) {
  if (tab.startsWith("file:")) {
    const path = tab.slice(5);
    return { label: path, text: trace?.sources?.[path] ?? "" };
  }
  if (tab === "css") {
    const matched = trace?.css?.matched || "";
    const own = local.rule ? `/* styles/proto.css: edições feitas no painel */\n${local.rule}` : "";
    return { label: "CSS que atinge este elemento", text: formatCss([own, matched].filter(Boolean).join("\n\n")) };
  }
  const code = trace?.code || {};
  const src = trace?.codeSource || {};
  if (tab === "react") return { label: src.react18 ? `React 18: componente ${src.react18.split("/").pop()}` : "React 18 (JSX do elemento)", text: src.react18 ? code.react18 || "" : formatHtml(code.react18 || "") };
  if (tab === "angular") return { label: src.angular18 ? `Angular 18: componente ${src.angular18.split("/").pop()}` : "Angular 18 (template do elemento)", text: src.angular18 ? code.angular18 || "" : formatHtml(code.angular18 || "") };
  return { label: trace?.files?.screen ? `HTML em ${trace.files.screen}` : "HTML", text: formatHtml(code.vanilla || "") };
}

/** Linhas de rodapé: componente do DS e arquivos de implementação conhecidos. */
export function fileLines(trace) {
  if (!trace) return [];
  const kind = { extracted: "extraído", ds: "design system", none: "sem componente" }[trace.component?.source] || "";
  const lines = [`Componente: ${trace.component?.id || "html.element"}${kind ? ` (${kind})` : ""}`];
  for (const f of trace.files?.components || []) lines.push(`${f.framework}: ${f.path}`);
  return lines;
}

/** Linguagem do realce de sintaxe para a aba (ou arquivo) ativa. */
export function langOf(tab, trace) {
  if (tab === "css") return "css";
  if (tab === "html") return "html";
  if (tab === "react") return "js";
  if (tab === "angular") return trace?.codeSource?.angular18 ? "js" : "html";
  const ext = tab.startsWith("file:") ? tab.split(".").pop() : "";
  return ext === "css" ? "css" : ext === "html" ? "html" : ext === "json" || ext === "md" ? "plain" : "js";
}

/** Arquivos do componente (para os botões que abrem o código na própria aba). */
export function fileEntries(trace) {
  return (trace?.files?.components || []).filter((f) => f?.path).map((f) => ({ framework: f.framework, path: f.path, name: f.path.split("/").pop() }));
}

/** Selo do componente no rodapé do visualizador: id, origem e rótulo legível. */
export function componentBadge(trace) {
  if (!trace) return null;
  const source = trace.component?.source || (trace.component?.isRegistered ? "ds" : "none");
  const label = { extracted: "Componente extraído", ds: "Componente do Design System", none: "Sem componente (só HTML + CSS)" }[source] || "";
  return { id: trace.component?.id || "html.element", source, label };
}

/** Arquivo do componente que está sendo mostrado (aba React/Angular mostram o arquivo de entrada; "file:" mostra o escolhido). */
export function activePath(tab, trace) {
  if (tab.startsWith("file:")) return tab.slice(5);
  if (tab === "react") return trace?.codeSource?.react18 || null;
  if (tab === "angular") return trace?.codeSource?.angular18 || null;
  return null;
}

/** Aba que corresponde a um arquivo (para destacar a aba quando um arquivo é aberto). */
export function tabOfPath(path) {
  const name = String(path || "").toLowerCase();
  if (name.endsWith(".css")) return "css";
  if (name.endsWith(".html")) return "html";
  if (name.endsWith(".jsx") || name.endsWith(".tsx")) return "react";
  if (name.endsWith(".component.ts")) return "angular";
  return null;
}
