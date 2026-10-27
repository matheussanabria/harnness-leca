// @ts-check
const test = require("node:test");
const assert = require("node:assert/strict");
const { createInitialState, stepActivityMachine } = require("../tools/lib/engine-monitor/activity-machine");

test("activity-machine: decaimento de tempo para hibernando e inativo", () => {
  const t0 = 1000000;
  let state = createInitialState(t0, "online");
  state.estado = "executando";
  state.ultimaAtividadeMs = t0;

  // Sem atividade por 10 min -> permanece executando
  state = stepActivityMachine(state, {
    nowMs: t0 + 10 * 60 * 1000,
    presenca: "online",
    minDwellMs: 3000,
    hibernateAfterMs: 15 * 60 * 1000,
    inactiveAfterMs: 2 * 60 * 60 * 1000,
    staleAfterMs: 30 * 60 * 1000,
  });
  assert.equal(state.estado, "executando");

  // Sem atividade por 16 min -> decai para hibernando
  state = stepActivityMachine(state, {
    nowMs: t0 + 16 * 60 * 1000,
    presenca: "online",
    minDwellMs: 3000,
    hibernateAfterMs: 15 * 60 * 1000,
    inactiveAfterMs: 2 * 60 * 60 * 1000,
    staleAfterMs: 30 * 60 * 1000,
  });
  assert.equal(state.estado, "hibernando");

  // Sem atividade por 2h10m -> decai para inativo
  state = stepActivityMachine(state, {
    nowMs: t0 + 130 * 60 * 1000,
    presenca: "online",
    minDwellMs: 3000,
    hibernateAfterMs: 15 * 60 * 1000,
    inactiveAfterMs: 2 * 60 * 60 * 1000,
    staleAfterMs: 30 * 60 * 1000,
  });
  assert.equal(state.estado, "inativo");
});

test("activity-machine: aguardando_resposta não decai para hibernando, mas marca stale", () => {
  const t0 = 1000000;
  let state = createInitialState(t0);
  state.estado = "aguardando_resposta";
  state.ultimaAtividadeMs = t0;

  // 40 minutos depois (staleAfterMs = 30m)
  state = stepActivityMachine(state, {
    nowMs: t0 + 40 * 60 * 1000,
    presenca: "online",
    minDwellMs: 3000,
    hibernateAfterMs: 15 * 60 * 1000,
    inactiveAfterMs: 2 * 60 * 60 * 1000,
    staleAfterMs: 30 * 60 * 1000,
  });

  assert.equal(state.estado, "aguardando_resposta", "não deve decair para hibernando");
  assert.equal(state.stale, true, "deve marcar stale após prazo");
});

test("activity-machine: minDwellMs filtra oscilações rápidas", () => {
  const t0 = 1000000;
  let state = createInitialState(t0);
  state.estado = "lendo";

  // Envia "executando" no instante t0 -> não transiciona na hora se minDwellMs = 3000
  state = stepActivityMachine(state, {
    novoEstado: "executando",
    nowMs: t0,
    presenca: "online",
    minDwellMs: 3000,
    hibernateAfterMs: 15 * 60 * 1000,
    inactiveAfterMs: 2 * 60 * 60 * 1000,
    staleAfterMs: 30 * 60 * 1000,
  });
  assert.equal(state.estado, "lendo", "não deve transicionar instantaneamente");

  // Passaram 1 segundo -> ainda em dwell
  state = stepActivityMachine(state, {
    novoEstado: "executando",
    nowMs: t0 + 1000,
    presenca: "online",
    minDwellMs: 3000,
    hibernateAfterMs: 15 * 60 * 1000,
    inactiveAfterMs: 2 * 60 * 60 * 1000,
    staleAfterMs: 30 * 60 * 1000,
  });
  assert.equal(state.estado, "lendo");

  // Passaram 3.5 segundos sustentados -> transição efetivada
  state = stepActivityMachine(state, {
    novoEstado: "executando",
    nowMs: t0 + 3500,
    presenca: "online",
    minDwellMs: 3000,
    hibernateAfterMs: 15 * 60 * 1000,
    inactiveAfterMs: 2 * 60 * 60 * 1000,
    staleAfterMs: 30 * 60 * 1000,
  });
  assert.equal(state.estado, "executando", "deve transicionar após minDwellMs sustentado");
});
