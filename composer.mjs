import {attachSyllableInput} from './composer-input.mjs?v=33';
import {blankWork,normalizeWork,serializeWork,getSaveAction,deserializeWork,filledVerses,templates,letters,escapeHtml,workPrintMarkup} from './composer-model.mjs?v=37';
import {readShared,writeShared} from './composer-store.mjs?v=25';
import {stopMusic} from './music.mjs?v=24';
const $=s=>document.querySelector(s);
let endpoint='',editKey='',revision=0,work=blankWork(),dirty=false,busy=false,connected=false,clearRequested=false,records=[],recordCount=0,lastPoll=0,pollTimer;
let readyResolve;const ready=new Promise(r=>readyResolve=r);
const safeGet=(key)=>{try{return localStorage.getItem(key)}catch{return null}};
const safeSet=(key,value)=>{try{localStorage.setItem(key,value)}catch{}};
const draftKey=()=>`greatman-draft-v1:${endpoint||'preview'}`;
function tell(text,type=''){const el=$('#compose-status');el.textContent=text;el.className='compose-state '+type}
function cacheDraft(){safeSet(draftKey(),JSON.stringify({work,revision,dirty,clearRequested}))}
function updateCount(){const selected=filledVerses(work).map(v=>v.number);$('#compose-counter').textContent=selected.length?`${selected.join(' · ')}절을 저장·출력해요.`:'작성한 절만 저장·출력해요.';$('#compose-save').disabled=busy||(!selected.length&&!clearRequested);$('#compose-print').disabled=!selected.length;$('#compose-reset').disabled=busy;$('#work-title').disabled=busy;document.querySelectorAll('.compose-cell').forEach(input=>input.disabled=busy)}
function markDirty(){dirty=true;clearRequested=false;cacheDraft();updateCount();tell(connected?'아직 저장하지 않았어요. 저장을 누르면 친구들 화면에 반영돼요.':'이 기기에만 임시 보관 중이에요. 온라인 저장소에 연결되면 저장할 수 있어요.')}
function renderWork(){
 syllableInput?.finish();
 $('#work-title').value=work.title;
 $('#compose-verses').innerHTML=templates.map((lines,v)=>`<details class="compose-verse" ${v===0||filledVerses(work).some(x=>x.number===v+1)?'open':''}><summary>${v+1}절<small>${v===0?'기본 노랫말':'원할 때 펼쳐 만들어요'}</small></summary><div class="compose-lines">${lines.map((line,l)=>{let c=0;return `<p class="compose-reference" ${$('#show-original').checked?'':'hidden'}>${escapeHtml(line)}</p><div class="compose-row" role="group" aria-label="${v+1}절 ${l+1}번째 줄">${letters(line).map(ch=>/\s/u.test(ch)?'<span class="compose-gap" aria-hidden="true"></span>':(()=>{const i=c++,value=work.verses[v][l][i];return `<input class="compose-cell" data-v="${v}" data-l="${l}" data-c="${i}" data-filled="${Boolean(value)}" value="${escapeHtml(value)}" aria-label="${v+1}절 ${l+1}줄 ${i+1}번째 글자" autocomplete="off" autocapitalize="off" spellcheck="false">`})()).join('')}</div>`}).join('')}</div></details>`).join('');updateCount()
}
function cellInfo(input){return [+input.dataset.v,+input.dataset.l,+input.dataset.c]}
const syllableInput=attachSyllableInput({container:$('#compose-verses'),letters,onChange:(input,value)=>{const [v,l,c]=cellInfo(input);work.verses[v][l][c]=value;markDirty()}});
$('#work-title').addEventListener('input',()=>{work.title=$('#work-title').value;markDirty()});
$('#show-original').addEventListener('change',()=>document.querySelectorAll('.compose-reference').forEach(p=>p.hidden=!$('#show-original').checked));
function print(workToPrint){if(!filledVerses(workToPrint).length){tell('먼저 한 글자 이상 적어 주세요.');return}let root=$('#print-lyrics');if(!root){root=document.createElement('div');root.id='print-lyrics';document.body.append(root)}root.innerHTML=workPrintMarkup(workToPrint);window.print()}
$('#compose-print').onclick=()=>print(work);
function renderHistory(){const container=$('#compose-history');if(!records.length){container.innerHTML='<p class="compose-empty">아직 제작 기록이 없어요. 첫 노랫말을 저장해 보세요.</p>';return}container.innerHTML=records.map(r=>`<article class="history-card"><div><h3><button class="history-title-button" data-record="${escapeHtml(r.id)}" data-action="sing">${escapeHtml(r.title)}</button></h3><p>${escapeHtml(new Date(r.savedAt).toLocaleString('ko-KR',{timeZone:'Asia/Seoul'}))} · ${r.verseNumbers.map(n=>n+'절').join(' · ')}${r.reason==='reset'?' · 초기화 전 기록':''}</p></div><div class="history-actions"><button data-record="${escapeHtml(r.id)}" data-action="print">출력</button><button class="history-delete" data-record="${escapeHtml(r.id)}" data-action="delete">삭제</button></div></article>`).join('');if(recordCount>records.length)container.insertAdjacentHTML('beforeend','<button class="history-more" data-load-more>이전 기록 더 보기</button>')}
async function loadCurrent({quiet=false}={}){
 if(!endpoint||busy)return false;
 const data=await readShared(endpoint);connected=true;records=data.records||[];recordCount=data.recordCount||records.length;renderHistory();lastPoll=Date.now();
 // Shared data supplies the history, never the new-song editor.
 if(!dirty)revision=data.current.revision;
 if(!quiet)tell('저장소가 연결됐어요. 빈칸에 새 노랫말을 만들어 보세요. 저장한 노랫말은 아래 제작 기록에서 열 수 있어요.','success');
 return true
}
async function key({force=false,recordTitle=''}={}){if(editKey&&!force)return editKey;const dialog=$('#compose-password');dialog.querySelector('h2').textContent=recordTitle?'제작 기록 삭제':'선생님 편집 비밀번호';dialog.querySelector('p').textContent=recordTitle?'「'+recordTitle+'」 기록을 삭제하려면 교사용 비밀번호를 입력해 주세요. 현재 작성 중인 노랫말은 그대로 유지됩니다.':'저장할 수 있는 선생님인지 비밀번호로 확인해요.';dialog.querySelector('button[value=ok]').textContent=recordTitle?'삭제하기':'저장하기';$('#compose-password-input').value='';return new Promise(resolve=>{dialog.addEventListener('close',()=>{if(dialog.returnValue==='ok'){editKey=$('#compose-password-input').value;resolve(editKey)}else resolve('')},{once:true});dialog.returnValue='';dialog.showModal();$('#compose-password-input').focus()})}
async function publish(action,{keepRecord=true}={}){
 if(busy)return;if(!endpoint){tell('온라인 저장소에 연결되지 않았어요. 잠시 뒤 다시 시도해 주세요.','error');return}
 if(!connected){try{await loadCurrent()}catch(e){tell(e.message,'error');return}}
 const secret=await key();if(!secret)return;
 busy=true;updateCount();tell(action==='reset'?'빈 노랫말 화면을 저장하고 있어요.':'친구들과 볼 노랫말을 저장하고 있어요.');
 try{const latest=await readShared(endpoint);records=latest.records||[];recordCount=latest.recordCount||records.length;renderHistory();
 if(latest.current.revision!==revision){const other=deserializeWork(latest.current.work);if(filledVerses(other).length&&JSON.stringify(serializeWork(other))!==JSON.stringify(serializeWork(work))&&!confirm('다른 화면에서 저장된 노랫말이 있어요. 지금 작성한 내용으로 새로 저장할까요? 기존 제작 기록은 유지됩니다.')){tell('저장하지 않았어요. 입력한 내용은 이 기기에 그대로 있어요.');return}revision=latest.current.revision}
 const result=await writeShared(endpoint,{action,editKey:secret,baseRevision:revision,keepRecord,work:serializeWork(work)});revision=result.current.revision;work=deserializeWork(result.current.work);dirty=false;clearRequested=false;records=result.records||records;recordCount=result.recordCount||records.length;renderWork();renderHistory();cacheDraft();tell(action==='reset'?(keepRecord?'이전 노랫말은 제작 기록에 남기고, 빈칸으로 새로 시작했어요.':'새 기록을 남기지 않고 빈칸으로 초기화했어요. 기존 제작 기록은 그대로 있어요.'):'공유 저장을 완료했어요. 아래 이전 제작 기록에 제목이 추가됐어요.','success')}
 catch(e){if(e.message.includes('비밀번호')){editKey='';}tell(e.message,'error')}finally{busy=false;updateCount()}
}
$('#compose-save').onclick=()=>{syllableInput.finish();document.querySelectorAll('.compose-cell').forEach(input=>{const [v,l,c]=cellInfo(input);work.verses[v][l][c]=letters(input.value)[0]||''});try{publish(getSaveAction(work,clearRequested),{keepRecord:false})}catch(error){tell(error.message,'error')}};
$('#compose-reset').onclick=()=>{if(busy)return;syllableInput.finish();work.verses=blankWork().verses;renderWork();markDirty();clearRequested=true;cacheDraft();updateCount();tell(connected?'노랫말을 모두 지웠어요. 저장을 누르면 친구들 화면도 빈칸으로 바뀌어요. 기존 제작 기록은 유지돼요.':'화면의 노랫말을 모두 지웠어요. 기존 제작 기록은 유지돼요.')};
async function deleteSavedRecord(recordId){
 const item=records.find(record=>record.id===recordId);if(!item||busy)return;
 const secret=await key({force:true,recordTitle:item.title});if(!secret)return;
 busy=true;updateCount();tell('제작 기록을 삭제하고 있어요.');
 try{const result=await writeShared(endpoint,{action:'delete',editKey:secret,recordId});records=result.records||[];recordCount=result.recordCount??records.length;renderHistory();tell('제작 기록을 삭제했어요. 현재 작성 중인 노랫말은 그대로예요.','success')}
 catch(error){if(error.message.includes('비밀번호'))editKey='';tell(error.message.includes('저장 방법')?'구글 저장소에 삭제 기능 업데이트가 필요해요. 최신 Code.gs로 바꾸고 새 버전으로 배포해 주세요.':error.message,'error')}
 finally{busy=false;updateCount()}
}
$('#compose-history').addEventListener('click',async e=>{const more=e.target.closest('[data-load-more]');if(more){more.disabled=true;try{const data=await readShared(endpoint,'history',{offset:String(records.length)});records.push(...data.records);recordCount=data.recordCount;renderHistory()}catch(error){tell(error.message,'error');more.disabled=false}return}const button=e.target.closest('[data-record]');if(!button||busy)return;if(button.dataset.action==='delete'){await deleteSavedRecord(button.dataset.record);return}button.disabled=true;try{const result=await readShared(endpoint,'record',{id:button.dataset.record}),past=deserializeWork(result.record.work);if(button.dataset.action==='print')print(past);else openSing(past);}catch(error){tell(error.message,'error')}finally{button.disabled=false}});
$('#history-refresh').onclick=async()=>{try{const refreshed=await loadCurrent({quiet:true});if(refreshed)tell(dirty?'제작 기록을 확인했어요. 현재 입력 내용은 아직 공유 저장 전이에요.':'제작 기록을 새로 확인했어요.','success')}catch(error){tell(error.message,'error')}};
function startPolling(){clearInterval(pollTimer);pollTimer=setInterval(async()=>{if(document.hidden||$('#compose').hidden||busy||Date.now()-lastPoll<12000)return;try{await loadCurrent({quiet:true})}catch{/* Keep draft and prior confirmed screen during a temporary outage. */}},15000)}
export function leaveComposer(){syllableInput.finish();stopAccompaniment()}
export async function enterComposer(){work=blankWork();dirty=false;clearRequested=false;renderWork();await ready;if(endpoint)try{await loadCurrent({quiet:true});tell('새 노랫말을 만들어 보세요. 저장한 노랫말은 아래 제작 기록에서 열 수 있어요.')}catch(e){tell(e.message,'error')}}
let player=null,loadingPlayer=false,wantPlay=false,rewindTimer;
function audioState(playing){$('#compose-play').textContent=playing?'Ⅱ 반주 일시정지':'▶ 반주 재생';$('#compose-play').setAttribute('aria-pressed',String(playing));$('#sing-play').textContent=playing?'Ⅱ 반주 일시정지':'▶ 반주 재생'}
function stopAccompaniment(){wantPlay=false;player?.pauseVideo?.();audioState(false)}
let accompanimentId='XGMb3JCd934';
async function youtubeReady(){if(window.YT?.Player)return;await new Promise((resolve,reject)=>{const previous=window.onYouTubeIframeAPIReady;window.onYouTubeIframeAPIReady=()=>{previous?.();resolve()};if(!document.querySelector('script[src="https://www.youtube.com/iframe_api"]')){const script=document.createElement('script');script.src='https://www.youtube.com/iframe_api';script.onerror=reject;document.head.append(script)}setTimeout(()=>window.YT?.Player?resolve():reject(Error('반주 연결이 늦어요. YouTube에서 열어 주세요.')),18000)})}
$('#compose-play').onclick=async()=>{stopMusic();if(player){wantPlay=player.getPlayerState()!==1;wantPlay?player.playVideo():player.pauseVideo();return}if(loadingPlayer)return;loadingPlayer=true;wantPlay=true;$('#compose-play').disabled=true;try{await youtubeReady();player=new YT.Player('compose-player',{host:'https://www.youtube-nocookie.com',videoId:accompanimentId,playerVars:{playsinline:1,rel:0,origin:location.origin},events:{onReady:event=>{loadingPlayer=false;$('#compose-play').disabled=false;if(wantPlay)event.target.playVideo();rewindTimer=setInterval(()=>{$('#compose-restart').hidden=!(player.getCurrentTime()>1&&[1,2,3].includes(player.getPlayerState()))},300)},onStateChange:event=>audioState(event.data===1),onError:()=>{loadingPlayer=false;$('#compose-play').disabled=false;audioState(false);tell('반주를 재생할 수 없어요. 학교의 YouTube 연결을 확인한 뒤 다시 시도해 주세요.','error')},onAutoplayBlocked:()=>tell('반주 영상 안의 재생 버튼을 한 번 눌러 주세요.')}})}catch(e){loadingPlayer=false;$('#compose-play').disabled=false;tell(e.message,'error')}};
$('#compose-restart').onclick=()=>{stopAccompaniment();player?.cueVideoById({videoId:accompanimentId,startSeconds:0});$('#compose-restart').hidden=true};
renderWork();
(async()=>{try{const config=await fetch(new URL('./composer-config.json?v=30',import.meta.url)).then(r=>r.json());endpoint=new URLSearchParams(location.search).get('classroom')||config.endpoint||safeGet('greatman-endpoint')||'';accompanimentId=config.accompanimentId||accompanimentId}catch{endpoint=safeGet('greatman-endpoint')||''}if(endpoint){try{await loadCurrent();startPolling()}catch(e){tell(e.message,'error')}}else tell('이 기기에 임시 보관 중이에요. 온라인 저장소 연결을 확인해 주세요.')})().then(()=>{if(!endpoint)tell('이 기기에 임시 보관 중이에요. 온라인 저장소에 연결되지 않았어요.');readyResolve()});
window.addEventListener('beforeunload',e=>{if(dirty){e.preventDefault();e.returnValue=''}});

let singWork=null;
function renderSing(){const source=singWork,number=Number($('#sing-verse').value),lines=source.verses[number-1];$('#sing-title').textContent=source.title;$('#sing-lines').innerHTML=templates[number-1].map((line,l)=>{let c=0;return '<div class="sing-row">'+letters(line).map(ch=>/\s/u.test(ch)?'<span class="sing-gap"></span>':'<span class="sing-cell">'+escapeHtml(lines[l][c++]||'')+'</span>').join('')+'</div>'}).join('')}
function openSing(source){const selected=filledVerses(source);if(!selected.length){tell('먼저 한 글자 이상 적어 주세요.');return}syllableInput.finish();singWork=normalizeWork(source);$('#sing-verse').innerHTML=selected.map(v=>'<option value="'+v.number+'">'+v.number+'절</option>').join('');renderSing();$('#compose-sing-dialog').showModal()}
$('#compose-sing').onclick=()=>openSing(work);
$('#sing-verse').onchange=renderSing;$('#sing-close').onclick=()=>$('#compose-sing-dialog').close();$('#sing-play').onclick=()=>$('#compose-play').click();
