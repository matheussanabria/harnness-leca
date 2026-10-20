// @ts-check
const os = require("os");

const MIN_SAFE_RAM_MB = 3000;

/**
 * Retorna o perfil de memoria RAM do sistema em MB e GB
 * @returns {{ totalMb: number, freeMb: number, usedMb: number, freePercent: number, safeForInference: boolean }}
 */
function getMemoryProfile() {
  const totalBytes = os.totalmem();
  const freeBytes = os.freemem();
  const usedBytes = totalBytes - freeBytes;

  const totalMb = Math.round(totalBytes / (1024 * 1024));
  const freeMb = Math.round(freeBytes / (1024 * 1024));
  const usedMb = Math.round(usedBytes / (1024 * 1024));
  const freePercent = Math.round((freeBytes / totalBytes) * 100);

  return {
    totalMb,
    freeMb,
    usedMb,
    freePercent,
    safeForInference: freeMb >= MIN_SAFE_RAM_MB,
  };
}

/**
 * Retorna o perfil da CPU e recomendacao de threads para inferencia local
 * @returns {{ model: string, logicalCores: number, recommendedThreads: number }}
 */
function getCpuProfile() {
  const cpus = os.cpus() || [];
  const logicalCores = cpus.length;
  const model = cpus[0]?.model || "CPU Generica";

  // Na AMD Ryzen 5 7430U (6 nucleos / 12 threads), reserva metade para o sistema e IDE
  const recommendedThreads = Math.max(2, Math.min(6, Math.floor(logicalCores / 2)));

  return {
    model,
    logicalCores,
    recommendedThreads,
  };
}

/**
 * Snapshot consolidado de capacidade de hardware para modelos locais
 * @returns {{
 *   timestamp: string,
 *   memory: ReturnType<typeof getMemoryProfile>,
 *   cpu: ReturnType<typeof getCpuProfile>,
 *   viable: boolean,
 *   alert?: string
 * }}
 */
function getHardwareSnapshot() {
  const memory = getMemoryProfile();
  const cpu = getCpuProfile();
  const viable = memory.safeForInference;

  let alert;
  if (!viable) {
    alert = `Memoria livre baixa (${memory.freeMb} MB). Recomendado pelo menos ${MIN_SAFE_RAM_MB} MB livres para carregar modelos locais sem degradar a maquina.`;
  }

  return {
    timestamp: new Date().toISOString(),
    memory,
    cpu,
    viable,
    alert,
  };
}

module.exports = {
  MIN_SAFE_RAM_MB,
  getMemoryProfile,
  getCpuProfile,
  getHardwareSnapshot,
};
