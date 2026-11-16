---
domain: frontend
module: coverage
feature: vendor-runtime
summary: Vendored Three.js controls/renderers and bundled React runtime dependencies.
paths: [ui/public/js/vendor/CSS3DRenderer.js, ui/public/js/vendor/OrbitControls.js, ui/public/js/vendor/PointerLockControls.js, ui/public/js/vendor/dc-runtime/react-dom.production.min.js, ui/public/js/vendor/dc-runtime/react.production.min.js, ui/public/js/vendor/dc-runtime/support.js, ui/public/js/vendor/three.min.js]
keywords: [vendor, threejs, react, runtime, controls]
updated: 2026-11-16
---
# Vendored Browser Runtime / Runtime de Navegador Vendor

| File | Responsibility |
|---|---|
| `ui/public/js/vendor/CSS3DRenderer.js` | Third-party Three.js CSS3D object, sprite and renderer implementation. / Implementação de terceiros para objetos, sprites e renderer CSS3D do Three.js. |
| `ui/public/js/vendor/OrbitControls.js` | Third-party Three.js orbit, zoom and pan controls. / Controles de terceiros de órbita, zoom e pan do Three.js. |
| `ui/public/js/vendor/PointerLockControls.js` | Third-party Three.js pointer-lock camera controls. / Controles de câmera de terceiros por pointer lock do Three.js. |
| `ui/public/js/vendor/dc-runtime/react-dom.production.min.js` | Minified React DOM production runtime bundled for the DC runtime. / Runtime de produção minificado do React DOM empacotado para o DC runtime. |
| `ui/public/js/vendor/dc-runtime/react.production.min.js` | Minified React production runtime bundled for the DC runtime. / Runtime de produção minificado do React empacotado para o DC runtime. |
| `ui/public/js/vendor/dc-runtime/support.js` | Generated adapter that loads React/ReactDOM and parses runtime support inputs. / Adaptador gerado que carrega React/ReactDOM e interpreta entradas do runtime. |
| `ui/public/js/vendor/three.min.js` | Minified third-party Three.js library. / Biblioteca Three.js minificada de terceiros. |
