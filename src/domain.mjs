/**
 * 领域对象：任务草稿构造 + 提交审核前的校验（拆分自 mock/mock-egoops.mjs L221-247）
 */
import { now } from './http-helpers.mjs';
import { nextId, state } from './state.mjs';

export function newTask(taskSetId) {
  return {
    task_id: nextId('66'), task_set_id: taskSetId, task_name: '', tet_node_path: '', description: '',
    required_duration: 0, collect_mode: 'passive', collect_device_schema: null,
    sop: { steps: [] }, task_photos: [], task_videos: [], review_status: 'draft',
    created_at: now(),
  };
}

export function validateSite(s) {
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
