/**
 * mock 服务入口（入口名保持 mock-egoops.mjs，只做转发到 src/）
 *
 * 原 mock/mock-egoops.mjs（249 行）已按路由域拆到 src/*.mjs，完整原件见 legacy/mock-egoops.mjs。
 * 运行方式与原文件一致：node mock-egoops.mjs（端口 MOCK_PORT，默认 18080）
 */
import { start } from './src/index.mjs';

start();
