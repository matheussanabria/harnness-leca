// @ts-check
// Rotas de leitura de atividade dos motores (EP-09.06).
const { getEngineActivity } = require("../controllers/engine-activity.controller");

/**
 * @type {Array<{ method: string, path: string | RegExp, handler: (req: any, res: any, params?: any) => Promise<void> | void }>}
 */
const engineActivityRoutes = [
  {
    method: "GET",
    path: "/api/engines/activity",
    handler: getEngineActivity,
  },
];

module.exports = {
  engineActivityRoutes,
};
