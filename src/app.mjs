/**
 * HTTP 服务实例（拆分自 mock/mock-egoops.mjs L71 的 http.createServer 调用）
 */
import http from 'node:http';
import { handle } from './router.mjs';

export function createApp() {
  return http.createServer(handle);
}
