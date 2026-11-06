// @ts-check
const { PIN, send, getActiveAppUrl, sendPinLoginPage } = require("./config");
const netLib = require("../../tools/lib/network");
const { apiHiaMetrics } = require("./controllers/hia.controller");

const { apiOverview } = require("./controllers/overview.controller");
const {
  apiState,
  apiProject,
  apiProjectActiveSet,
  apiProjectGroupsGet,
  apiProjectGroupsSave,
  apiProjectChatGroupAssign,
  apiProjectGroupsSuggest,
  apiFile,
  apiProjectJournal,
} = require("./controllers/project.controller");
const { apiReviewList, apiReviewApply } = require("./controllers/review.controller");
const { apiPermissionRequest, apiPermissionAnswer, apiProjectPermissionsGet, apiProjectPermissionsRemove } = require("./controllers/permissions.controller");
const {
  apiProjectSkillsGet,
  apiProjectSkillsTemplates,
  apiProjectSkillsDetail,
  apiProjectSkillsSave,
  apiProjectSkillsInstall,
  apiProjectSkillsRecognized,
  apiProjectSkillsImportRecognized,
  apiProjectSkillsDelete,
} = require("./controllers/skills.controller");
const {
  apiProjectServicesGet,
  apiProjectServicesStart,
  apiProjectServicesStop,
  apiProjectServicesLogs,
  apiProjectServicesConfig,
} = require("./controllers/services.controller");
const { apiEngines, apiDai, apiAppPing, apiChat, apiChatSave, chatStreamRoutes } = require("./controllers/chat.controller");
const { apiChatUpload } = require("./controllers/upload.controller");
const { apiSync, apiProjectSync } = require("./controllers/sync.controller");
const { apiRemoteInfo, apiRemotePin } = require("./controllers/remote.controller");
const { artifactRoutes } = require("./routes/artifact.routes");
const { skillBindingRoutes } = require("./routes/skill-bindings.routes");
const { auditRoutes } = require("./routes/audit.routes");
const { canonicalSessionRoutes } = require("./routes/canonical-sessions.routes");
const { centralEventRoutes } = require("./routes/central-events.routes");
const { screensRoutes } = require("./routes/screens.routes");
const { canvasRoutes } = require("./routes/canvas.routes");
const { scrumSprintRoutes } = require("./routes/scrum-sprint.routes");
const { engineActivityRoutes } = require("./routes/engine-activity.routes");
const { designRoutes } = require("./routes/design.routes");
const { inspectRoutes } = require("./routes/inspect.routes");
const {
  apiProjectSourceFiles,
  apiProjectSourceFileGet,
  apiProjectSourceFileSave,
} = require("./controllers/source-workspace.controller");
const {
  apiDeployConfigGet,
  apiDeployConfigSave,
  apiDeployTrigger,
  apiDeployHistoryGet,
  apiDeployHistoryClear,
} = require("./controllers/deploy.controller");
const {
  apiDeployTimeline,
  apiDeployLogs,
} = require("./controllers/deploy-timeline.controller");
const {
  apiDeployActions,
  apiDeployActionAuthorize,
  apiDeployActionExecute,
} = require("./controllers/deploy-actions.controller");
const { apiDeployStatus } = require("./controllers/deploy-status.controller");
const {
  apiDeployHealth,
  apiDeployHealthChecksSave,
  apiDeployHealthCheckRun,
} = require("./controllers/deploy-health.controller");
const {
  apiDeployPipelines,
  apiDeployPipelinesSave,
  apiDeployPipelineRun,
  apiDeployPipelineRuns,
} = require("./controllers/deploy-pipeline.controller");
const {
  apiProjectScrumGet,
  apiProjectScrumStorySave,
  apiProjectScrumStoryStatus,
  apiProjectScrumStoryAssignSprint,
  apiProjectScrumStoryImpediment,
  apiProjectScrumStoryDelete,
  apiProjectScrumEpicSave,
  apiProjectScrumSprintSave,
  apiProjectScrumStatusMappingSave,
  apiProjectScrumLanesSave,
  apiProjectScrumLanesOrder,
} = require("./controllers/scrum.controller");
const { apiProjectScrumJiraSync } = require("./controllers/scrum-jira-sync.controller");
const { apiProjectScrumStoryTransition } = require("./controllers/scrum-transition.controller");
const { apiProjectScrumStoryCommits, apiProjectScrumStoryDor } = require("./controllers/scrum-trace.controller");
const { apiProjectCoordinationLanes } = require("./controllers/coordination-view.controller");
const { apiProjectScrumPanel } = require("./controllers/scrum-panel.controller");const { apiProjectScrumStoryCapture, apiProjectScrumDuplicates } = require("./controllers/scrum-capture.controller");
const {
  apiOrchestrationState,
  apiOrchestrationEvents,
  apiOrchestrationExecutionDetail,
  apiOrchestrationStream,
  apiOrchestrationOperation
} = require("./controllers/orchestration.controller");
const { orchestrationRoutes } = require("./routes/orchestration.routes");
const { serveStatic } = require("./controllers/static.controller");
const { getActiveAgentsSummary } = require("./services/agent-activity.service");

function apiAgentsActive({ res }) {
  return send(res, 200, getActiveAgentsSummary());
}

// method + caminho (texto exato ou RegExp). HEAD usa a rota do GET.
const ROUTES = [
  { method: "GET", path: /^\/api\/project\/([\w-]+)\/scrum$/, handler: apiProjectScrumGet },
  { method: "POST", path: /^\/api\/project\/([\w-]+)\/scrum\/jira-sync$/, handler: apiProjectScrumJiraSync },
  { method: "POST", path: /^\/api\/project\/([\w-]+)\/scrum\/story$/, handler: apiProjectScrumStorySave },
  { method: "POST", path: /^\/api\/project\/([\w-]+)\/scrum\/story\/capture$/, handler: apiProjectScrumStoryCapture },
  { method: "GET", path: /^\/api\/project\/([\w-]+)\/scrum\/duplicates$/, handler: apiProjectScrumDuplicates },
  { method: "POST", path: /^\/api\/project\/([\w-]+)\/scrum\/story\/status$/, handler: apiProjectScrumStoryStatus },
  { method: "POST", path: /^\/api\/project\/([\w-]+)\/scrum\/story\/transition$/, handler: apiProjectScrumStoryTransition },
  { method: "GET", path: /^\/api\/project\/([\w-]+)\/scrum\/story\/([\w.-]+)\/commits$/, handler: apiProjectScrumStoryCommits },
  { method: "GET", path: /^\/api\/project\/([\w-]+)\/scrum\/story\/([\w.-]+)\/dor$/, handler: apiProjectScrumStoryDor },
  { method: "GET", path: /^\/api\/project\/([\w-]+)\/coordination\/lanes$/, handler: apiProjectCoordinationLanes },
  { method: "GET", path: /^\/api\/project\/([\w-]+)\/scrum\/panel$/, handler: apiProjectScrumPanel },
  { method: "POST", path: /^\/api\/project\/([\w-]+)\/scrum\/story\/assign-sprint$/, handler: apiProjectScrumStoryAssignSprint },
  { method: "POST", path: /^\/api\/project\/([\w-]+)\/scrum\/story\/impediment$/, handler: apiProjectScrumStoryImpediment },
  { method: "POST", path: /^\/api\/project\/([\w-]+)\/scrum\/story\/delete$/, handler: apiProjectScrumStoryDelete },
  { method: "POST", path: /^\/api\/project\/([\w-]+)\/scrum\/epic$/, handler: apiProjectScrumEpicSave },
  { method: "POST", path: /^\/api\/project\/([\w-]+)\/scrum\/sprint$/, handler: apiProjectScrumSprintSave },  { method: "POST", path: /^\/api\/project\/([\w-]+)\/scrum\/status-mapping$/, handler: apiProjectScrumStatusMappingSave },
  { method: "POST", path: /^\/api\/project\/([\w-]+)\/scrum\/lanes$/, handler: apiProjectScrumLanesSave },
  { method: "POST", path: /^\/api\/project\/([\w-]+)\/scrum\/lanes\/order$/, handler: apiProjectScrumLanesOrder },
  ...designRoutes,
  ...inspectRoutes,
  { method: "GET", path: /^\/api\/project\/([\w-]+)\/source$/, handler: apiProjectSourceFiles },
  { method: "GET", path: /^\/api\/project\/([\w-]+)\/source\/file$/, handler: apiProjectSourceFileGet },
  { method: "POST", path: /^\/api\/project\/([\w-]+)\/source\/file$/, handler: apiProjectSourceFileSave },
  { method: "GET", path: /^\/api\/project\/([\w-]+)\/journal$/, handler: apiProjectJournal },
  ...artifactRoutes,
  ...skillBindingRoutes, ...require("./routes/catalog.routes").catalogRoutes,
  ...auditRoutes,
  // centralEventRoutes antes: /sessions/stream precisa vencer /sessions/([^/]+) (primeiro match ganha).
  ...centralEventRoutes,
  ...canonicalSessionRoutes,
  ...screensRoutes,
  ...canvasRoutes,
  ...scrumSprintRoutes,
  ...engineActivityRoutes,
  { method: "GET", path: "/api/state", handler: apiState },
  { method: "GET", path: "/api/agents/active", handler: apiAgentsActive },
  { method: "GET", path: "/api/orchestration/state", handler: apiOrchestrationState },
  { method: "GET", path: "/api/orchestration/events", handler: apiOrchestrationEvents },
  { method: "GET", path: /^\/api\/orchestration\/executions\/([\w-]+)$/, handler: apiOrchestrationExecutionDetail },
  ...orchestrationRoutes,
  { method: "GET", path: "/api/orchestration/stream", handler: apiOrchestrationStream },
  { method: "POST", path: "/api/orchestration/operations", handler: apiOrchestrationOperation },
  { method: "GET", path: "/api/engines", handler: apiEngines },
  { method: "GET", path: "/api/overview", handler: apiOverview },
  { method: "POST", path: "/api/sync", handler: apiSync },
  { method: "POST", path: "/api/project/active", handler: apiProjectActiveSet },
  { method: "GET", path: /^\/api\/project\/([\w-]+)$/, handler: apiProject },
  { method: "GET", path: /^\/api\/project\/([\w-]+)\/review$/, handler: apiReviewList },
  { method: "POST", path: /^\/api\/project\/([\w-]+)\/review$/, handler: apiReviewApply },
  { method: "POST", path: /^\/api\/project\/([\w-]+)\/sync$/, handler: apiProjectSync },
  { method: "GET", path: /^\/api\/project\/([\w-]+)\/groups$/, handler: apiProjectGroupsGet },
  { method: "POST", path: /^\/api\/project\/([\w-]+)\/groups$/, handler: apiProjectGroupsSave },
  { method: "POST", path: /^\/api\/project\/([\w-]+)\/groups\/suggest$/, handler: apiProjectGroupsSuggest },
  { method: "POST", path: /^\/api\/project\/([\w-]+)\/chat-group$/, handler: apiProjectChatGroupAssign },
  { method: "GET", path: /^\/api\/project\/([\w-]+)\/skills$/, handler: apiProjectSkillsGet },
  { method: "GET", path: /^\/api\/project\/([\w-]+)\/skills\/templates$/, handler: apiProjectSkillsTemplates },
  { method: "GET", path: /^\/api\/project\/([\w-]+)\/skills\/recognized$/, handler: apiProjectSkillsRecognized },
  { method: "GET", path: /^\/api\/project\/([\w-]+)\/skills\/detail$/, handler: apiProjectSkillsDetail },
  { method: "POST", path: /^\/api\/project\/([\w-]+)\/skills$/, handler: apiProjectSkillsSave },
  { method: "POST", path: /^\/api\/project\/([\w-]+)\/skills\/install$/, handler: apiProjectSkillsInstall },
  { method: "POST", path: /^\/api\/project\/([\w-]+)\/skills\/import-recognized$/, handler: apiProjectSkillsImportRecognized },
  { method: "POST", path: /^\/api\/project\/([\w-]+)\/skills\/delete$/, handler: apiProjectSkillsDelete },
  { method: "GET", path: /^\/api\/project\/([\w-]+)\/services$/, handler: apiProjectServicesGet },
  { method: "POST", path: /^\/api\/project\/([\w-]+)\/services\/start$/, handler: apiProjectServicesStart },
  { method: "POST", path: /^\/api\/project\/([\w-]+)\/services\/stop$/, handler: apiProjectServicesStop },
  { method: "GET", path: /^\/api\/project\/([\w-]+)\/services\/logs$/, handler: apiProjectServicesLogs },
  { method: "POST", path: /^\/api\/project\/([\w-]+)\/services\/config$/, handler: apiProjectServicesConfig },
  { method: "GET", path: "/api/file", handler: apiFile },
  { method: "GET", path: "/api/dai", handler: apiDai },
  { method: "GET", path: "/api/app/ping", handler: apiAppPing },
  { method: "GET", path: "/api/remote/info", handler: apiRemoteInfo },
  { method: "POST", path: "/api/remote/pin", handler: apiRemotePin },
  { method: "POST", path: "/api/chat", handler: apiChat },
  ...chatStreamRoutes,
  { method: "POST", path: "/api/chat/save", handler: apiChatSave },
  { method: "POST", path: "/api/chat/upload", handler: apiChatUpload },
  { method: "POST", path: "/api/permissions/request", handler: apiPermissionRequest },
  { method: "POST", path: "/api/permissions/answer", handler: apiPermissionAnswer },
  { method: "GET", path: /^\/api\/project\/([\w-]+)\/permissions$/, handler: apiProjectPermissionsGet },
  { method: "POST", path: /^\/api\/project\/([\w-]+)\/permissions\/remove$/, handler: apiProjectPermissionsRemove },
  { method: "GET", path: "/api/deploy/config", handler: apiDeployConfigGet },
  { method: "POST", path: "/api/deploy/config", handler: apiDeployConfigSave },
  { method: "POST", path: "/api/deploy/trigger", handler: apiDeployTrigger },
  { method: "GET", path: "/api/deploy/history", handler: apiDeployHistoryGet },
  { method: "POST", path: "/api/deploy/clear-history", handler: apiDeployHistoryClear },
  { method: "GET", path: "/api/deploy/pipelines", handler: apiDeployPipelines },
  { method: "POST", path: "/api/deploy/pipelines", handler: apiDeployPipelinesSave },
  { method: "GET", path: "/api/deploy/pipelines/runs", handler: apiDeployPipelineRuns },
  { method: "POST", path: /^\/api\/deploy\/pipelines\/([\w-]+)\/run$/, handler: apiDeployPipelineRun },
  { method: "GET", path: "/api/deploy/health", handler: apiDeployHealth },
  { method: "POST", path: "/api/deploy/health/checks", handler: apiDeployHealthChecksSave },
  { method: "POST", path: /^\/api\/deploy\/health\/checks\/([\w-]+)\/run$/, handler: apiDeployHealthCheckRun },
  { method: "GET", path: "/api/deploy/timeline", handler: apiDeployTimeline },
  { method: "GET", path: "/api/deploy/logs", handler: apiDeployLogs },
  { method: "GET", path: "/api/deploy/actions", handler: apiDeployActions },
  { method: "GET", path: "/api/deploy/status", handler: apiDeployStatus },
  { method: "POST", path: /^\/api\/deploy\/actions\/([\w-]+)\/authorize$/, handler: apiDeployActionAuthorize },
  { method: "POST", path: /^\/api\/deploy\/actions\/([\w-]+)\/execute$/, handler: apiDeployActionExecute },
  { method: "GET", path: "/api/hia/metrics", handler: apiHiaMetrics },
];

async function handle(req, res) {
  const url = new URL(req.url, "http://x");
  const p = decodeURIComponent(url.pathname);
  if (p.includes("\0")) return send(res, 400, { error: "requisição inválida" });

  // 1. PIN de Acesso Remoto: só o loopback direto passa livre; proxy/túnel e rede exigem sessão ou PIN.
  // O envio do PIN pelo formulário (POST /api/remote/pin) é autorizado e limitado pelo próprio controller.
  const isPinLogin = req.method === "POST" && p === "/api/remote/pin";
  const auth = isPinLogin ? { ok: true, reason: "local", retryAfterSec: 0 } : netLib.authorizeRemote(req, PIN, url);
  if (!auth.ok) {
    if (auth.reason === "locked") {
      res.setHeader("Retry-After", String(auth.retryAfterSec || 900));
      return send(res, 429, { error: "Muitas tentativas de PIN. Tente de novo mais tarde.", retryAfterSec: auth.retryAfterSec });
    }
    if (auth.reason === "unprotected-proxy") {
      return send(res, 403, { error: "Acesso por túnel ou proxy exige iniciar o Harness com --remote (PIN)." });
    }
    if (p.startsWith("/api/")) {
      return send(res, 401, { error: "PIN de acesso remoto obrigatório", authRequired: true });
    }
    return sendPinLoginPage(res);
  }

  // PIN aceito pelo link/QR: troca por cookie de sessão e remove o PIN da URL (histórico, logs, Referer).
  if (auth.reason === "pin" && url.searchParams.has("pin")) {
    res.setHeader("Set-Cookie", netLib.buildSessionCookie(req, netLib.issueSessionToken(PIN)));
    if (req.method === "GET" || req.method === "HEAD") {
      url.searchParams.delete("pin");
      // Uma barra só: "//host" viraria redirecionamento para outro site.
      res.writeHead(302, { Location: `/${url.pathname.replace(/^\/+/, "")}${url.search}`, "Cache-Control": "no-store" });
      return res.end();
    }
  }

  // 2. Rota de Proxy do App em Desenvolvimento: /preview ou /preview/*
  if (p === "/preview" || p.startsWith("/preview/")) {
    const appUrl = getActiveAppUrl();
    const subpath = p.replace(/^\/preview/, "") || "/";
    return netLib.proxyAppRequest(req, res, appUrl, subpath + (url.search || ""));
  }

  const method = req.method === "HEAD" ? "GET" : req.method;
  let pathKnown = false;
  for (const route of ROUTES) {
    const m = typeof route.path === "string" ? (p === route.path ? [p] : null) : p.match(route.path);
    if (!m) continue;
    pathKnown = true;
    if (route.method === method) return /** @type {any} */ (route.handler)({ req, res, url, params: m.slice(1) });
  }

  // 3. Proxy de assets e submódulos do app dev (Vite, React, Angular, Webpack)
  const referer = req.headers.referer || "";
  const isAppReferer =
    referer.includes("/preview") ||
    referer.includes("/@vite") ||
    referer.includes("/@") ||
    referer.includes("/src/") ||
    referer.includes("/node_modules/");
  const isKnownDevPrefix =
    p.startsWith("/@") ||
    p.startsWith("/src/") ||
    p.startsWith("/node_modules/") ||
    p.startsWith("/assets/");
  const isDevAssetExt = /\.(tsx?|jsx?|mjs|cjs|vue|svelte|css|scss|less|wasm|svg|png|jpe?g|gif|webp|ico|woff2?|ttf|eot|json|map)($|\?)/i.test(p);
  const isAppDevAsset = !p.includes("..") && (isKnownDevPrefix || (isAppReferer && isDevAssetExt));

  if (!p.startsWith("/api/") && isAppDevAsset) {
    const appUrl = getActiveAppUrl();
    return netLib.proxyAppRequest(req, res, appUrl, p + (url.search || ""));
  }

  return pathKnown ? send(res, 405, { error: "método não permitido" }) : serveStatic(res, p);
}

module.exports = {
  ROUTES,
  handle,
};
