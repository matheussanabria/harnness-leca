// @ts-check
// Quality prompt for the Atelier: brief, Design System context, craft rules and an optional "directions" mode.
// Opt-in per project (design/profile.json: atelier.qualityPrompt). Flag off keeps the legacy prompt untouched.

const COMMAND = /^\/directions\b[ \t]*/i;

/**
 * "/directions <request>" asks for two alternative first folds instead of a full page.
 * @param {string} text
 * @returns {{ mode: "compose" | "directions", text: string }}
 */
export function parseQualityCommand(text) {
  const raw = String(text || "");
  if (COMMAND.test(raw)) return { mode: "directions", text: raw.replace(COMMAND, "").trim() };
  return { mode: "compose", text: raw };
}

const OUTPUT = `You are working in the Harness Atelier prototyping tool. Answer with file blocks in this exact format (do not use file tools):
<arquivo caminho="screens/home.html">
...HTML body fragment only: no <html>, <head>, <script> or inline on* handlers...
</arquivo>
<arquivo caminho="styles/proto.css">
...CSS...
</arquivo>
Allowed paths: screens/<id>.html, styles/proto.css, data/*.json. Rewrite a file completely when you change it.
After the blocks write at most 4 short lines: the assumptions you made, any Design System gaps, and what changed.`;

const BRIEF = `Brief: before writing, work out the objective, audience, primary action, content, identity and constraints from the request. Fill gaps with reasonable assumptions and list them in your closing lines. Ask a question only if the request is unusable.`;

const CRAFT = `Craft rules:
- One primary action per view, and it is the most prominent element. Build hierarchy with the type scale and spacing (multiples of var(--spacing-scale-base)), not with extra colours.
- Give the page an identity through composition and typographic voice built from the tokens. Avoid the generic template look (centred hero plus three equal cards) unless the brief asks for it.
- Signature element: choose one distinctive visual element that communicates the product (for example the product drawn with inline SVG or CSS) and build the hero around it, with colours from the tokens. A page without one reads as a template.
- Dark surfaces: you may use --primary-headings as a section or card background, with --neutral-background for text and --neutral-light for secondary text. Check every button label against its own background, including on dark cards: a label must never be white on white or on a transparent button; use .btn--primary or .btn--secondary as the kit defines them.
- Rhythm: use one vertical padding for all sections (4 to 6 times var(--spacing-scale-base)), align the tops of cards that sit in a row and give them the same inner padding, and avoid empty bands taller than a section's padding.
- Consistency of claims: delivery days, prices and quantities must agree between hero, plans and FAQ. When the briefing gives exact content, use it verbatim.
- Responsive from 360 px to 1440 px, mobile first: no horizontal scroll, no clipped text, touch targets of at least 44 px. Put every section's content in a centred container (max-width about 1200px) with at least 16px of horizontal padding, and let long words and headings wrap.
- Use the kit's header and footer as they are (do not restyle their colours). The kit header hides its navigation below 576 px, so keep the primary action reachable on mobile, for example repeated in the hero. Buttons are <a class="btn btn--primary"> or <button class="btn btn--primary">.
- Use realistic fictional content, including one long title and one empty state where relevant. No external images, fonts or URLs. Draw icons as inline SVG with stroke="currentColor". No emojis.
- Text colours: use only --neutral-body, --neutral-dark, --neutral-base, --primary-headings or --primary-interactive on light surfaces. Never set text in --neutral-muted or --neutral-light (they are for borders and fills and fail contrast), and never put text on a coloured bar in a colour you did not take from the kit.
- Accessibility: header, nav, main and footer landmarks, a single h1 with ordered headings, a visible focus style using the focus token, text contrast of at least 4.5:1, a label for every control.
- Interaction without scripts: move between screens with data-action="goto:<screen-id>", toggle panels with data-action="toggle:<css selector>", and otherwise use CSS-only patterns (details/summary, :target, :focus-within). Say in the visible copy when an action is simulated.`;

const DIRECTIONS = `Mode: directions. The user wants two alternative directions for the first fold only (what is visible without scrolling at 1440 px and at 390 px). Output exactly two screens with the same content and different design decisions: screens/direction-a.html and screens/direction-b.html, plus styles/proto.css holding the styles of both (prefix the classes da- and db-). The difference must be real: composition, typographic voice and use of space, not just colour. Begin the closing lines with one line per direction naming its idea. Do not build the rest of the page.`;

/** Markup and CSS of the kit components, so the model copies real patterns instead of guessing inner markup. */
function kitSection(kit) {
  if (!Array.isArray(kit) || !kit.length) return "";
  const blocks = kit.map((c) => `### ${c.id}\nHTML:\n${c.html}\nCSS (already loaded, shown for reference):\n${c.css}`);
  return `\n\nComponent kit. Copy this markup exactly, changing only the text, links and extra items, and keep the class names:\n\n${blocks.join("\n\n")}`;
}

/**
 * Design System section: components index, the tokens the preview already loads, and the kit markup.
 * @param {{ index?: string, tokensCss?: string, kit?: Array<{id: string, html: string, css: string}> }} ds
 */
function designSystemSection(ds) {
  return `Design System: the preview already loads the project's tokens and component CSS. Do not redefine them. Build with the components below, reusing their class names and markup patterns. Colours, fonts and spacing come only from var(--token) values; never hardcode hex colours or font names. If you need something the Design System lacks, compose it from tokens in styles/proto.css and report it as a gap.

${(ds.index || "").trim()}

Token values:
${(ds.tokensCss || "").trim()}${kitSection(ds.kit)}`;
}

/**
 * Full rules for a fresh session.
 * @param {{ index?: string, tokensCss?: string }} ds
 * @param {"compose" | "directions"} [mode]
 */
export function buildQualityRules(ds, mode = "compose") {
  const parts = [OUTPUT, BRIEF, designSystemSection(ds), CRAFT];
  if (mode === "directions") parts.push(DIRECTIONS);
  return parts.join("\n\n");
}

/** Short reminder for a resumed session that already received the full rules. */
export function directionsReminder() {
  return DIRECTIONS;
}

/**
 * Asks the server whether the project opted in and for its Design System context.
 * @param {string} slug
 * @param {typeof fetch} [fetchFn]
 * @returns {Promise<{ enabled: boolean, index?: string, tokensCss?: string, reason?: string }>}
 */
export async function loadQualityContext(slug, fetchFn = fetch) {
  try {
    const res = await fetchFn(`/api/project/${encodeURIComponent(slug)}/design/atelier/quality-context`);
    const data = await res.json();
    return data && data.enabled === true ? data : { enabled: false, reason: data?.reason || "flag-off" };
  } catch {
    return { enabled: false, reason: "unavailable" };
  }
}
