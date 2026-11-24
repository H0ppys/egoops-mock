/**
 * 预签名直传（拆分自 mock/mock-egoops.mjs L76-89）
 *
 * PUT /upload/:mediaId       模拟对象存储：把请求体写到 storage/:mediaId，返回 MD5 ETag
 * 注意这条路由在 /api/v1 前缀与鉴权判断之前，原文件的顺序也一样。
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { err, now, readBody } from '../http-helpers.mjs';
import { STORAGE } from '../config.mjs';
import { save, state } from '../state.mjs';

export async function handleUploadRoute(ctx) {
  const { req, res, p } = ctx;
  const m = ctx.method;

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

  return false;
}
