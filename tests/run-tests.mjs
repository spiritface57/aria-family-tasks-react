import {execFileSync} from 'node:child_process';
import {readFileSync,writeFileSync,unlinkSync} from 'node:fs';
const dir=new URL('.',import.meta.url).pathname;
try{
  execFileSync('tsc',['--module','es2022','--target','es2022','--skipLibCheck','--moduleResolution','node','--outDir',dir,'--rootDir',new URL('../src/',import.meta.url).pathname,new URL('../src/lib/schedule.ts',import.meta.url).pathname],{stdio:'pipe'});
  let compiled=readFileSync(new URL('./lib/schedule.js',import.meta.url),'utf8');
  compiled=compiled.replace(/from ['"]\.\.\/types['"]/g,"from '../types.js'");
  writeFileSync(new URL('./schedule.compiled.mjs',import.meta.url),compiled);
  execFileSync('node',['--test',new URL('./schedule.test.mjs',import.meta.url).pathname],{stdio:'inherit'});
}finally{
  for(const p of ['./schedule.compiled.mjs','./lib/schedule.js','./types.js'])try{unlinkSync(new URL(p,import.meta.url));}catch{}
}
