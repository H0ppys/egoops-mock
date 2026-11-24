/**
 * 冒烟自检：在独立临时目录起 mock（随机端口），按原接口契约走完整链路。
 *
 * 用法：
 *   node scripts/smoke.mjs
 *   SMOKE_ROOT=<目录> node scripts/smoke.mjs
 *
 * 覆盖：鉴权 → 场景树 → 建草稿采集点 → 追加任务 → 字段校验 → 媒体三段式（预签名直传 + complete）
 *       → 提交审核成功 → __mock 调试接口 → reset → 各种 404/401。
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const SMOKE_ROOT = process.env.SMOKE_ROOT
  ? path.resolve(process.env.SMOKE_ROOT)
  : path.join(os.tmpdir(), `egoops-mock-smoke-${process.pid}`);
fs.mkdirSync(SMOKE_ROOT, { recursive: true });
fs.rmSync(path.join(SMOKE_ROOT, 'state.json'), { force: true });
fs.rmSync(path.join(SMOKE_ROOT, 'storage'), { recursive: true, force: true });

// 关键：MOCK_ROOT 必须在 import src/config.mjs 之前生效
process.env.MOCK_ROOT = SMOKE_ROOT;
process.env.MOCK_PORT = '0';
const { start } = await import('../src/index.mjs');

const server = start(0);
await new Promise((r) => server.once('listening', r));
const base = `http://127.0.0.1:${server.address().port}`;
const AUTH = { Authorization: 'Bearer smoke-token' };

let failed = 0;
const check = (name, ok, extra = '') => {
  if (!ok) failed++;
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${extra ? '  ' + extra : ''}`);
};
const j = async (method, p, body, headers = AUTH) => {
  const res = await fetch(base + p, {
    method,
    headers: body === undefined ? headers : { 'Content-Type': 'application/json', ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let data = text;
  try { data = JSON.parse(text); } catch (_) {}
  return { status: res.status, data };
};

const noAuth = await j('GET', '/api/v1/tet-snapshots/active', undefined, {});
check('无 Bearer → 401 Not authenticated', noAuth.status === 401 && noAuth.data.detail === 'Not authenticated');

const snap = await j('GET', '/api/v1/tet-snapshots/active');
check('GET /api/v1/tet-snapshots/active', snap.status === 200 && snap.data.snapshot_id === 'mock-tet' && !!snap.data.snapshot_data.home);

const draft = await j('POST', '/api/v1/task-sets/allocate-draft', {});
const tsid = draft.data.task_set_id;
check('POST task-sets/allocate-draft（带默认任务）', draft.status === 200 && /^77\d+$/.test(tsid || ''));

const siteRead = await j('GET', `/api/v1/task-sets/${tsid}`);
check('GET task-sets/:id 任务统计', siteRead.status === 200 && siteRead.data.task_count === 1 && siteRead.data.tasks[0].photos === 0);

const addTask = await j('POST', `/api/v1/task-sets/${tsid}/tasks/allocate-draft`, {});
const tid2 = addTask.data.task_id;
check('POST tasks/allocate-draft 追加任务', addTask.status === 200 && /^66\d+$/.test(tid2 || ''));

const listTasks = await j('GET', `/api/v1/task-sets/${tsid}/tasks`);
check('GET task-sets/:id/tasks 列表', listTasks.status === 200 && listTasks.data.records.length === 2);

const patchEmpty = await j('PATCH', `/api/v1/task-sets/${tsid}`, { name: '  ' });
check('PATCH task-sets/:id 缺字段 → 400 COLLECTION_SITE_FIELDS_REQUIRED',
  patchEmpty.status === 400 && patchEmpty.data.detail === 'COLLECTION_SITE_FIELDS_REQUIRED');

const submitBad = await j('POST', `/api/v1/task-sets/${tsid}/submit-review`, {});
check('submit-review 校验失败 → 400 VALIDATION_FAILED（带 problems）',
  submitBad.status === 400 && submitBad.data.detail === 'VALIDATION_FAILED' && Array.isArray(submitBad.data.params?.problems));

const patchSite = await j('PATCH', `/api/v1/task-sets/${tsid}`, {
  name: '冒烟采集点', address: '测试路 1 号', tet_node_path: 'retail/convenience_store', description: '冒烟',
});
check('PATCH task-sets/:id 写入基础字段', patchSite.status === 200 && patchSite.data.name === '冒烟采集点');

const uploadReq = await j('POST', '/api/v1/media-assets/upload-url', {
  owner_type: 'task', owner_id: 'x', business_type: 'TASK_PHOTO', filename: 'a.jpg', content_type: 'image/jpeg', file_size: 1024,
});
const mediaId = uploadReq.data.media_id;
check('POST media-assets/upload-url 发预签名地址', uploadReq.status === 200 && typeof uploadReq.data.upload_url === 'string' && uploadReq.data.upload_url.includes(mediaId));

const putShort = await fetch(uploadReq.data.upload_url, { method: 'PUT', body: Buffer.alloc(10) });
check('PUT 预签名地址（原契约不校验尺寸：判据是 media.size，而 upload-url 只写了 file_size）', putShort.status === 200);

const putOk = await fetch(uploadReq.data.upload_url, { method: 'PUT', body: Buffer.alloc(1024, 7) });
check('PUT 预签名地址 直传成功（ETag）', putOk.status === 200 && !!putOk.headers.get('etag'));
check('storage/ 落盘', fs.existsSync(path.join(SMOKE_ROOT, 'storage', mediaId)));

const complete = await j('POST', `/api/v1/media-assets/${mediaId}/complete`, {});
check('POST media-assets/:id/complete', complete.status === 200 && complete.data.completed === true);

const patchTaskOk = await j('PATCH', `/api/v1/tasks/${listTasks.data.records[0].task_id}`, {
  task_name: '任务1', description: '冒烟描述', required_duration: 60, sop: { steps: ['步骤1'] },
  task_photos: [mediaId, mediaId], task_videos: [mediaId],
});
check('PATCH /api/v1/tasks/:id（photos 去重）',
  patchTaskOk.status === 200 && patchTaskOk.data.task_photos.length === 1 && patchTaskOk.data.required_duration === 60);

for (const t of listTasks.data.records.slice(1)) {
  await j('PATCH', `/api/v1/tasks/${t.task_id}`, {
    task_name: '任务2', description: '冒烟描述', required_duration: 30, sop: { steps: ['步骤1'] },
    task_photos: [mediaId], task_videos: [mediaId],
  });
}
const submitOk = await j('POST', `/api/v1/task-sets/${tsid}/submit-review`, {});
check('submit-review 通过 → review_status=submitted',
  submitOk.status === 200 && submitOk.data.review_status === 'submitted' && submitOk.data.tasks.every((t) => t.review_status === 'submitted'));

const lock = await j('PATCH', `/api/v1/task-sets/${tsid}`, { name: '改名' });
check('已提交后再 PATCH → 409 COLLECTION_SITE_CONTENT_LOCKED', lock.status === 409 && lock.data.detail === 'COLLECTION_SITE_CONTENT_LOCKED');

const allSites = await j('GET', '/api/v1/__mock/sites');
check('GET __mock/sites', allSites.status === 200 && allSites.data.sites.length === 1);

const notV1 = await j('GET', '/nope');
check('非 /api/v1/ 前缀 → 404 Not Found', notV1.status === 404 && notV1.data.detail === 'Not Found');

const unknownApi = await j('GET', '/api/v1/definitely-not-here');
check('/api/v1/ 未知路由 → 404 Not Found', unknownApi.status === 404 && unknownApi.data.detail === 'Not Found');

const bogusUpload = await fetch(`${base}/upload/not-exist`, { method: 'PUT', body: Buffer.alloc(1) });
check('PUT /upload/:未知 mediaId → 404 NoSuchKey', bogusUpload.status === 404);

const reset = await j('POST', '/api/v1/__mock/reset', {});
const afterReset = await j('GET', '/api/v1/__mock/sites');
check('POST __mock/reset 复位', reset.status === 200 && reset.data.ok === true && afterReset.data.sites.length === 0);
check('state.json 持久化', fs.existsSync(path.join(SMOKE_ROOT, 'state.json')));

server.close();
console.log(`\n${failed === 0 ? '全部通过' : failed + ' 项失败'}（临时目录：${SMOKE_ROOT}）`);
process.exit(failed ? 1 : 0);
