// @ts-check
const { slugs, active, send } = require("../config");
const { activityMs, overviewCached } = require("../services/project.service");

const OV_PAGE_SIZE = 10;
const OV_MAX_PAGE_SIZE = 50;
const ovInt = (raw, fallback, min, max) => {
  const n = Number(raw);
  return Number.isFinite(n) && n >= min ? Math.min(Math.floor(n), max) : fallback;
};

// page/pageSize vêm da query string; valores inválidos caem nos limites em vez de quebrar a página.
function apiOverview({ res, url }) {
  const act = active();
  const order = slugs()
    .map((slug) => ({ slug, at: activityMs(slug) }))
    .sort((a, b) => b.at - a.at || a.slug.localeCompare(b.slug));
  const pageSize = ovInt(url.searchParams.get("pageSize"), OV_PAGE_SIZE, 1, OV_MAX_PAGE_SIZE);
  const pages = Math.max(1, Math.ceil(order.length / pageSize));
  const page = ovInt(url.searchParams.get("page"), 1, 1, pages);
  const start = (page - 1) * pageSize;
  return send(res, 200, {
    total: order.length,
    page,
    pageSize,
    pages,
    active: act,
    projects: order.slice(start, start + pageSize).map((o) => overviewCached(o.slug, o.slug === act)),
  });
}

module.exports = {
  apiOverview,
};
