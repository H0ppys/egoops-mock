/**
 * 模块出口（拆分自 mock/mock-egoops.mjs L249 的 listen 段）
 *
 * 供根目录 mock-egoops.mjs 与冒烟脚本使用：
 *   import { start } from './src/index.mjs';
 *   const server = start(0);   // 0 = 随机端口；也可用 MOCK_PORT 环境变量
 */
import { pathToFileURL } from 'node:url';
import { PORT, setPort } from './config.mjs';
import { createApp } from './app.mjs';

export { createApp };

export function start(port = PORT) {
  const server = createApp();
  server.listen(port, '0.0.0.0', () => {
    setPort(server.address().port);   // 端口 0 时回填真实端口，供 upload_url 拼装
    console.log(`mock egoops on http://127.0.0.1:${PORT}`);
  });
  return server;
}

// 直接 `node src/index.mjs` 时自启；被 import 时不自启（便于冒烟测试）
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) start();
