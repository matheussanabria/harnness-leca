// @ts-check
// Anexos do chat: arquivos, imagens (galeria, câmera ou colar) e gravação de áudio.
// Cada anexo sobe na hora para projects/<slug>/context/uploads/ e o caminho vai no prompt para o motor ler o arquivo.
import { $, esc, showToast } from "../shared/dom.js";
import { state } from "../shared/state.js";

/** @type {{ id: number, name: string, path?: string, kind: string, thumb?: string, error?: string, transcript?: string }[]} */
let items = [];
let seq = 0;
let recorder = null;
let recStream = null;
let recChunks = [];
let recTimer = null;
let recStart = 0;
let recognition = null;
let transcript = "";

export const attachmentsBusy = () => items.some((a) => !a.path && !a.error);
export const hasAttachments = () => items.some((a) => a.path);

function render() {
  const trays = [$("chatAttachTray"), $("studioChatAttachTray"), $("miniChatAttachTray")].filter(Boolean);
  if (!trays.length) return;
  const html = items
    .map((a) => {
      const icon = a.thumb
        ? `<img src="${a.thumb}" alt="">`
        : `<span class="att-ico">${a.kind === "audio" ? '<i class="fa-solid fa-microphone"></i>' : '<i class="fa-regular fa-file"></i>'}</span>`;
      const st = a.error ? `<span class="att-err">${esc(a.error)}</span>` : !a.path ? '<span class="att-wait">enviando…</span>' : "";
      return `<div class="att-chip ${a.error ? "bad" : ""}">${icon}<span class="att-name">${esc(a.name)}</span>${st}<button type="button" aria-label="Remover" onclick="removeChatAttachment(${a.id})"><i class="fa-solid fa-xmark"></i></button></div>`;
    })
    .join("");
  trays.forEach((tray) => {
    tray.style.display = items.length ? "flex" : "none";
    tray.innerHTML = html;
  });
}

const readThumb = (file) =>
  new Promise((resolve) => {
    if (!file.type.startsWith("image/") || file.size > 8 * 1024 * 1024) return resolve(undefined);
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => resolve(undefined);
    r.readAsDataURL(file);
  });

async function upload(file, name, extra = {}) {
  const P = state.P;
  if (!P) return showToast("Abra um projeto antes de anexar.");
  const kind = file.type.startsWith("image/") ? "image" : file.type.startsWith("audio/") ? "audio" : "file";
  const item = { id: ++seq, name, kind, ...extra };
  items.push(item);
  render();
  readThumb(file).then((t) => {
    if (t) {
      item.thumb = t;
      render();
    }
  });
  try {
    const res = await fetch(`/api/chat/upload?slug=${encodeURIComponent(P.slug)}&name=${encodeURIComponent(name)}`, {
      method: "POST",
      headers: { "Content-Type": "application/octet-stream" },
      body: file,
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(j.error || `HTTP ${res.status}`);
    item.path = j.path;
  } catch (err) {
    item.error = err.message || "falhou";
  }
  render();
}

export function pickChatFiles() {
  const inp = $("chatFileInput");
  if (inp) inp.click();
}

export function onChatFilesChosen(input) {
  for (const f of Array.from(input.files || [])) upload(f, f.name);
  input.value = "";
}

export function onChatPaste(e) {
  const files = Array.from(e.clipboardData?.files || []);
  if (!files.length) return;
  e.preventDefault();
  files.forEach((f, i) => {
    const ext = (f.type.split("/")[1] || "png").replace("jpeg", "jpg");
    upload(f, f.name && f.name !== "image.png" ? f.name : `colado-${Date.now()}-${i}.${ext}`);
  });
}

export function removeChatAttachment(id) {
  items = items.filter((a) => a.id !== id);
  render();
}

export function clearChatAttachments() {
  items = [];
  render();
}

/** Nomes dos anexos enviados, para mostrar no balão do usuário e salvar no histórico. */
export const attachmentLabel = () => items.filter((a) => a.path).map((a) => a.name).join("\n");

/** Trecho que vai no prompt: caminhos dos arquivos e, nos áudios, a transcrição ditada quando houver. */
export function attachmentPrompt() {
  const ok = items.filter((a) => a.path);
  if (!ok.length) return "";
  const lines = ok.map((a) => {
    const kind = a.kind === "image" ? "imagem" : a.kind === "audio" ? "áudio" : "arquivo";
    const tr = a.transcript ? `\n  Transcrição do áudio: ${a.transcript}` : "";
    return `- ${kind}: ${a.path}${tr}`;
  });
  return `\n\n[Anexos enviados pelo usuário — abra e analise os arquivos nestes caminhos]\n${lines.join("\n")}`;
}

function setRecUI(on) {
  const b = $("btnRecordChat");
  if (!b) return;
  b.classList.toggle("recording", on);
  b.innerHTML = on ? '<i class="fa-solid fa-stop"></i> 0:00' : '<i class="fa-solid fa-microphone"></i>';
  b.title = on ? "Parar e anexar a gravação" : "Gravar áudio";
}

function startDictation() {
  const w = /** @type {any} */ (window);
  const SR = w.SpeechRecognition || w.webkitSpeechRecognition;
  transcript = "";
  if (!SR) return;
  try {
    recognition = new SR();
    recognition.lang = "pt-BR";
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.onresult = (ev) => {
      for (let i = ev.resultIndex; i < ev.results.length; i++) if (ev.results[i].isFinal) transcript += ev.results[i][0].transcript + " ";
    };
    recognition.onerror = () => {};
    recognition.start();
  } catch {
    recognition = null;
  }
}

export async function toggleChatRecording() {
  if (recorder) {
    recorder.stop();
    return;
  }
  if (!state.P) return showToast("Abra um projeto antes de gravar.");
  if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
    return showToast("Gravação indisponível: o navegador exige HTTPS (ou localhost) e permissão de microfone.");
  }
  try {
    recStream = await navigator.mediaDevices.getUserMedia({ audio: true });
  } catch {
    return showToast("Permissão de microfone negada.");
  }
  recChunks = [];
  recorder = new MediaRecorder(recStream);
  recorder.ondataavailable = (e) => e.data.size && recChunks.push(e.data);
  recorder.onstop = () => {
    clearInterval(recTimer);
    recStream.getTracks().forEach((t) => t.stop());
    if (recognition) {
      try { recognition.stop(); } catch {}
    }
    const type = recorder.mimeType || "audio/webm";
    const ext = type.includes("mp4") ? "m4a" : type.includes("ogg") ? "ogg" : "webm";
    const blob = new Blob(recChunks, { type });
    recorder = null;
    setRecUI(false);
    // O reconhecimento de voz entrega o último trecho logo após o stop.
    setTimeout(() => upload(blob, `audio-${Date.now()}.${ext}`, { transcript: transcript.trim() || undefined }), 400);
  };
  startDictation();
  recorder.start();
  recStart = Date.now();
  setRecUI(true);
  recTimer = setInterval(() => {
    const s = Math.floor((Date.now() - recStart) / 1000);
    const b = $("btnRecordChat");
    if (b) b.textContent = `⏹ ${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
  }, 500);
}
