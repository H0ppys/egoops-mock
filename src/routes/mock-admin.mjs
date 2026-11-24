/**
 * 测试专用调试接口（拆分自 mock/mock-egoops.mjs L214-216）
 *
 * GET  /api/v1/__mock/sites   查看全部采集点（带任务统计）
 * POST /api/v1/__mock/reset   把状态复位到 defaultState
 */
import { json } from '../http-helpers.mjs';
import { defaultState, save, state } from '../state.mjs';
import { siteView } from '../views.mjs';

export async function handleMockAdminRoutes(ctx) {
  const { res, p } = ctx;
  const m = ctx.method;

  // GET /api/v1/__mock/sites （测试用：查看全部）
  if (m === 'GET' && p === '/api/v1/__mock/sites') return json(res, 200, { sites: state.sites.map(siteView) });
  if (m === 'POST' && p === '/api/v1/__mock/reset') { Object.assign(state, structuredClone(defaultState)); save(); return json(res, 200, { ok: true }); }

  return false;
}
