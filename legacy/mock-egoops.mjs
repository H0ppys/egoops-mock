// EgoOps 模拟服务：复刻「申请采集点」链路的接口契约，用于本机端到端验证。
// 不连美团线上，所有数据落在 mock/storage 下。
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const PORT = Number(process.env.MOCK_PORT || 18080);
const ROOT = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const STORAGE = path.join(ROOT, 'storage');
const STATE = path.join(ROOT, 'state.json');
fs.mkdirSync(STORAGE, { recursive: true });

// ---------- 状态 ----------
const defaultState = { sites: [], tasks: [], media: [], seq: 1000 };
const state = fs.existsSync(STATE) ? JSON.parse(fs.readFileSync(STATE, 'utf8')) : structuredClone(defaultState);
const save = () => fs.writeFileSync(STATE, JSON.stringify(state, null, 2));

const TET = {
  home: {
    name_zh: '居家', name_en: 'home', level: 1, status: 'active',
    children: {
      detached_house: { name_zh: '自建房', name_en: 'detached_house', level: 2, status: 'active' },
      apartment: { name_zh: '公寓', name_en: 'apartment', level: 2, status: 'active' },
    },
  },
  supermarket: {
    name_zh: '商超', name_en: 'supermarket', level: 1, status: 'active',
    children: {
      convenience_store: { name_zh: '便利店', name_en: 'convenience_store', level: 2, status: 'active' },
      warehouse_store: { name_zh: '仓储超市', name_en: 'warehouse_store', level: 2, status: 'active' },
    },
  },
};

// ---------- 工具 ----------
function json(res, code, body) {
  const s = JSON.stringify(body);
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': Buffer.byteLength(s) });
  res.end(s);
}
function err(res, code, detail, extra = {}) { json(res, code, { detail, ...extra }); }
const now = () => new Date().toISOString().slice(0, 19);
const nextId = (p) => `${p}${++state.seq}`;

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', c => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

function auth(req, res) {
  const h = req.headers.authorization || '';
  if (!h.startsWith('Bearer ')) { err(res, 401, 'Not authenticated'); return false; }
  return true;
}

function siteView(s) {
  const tasks = state.tasks.filter(t => t.task_set_id === s.task_set_id);
  return {
    ...s,
    task_count: tasks.length,
    tasks: tasks.map(t => ({ ...t, photos: t.task_photos.length, videos: t.task_videos.length })),
  };
}

// ---------- 路由 ----------
const server = http.createServer(async (req, res) => {
  const u = new URL(req.url, `http://127.0.0.1:${PORT}`);
  const p = u.pathname;
  const m = req.method;

  // 预签名上传（模拟对象存储）：PUT
  if (m === 'PUT' && p.startsWith('/upload/')) {
    const mediaId = p.split('/')[2];
    const buf = await readBody(req);
    const media = state.media.find(x => x.media_id === mediaId);
    if (!media) return err(res, 404, 'NoSuchKey');
    if (media.size && buf.length !== media.size) return err(res, 400, 'size mismatch', { expected: media.size, got: buf.length });
    fs.writeFileSync(path.join(STORAGE, mediaId), buf);
    media.uploaded_at = now();
    media.bytes = buf.length;
    save();
    res.writeHead(200, { ETag: `"${crypto.createHash('md5').update(buf).digest('hex')}"` });
    return res.end();
  }

  if (!p.startsWith('/api/v1/')) return err(res, 404, 'Not Found');
  if (!auth(req, res)) return;

  const body = m === 'GET' || m === 'DELETE' ? null : await readBody(req);
  const parse = () => { try { return body?.length ? JSON.parse(body.toString('utf8')) : {}; } catch { return null; } };

  // GET /api/v1/tet-snapshots/active
  if (m === 'GET' && p === '/api/v1/tet-snapshots/active') {
    return json(res, 200, {
      snapshot_id: 'mock-tet', received_at: now(), node_count: 6, is_active: true, snapshot_data: TET,
    });
  }

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
  let mm = p.match(/^\/api\/v1\/task-sets\/([^/]+)$/);
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

  // POST /api/v1/media-assets/upload-url
  if (m === 'POST' && p === '/api/v1/media-assets/upload-url') {
    const b = parse() ?? {};
    const need = ['owner_type', 'owner_id', 'business_type', 'filename', 'content_type', 'file_size'];
    for (const k of need) if (!b[k]) return err(res, 400, `missing ${k}`);
    const limits = { TASK_PHOTO: 9, TASK_VIDEO: 3 };
    const existing = state.media.filter(x => x.owner_id === b.owner_id && x.business_type === b.business_type);
    if (existing.length >= (limits[b.business_type] ?? 99)) return err(res, 409, `MEDIA_LIMIT_REACHED`);
    const mediaId = nextId('m');
    const media = { media_id: mediaId, ...b, created_at: now(), uploaded_at: null, completed_at: null, bytes: 0 };
    state.media.push(media);
    save();
    const upload_url = `http://127.0.0.1:${PORT}/upload/${mediaId}?sig=${crypto.randomBytes(8).toString('hex')}`;
    return json(res, 200, { media_id: mediaId, upload_url, expires_in: 3600 });
  }
  // POST /api/v1/media-assets/:id/complete
  mm = p.match(/^\/api\/v1\/media-assets\/([^/]+)\/complete$/);
  if (mm && m === 'POST') {
    const media = state.media.find(x => x.media_id === mm[1]);
    if (!media) return err(res, 404, 'COLLECTION_RESOURCE_NOT_FOUND');
    const file = path.join(STORAGE, media.media_id);
    if (!fs.existsSync(file)) return err(res, 400, 'UPLOAD_INCOMPLETE');
    media.completed_at = now();
    save();
    return json(res, 200, { media_id: media.media_id, completed: true });
  }

  // GET /api/v1/__mock/sites （测试用：查看全部）
  if (m === 'GET' && p === '/api/v1/__mock/sites') return json(res, 200, { sites: state.sites.map(siteView) });
  if (m === 'POST' && p === '/api/v1/__mock/reset') { Object.assign(state, structuredClone(defaultState)); save(); return json(res, 200, { ok: true }); }

  return err(res, 404, 'Not Found');
});

function newTask(taskSetId) {
  return {
    task_id: nextId('66'), task_set_id: taskSetId, task_name: '', tet_node_path: '', description: '',
    required_duration: 0, collect_mode: 'passive', collect_device_schema: null,
    sop: { steps: [] }, task_photos: [], task_videos: [], review_status: 'draft',
    created_at: now(),
  };
}

function validateSite(s) {
  const problems = [];
  if (!s.name?.trim()) problems.push('采集点名称必填');
  if (!s.address?.trim()) problems.push('现场地址必填');
  if (!s.tet_node_path?.trim()) problems.push('采集场景分类必填');
  const tasks = state.tasks.filter(t => t.task_set_id === s.task_set_id);
  if (!tasks.length) problems.push('至少需要一个任务');
  for (const [i, t] of tasks.entries()) {
    const n = i + 1;
    if (!t.task_name?.trim()) problems.push(`任务${n} 名称必填`);
    if (!t.description?.trim()) problems.push(`任务${n} 描述必填`);
    if (!(t.required_duration > 0)) problems.push(`任务${n} 预计时长必须大于 0`);
    if (!t.task_photos.length) problems.push(`任务${n} 至少一张照片`);
    if (!t.task_videos.length) problems.push(`任务${n} 至少一个视频`);
    if (!t.sop?.steps?.filter(Boolean).length) problems.push(`任务${n} 至少一条 SOP`);
  }
  return problems;
}

server.listen(PORT, '0.0.0.0', () => console.log(`mock egoops on http://127.0.0.1:${PORT}`));
