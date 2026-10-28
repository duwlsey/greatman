import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import crypto from 'node:crypto';
import {blankWork,serializeWork,getSaveAction,deserializeWork,filledVerses,workPrintMarkup,workText,templates,slots} from '../composer-model.mjs';
import {validEndpoint} from '../composer-store.mjs';
assert(validEndpoint('https://script.google.com/macros/s/test-123/exec'));
assert(!validEndpoint('https://evil.com/macros/s/test/exec'));
const work=blankWork();assert.deepEqual(serializeWork(work).verses,[]);work.verses[0][0][0]='한';work.verses[4][0][0]='나';const serialized=serializeWork(work);
assert.deepEqual(serialized.verses.map(v=>v.number),[1,5]);assert.deepEqual(deserializeWork(serialized),work);assert.equal((workPrintMarkup(work).match(/compose-print-sheet/g)||[]).length,2);assert(!workText(work).includes('2절'));
assert(templates.every((lines,i)=>lines.every((line,j)=>slots(line).length===work.verses[i][j].length)));
class Sheet{constructor(){this.rows=[]}appendRow(row){this.rows.push([...row]);return this}setName(n){this.name=n;return this}getLastRow(){return this.rows.length}getRange(r,c,h,w){const sheet=this;return {getValues:()=>Array.from({length:h},(_,i)=>Array.from({length:w},(_,j)=>sheet.rows[r-1+i]?.[c-1+j]??'')),setValues:values=>{values.forEach((row,i)=>{sheet.rows[r-1+i]??=[];row.forEach((cell,j)=>sheet.rows[r-1+i][c-1+j]=cell)})},createTextFinder:value=>({matchEntireCell(){return this},findNext(){for(let i=r-1;i<sheet.rows.length;i++)if(sheet.rows[i][c-1]===value)return {getRow:()=>i+1};return null}})}}}
Sheet.prototype.deleteRow=function(row){this.rows.splice(row-1,1)};
const props=new Map(),cache=new Map();let sheetBook;
const context=vm.createContext({console:{log(){}},SpreadsheetApp:{create:()=>sheetBook={sheets:[new Sheet()],getId:()=> 'test-sheet',getSheets(){return this.sheets},getSheetByName(n){return this.sheets.find(s=>s.name===n)},insertSheet(n){const s=new Sheet().setName(n);this.sheets.push(s);return s}},openById:()=>sheetBook,flush(){}},PropertiesService:{getScriptProperties:()=>({getProperty:k=>props.get(k),setProperty:(k,v)=>props.set(k,v)})},Utilities:{getUuid:()=>crypto.randomUUID()},CacheService:{getScriptCache:()=>({get:k=>cache.get(k),put:(k,v)=>cache.set(k,v)})},LockService:{getScriptLock:()=>({waitLock(){},releaseLock(){}})},ContentService:{MimeType:{JSON:'json',JAVASCRIPT:'js'},createTextOutput:text=>({text,setMimeType(){return this}})}});
vm.runInContext(fs.readFileSync(new URL('../google-apps-script/Code.gs',import.meta.url),'utf8'),context);
context.setup();context.setup();assert.equal(sheetBook.sheets.length,2);
function post(action,revision,w=serialized,key=props.get('EDIT_KEY'),keepRecord=true){const requestId=crypto.randomUUID().replaceAll('-','');context.doPost({parameter:{payload:JSON.stringify({action,baseRevision:revision,work:w,editKey:key,requestId,keepRecord})}});return JSON.parse(cache.get('result:'+requestId))}
assert.equal(post('save',0,serialized,'wrong').ok,false);
assert.equal(post('save',0,serializeWork(blankWork())).ok,false);
let result=post('save',0);assert.equal(result.ok,true);assert.equal(result.current.revision,1);assert.equal(result.records.length,1);
assert.equal(post('save',0).ok,false,'Stale writers must not overwrite current lyrics');
const read=JSON.parse(context.doGet({parameter:{action:'read'}}).text);assert.equal(read.current.work.verses[0].lines[0][0],'한');
const oldRecord=result.records[0].id;const draft=structuredClone(serialized);draft.verses[0].lines[0][1]='글';result=post('reset',1,draft);assert.equal(result.ok,true);assert.equal(result.current.revision,2);assert.equal(result.current.work.verses.length,0);assert(result.records.some(r=>r.id===oldRecord));assert(result.records.some(r=>r.reason==='reset'));
const old=JSON.parse(context.doGet({parameter:{action:'record',id:oldRecord}}).text);assert.equal(old.record.work.verses[0].lines[0][0],'한');
const script= context.doGet({parameter:{callback:'greatman_'+crypto.randomUUID().replaceAll('-','')}}).text;assert(script.startsWith('greatman_'));assert(!script.includes(props.get('EDIT_KEY')));
const invalid=structuredClone(serialized);invalid.verses[0].lines[0][0]='두글자';assert.equal(post('save',2,invalid).ok,false);
const archivedCount=sheetBook.getSheetByName('기록').getLastRow();
result=post('reset',2,draft,props.get('EDIT_KEY'),false);assert.equal(result.ok,true);assert.equal(result.current.work.verses.length,0);assert.equal(sheetBook.getSheetByName('기록').getLastRow(),archivedCount,'Discard reset must not add or remove history');
console.log('Composer checks passed: exact slots, filled verses only, print/text export, read, password, revision conflict, archival reset and record retrieval.');

assert.throws(()=>getSaveAction(blankWork()),/한 글자/);assert.equal(getSaveAction(blankWork(),true),'reset');assert.equal(getSaveAction(work),'save');

function deleteRecord(id,key=props.get('EDIT_KEY')){const requestId=crypto.randomUUID().replaceAll('-','');context.doPost({parameter:{payload:JSON.stringify({action:'delete',recordId:id,editKey:key,requestId})}});return JSON.parse(cache.get('result:'+requestId))}
const countBeforeDelete=sheetBook.getSheetByName('기록').getLastRow();
assert.equal(deleteRecord(oldRecord,'wrong').ok,false);assert.equal(sheetBook.getSheetByName('기록').getLastRow(),countBeforeDelete);
const currentBeforeDelete=JSON.stringify(readCurrent());
function readCurrent(){return JSON.parse(context.doGet({parameter:{action:'read'}}).text).current}
const deleted=deleteRecord(oldRecord);assert.equal(deleted.ok,true);assert.equal(deleted.records.some(record=>record.id===oldRecord),false);assert.equal(JSON.stringify(readCurrent()),currentBeforeDelete);assert.equal(sheetBook.getSheetByName('휴지통').rows[1][0],oldRecord);
assert.equal(JSON.parse(context.doGet({parameter:{action:'record',id:oldRecord}}).text).ok,false);
assert.equal(deleteRecord(oldRecord).ok,false);
console.log('Record deletion passed: password required, removed from history, preserved current lyrics and recoverable trash.');
