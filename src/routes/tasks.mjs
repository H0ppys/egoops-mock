/**
 * 单个任务更新（拆分自 mock/mock-egoops.mjs L175-185）
 * PATCH /api/v1/tasks/:id
 */
import { err, json } from '../http-helpers.mjs';
import { save, state } from '../state.mjs';

export async function handleTaskRoutes(ctx) {
  const { res, p, parse } = ctx;
  const m = ctx.method;
  let mm;

  // PATCH /api/v1/tasks/:id
  mm = p.match(/^\/api\/v1\/tasks\/([^/]+)$/);
  if (mm && m === 'PATCH') {
    const t = state.tasks.find(x => x.task_id === mm[1]);
    if (!t) return err(res, 404, 'COLLECTION_TASK_NOT_FOUND');
    const b = parse() ?? {};
    for (const k of ['task_name', 'tet_node_path', 'description', 'required_duration', 'collect_mode', 'sop']) if (b[k] !== undefined) t[k] = b[k];
    for (const k of ['task_photos', 'task_videos']) if (b[k] !== undefined) t[k] = [...new Set(b[k])];
    save();
    return json(res, 200, t);
  }

  return false;
}
