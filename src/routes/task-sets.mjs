/**
 * 采集点（task-set）链路（拆分自 mock/mock-egoops.mjs L104-173）
 *
 * POST   /api/v1/task-sets/allocate-draft            建草稿采集点 + 默认任务
 * GET    /api/v1/task-sets/:id                       查采集点（含任务统计）
 * PATCH  /api/v1/task-sets/:id                       改名称/场景/地址/描述（草稿或被驳回时）
 * GET    /api/v1/task-sets/:id/tasks                 任务列表
 * POST   /api/v1/task-sets/:id/tasks/allocate-draft  追加任务草稿
 * POST   /api/v1/task-sets/:id/submit-review         提交审核（先跑 validateSite）
 */
import { err, json, now } from '../http-helpers.mjs';
import { newTask, validateSite } from '../domain.mjs';
import { nextId, save, state } from '../state.mjs';
import { siteView } from '../views.mjs';

export async function handleTaskSetRoutes(ctx) {
  const { res, p, parse } = ctx;
  const m = ctx.method;
  let mm;

  // POST /api/v1/task-sets/allocate-draft
  if (m === 'POST' && p === '/api/v1/task-sets/allocate-draft') {
    const tsid = nextId('77');
    const site = {
      task_set_id: tsid, project_id: '09893824', project_name: 'DVT阶段渠道商录制',
      name: `未命名采集点-${tsid}`, vendor_id: 'tenant_8a4ea824', vendor_name: '湛江盛宴科技有限公司',
      priority: 'medium', status: 'pending', dispatched_at: null, created_by: 'mock', created_by_name: 'mock',
      created_at: now(), work_mode: 'site_organization', tet_node_path: '', address: '', description: '',
      site_photos: [], review_status: 'draft', review_comment: null, reviewed_by: null, reviewed_at: null,
      review_content_modified: false, approved_duration: null, restore_available: false, collectors: [],
      collected_duration: 0, uploaded_duration: 0, pass_duration: 0, reviewed_duration: 0,
      task_count: 0, over_collected_task_count: 0, completed_task_count: 0, total_required_duration: 0,
      stats: {},
    };
    state.sites.push(site);
    // 默认任务草稿
    const task = newTask(tsid);
    state.tasks.push(task);
    save();
    return json(res, 200, site);
  }

  // GET /api/v1/task-sets/:id
  mm = p.match(/^\/api\/v1\/task-sets\/([^/]+)$/);
  if (mm && m === 'GET') {
    const s = state.sites.find(x => x.task_set_id === mm[1]);
    return s ? json(res, 200, siteView(s)) : err(res, 404, 'COLLECTION_TASK_SET_NOT_FOUND');
  }
  // PATCH /api/v1/task-sets/:id
  if (mm && m === 'PATCH') {
    const s = state.sites.find(x => x.task_set_id === mm[1]);
    if (!s) return err(res, 404, 'COLLECTION_TASK_SET_NOT_FOUND');
    if (!['draft', 'rejected'].includes(s.review_status)) return err(res, 409, 'COLLECTION_SITE_CONTENT_LOCKED');
    const b = parse() ?? {};
    for (const k of ['name', 'tet_node_path', 'address', 'description']) if (b[k] !== undefined) s[k] = b[k];
    if (!s.name?.trim() || !s.address?.trim() || !s.tet_node_path?.trim()) return err(res, 400, 'COLLECTION_SITE_FIELDS_REQUIRED');
    s.updated_at = now();
    save();
    return json(res, 200, siteView(s));
  }
  // GET /api/v1/task-sets/:id/tasks
  mm = p.match(/^\/api\/v1\/task-sets\/([^/]+)\/tasks$/);
  if (mm && m === 'GET') {
    const recs = state.tasks.filter(t => t.task_set_id === mm[1]);
    return json(res, 200, { records: recs, current: 1, size: recs.length, total: recs.length });
  }
  // POST /api/v1/task-sets/:id/tasks/allocate-draft
  mm = p.match(/^\/api\/v1\/task-sets\/([^/]+)\/tasks\/allocate-draft$/);
  if (mm && m === 'POST') {
    const s = state.sites.find(x => x.task_set_id === mm[1]);
    if (!s) return err(res, 404, 'COLLECTION_TASK_SET_NOT_FOUND');
    const t = newTask(s.task_set_id);
    state.tasks.push(t);
    save();
    return json(res, 200, t);
  }
  // POST /api/v1/task-sets/:id/submit-review
  mm = p.match(/^\/api\/v1\/task-sets\/([^/]+)\/submit-review$/);
  if (mm && m === 'POST') {
    const s = state.sites.find(x => x.task_set_id === mm[1]);
    if (!s) return err(res, 404, 'COLLECTION_TASK_SET_NOT_FOUND');
    if (!['draft', 'rejected'].includes(s.review_status)) return err(res, 409, 'COLLECTION_SITE_CONTENT_LOCKED');
    const problems = validateSite(s);
    if (problems.length) return err(res, 400, 'VALIDATION_FAILED', { params: { problems } });
    s.review_status = 'submitted';
    s.submitted_at = now();
    for (const t of state.tasks.filter(t => t.task_set_id === s.task_set_id)) t.review_status = 'submitted';
    save();
    return json(res, 200, siteView(s));
  }

  return false;
}
