// @ts-check
// Resolução, leitura e listagem de componentes do repositório.
const fs = require("fs");
const path = require("path");
const { FORBIDDEN_DIRS, MAX_FILE_SIZE } = require("./component-resolver-store");
const { isInside, findTsFiles, normalizeComponentName } = require("./component-resolver-utils");
const { parseComponentMetadata } = require("./component-resolver-parse");

/**
 * Resolve os arquivos e metadados de um componente Angular dentro do repositório.
 * @param {string} repoRoot
 * @param {string} className
 * @param {object} [options]
 * @param {string} [options.appCwd] Subpasta onde o app vive (ex: 'dispensacao-novo/dispensacao-web')
 * @param {object} [options.deps] Injeção de fs/path para testes
 */
function resolveComponent(repoRoot, className, options = {}) {
  const deps = options.deps || { fs, path };
  if (!className || typeof className !== "string" || !/^[A-Za-z0-9_ɵ$-]+$/.test(className)) {
    throw new Error("Nome de componente inválido");
  }

  const resolvedRoot = deps.path.resolve(repoRoot);
  if (!deps.fs.existsSync(resolvedRoot)) {
    throw new Error("Diretório do repositório não encontrado");
  }

  // Se houver subpasta do app (appCwd), foca a busca nela, mantendo repoRoot como teto de segurança
  const searchRoot = options.appCwd
    ? deps.path.resolve(resolvedRoot, options.appCwd)
    : resolvedRoot;

  if (!isInside(resolvedRoot, searchRoot)) {
    throw new Error("appCwd aponta para fora do repositório");
  }

  const normalized = normalizeComponentName(className);
  const isSelector = className.includes("-");
  const tsFiles = findTsFiles(searchRoot, deps);

  for (const filePath of tsFiles) {
    let content = "";
    try {
      content = deps.fs.readFileSync(filePath, "utf8");
    } catch {
      continue;
    }

    let isMatch = false;
    if (isSelector) {
      isMatch = content.includes(`'${className}'`) || content.includes(`"${className}"`) || content.includes(`\`${className}\``);
    } else {
      isMatch = content.includes(`class ${className}`) || (normalized && content.includes(`class ${normalized}`));
    }

    if (isMatch) {
      const meta = parseComponentMetadata(content, className) || (normalized ? parseComponentMetadata(content, normalized) : null);
      if (meta) {
        const fileDir = deps.path.dirname(filePath);
        const relTs = deps.path.relative(resolvedRoot, filePath).replace(/\\/g, "/");

        let relHtml = null;
        let htmlSize = 0;
        if (meta.templateUrl) {
          const absHtml = deps.path.resolve(fileDir, meta.templateUrl);
          if (isInside(resolvedRoot, absHtml) && deps.fs.existsSync(absHtml)) {
            relHtml = deps.path.relative(resolvedRoot, absHtml).replace(/\\/g, "/");
            try {
              htmlSize = deps.fs.statSync(absHtml).size;
            } catch {}
          }
        }

        const styles = [];
        for (const styleUrl of meta.styleUrls) {
          const absStyle = deps.path.resolve(fileDir, styleUrl);
          if (isInside(resolvedRoot, absStyle) && deps.fs.existsSync(absStyle)) {
            const relStyle = deps.path.relative(resolvedRoot, absStyle).replace(/\\/g, "/");
            let styleSize = 0;
            try {
              styleSize = deps.fs.statSync(absStyle).size;
            } catch {}
            styles.push({ path: relStyle, size: styleSize });
          }
        }

        let tsSize = 0;
        try {
          tsSize = deps.fs.statSync(filePath).size;
        } catch {}

        return {
          found: true,
          className: meta.className,
          selector: meta.selector,
          standalone: meta.standalone,
          files: {
            ts: { path: relTs, size: tsSize },
            html: relHtml ? { path: relHtml, size: htmlSize } : null,
            inlineTemplate: meta.inlineTemplate !== null,
            inlineStyles: meta.inlineStyles || [],
            styles,
          },
        };
      }
    }
  }

  return { found: false, className: normalized || className, files: null };
}

/**
 * Lê o conteúdo de um arquivo do repositório com confinamento estrito e limite de tamanho.
 * @param {string} repoRoot
 * @param {string} relativePath
 * @param {object} [options]
 * @param {object} [options.deps] Injeção de fs/path para testes
 */
function readComponentFile(repoRoot, relativePath, options = {}) {
  const deps = options.deps || { fs, path };
  if (!relativePath || typeof relativePath !== "string") {
    throw new Error("Caminho de arquivo inválido");
  }

  // Previne caracteres nulos
  if (relativePath.includes("\0")) {
    throw new Error("Caminho contém caractere nulo proibido");
  }

  // Previne travessia de diretório codificada (%2e ou %2E)
  if (/%2e/i.test(relativePath)) {
    throw new Error("Acesso negado: travessia de diretório codificada (%2e) proibida");
  }

  // Rejeita caminhos absolutos (Windows C:\ ou /etc ou UNC \\)
  if (
    deps.path.isAbsolute(relativePath) ||
    /^[A-Za-z]:[\\/]/.test(relativePath) ||
    relativePath.startsWith("\\\\") ||
    relativePath.startsWith("/") ||
    relativePath.startsWith("\\")
  ) {
    throw new Error("Acesso negado: caminhos absolutos não são permitidos");
  }

  // Previne travessia com ..
  const normalizedRel = relativePath.replace(/\\/g, "/");
  const segments = normalizedRel.split("/").filter(Boolean);
  if (segments.includes("..")) {
    throw new Error("Acesso negado: tentativa de leitura fora do repositório");
  }

  // Previne acesso a pastas de sistema/dependências/build
  for (const seg of segments) {
    if (FORBIDDEN_DIRS.has(seg)) {
      throw new Error(`Acesso negado: leitura em pasta protegida (${seg}) é proibida`);
    }
  }

  // Previne leitura de arquivos de segredo/ambiente .env*
  const fileName = segments[segments.length - 1] || "";
  if (fileName === ".env" || fileName.startsWith(".env.") || fileName.startsWith(".env")) {
    throw new Error("Acesso negado: leitura de arquivos de configuração .env é proibida");
  }

  const resolvedRoot = deps.path.resolve(repoRoot);
  const targetFile = deps.path.resolve(resolvedRoot, relativePath);

  if (!isInside(resolvedRoot, targetFile)) {
    throw new Error("Acesso negado: tentativa de leitura fora do repositório");
  }

  // Verifica link simbólico apontando para fora do repositório
  try {
    const lstat = deps.fs.lstatSync(targetFile);
    if (lstat.isSymbolicLink()) {
      const realTarget = deps.fs.realpathSync(targetFile);
      if (!isInside(resolvedRoot, realTarget)) {
        throw new Error("Acesso negado: link simbólico aponta para fora do repositório");
      }
    }
  } catch (err) {
    if (err.message && err.message.includes("Acesso negado")) throw err;
  }

  if (!deps.fs.existsSync(targetFile)) {
    throw new Error("Arquivo não encontrado");
  }

  const stat = deps.fs.statSync(targetFile);
  if (!stat.isFile()) {
    throw new Error("O caminho especificado não é um arquivo comum");
  }

  if (stat.size > MAX_FILE_SIZE) {
    throw new Error("Arquivo excede o tamanho máximo permitido (500 KB)");
  }

  const content = deps.fs.readFileSync(targetFile, "utf8");
  return {
    path: normalizedRel,
    size: stat.size,
    content,
  };
}

/**
 * Lista todos os componentes Angular encontrados no repositório.
 * @param {string} repoRoot
 * @param {object} [options]
 * @param {string} [options.appCwd]
 * @param {object} [options.deps]
 */
function listComponents(repoRoot, options = {}) {
  const deps = options.deps || { fs, path };
  const resolvedRoot = deps.path.resolve(repoRoot);
  if (!deps.fs.existsSync(resolvedRoot)) return [];

  const searchRoot = options.appCwd
    ? deps.path.resolve(resolvedRoot, options.appCwd)
    : resolvedRoot;

  if (!isInside(resolvedRoot, searchRoot)) return [];

  const components = [];
  const tsFiles = findTsFiles(searchRoot, deps);
  for (const filePath of tsFiles) {
    let content = "";
    try {
      content = deps.fs.readFileSync(filePath, "utf8");
    } catch {
      continue;
    }

    if (content.includes("@Component")) {
      const classMatches = content.matchAll(/export\s+class\s+([A-Za-z0-9_]+)\b/g);
      for (const m of classMatches) {
        const className = m[1];
        const meta = parseComponentMetadata(content, className);
        if (meta) {
          components.push({
            className,
            selector: meta.selector || null,
            relTs: deps.path.relative(resolvedRoot, filePath).replace(/\\/g, "/"),
            standalone: meta.standalone,
          });
        }
      }
    }
  }

  return components.sort((a, b) => a.className.localeCompare(b.className));
}

module.exports = { resolveComponent, readComponentFile, listComponents };
