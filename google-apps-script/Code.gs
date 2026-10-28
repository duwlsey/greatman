/** 위인을 찾아서: 구글 시트 공동 노랫말 저장소. V8 런타임. */
function setup() {
 const props=PropertiesService.getScriptProperties();
 if(!props.getProperty('SHEET_ID')){
  const book=SpreadsheetApp.create('위인을 찾아서 · 우리 반 노랫말');
  book.getSheets()[0].setName('현재');book.getSheetByName('현재').appendRow(['revision','work','updatedAt']);
  book.getSheetByName('현재').appendRow([0,JSON.stringify(emptyWork_()),new Date().toISOString()]);
  book.insertSheet('기록').appendRow(['id','savedAt','title','verses','reason','work']);
  props.setProperty('SHEET_ID',book.getId());
 }
 if(!props.getProperty('EDIT_KEY'))props.setProperty('EDIT_KEY',Utilities.getUuid()+Utilities.getUuid());
 console.log('저장 시트: https://docs.google.com/spreadsheets/d/'+props.getProperty('SHEET_ID')+'/edit');
 console.log('선생님 편집 비밀번호 (학생에게 전달하지 마세요): '+props.getProperty('EDIT_KEY'));
}
function book_(){const id=PropertiesService.getScriptProperties().getProperty('SHEET_ID');if(!id)throw Error('먼저 setup 함수를 한 번 실행해 주세요.');return SpreadsheetApp.openById(id)}
function emptyWork_(){return {title:'우리 반의 위인을 찾아서',verses:[]}}
function current_(book){const row=book.getSheetByName('현재').getRange(2,1,1,3).getValues()[0];return {revision:Number(row[0])||0,work:JSON.parse(row[1]),updatedAt:row[2]}}
function records_(book,offset){const sheet=book.getSheetByName('기록'),count=sheet.getLastRow()-1,end=Math.max(0,count-(Number(offset)||0)),start=Math.max(0,end-100);if(end<=start)return [];return sheet.getRange(start+2,1,end-start,5).getValues().reverse().map(row=>({id:row[0],savedAt:row[1],title:row[2],verseNumbers:JSON.parse(row[3]),reason:row[4]}))}
function publicData_(book){return {current:current_(book),records:records_(book),recordCount:book.getSheetByName('기록').getLastRow()-1}}
function json_(data,callback){let text=JSON.stringify(data).replace(/</g,'\\u003c').replace(/\u2028/g,'\\u2028').replace(/\u2029/g,'\\u2029');if(callback&&/^greatman_[a-f0-9]{32}$/.test(callback))return ContentService.createTextOutput(callback+'('+text+');').setMimeType(ContentService.MimeType.JAVASCRIPT);return ContentService.createTextOutput(text).setMimeType(ContentService.MimeType.JSON)}
function doGet(e){const p=e.parameter||{};try{
 if(p.action==='result'){
  if(!/^[a-f0-9]{32}$/.test(p.requestId||''))throw Error('잘못된 요청이에요.');
  const result=CacheService.getScriptCache().get('result:'+p.requestId);return json_(result?JSON.parse(result):{ok:true,done:false},p.callback);
 }
 const book=book_();
 if(p.action==='history'){const offset=Number(p.offset);if(!Number.isInteger(offset)||offset<0)throw Error('기록 위치를 확인해 주세요.');return json_({ok:true,records:records_(book,offset),recordCount:book.getSheetByName('기록').getLastRow()-1},p.callback)}
 if(p.action==='record'){
  if(!/^[a-zA-Z0-9-]{20,80}$/.test(p.id||''))throw Error('기록 번호를 확인해 주세요.');
  const sheet=book.getSheetByName('기록');const match=sheet.getRange(2,1,Math.max(1,sheet.getLastRow()-1),1).createTextFinder(p.id).matchEntireCell(true).findNext();
  if(!match)throw Error('기록을 찾지 못했어요.');const row=sheet.getRange(match.getRow(),1,1,6).getValues()[0];
  return json_({ok:true,record:{id:row[0],savedAt:row[1],work:JSON.parse(row[5])}},p.callback);
 }
 return json_({ok:true,...publicData_(book)},p.callback);
 }catch(error){return json_({ok:false,message:error.message},p.callback)}
}
function validateWork_(raw){
 if(!raw||typeof raw.title!=='string'||raw.title.length>80||!Array.isArray(raw.verses)||raw.verses.length>5)throw Error('노랫말 형식을 확인해 주세요.');
 const seen={};const verses=raw.verses.map(v=>{
  if(!Number.isInteger(v.number)||v.number<1||v.number>5||seen[v.number])throw Error('절 번호를 확인해 주세요.');seen[v.number]=true;
  const shape=SHAPES_[v.number-1];if(!Array.isArray(v.lines)||v.lines.length!==shape.length)throw Error('노랫말 줄 수를 확인해 주세요.');
  const lines=v.lines.map((line,i)=>{if(!Array.isArray(line)||line.length!==shape[i])throw Error('노랫말 칸 수를 확인해 주세요.');return line.map(c=>{if(typeof c!=='string'||Array.from(c.normalize('NFC')).length>1||/[\r\n\t]/.test(c))throw Error('한 칸에는 한 글자만 넣어 주세요.');return c.normalize('NFC')})});
  return {number:v.number,lines};
 }).filter(v=>v.lines.some(line=>line.some(c=>c.trim()))).sort((a,b)=>a.number-b.number);
 return {title:raw.title.trim()||'우리 반의 위인을 찾아서',verses};
}
function archive_(book,work,reason){if(!work.verses.length)return;book.getSheetByName('기록').appendRow([Utilities.getUuid(),new Date().toISOString(),safeCell_(work.title),JSON.stringify(work.verses.map(v=>v.number)),reason,JSON.stringify(work)])}
function safeCell_(value){return /^[=+@-]/.test(value)?"'"+value:value}
function deleteRecord_(book,id){
 if(!/^[a-zA-Z0-9-]{20,80}$/.test(id||''))throw Error('기록 번호를 확인해 주세요.');
 const sheet=book.getSheetByName('기록');if(sheet.getLastRow()<2)throw Error('이미 삭제되었거나 없는 기록이에요.');
 const found=sheet.getRange(2,1,sheet.getLastRow()-1,1).createTextFinder(id).matchEntireCell(true).findNext();if(!found)throw Error('이미 삭제되었거나 없는 기록이에요.');
 const row=sheet.getRange(found.getRow(),1,1,6).getValues()[0];
 let trash=book.getSheetByName('휴지통');if(!trash){trash=book.insertSheet('휴지통');trash.appendRow(['id','savedAt','title','verses','reason','work','deletedAt'])}
 trash.appendRow([...row,new Date().toISOString()]);sheet.deleteRow(found.getRow());
}
function doPost(e){
 let requestId='',lock,reply;
 try{
  const text=e.parameter&&e.parameter.payload;if(!text||text.length>60000)throw Error('보낼 노랫말 크기를 확인해 주세요.');
  const data=JSON.parse(text);requestId=data.requestId;if(!/^[a-f0-9]{32}$/.test(requestId||''))throw Error('요청 번호를 확인해 주세요.');
  const props=PropertiesService.getScriptProperties();if(!props.getProperty('EDIT_KEY')||data.editKey!==props.getProperty('EDIT_KEY'))throw Error('선생님 편집 비밀번호가 맞지 않아요.');
  if(!['save','reset','delete'].includes(data.action))throw Error('저장 방법을 확인해 주세요.');
  const work=data.action==='delete'?null:validateWork_(data.work);if(data.action==='save'&&!work.verses.length)throw Error('노랫말을 한 글자 이상 적어 주세요.');
  lock=LockService.getScriptLock();lock.waitLock(15000);
  const cached=CacheService.getScriptCache().get('result:'+requestId);if(cached)return json_({ok:true});
  const book=book_(),current=current_(book);if(data.action==='delete'){deleteRecord_(book,data.recordId);SpreadsheetApp.flush();reply={ok:true,done:true,...publicData_(book)}}else{if(data.baseRevision!==current.revision)throw Error('다른 화면에서 먼저 저장했어요. 출력으로 내 노랫말을 보관한 뒤 저장된 노랫말을 확인해 주세요.');
  // Keep current text and any unsaved edits before a reset; never delete a record.
  if(data.action==='reset'&&data.keepRecord!==false){
   if(current.work.verses.length&&JSON.stringify(current.work)!==JSON.stringify(work))archive_(book,current.work,'reset');
   archive_(book,work,'reset');
  }else if(data.action==='save')archive_(book,work,'save');
  const next=data.action==='reset'?emptyWork_():work;
  book.getSheetByName('현재').getRange(2,1,1,3).setValues([[current.revision+1,JSON.stringify(next),new Date().toISOString()]]);
  SpreadsheetApp.flush();reply={ok:true,done:true,...publicData_(book)};
 }
 }catch(error){reply={ok:false,done:true,message:error.message}}finally{if(lock)lock.releaseLock()}
 if(/^[a-f0-9]{32}$/.test(requestId))CacheService.getScriptCache().put('result:'+requestId,JSON.stringify(reply),600);
 return json_({ok:true});
}

const SHAPES_=[[12,12,12,12,13,8,12,7,7,7,12,6],[12,12,13,12,12,7,12,8,7,7,12,6],[11,10,12,12,12,7,12,7,7,7,12,6],[12,12,12,12,12,7,12,7,7,7,12,6],[12,7,12,7,7,8,12,6]];
