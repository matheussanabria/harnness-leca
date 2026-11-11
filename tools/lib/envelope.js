// @ts-check
// Remove blocos que o IDE ou o harness injetam na mensagem do usuario e que nao fazem parte da fala dele.
const NOISE = /<(system-reminder|ide_[a-z_]+|command-[a-z-]+|local-command-[a-z-]+|project-harness|contexto_do_harness|task-notification)>[\s\S]*?<\/\1>/g;

/** @param {string} text */
const stripEnvelope = (text) => String(text || "").replace(NOISE, "").trim();

// Titulo vindo da fonte que ainda carrega o envelope (ou so um traco): nao serve, use a primeira fala real.
/** @param {string} title */
const isEnvelopeTitle = (title) => /^[-\s]*<contexto_do_harness/i.test(String(title || ""));

module.exports = { stripEnvelope, isEnvelopeTitle };
