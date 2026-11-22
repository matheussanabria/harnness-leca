// Validation of a Mermaid source (EP-21.03): size, header and `mermaid.parse`, with a short message and the source
// line when it fails. One of the two modules allowed to import Mermaid (the other is render.ts); the import is lazy.
import { ensureInitialized, type MermaidLoader } from "./config.ts";
import { detectType, isSupported } from "./detect.ts";
import { describeParseError, detectionMessage, emptyMessage, tooLargeMessage } from "./errors.ts";
import type { ValidationResult } from "./types.ts";
import { MAX_SOURCE_BYTES } from "./types.ts";

const loadMermaid: MermaidLoader = async () =>
  (await import("mermaid")).default as unknown as Awaited<ReturnType<MermaidLoader>>;

/** `load` is injectable so tests can supply a fake or a real library served by a test page. */
export function createValidator(load: MermaidLoader = loadMermaid) {
  return async function validate(source: string): Promise<ValidationResult> {
    const bytes = new TextEncoder().encode(source).length;
    if (bytes > MAX_SOURCE_BYTES) return { ok: false, message: tooLargeMessage(bytes) };
    if (source.trim() === "") return { ok: false, message: emptyMessage() };

    const detection = detectType(source);
    if (detection.kind !== "supported") return { ok: false, message: detectionMessage(detection) };

    try {
      const mermaid = await load();
      ensureInitialized(mermaid);
      const parsed = (await mermaid.parse(source)) as { diagramType?: unknown } | undefined;
      // The parser is the authority on the type; our list only decides which ones the editor offers.
      const type = typeof parsed?.diagramType === "string" ? parsed.diagramType : detection.type;
      if (!isSupported(type))
        return { ok: false, message: detectionMessage({ kind: "refused", reason: "unsupported", header: type }) };
      return { ok: true, type };
    } catch (error) {
      return { ok: false, ...describeParseError(error, source) };
    }
  };
}

export const validateDiagram = createValidator();
