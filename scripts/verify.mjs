#!/usr/bin/env node
import {resolve,dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
const [html,prd,evidence]=process.argv.slice(2);
if(!html||!prd||!evidence){console.error('用法: node verify.mjs 原型.html PRD.md 证据目录');process.exit(2)}
const root=dirname(fileURLToPath(import.meta.url)),dir=resolve(evidence);mkdirSync(dir,{recursive:true});
const receipt=join(dir,'verification.json');
// Invalidate an earlier pass before starting: file revisions need fresh evidence.
writeFileSync(receipt,JSON.stringify({status:'running',html:resolve(html)},null,2));
const logs=[];
for(const [script,args] of [['validate-editor.mjs',[resolve(html)]],['validate-review.mjs',[resolve(html),'--prd',resolve(prd),'--screenshots',join(dir,'screenshots')]]]){
 const r=spawnSync(process.execPath,[join(root,script),...args],{encoding:'utf8'});const output=(r.stdout||'')+(r.stderr||'');process.stdout.write(output);logs.push({script,exitCode:r.status,output});
 if(r.status!==0){writeFileSync(receipt,JSON.stringify({status:'failed',checks:logs},null,2));process.exit(1)}
}
const hash=p=>createHash('sha256').update(readFileSync(p)).digest('hex');
writeFileSync(receipt,JSON.stringify({status:'automated-checks-passed',checkedAt:new Date().toISOString(),html:resolve(html),htmlSha256:hash(html),prd:resolve(prd),prdSha256:hash(prd),checks:logs,remaining:'必须目检截图、对照需求验证业务场景及导出重开；此结果不证明视觉质量或全业务正确。'},null,2));
console.log('✓ 验收记录已保存；自动通过不等于视觉及业务验收完成');
