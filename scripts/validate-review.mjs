#!/usr/bin/env node
import { findBrowser } from './browser.mjs';
import { mkdtempSync, rmSync, readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';

const htmlPath = process.argv[2];
const prdArg = process.argv.indexOf('--prd');
if (prdArg !== -1 && !process.argv[prdArg + 1]) { console.error('--prd 需要指定 Markdown 文件'); process.exit(2); }
const prdPath = prdArg === -1 ? null : process.argv[prdArg + 1];
const prdDiagrams = prdPath ? [...readFileSync(prdPath,'utf8').matchAll(/^```mermaid[ \t]*\r?\n([\s\S]*?)^```[ \t]*$/gm)].map(m=>createHash('sha256').update(m[1].trim(),'utf8').digest('hex')) : [];

if (!htmlPath) {
  console.error('用法: validate-review.mjs <原型.html> [--prd <PRD.md>]');
  process.exit(2);
}
if (typeof WebSocket === 'undefined') {
  console.error('需要 Node.js 22+（内置 WebSocket）');
  process.exit(2);
}

let chromePath;
try { chromePath = findBrowser(); } catch (error) {
  console.error(error.message); process.exit(2);
}

const freePort = () => new Promise((resolvePort, reject) => {
  const server = createServer();
  server.once('error', reject);
  server.listen(0, '127.0.0.1', () => {
    const { port } = server.address();
    server.close(error => error ? reject(error) : resolvePort(port));
  });
});
const wait = ms => new Promise(resolveWait => setTimeout(resolveWait, ms));

const port = await freePort();
const profileDir = mkdtempSync(join(tmpdir(), 'proto-editor-qa-'));
const chromeArgs = ['--headless=new', '--disable-gpu', '--remote-debugging-address=127.0.0.1', `--remote-debugging-port=${port}`, `--user-data-dir=${profileDir}`, 'about:blank'];
if (process.platform === 'linux') chromeArgs.splice(2, 0, '--no-sandbox', '--disable-dev-shm-usage');
const chrome = spawn(chromePath, chromeArgs, { stdio: 'ignore' });
let ws;

try {
  let page;
  for (let i = 0; i < 160; i++) {
    try {
      const targets = await fetch(`http://127.0.0.1:${port}/json`).then(response => response.json());
      page = targets.find(target => target.type === 'page');
      if (page) break;
    } catch {}
    await wait(125);
  }
  if (!page) throw new Error('Chrome 启动超时');

  ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolveOpen, reject) => {
    ws.addEventListener('open', resolveOpen, { once: true });
    ws.addEventListener('error', reject, { once: true });
  });
  let seq = 0;
  const pending = new Map();
  ws.addEventListener('message', event => {
    const message = JSON.parse(event.data);
    if (!message.id || !pending.has(message.id)) return;
    const callback = pending.get(message.id);
    pending.delete(message.id);
    if (message.error) callback.reject(new Error(message.error.message));
    else callback.resolve(message.result);
  });
  const send = (method, params = {}) => new Promise((resolveSend, reject) => {
    const id = ++seq;
    pending.set(id, { resolve: resolveSend, reject });
    ws.send(JSON.stringify({ id, method, params }));
  });
  const evaluate = async expression => {
    const result = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
    return result.result.value;
  };

  await send('Page.enable');
  await send('Page.navigate', { url: pathToFileURL(resolve(htmlPath)).href });
  for (let i = 0; i < 40; i++) {
    if (await evaluate(`!!document.querySelector('.proto-editor-launcher')`)) break;
    await wait(125);
  }
  await wait(300);
  const audit=await evaluate(`(()=>({features:document.querySelectorAll('.rc-feature').length,boards:document.querySelectorAll('.rc-board').length,edges:document.querySelectorAll('.rc-edge').length,wide:[...document.querySelectorAll('.review-product-stage')].filter(x=>{const p=x.closest('[data-review-panel]'),active=p?.classList.contains('review-current');p?.classList.add('review-current');const bad=x.querySelector('.prototype-viewport')?.getBoundingClientRect().width>x.clientWidth+1;if(!active)p?.classList.remove('review-current');return bad}).length,actions:[...document.querySelectorAll('.prototype-viewport [data-review-test-action]')].map(x=>x.dataset.reviewTestAction)}))()`);
  const featureStyle=await evaluate(`(()=>{const card=document.querySelector('.rc-feature')?.closest('.review-diagram-card');return card&&getComputedStyle(card).backgroundColor==='rgb(255, 255, 255)'})()`);
  if(!featureStyle)throw Error('功能结构缺少白底图卡');
  const oldNames=await evaluate(`[...document.querySelectorAll('[data-review-panel]')].filter(p=>/功能.*(改动总览|变更范围)/.test(p.dataset.reviewTitle||'')).map(p=>p.dataset.reviewTitle)`);
  if(oldNames.length)throw Error('功能结构目录与页标题应使用「功能结构」，变更标在图内');
  const wrongTheme=await evaluate(`[...document.querySelectorAll('svg[data-prd-diagram-index]')].some(s=>s.getAttribute('data-review-diagram-theme')!=='review-blue-v1')`);
  if(wrongTheme)throw Error('PRD 图示未使用公共评审配色，请使用当前转换脚本重新渲染');
  const duplicateSwitch=await evaluate(`[...document.querySelectorAll('[data-review-panel="demo"] .demo-switch,[data-review-page-switch]')].some(x=>!x.closest('.prototype-viewport'))`);
  if(duplicateSwitch)throw Error('业务页必须通过左侧目录切换，不能在内容区另造页面导航');
  if(prdPath && prdDiagrams.length){
    const actual=await evaluate(`[...document.querySelectorAll('svg[data-prd-diagram-index][data-prd-diagram-sha256]')].map(s=>({index:s.getAttribute('data-prd-diagram-index'),hash:s.getAttribute('data-prd-diagram-sha256'),content:!!s.querySelector('path,rect,polygon,line,text')}))`);
    for(let i=0;i<prdDiagrams.length;i++){
      const matches=actual.filter(x=>x.index===String(i)&&x.hash===prdDiagrams[i]&&x.content);
      if(matches.length!==1)throw Error('PRD Mermaid 第 '+(i+1)+' 张缺少对应 SVG，或来源指纹不一致');
    }
    if(actual.length!==prdDiagrams.length)throw Error('PRD 图示数量与标记的 SVG 数量不一致');
    console.log('✓ PRD 图示来源指纹与 SVG 数量核对通过：'+prdDiagrams.length+' 张；仍需人工检查图形与语义');
  }
  const missingDiagrams=await evaluate(`[...document.querySelectorAll('[data-review-panel="requirements"]')].filter(p=>/业务流程|关键时序|状态图/.test(p.dataset.reviewTitle||'')&&!p.querySelector('svg')).map(p=>p.dataset.reviewTitle)`);
  if(missingDiagrams.length)throw Error('图示页面缺少 SVG：'+missingDiagrams.join('、'));
  const bareDiagrams=await evaluate(`[...document.querySelectorAll('[data-review-panel="requirements"] svg')].filter(svg=>{const p=svg.closest('[data-review-panel]');if(!/流程|时序|状态/.test(p.dataset.reviewTitle||''))return false;const c=svg.closest('.review-diagram-card,.review-flow,.flow-overview');return !c||getComputedStyle(c).backgroundColor!=='rgb(255, 255, 255)'}).length`);
  if(bareDiagrams)throw Error('流程/时序/状态图缺少白底卡片容器');
  const badNavigation=await evaluate(`[...document.querySelectorAll('[data-review-nav] [data-review-link]')].filter(a=>!document.getElementById(a.dataset.reviewLink)?.matches('[data-review-panel]')).map(a=>a.textContent)`);
  if(badNavigation.length)throw Error('目录必须指向独立页面，不能指向页内章节：'+badNavigation.join('、'));
  const navigationWorks=await evaluate(`(()=>{const ids=[...document.querySelectorAll('[data-review-nav] [data-review-link]')].map(a=>a.dataset.reviewLink);for(const id of ids){const a=[...document.querySelectorAll('[data-review-nav] [data-review-link]')].find(x=>x.dataset.reviewLink===id);a.click();const active=[...document.querySelectorAll('[data-review-panel].review-current')];if(active.length!==1||active[0].id!==id||scrollY!==0)return false}return true})()`);
  if(!navigationWorks)throw Error('目录切换未做到单页显示或切换归顶');
  if(!audit.features||!audit.boards)throw Error('缺少实际功能结构组件或静态画板组件');
  if(audit.wide)throw Error('产品视口宽于容器，需适配外层布局，不能用嵌套滚动掩盖');
  if(!audit.actions.length)throw Error('缺少data-review-test-action代表性交互：请标记查询、页签或详情等真实按钮');
  const actionTargets=await evaluate(`[...document.querySelectorAll('.prototype-viewport [data-review-test-action]')].map(x=>({action:x.dataset.reviewTestAction,page:x.closest('[data-review-panel]').id}))`);
  for(const {action,page} of actionTargets){
    await evaluate(`(()=>{document.querySelector('[data-review-link="'+${JSON.stringify(page)}+'"]').click();const p=document.getElementById(${JSON.stringify(page)});const x=[...p.querySelectorAll('[data-review-test-action]')].find(x=>x.dataset.reviewTestAction===${JSON.stringify(action)});if(!x)throw Error('操作入口已丢失');x.click()})()`);
    await wait(150);
    const count=await evaluate(`document.getElementById(${JSON.stringify(page)}).querySelectorAll('.prototype-viewport [data-proto-edit]').length`);
    if(!count)throw Error(page+' / '+action+' 操作后本页产品文案编辑绑定全部丢失');
  }
  // Inspect every page at the actual review widths; screenshots are evidence, not a visual-quality score.
  const shotsAt=process.argv.indexOf('--screenshots');
  if(shotsAt!==-1&&!process.argv[shotsAt+1])throw Error('--screenshots 需要目录');
  const shotDir=shotsAt===-1?null:resolve(process.argv[shotsAt+1]);
  if(shotDir)mkdirSync(shotDir,{recursive:true});
  const pages=await evaluate(`[...document.querySelectorAll('[data-review-panel]')].map(p=>p.id)`);
  for(const width of [1440,1920]){
    await send('Emulation.setDeviceMetricsOverride',{width,height:1080,deviceScaleFactor:1,mobile:false});
    for(const id of pages){
      await evaluate(`document.querySelector('[data-review-link="'+${JSON.stringify(id)}+'"]').click()`);
      await wait(100);
      const clipped=await evaluate(`(()=>{const p=document.getElementById(${JSON.stringify(id)});return [...p.querySelectorAll('.rc-static-ui')].filter(n=>n.scrollHeight>n.clientHeight+3||n.scrollWidth>n.clientWidth+3).length})()`);
      if(clipped)throw Error(width+'px / '+id+' 静态画板内容超出固定尺寸，请增大画板或修复布局');
      const wide=await evaluate(`document.documentElement.scrollWidth>innerWidth+2`);
      if(wide)throw Error(width+'px / '+id+' 页面横向溢出');
      if(shotDir){const shot=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});writeFileSync(join(shotDir,width+'-'+id.replace(/[^a-zA-Z0-9_-]/g,'_')+'.png'),Buffer.from(shot.data,'base64'))}
    }
  }
  console.log('✓ 1440/1920 全目录页无整页横向溢出、静态画板无尺寸裁切'+(shotDir?'；逐页截图已保存':''));
  console.log('✓ 评审组件、视口宽度及 '+audit.actions.length+' 个操作后的编辑绑定检查通过');

} catch (error) {
  console.error(`✗ 评审结构验收失败：${error.message}`);
  process.exitCode = 1;
} finally {
  try { ws?.close(); } catch {}
  if (chrome.exitCode === null) chrome.kill('SIGTERM');
  await Promise.race([new Promise(resolveExit => chrome.once('exit', resolveExit)), wait(1500)]);
  if (chrome.exitCode === null) {
    chrome.kill('SIGKILL');
    await Promise.race([new Promise(resolveExit => chrome.once('exit', resolveExit)), wait(1000)]);
  }
  try {
    rmSync(profileDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  } catch (error) {
    console.warn(`! 临时浏览器目录稍后由系统清理：${error.code || error.message}`);
  }
}
