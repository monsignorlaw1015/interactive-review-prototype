#!/usr/bin/env node
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import { findBrowser } from './browser.mjs';
const require = createRequire(import.meta.url);
let failed = false;
function check(label, action) {
  try { console.log('✓ ' + label + ': ' + action()); }
  catch (error) { failed = true; console.error('✗ ' + label + ': ' + error.message); }
}
check('Node.js', () => { if (Number(process.versions.node.split('.')[0]) < 22 || typeof WebSocket === 'undefined') throw Error('需要 Node.js 22+'); return process.version; });
check('Chrome/Chromium', () => {
  const file = findBrowser();
  const result = spawnSync(file, ['--headless=new', '--disable-gpu', ...(process.platform === 'linux' ? ['--no-sandbox', '--disable-dev-shm-usage'] : []), '--dump-dom', 'about:blank'], { encoding: 'utf8', timeout: 20000 });
  if (result.error || result.status !== 0 || !result.stdout.includes('<html')) throw Error('浏览器无法无头启动；请检查系统依赖、执行权限及沙箱限制。');
  return file;
});
for (const name of ['mermaid', 'playwright-core']) check(name, () => { try { return require.resolve(name + '/package.json'); } catch { throw Error('缺少依赖，请在 Skill 目录执行 npm ci'); } });
process.exitCode = failed ? 1 : 0;
