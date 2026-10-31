---
domain: frontend
module: web
feature: islands
summary: React 19 islands built by Vite (ADR-011) - contract, build config, index plugin, lab island and Biome scope.
paths: [ui/web/**, biome.json]
keywords: [react, islands, vite, typescript, biome, adr-011, lab, build]
updated: 2026-10-31
---
# React Islands (ADR-011)

New UI screens are React islands mounted inside the legacy shell by `ui/public/js/shared/island-loader.js`.
Build with `npm run build:web` (or `npm run dev:web` to rebuild on save); output goes to `ui/public/dist/` (gitignored).

| File | Responsibility |
|---|---|
| `ui/web/package.json` | Marks `ui/web` as an ES module package; dependencies live in the root `package.json`. |
| `ui/web/tsconfig.json` | Strict TypeScript for island code (`src/`), with `vite/client` types for CSS imports. |
| `ui/web/tsconfig.node.json` | TypeScript for the build side (`vite.config.ts`, `build/`) with Node types. |
| `ui/web/vite.config.ts` | Builds every `src/islands/<name>/main.tsx` into `ui/public/dist` with hashed file names and base `/dist/`. |
| `ui/web/build/islands-index.ts` | Vite plugin that emits `dist/islands.js`, mapping each island to its hashed entry and CSS. |
| `ui/web/src/shared/island.ts` | Island contract (`mount(el, { slug, params }) => { unmount }`) and `createIsland` wrapper with `StrictMode`. |
| `ui/web/src/islands/lab/main.tsx` | Entry of the `lab` proof island for the hidden route `#/lab`. |
| `ui/web/src/islands/lab/LabIsland.tsx` | Lab component: shows project slug and route params, keeps a click counter in React state. |
| `ui/web/src/islands/lab/lab.css` | Styles of the lab island. |
| `biome.json` | Biome lint and format config, scoped to `ui/web/**` so legacy code is untouched. |
