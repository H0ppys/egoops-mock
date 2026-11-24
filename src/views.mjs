/**
 * 视图拼装：采集点 + 任务统计（拆分自 mock/mock-egoops.mjs L61-68）
 */
import { state } from './state.mjs';

export function siteView(s) {
  const tasks = state.tasks.filter(t => t.task_set_id === s.task_set_id);
  return {
    ...s,
    task_count: tasks.length,
    tasks: tasks.map(t => ({ ...t, photos: t.task_photos.length, videos: t.task_videos.length })),
  };
}
