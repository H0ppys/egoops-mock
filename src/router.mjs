/**
 * 路由装配（拆分自 mock/mock-egoops.mjs L70-95、L218）
 *
 * 顺序与原文件一致：
 *   1) PUT /upload/*（预签名直传，先于 /api/v1 判定）
 *   2) 非 /api/v1/ → 404
 *   3) Bearer 校验
 *   4) 一次性读 body + parse()
 *   5) 各域路由 → 兜底 404
 *
 * 请求体在原文件里是「每个请求只读一次、所有路由共享 parse()」，这里同样在路由装配层
 * 读完再以 ctx 传给域模块，保证行为一致（GET/DELETE 不读 body）。
 */
import { err, readBody } from './http-helpers.mjs';
import { auth } from './auth.mjs';
import { PORT } from './config.mjs';
import { handleUploadRoute } from './routes/upload.mjs';
import { handleTetSnapshotRoute } from './routes/tet.mjs';
import { handleTaskSetRoutes } from './routes/task-sets.mjs';
import { handleTaskRoutes } from './routes/tasks.mjs';
import { handleMediaAssetRoutes } from './routes/media-assets.mjs';
import { handleMockAdminRoutes } from './routes/mock-admin.mjs';

async function take(res, fn) {
  const r = await fn();
  return res.headersSent || r === true;
}

const CHAIN = [
  handleTetSnapshotRoute,
  handleTaskSetRoutes,
  handleTaskRoutes,
  handleMediaAssetRoutes,
  handleMockAdminRoutes,
];

export async function handle(req, res) {
  const u = new URL(req.url, `http://127.0.0.1:${PORT}`);
  const p = u.pathname;
  const m = req.method;

  const base = { req, res, u, p, method: m };

  // 预签名上传（模拟对象存储）：PUT
  if (await take(res, () => handleUploadRoute(base))) return;

  if (!p.startsWith('/api/v1/')) return err(res, 404, 'Not Found');
  if (!auth(req, res)) return;

  const body = m === 'GET' || m === 'DELETE' ? null : await readBody(req);
  const parse = () => { try { return body?.length ? JSON.parse(body.toString('utf8')) : {}; } catch { return null; } };

  const ctx = { ...base, body, parse };
  for (const h of CHAIN) {
    if (await take(res, () => h(ctx))) return;
  }

  return err(res, 404, 'Not Found');
}
