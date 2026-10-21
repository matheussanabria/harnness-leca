# Battery 2 Benchmark Analysis — Local AI Runtime (`qwen3.5:4b`)

**Date:** 2026-10-21  
**Hardware Host:** AMD Ryzen 5 7430U (6C/12T), 16 GB RAM (Integrated GPU)  
**Model Under Test:** `qwen3.5:4b` via Ollama (`http://localhost:11434`)  
**Source Dataset:** `benchmark-bateria2-20261021-101700/resultados.csv`  

---

## 1. Executive Summary

| Category | Cases | Passed | Failed | Accuracy | Avg Latency (warm) |
|---|---|---|---|---|---|
| **A: Task Classification** | 20 | 20 | 0 | **100.0%** | ~3.16s |
| **B: Structured Entity Extraction** | 15 | 15 | 0 | **100.0%** | ~6.25s |
| **C: MAPA Codebase Localization** | 10 | 10 | 0 | **100.0%** | ~7.78s |
| **D: Execution Routing** | 5 | 3 | 2 | **60.0%** | ~2.90s |
| **Total** | **50** | **48** | **2** | **96.0% (48/50)** | **~5.12s** |

---

## 2. In-Depth Latency & Performance Breakdown

### 2.1 Cold-Start vs Warm Cache
- **Cold Start (A01):**
  - Total Duration: **27.88s**
  - Model Load Time (`load_duration`): **24.61s**
  - Prompt Evaluation: **3.01s**
  - Token Generation: **0.16s**
- **Warm Inference (A02 to A20):**
  - Model Load Time: drops to **~10ms – 20ms** (0.015s).
  - Average Total Duration: **2.6s to 4.0s**.
  - **Key Decision Implemented:** In Phase 1, `keep_alive: "5m"` was configured in `ollama-client.js` to eliminate the 24.6s reload penalty across sequential calls.

### 2.2 Latency per Group
- **Classification (Group A):** 71–78 prompt tokens, 2–3 output tokens. Prompt eval dominates (~2.5s–3.4s), generation is virtually instant (~0.15s–0.30s).
- **Structured Extraction (Group B):** 81–85 prompt tokens, 20–22 generated JSON tokens. Generation takes ~2.6s–3.7s, total time ~5.4s–7.2s.
- **Codebase Localization (Group C):** ~200 prompt tokens (with partial MAPA slice), 4–12 generated tokens. Total time ~7.1s–8.5s.
- **Routing (Group D):** ~76–84 prompt tokens, 2–4 output tokens. Total time ~2.7s–3.2s.

---

## 3. Discrepancy & Error Analysis

The only two discrepancies occurred in **Group D (Routing)**:

| Case | Input Text | Expected | Obtained | Analysis & Root Cause |
|---|---|---|---|---|
| **D03** | *"Classificar uma solicitação curta de desenvolvimento"* | `local_llm` | `script` | Model favored `script` because classification sounded like a programmatic command. |
| **D04** | *"Extrair campos de um pequeno texto em JSON"* | `local_llm` | `script` | Model favored `script` because parsing/JSON extraction is traditionally handled by deterministic code. |

### Architectural Implication
In our Phase 2 implementation, the routing boundary is strictly anchored in `tools/lib/hia/router.js` using deterministic regex checks before passing to any LLM. The local LLM is used to **execute** the extraction/classification, not to make the self-routing decision. This guarantees 100% routing determinism.

---

## 4. RAM & System Health Observations
- Peak RAM consumption under load: ~2.8 GB allocated by the Ollama runner process.
- With multiple development IDEs, browsers, and background tunnels running, system memory reached 92%–99%.
- **Protective Guardrail:** `minFreeMemMb: 2500` in `tools/lib/runtime/ollama-client.js` ensures that when host RAM is exhausted, inference cleanly defers rather than freezing the host OS.
