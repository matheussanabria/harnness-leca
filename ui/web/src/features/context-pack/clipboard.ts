// Clipboard helper with a fallback for environments without the modern Clipboard API.
export interface ClipboardEnv {
  navigator: typeof navigator;
  document: typeof document;
}

interface ClipboardLike {
  writeText(text: string): Promise<void>;
}

interface DocumentLike {
  createElement(tag: string): HTMLTextAreaElement;
  execCommand(command: string): boolean;
  body: HTMLElement;
}

function clipboardOf(nav: typeof navigator): ClipboardLike | null {
  const candidate = (nav as { clipboard?: Partial<ClipboardLike> }).clipboard;
  if (candidate && typeof candidate.writeText === "function") return candidate as ClipboardLike;
  return null;
}

/**
 * Copies text to the clipboard and reports whether it worked.
 *
 * Uses `navigator.clipboard.writeText` when available and falls back to a hidden
 * textarea plus `document.execCommand("copy")`. It never throws: every failure
 * resolves to `false`.
 */
export async function copyText(text: string, env?: ClipboardEnv): Promise<boolean> {
  try {
    const nav = env?.navigator ?? navigator;
    const doc = env?.document ?? document;

    const clipboard = clipboardOf(nav);
    if (clipboard) {
      try {
        await clipboard.writeText(text);
        return true;
      } catch {
        // Permission denied or a rejected write: try the legacy path.
      }
    }

    return legacyCopy(text, doc as unknown as DocumentLike);
  } catch {
    return false;
  }
}

/** Legacy fallback: a hidden textarea holding the text, selected and copied in one command. */
function legacyCopy(text: string, doc: DocumentLike): boolean {
  const textarea = doc.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.left = "-9999px";
  textarea.style.top = "-9999px";
  doc.body.appendChild(textarea);
  try {
    textarea.focus();
    textarea.select();
    return doc.execCommand("copy");
  } catch {
    return false;
  } finally {
    doc.body.removeChild(textarea);
  }
}
