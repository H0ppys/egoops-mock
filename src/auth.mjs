/**
 * 鉴权：只认 `Authorization: Bearer ...` 存在与否（拆分自 mock/mock-egoops.mjs L55-59）
 *
 * mock 不校验 token 内容，只看有没有 Bearer 头；返回 false 时已写好 401。
 */
import { err } from './http-helpers.mjs';

export function auth(req, res) {
  const h = req.headers.authorization || '';
  if (!h.startsWith('Bearer ')) { err(res, 401, 'Not authenticated'); return false; }
  return true;
}
