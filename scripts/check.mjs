/**
 * 语法自检：递归对仓库内所有 .mjs 逐个跑 node --check
 * 用法：npm run check
 *
 * 说明：用 stdio:'inherit' 而不是默认管道，避免在受限沙箱（禁止子进程管道）里被拒绝。
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === 'node_modules' || e.name.startsWith('.')) continue;
      walk(full, out);
    } else if (e.name.endsWith('.mjs')) {
      out.push(full);
    }
  }
  return out;
}

const files = walk(ROOT).sort();
let failed = 0;
for (const f of files) {
  const r = spawnSync(process.execPath, ['--check', f], { cwd: ROOT, stdio: 'inherit' });
  const ok = r.status === 0;
  if (!ok) failed++;
  console.log(`${ok ? 'OK  ' : 'FAIL'} node --check ${path.relative(ROOT, f)}`);
}
console.log(`\n${files.length - failed}/${files.length} file(s) pass node --check`);
process.exit(failed ? 1 : 0);
