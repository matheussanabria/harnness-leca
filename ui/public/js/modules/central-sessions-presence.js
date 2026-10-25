// @ts-check
// Activity, presence and origin labels for sessions fed by the EP-09 projection (story T2.5).

import { formatTimestamp } from "./central-sessions-model.js";
import { esc } from "./central-sessions-format.js";

export const ACTIVITY = {
  processing: { label: "Processando", icon: "fa-gear" },
  idle: { label: "Ocioso", icon: "fa-mug-hot" },
  unknown: { label: "Atividade desconhecida", icon: "fa-circle-question" },
};

export const PRESENCE = {
  connected: { label: "Conectada", icon: "fa-plug" },
  no_recent_signal: { label: "Sem sinal recente", icon: "fa-plug-circle-xmark" },
  unknown: { label: "Presença desconhecida", icon: "fa-circle-question" },
};

export const ORIGIN = {
  external: { label: "externa", icon: "fa-arrow-up-right-from-square" },
  harness_chat: { label: "chat do Harness", icon: "fa-comments" },
};

const badge = (item, extra, neutral = false) =>
  `<span class="central-badge central-badge--outline ${extra}${neutral ? " is-neutral" : ""}"><i class="fa-solid ${esc(item.icon)}" aria-hidden="true"></i> ${esc(item.label)}</span>`;

/** Activity and presence badges; empty when the session carries neither (Markdown-only). */
export function presenceBadges(session) {
  const parts = [];
  if (session?.activity) {
    const neutral = !ACTIVITY[session.activity] || session.activity === "unknown";
    parts.push(badge(ACTIVITY[session.activity] || ACTIVITY.unknown, "central-badge--activity", neutral));
  }
  if (session?.presence) {
    const neutral = !PRESENCE[session.presence] || session.presence === "unknown" || session.presence === "no_recent_signal";
    parts.push(badge(PRESENCE[session.presence] || PRESENCE.unknown, "central-badge--presence", neutral));
  }
  return parts.join(" ");
}

/** Origin badge ("externa" or "chat do Harness"); empty when the origin is not known. */
export function originBadge(session) {
  const item = ORIGIN[session?.origin];
  return item ? badge(item, "central-badge--origin") : "";
}

/** "Última atividade" text: the activity signal when present, else the last observation. */
export function lastActivityText(session) {
  return formatTimestamp(session?.lastActivityAt || session?.lastObservedAt);
}
