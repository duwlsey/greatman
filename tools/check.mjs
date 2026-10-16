import assert from 'node:assert/strict';
import {readFile,stat} from 'node:fs/promises';
import {people,verses,lyricNames,kingNames} from '../data.mjs';
import {learning} from '../learning.mjs';
import {contexts} from '../context.mjs';
import {buildPrintMarkup} from '../print-layout.mjs';
assert.equal(verses.length,5);
const printMarkup=buildPrintMarkup();
assert.equal((printMarkup.match(/class="print-sheet"/g)||[]).length,2);
assert.equal((printMarkup.match(/class="print-verse"/g)||[]).length,5);
assert.equal((printMarkup.match(/class="print-line"/g)||[]).length,verses.reduce((sum,verse)=>sum+verse.split('\n').length,0));
for(const name of Object.keys(people)){assert(learning[name]?.easy,name+' needs an easy explanation');assert(learning[name]?.lesson,name+' needs a learning sentence')}
assert(contexts['이완용'].critical);assert(contexts['이수일']&&!contexts['이수일'].critical);assert(contexts['심순애']&&!contexts['심순애'].critical);
assert.deepEqual(Object.entries(contexts).filter(([,value])=>value.critical).map(([name])=>name),['이완용'],'Red is reserved for the identified collaboration acts, not a general moral ranking');
for(const name of ['정중부','신숙주','한명회','세조'])assert.equal(contexts[name].critical,false);
assert.equal(lyricNames.length-6+7+7+6+6+3,100);
for(const name of lyricNames){assert(verses.some(v=>v.includes(name)),name+' is missing from lyrics');const p=people[name];for(const key of ['period','title','description','topic','wiki','kind'])assert(p[key],name+' is missing '+key)}
const pattern=new RegExp(lyricNames.join('|'),'g');assert.deepEqual('의천 천태종'.match(pattern),['의천'],'천태종 must not link to King Taejong');assert.deepEqual('태정태세문단세'.match(pattern),['태정태세문단세']);assert.deepEqual('원효대사 해골물 혜초 천축국'.match(pattern),['원효대사','혜초']);for(const name of kingNames)assert(people[name]);
const assets=JSON.parse(await readFile(new URL('../assets.json',import.meta.url),'utf8'));for(const asset of Object.values(assets)){assert(asset.license&&asset.filePage,'missing credit');assert((await stat(new URL('../'+asset.src,import.meta.url))).size>0,'missing image')}
const uncovered=Object.values(people).filter(p=>!assets[p.wiki]&&!assets[p.topic]);console.log('Lyrics: 5 verses. Linked entries:',lyricNames.length,'Additional kings:',kingNames.length,'Images:',Object.keys(assets).length);console.log('Entries without a local photo:',uncovered.map(p=>p.name).join(', ')||'none');console.log('Content and asset checks passed.');
