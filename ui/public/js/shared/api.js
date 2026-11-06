// @ts-check

/**
 * Cliente de API HTTP e SSE para o servidor do Harness.
 */

export async function fetchJson(url, options = {}) {
  const res = await fetch(url, options);
  if (!res.ok) {
    let errBody = "";
    try {
      errBody = await res.text();
    } catch {}
    throw new Error(`Erro ${res.status}: ${errBody || res.statusText}`);
  }
  return res.json();
}

export function apiGetState() {
  return fetchJson("/api/state");
}

export function apiGetProject(slug) {
  return fetchJson(`/api/project?name=${encodeURIComponent(slug)}`);
}

export function apiGetFile(path) {
  return fetchJson(`/api/file?path=${encodeURIComponent(path)}`);
}

export function apiGetEngines() {
  return fetchJson("/api/engines");
}

export function apiGetDai() {
  return fetchJson("/api/dai");
}

export function apiGetRemoteInfo() {
  return fetchJson("/api/remote/info");
}

export function apiSaveChat(payload) {
  return fetchJson("/api/chat/save", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export function apiGetReviewSuggestions(slug) {
  return fetchJson(`/api/project/${encodeURIComponent(slug)}/review/suggestions`);
}

export function apiApplyReview(slug, acoes) {
  return fetchJson(`/api/project/${encodeURIComponent(slug)}/review/apply`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ acoes }),
  });
}

export function apiSaveGroups(slug, groups, assignments) {
  return fetchJson(`/api/project/${encodeURIComponent(slug)}/groups`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ groups, assignments }),
  });
}

export function apiClassifyGroup(slug, payload) {
  return fetchJson(`/api/project/${encodeURIComponent(slug)}/groups/classify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export function apiGetServices(slug) {
  return fetchJson(`/api/project/${encodeURIComponent(slug)}/services`);
}

export function apiStartService(slug, id) {
  return fetchJson(`/api/project/${encodeURIComponent(slug)}/services/${encodeURIComponent(id)}/start`, {
    method: "POST",
  });
}

export function apiStopService(slug, id) {
  return fetchJson(`/api/project/${encodeURIComponent(slug)}/services/${encodeURIComponent(id)}/stop`, {
    method: "POST",
  });
}

export function apiGetServiceLogs(slug, id) {
  return fetchJson(`/api/project/${encodeURIComponent(slug)}/services/${encodeURIComponent(id)}/logs`);
}

export function apiGetSkills(slug) {
  return fetchJson(`/api/project/${encodeURIComponent(slug)}/skills`);
}

export function apiSaveSkill(slug, target, name, content) {
  return fetchJson(`/api/project/${encodeURIComponent(slug)}/skills`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ target, name, content }),
  });
}

export function apiDeleteSkill(slug, target, name) {
  return fetchJson(
    `/api/project/${encodeURIComponent(slug)}/skills?target=${encodeURIComponent(target)}&name=${encodeURIComponent(name)}`,
    { method: "DELETE" }
  );
}

export function apiInstallSkillBundle(slug, target, bundle) {
  return fetchJson(`/api/project/${encodeURIComponent(slug)}/skills/bundle`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ target, bundle }),
  });
}

export function apiInstallSkillTemplate(slug, target, template) {
  return fetchJson(`/api/project/${encodeURIComponent(slug)}/skills/template`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ target, template }),
  });
}

export function apiGetRecognizedSkills() {
  return fetchJson("/api/skills/recognized");
}

export function apiImportSkill(slug, target, name, sourcePath) {
  return fetchJson(`/api/project/${encodeURIComponent(slug)}/skills/import`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ target, name, sourcePath }),
  });
}

export function apiCloneSkill(slug, target, sourceTarget, name) {
  return fetchJson(`/api/project/${encodeURIComponent(slug)}/skills/clone`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ target, sourceTarget, name }),
  });
}

/**
 * Lê SSE de streaming linha a linha.
 * @param {Response} response
 * @param {(event: string, data: any) => void} onEvent
 */
export async function readSSEStream(response, onEvent) {
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n\n");
    buffer = lines.pop() || "";

    for (const chunk of lines) {
      if (!chunk.trim()) continue;
      let eventType = "message";
      let data = "";
      for (const line of chunk.split("\n")) {
        if (line.startsWith("event: ")) {
          eventType = line.slice(7).trim();
        } else if (line.startsWith("data: ")) {
          data += (data ? "\n" : "") + line.slice(6);
        }
      }
      try {
        const parsed = JSON.parse(data);
        onEvent(eventType, parsed);
      } catch {
        onEvent(eventType, data);
      }
    }
  }
}
