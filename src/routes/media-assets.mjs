/**
 * 媒体三段式（拆分自 mock/mock-egoops.mjs L187-212）
 *
 * POST /api/v1/media-assets/upload-url        申请上传地址（含数量上限 TASK_PHOTO 9 / TASK_VIDEO 3）
 * POST /api/v1/media-assets/:id/complete      标记完成（文件必须已经在 storage 里）
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { err, json, now } from '../http-helpers.mjs';
import { PORT, STORAGE } from '../config.mjs';
import { nextId, save, state } from '../state.mjs';

export async function handleMediaAssetRoutes(ctx) {
  const { res, p, parse } = ctx;
  const m = ctx.method;
  let mm;

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

  return false;
}
