// @ts-check
// Máquina de estados de atividade, decaimento por tempo e dwell time (EP-09.06).

/**
 * @typedef {"lendo" | "planejando" | "pensando" | "executando" | "testando" | "aguardando_resposta" | "hibernando" | "inativo"} AtividadeEstado
 */

/**
 * @typedef {{
 *   estado: AtividadeEstado,
 *   desde: string,
 *   ultimaAtividadeMs: number,
 *   detalhe?: string,
 *   stale?: boolean,
 *   candidatoEstado?: AtividadeEstado,
 *   candidatoDesdeMs?: number
 * }} EstadoInstancia
 */

/**
 * Cria um estado inicial para um motor ou sessão.
 * @param {number} [nowMs=Date.now()]
 * @param {string} [detalhe="offline"]
 * @returns {EstadoInstancia}
 */
function createInitialState(nowMs = Date.now(), detalhe = "offline") {
  return {
    estado: "inativo",
    desde: new Date(nowMs).toISOString(),
    ultimaAtividadeMs: nowMs,
    detalhe,
    stale: false,
  };
}

/**
 * Atualiza o estado da máquina aplicando regras de transição, minDwellMs e decaimento por tempo.
 * @param {EstadoInstancia} atual
 * @param {{
 *   novoEstado?: AtividadeEstado,
 *   nowMs: number,
 *   presenca: "online" | "offline",
 *   minDwellMs: number,
 *   hibernateAfterMs: number,
 *   inactiveAfterMs: number,
 *   staleAfterMs: number
 * }} params
 * @returns {EstadoInstancia}
 */
function stepActivityMachine(atual, params) {
  const {
    novoEstado,
    nowMs,
    presenca,
    minDwellMs,
    hibernateAfterMs,
    inactiveAfterMs,
    staleAfterMs,
  } = params;

  // Se o motor está offline, força inativo com detalhe offline
  if (presenca === "offline") {
    if (atual.estado === "inativo" && atual.detalhe === "offline") {
      return atual;
    }
    return {
      estado: "inativo",
      desde: new Date(nowMs).toISOString(),
      ultimaAtividadeMs: atual.ultimaAtividadeMs,
      detalhe: "offline",
      stale: false,
    };
  }

  // 1. Processamento de novo evento ativo
  if (novoEstado && novoEstado !== atual.estado) {
    if (atual.candidatoEstado === novoEstado) {
      const dwell = nowMs - (atual.candidatoDesdeMs || nowMs);
      if (dwell >= minDwellMs) {
        // Transição aprovada pelo dwell time
        return {
          estado: novoEstado,
          desde: new Date(nowMs).toISOString(),
          ultimaAtividadeMs: nowMs,
          detalhe: undefined,
          stale: false,
          candidatoEstado: undefined,
          candidatoDesdeMs: undefined,
        };
      }
      return atual;
    } else {
      // Começa contagem de dwell para o candidato
      return {
        ...atual,
        candidatoEstado: novoEstado,
        candidatoDesdeMs: nowMs,
      };
    }
  }

  // Se recebeu o mesmo evento que já é o estado atual, renova a recência de atividade
  let ultimaAtividade = atual.ultimaAtividadeMs;
  if (novoEstado && novoEstado === atual.estado) {
    ultimaAtividade = nowMs;
  }

  // 2. Regra de aguardando_resposta: não decai para hibernando/inativo, mas ganha marcação de stale
  if (atual.estado === "aguardando_resposta") {
    const semResposta = nowMs - ultimaAtividade;
    const isStale = semResposta >= staleAfterMs;
    if (atual.stale !== isStale) {
      return {
        ...atual,
        ultimaAtividadeMs: ultimaAtividade,
        stale: isStale,
      };
    }
    return atual;
  }

  // 3. Decaimento por tempo (somente sem trabalho em curso)
  const tempoInativo = nowMs - ultimaAtividade;

  if (tempoInativo >= inactiveAfterMs && atual.estado !== "inativo") {
    return {
      estado: "inativo",
      desde: new Date(nowMs).toISOString(),
      ultimaAtividadeMs: ultimaAtividade,
      detalhe: undefined,
      stale: false,
    };
  }

  if (tempoInativo >= hibernateAfterMs && atual.estado !== "hibernando" && atual.estado !== "inativo") {
    return {
      estado: "hibernando",
      desde: new Date(nowMs).toISOString(),
      ultimaAtividadeMs: ultimaAtividade,
      detalhe: undefined,
      stale: false,
    };
  }

  return {
    ...atual,
    ultimaAtividadeMs: ultimaAtividade,
  };
}

module.exports = {
  createInitialState,
  stepActivityMachine,
};
