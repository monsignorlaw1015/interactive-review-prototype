#!/usr/bin/env node
import {readFileSync,writeFileSync} from 'node:fs';
import {dirname,resolve,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const files=process.argv.slice(2);if(!files.length){console.error('用法: node assemble.mjs <原型.html> [...]');process.exit(2)}
for(const file of files){
 let html=readFileSync(file,'utf8');
 for(const [kind,asset,tag] of [['css','review-shell.css','style'],['js','review-shell.js','script']]){
  const start=`<!-- @review-shell:${kind}:start -->`,end=`<!-- @review-shell:${kind}:end -->`;
  if(html.split(start).length!==2||html.split(end).length!==2||html.indexOf(end)<html.indexOf(start))throw Error(`${file}: ${kind} 标记必须成对且唯一`);
  const a=html.indexOf(start)+start.length,b=html.indexOf(end);html=html.slice(0,a)+`\n<${tag}>\n${readFileSync(join(root,'assets',asset),'utf8')+'\n'+readFileSync(join(root,'assets',kind==='css'?'review-components.css':'review-components.js'),'utf8')}\n</${tag}>\n`+html.slice(b);
 }
 writeFileSync(file,html);execFileSync(process.execPath,[join(root,'assets/inject-assets.mjs'),resolve(file)],{stdio:'inherit'});
}
