/**
 * 配置与路径（拆分自 mock/mock-egoops.mjs L8-12）
 *
 * 与原文件的差异：目录定位改用 fileURLToPath，不再用 `new URL(...).pathname` 手工去盘符；
 * 另加 MOCK_ROOT 环境变量便于冒烟测试指到临时目录。
 * PORT 用 live binding：listen(0) 时由 src/index.mjs 调 setPort(实际端口) 回填，
 * 保证 /api/v1/media-assets/upload-url 返回的预签名地址端口正确。
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = process.env.MOCK_ROOT
  ? path.resolve(process.env.MOCK_ROOT)
  : path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export let PORT = Number(process.env.MOCK_PORT || 18080);
export function setPort(p) { PORT = Number(p); }

export const STORAGE = path.join(ROOT, 'storage');
export const STATE = path.join(ROOT, 'state.json');
fs.mkdirSync(STORAGE, { recursive: true });
