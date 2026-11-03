import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {normalize} from './normalize.mjs';
const sources=JSON.parse(await readFile(new URL('../config/sources.json',import.meta.url),'utf8'));
const records=[];
for(const [name,source] of [['bpsc-noncadre',sources[0]],['teletalk-dgms',sources[1]]]) {
  const raw=await readFile(new URL(`../evidence/${name}.txt`,import.meta.url),'utf8');
  records.push(...normalize(JSON.parse(raw.split('\n')[0].replace(/^Result: /,'')),source));
}
const dir=new URL('../examples/',import.meta.url);
await mkdir(dir,{recursive:true});
await writeFile(new URL('observed-records.json',dir),JSON.stringify(records,null,2));
console.log(`Saved ${records.length} evidence-backed review records`);
