// @ts-check
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const read = (p) => fs.readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

test("Studio has a Histórias button wired to the stories mode", () => {
  const html = read("ui/public/partials/studio.html");
  assert.match(html, /id="btnViewStories"[^>]*setStudioModeType\('stories'\)/);
  assert.doesNotMatch(html, /btnViewStories[^>]*>[^<]*[\u{1F300}-\u{1FAFF}]/u, "no emoji in the button");
});

test("stories mode toggles its own column without changing the preview mode", () => {
  const views = read("ui/public/js/modules/studio-views.js");
  assert.match(views, /STORIES: "stories"/);
  assert.match(views, /mode === STUDIO_VIEW_MODES\.STORIES[\s\S]{0,120}setStudioStoriesColumn\(!isStudioStoriesColumnOpen\(\)\)/);
});

test("the column reuses the office Scrum board and loads its styles in the Studio", () => {
  const column = read("ui/public/js/modules/studio-stories-column.js");
  assert.match(column, /from "\.\.\/office\/scrum-board\/scrum-board\.js"/);
  assert.match(read("ui/public/css/studio.css"), /office\/21-scrum-board\.css/);
  assert.match(read("ui/public/css/studio.css"), /06-stories-column\.css/);
});

test("the column offers a keyboard and pointer resizer and the chat/edit shortcuts", () => {
  const column = read("ui/public/js/modules/studio-stories-column.js");
  assert.match(column, /ensureStoriesResizer\(\)/);
  assert.match(column, /onSendToChat/);
  assert.match(column, /onEdit/);
  const resizer = read("ui/public/js/modules/studio-stories-resizer.js");
  assert.match(resizer, /role", "separator"/);
  assert.match(resizer, /ArrowLeft/);
});
