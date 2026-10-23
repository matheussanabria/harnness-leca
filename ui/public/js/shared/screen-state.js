// @ts-check
// Cliente único de estado das telas (EP-14.06): hidrata antes da primeira
// renderização, grava com debounce, usa localStorage como reserva e migra as
// chaves antigas na primeira carga.
import { isKnownScreen, readLegacyScreenState, removeLegacyKeys, screenScope } from "./screen-state-migrate.js";

const DEBOUNCE_MS = 400, RETRY_MS = 5000, MAX_RETRY_MS = 60000, REQUEST_TIMEOUT_MS = 2000;
const FALLBACK_PREFIX = "leca.screen-state.v1";

function cloneRecord(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  try {
    const parsed = JSON.parse(JSON.stringify(value));
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    delete parsed.__proto__; delete parsed.constructor; delete parsed.prototype;
    return parsed; } catch { return null; }
}

const mergeState = (base, patch) => {
  const safeBase = cloneRecord(base) || {}, safePatch = cloneRecord(patch);
  return safePatch ? { ...safeBase, ...safePatch } : safeBase;
};

function payloadState(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return {};
  const candidate = payload.state;
  if (candidate && typeof candidate === "object" && !Array.isArray(candidate)) return cloneRecord(candidate) || {};
  const direct = cloneRecord(payload) || {}; delete direct.rev; return direct;
}

const payloadRev = (payload, fallback) => {
  const value = payload && typeof payload === "object" ? payload.rev : undefined;
  return Number.isFinite(value) ? Number(value) : fallback;
};

const slugSeguro = (value) => String(value || "global").trim().replace(/[^A-Za-z0-9._-]+/g, "_") || "global";
const fallbackKey = (id, scope, project) => `${FALLBACK_PREFIX}:${scope}:${scope === "projeto" ? slugSeguro(project) : "global"}:${id}`;

export class ScreenStateClient {
  constructor(options = {}) {
    this.options = options; this.entries = new Map(); this.pendingActions = [];
    this.retryTimer = null; this.retryDelay = RETRY_MS; this.listening = false;
    this.handlePagehide = () => this.#beaconPending();
  }
  async loadScreen(id) { return cloneRecord((await this.#entryFor(id)).state) || {}; }
  async patchScreen(id, parcial) {
    const patch = cloneRecord(parcial);
    if (!patch) throw new TypeError("patchScreen exige um objeto de estado.");
    const entry = await this.#entryFor(id);
    entry.state = mergeState(entry.state, patch);
    entry.pending = true;
    this.#writeFallback(entry);
    this.#scheduleSave(entry);
    return cloneRecord(entry.state) || {};
  }

  async logAction(id, acao, alvo = "") {
    if (!isKnownScreen(id)) throw new TypeError(`Tela desconhecida: ${id}`);
    const action = typeof acao === "string" ? acao.trim() : "";
    if (!action) throw new TypeError("logAction exige o nome da ação.");
    const entry = this.#ensureEntry(id);
    const payload = {
      acao: action, alvo: alvo == null ? "" : String(alvo),
      ts: Number(this.options.now ? this.options.now() : Date.now()),
      ...(entry.scope === "projeto" ? { project: entry.project } : {}),
    };
    const ok = await this.#postHistory(entry, payload);
    if (!ok) { this.pendingActions.push({ entry, payload }); this.#scheduleRetry(); }
    return ok;
  }

  destroy() {
    for (const entry of this.entries.values()) this.#clearTimer(entry);
    if (this.retryTimer) clearTimeout(this.retryTimer);
    this.retryTimer = null; this.entries.clear(); this.pendingActions = []; this.listening = false;
  }
  #ensureEntry(id) {
    if (!isKnownScreen(id)) throw new TypeError(`Tela desconhecida: ${id}`);
    const scope = screenScope(id), project = this.#project(scope), key = `${id}@${scope}:${project}`;
    let entry = this.entries.get(key);
    if (!entry) {
      entry = { id, scope, project, state: {}, rev: 0, pending: false, hydrated: false,
        promise: null, timer: null, saving: null, queued: false };
      this.entries.set(key, entry);
    }
    return entry;
  }
  async #entryFor(id) {
    const entry = this.#ensureEntry(id);
    this.#listen();
    if (!entry.hydrated) {
      if (!entry.promise) entry.promise = this.#hydrate(entry).finally(() => { entry.promise = null; });
      await entry.promise;
    }
    return entry;
  }
  async #hydrate(entry) {
    const storage = this.#storage(), legacy = readLegacyScreenState(entry.id, { storage, project: entry.project });
    const fallback = this.#readFallback(entry), server = await this.#fetchState(entry);
    if (server) {
      entry.rev = server.rev;
      entry.state = fallback.pending ? mergeState(server.state, fallback.state) : mergeState(legacy.state, server.state);
      entry.pending = fallback.pending || legacy.keys.length > 0;
    } else {
      entry.rev = fallback.rev;
      entry.state = mergeState(legacy.state, fallback.state);
      entry.pending = true;
    }
    entry.hydrated = true;
    const persisted = this.#writeFallback(entry);
    if (legacy.keys.length) {
      const sent = entry.pending && server ? await this.#save(entry) : false;
      if (sent || persisted) removeLegacyKeys(legacy.keys, storage);
    }
    if (!server || entry.pending) this.#scheduleRetry();
    return entry;
  }
  #project(scope) {
    if (scope === "global") return "global";
    if (typeof this.options.project === "string" && this.options.project.trim()) return this.options.project.trim();
    try {
      const fromUrl = new URL((this.options.location || globalThis.location).href).searchParams.get("p");
      if (fromUrl) return fromUrl.trim();
    } catch {}
    try {
      const stored = this.#storage()?.getItem("harness_active_project");
      if (stored) return String(stored).trim();
    } catch {}
    return "global";
  }
  #storage() {
    if (this.options.storage !== undefined) return this.options.storage;
    try { return globalThis.localStorage || null; } catch { return null; }
  }
  #fetchImpl() {
    if (this.options.fetchImpl !== undefined) return this.options.fetchImpl;
    return typeof globalThis.fetch === "function" ? globalThis.fetch.bind(globalThis) : null;
  }
  #listen() {
    if (this.listening) return;
    this.listening = true;
    (this.options.eventTarget || globalThis.window)?.addEventListener?.("pagehide", this.handlePagehide);
  }
  #stateUrl(entry) {
    return `/api/screens/${encodeURIComponent(entry.id)}/state` +
      (entry.scope === "projeto" ? `?project=${encodeURIComponent(entry.project)}` : "");
  }
  #stateBody(entry) {
    return { ...(entry.scope === "projeto" ? { project: entry.project } : {}), state: entry.state, rev: entry.rev };
  }
  async #fetchState(entry) {
    const fetchImpl = this.#fetchImpl();
    if (!fetchImpl) return null;
    const controller = typeof AbortController === "function" ? new AbortController() : null;
    const timer = controller ? setTimeout(() => controller.abort(), Number(this.options.requestTimeoutMs || REQUEST_TIMEOUT_MS)) : null;
    timer?.unref?.();
    try {
      const response = await fetchImpl(this.#stateUrl(entry), {
        method: "GET", headers: { Accept: "application/json" }, signal: controller?.signal,
      });
      if (!response?.ok) return null;
      const payload = await response.json();
      return { state: payloadState(payload), rev: payloadRev(payload, 0) };
    } catch { return null; } finally { if (timer) clearTimeout(timer); }
  }
  #readFallback(entry) {
    try {
      const raw = this.#storage()?.getItem(fallbackKey(entry.id, entry.scope, entry.project));
      if (!raw) return { state: {}, rev: 0, pending: false };
      const parsed = JSON.parse(raw);
      return { state: cloneRecord(parsed?.state) || {}, rev: Number.isFinite(parsed?.rev) ? Number(parsed.rev) : 0,
        pending: parsed?.pending === true };
    } catch { return { state: {}, rev: 0, pending: false }; }
  }
  #writeFallback(entry) {
    try {
      const storage = this.#storage();
      if (!storage) return false;
      storage.setItem(fallbackKey(entry.id, entry.scope, entry.project),
        JSON.stringify({ state: entry.state, rev: entry.rev, pending: entry.pending }));
      return true;
    } catch { return false; }
  }
  #scheduleSave(entry) {
    this.#clearTimer(entry);
    const timer = setTimeout(() => { entry.timer = null; this.#save(entry); },
      Number(this.options.debounceMs || DEBOUNCE_MS));
    timer?.unref?.();
    entry.timer = timer;
  }
  #clearTimer(entry) {
    if (entry.timer) clearTimeout(entry.timer);
    entry.timer = null;
  }
  async #save(entry) {
    if (entry.saving) { entry.queued = true; return entry.saving; }
    entry.saving = this.#doSave(entry);
    const ok = await entry.saving;
    entry.saving = null;
    if (entry.queued) { entry.queued = false; if (ok) this.#scheduleSave(entry); }
    return ok;
  }
  async #doSave(entry, tentarConflito = true) {
    const fetchImpl = this.#fetchImpl();
    if (!fetchImpl) { entry.pending = true; this.#writeFallback(entry); this.#scheduleRetry(); return false; }
    try {
      const response = await fetchImpl(this.#stateUrl(entry), {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(this.#stateBody(entry)),
      });
      if (response?.status === 409 && tentarConflito) {
        const latest = await this.#fetchState(entry);
        if (!latest) throw new Error("Conflito sem estado atualizado.");
        entry.rev = latest.rev;
        entry.state = mergeState(latest.state, entry.state);
        return this.#doSave(entry, false);
      }
      if (!response?.ok) throw new Error(`Falha ao salvar estado (${response?.status || 0}).`);
      let payload = null;
      try { payload = await response.json(); } catch {}
      entry.rev = payloadRev(payload, entry.rev);
      entry.pending = false;
      this.retryDelay = RETRY_MS;
      this.#writeFallback(entry);
      return true;
    } catch {
      entry.pending = true;
      this.#writeFallback(entry);
      this.#scheduleRetry();
      return false;
    }
  }
  async #postHistory(entry, payload) {
    const fetchImpl = this.#fetchImpl();
    if (!fetchImpl) return false;
    try {
      const response = await fetchImpl(`/api/screens/${encodeURIComponent(entry.id)}/history`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
      });
      return Boolean(response?.ok);
    } catch { return false; }
  }
  #scheduleRetry() {
    if (this.retryTimer) return;
    const timer = setTimeout(() => { this.retryTimer = null; this.#retryPending(); },
      this.options.retryDelayMs || this.retryDelay);
    timer?.unref?.();
    this.retryTimer = timer;
    this.retryDelay = Math.min(MAX_RETRY_MS, Math.max(RETRY_MS, this.retryDelay * 2));
  }
  async #retryPending() {
    for (const entry of this.entries.values()) {
      if (entry.hydrated && entry.pending && !entry.saving) await this.#save(entry);
    }
    const actions = this.pendingActions;
    this.pendingActions = [];
    for (const item of actions) {
      if (!(await this.#postHistory(item.entry, item.payload))) this.pendingActions.push(item);
    }
    if (this.pendingActions.length || [...this.entries.values()].some((entry) => entry.pending)) this.#scheduleRetry();
  }
  #beaconPending() {
    for (const entry of this.entries.values()) {
      if (!entry.hydrated || !entry.pending) continue;
      this.#writeFallback(entry);
      this.#sendBeacon(entry);
    }
  }
  #sendBeacon(entry) {
    const navigatorRef = this.options.navigator || globalThis.navigator;
    const body = JSON.stringify(this.#stateBody(entry));
    try {
      if (typeof navigatorRef?.sendBeacon === "function") {
        const blob = typeof Blob === "function" ? new Blob([body], { type: "application/json" }) : body;
        if (navigatorRef.sendBeacon(this.#stateUrl(entry), blob)) return true;
      }
    } catch {}
    const fetchImpl = this.#fetchImpl();
    if (!fetchImpl) return false;
    try {
      fetchImpl(this.#stateUrl(entry), {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body, keepalive: true,
      });
      return true;
    } catch { return false; }
  }
}

let singleton = null;

export function createScreenStateClient(options = {}) { return new ScreenStateClient(options); }

export function getScreenStateClient(options) {
  if (!singleton || options) singleton = new ScreenStateClient(options || {});
  return singleton;
}

export function loadScreen(id) { return getScreenStateClient().loadScreen(id); }
export function patchScreen(id, parcial) { return getScreenStateClient().patchScreen(id, parcial); }
export function logAction(id, acao, alvo = "") { return getScreenStateClient().logAction(id, acao, alvo); }
