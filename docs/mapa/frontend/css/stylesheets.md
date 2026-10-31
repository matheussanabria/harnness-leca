---
domain: frontend
module: css
feature: stylesheets
summary: Frontend CSS files under ui/public/css, including chat, studio, review, inspector and design stylesheets.
paths: [ui/public/css/*.css, ui/public/css/chat/*.css, ui/public/css/design/*.css]
keywords: [css, stylesheet, theme, chat, design, artifacts, prototype]
updated: 2026-10-31
---
# Frontend Stylesheets

| File | Responsibility |
|---|---|
| `ui/public/css/index.css` | Central mount point importing the style files via `@import`. |
| `ui/public/css/island-host.css` | Full-screen host for React islands (ADR-011) over the legacy dashboard, plus the "not built" notice. |
| `ui/public/css/base.css` | HSL dark/light theme variables, reset, typography, base buttons and native dialogs. |
| `ui/public/css/components.css` | Header, conversation table, filters, group chips, pagination and toasts. |
| `ui/public/css/chat.css` | Modular aggregator: dialog layout, editorial messages, actionable code cards, composer, popovers, multi-engine arena, mini-dock. |
| `ui/public/css/chat/05-chat-code-cards.css` | Code cards, headers, extension badges and copy/apply buttons. |
| `ui/public/css/chat/06-chat-system-cards.css` | MCP permission cards, error notices and chat attachment chips. |
| `ui/public/css/chat-mobile.css` | Responsive safe-area and touch-target refinements for mobile. |
| `ui/public/css/studio.css` | Vibecoding Studio workspace, mobile/desktop viewport frames and responsive dock. |
| `ui/public/css/review.css` | Memory review interface and skill management cards. |
| `ui/public/css/inspector.css` | Active button, inspector notice strip, component result card and code viewer. |
| `ui/public/css/design/06-workspace-prototypes.css` | 4-area workspace (Catalog, Chat, Preview, Inspector), splitters and collapse buttons. |
| `ui/public/css/design/07-layers-tree.css` | Layer tree (Figma/XD), search, hierarchical indent, category icons and inspector tabs. |
| `ui/public/css/design/08-prototype-catalog.css` | Unified catalog, reusable components, preview header, versions and Atelier states. |
| `ui/public/css/design/13-prototype-canvas.css` | Atelier canvas: camera, frames, tools, code blocks and Play mode. |
| `ui/public/css/design/15-prototype-props.css` | Position and Layout panel styles. |
| `ui/public/css/design/16-artifact-inventory.css` | Artifacts tab: summary, search, filters, table, states and responsiveness. |
| `ui/public/css/design/17-artifact-import.css` | Artifact import buttons, status and responsiveness. |
| `ui/public/css/design/18-artifact-access.css` | Badge and toggle for local/project access. |
| `ui/public/css/design/19-artifact-preview.css` | Preview button, preview panel, iframe, text and image. |
| `ui/public/css/design/20-artifact-relationships.css` | Links panel, screens/fields list, orphans and target selector. |
| `ui/public/css/*.css` | Large stylesheets: the aggregator `css/<name>.css` imports `css/<name>/NN-*.css` in order. |
