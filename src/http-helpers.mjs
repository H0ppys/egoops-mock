/**
 * HTTP 工具：JSON 响应、错误响应、时间戳、请求体读取（拆分自 mock/mock-egoops.mjs L36-53）
 */

export function json(res, code, body) {
  const s = JSON.stringify(body);
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': Buffer.byteLength(s) });
  res.end(s);
}

export function err(res, code, detail, extra = {}) { json(res, code, { detail, ...extra }); }

export const now = () => new Date().toISOString().slice(0, 19);

export function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', c => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}
