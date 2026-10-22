import {attachSyllableInput} from './composer-input.mjs?v=26';
import {blankWork,normalizeWork,serializeWork,deserializeWork,filledVerses,templates,letters,escapeHtml,workPrintMarkup} from './composer-model.mjs?v=25';
import {validEndpoint,readShared,writeShared} from './composer-store.mjs?v=25';
import {stopMusic} from './music.mjs?v=24';
const $=s=>document.querySelector(s);
let endpoint='',editKey='',revision=0,work=blankWork(),dirty=false,busy=false,connected=false,records=[],recordCount=0,lastPoll=0,pollTimer;
let readyResolve;const ready=new Promise(r=>readyResolve=r);
const safeGet=(key)=>{try{return localStorage.getItem(key)}catch{return null}};
const safeSet=(key,value)=>{try{localStorage.setItem(key,value)}catch{}};
const draftKey=()=>`greatman-draft-v1:${endpoint||'preview'}`;
function tell(text,type=''){const el=$('#compose-status');el.textContent=text;el.className='compose-state '+type}
function cacheDraft(){safeSet(draftKey(),JSON.stringify({work,revision,dirty}))}
function updateCount(){const selected=filledVerses(work).map(v=>v.number);$('#compose-counter').textContent=selected.length?`${selected.join(' · ')}절을 저장·출력해요.`:'작성한 절만 저장·출력해요.';$('#compose-save').disabled=busy||!selected.length;$('#compose-print').disabled=!selected.length;$('#compose-reset').disabled=busy;$('#work-title').disabled=busy;document.querySelectorAll('.compose-cell').forEach(input=>input.disabled=busy)}
function markDirty(){dirty=true;cacheDraft();updateCount();tell(connected?'아직 저장하지 않았어요. 저장을 누르면 친구들 화면에 반영돼요.':'이 기기에만 임시 보관 중이에요. 선생님 설정에서 저장소를 연결해 주세요.')}
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
function renderHistory(){const container=$('#compose-history');if(!records.length){container.innerHTML='<p class="compose-empty">아직 제작 기록이 없어요. 첫 노랫말을 저장해 보세요.</p>';return}container.innerHTML=records.map(r=>`<article class="history-card"><div><h3>${escapeHtml(r.title)}</h3><p>${escapeHtml(new Date(r.savedAt).toLocaleString('ko-KR',{timeZone:'Asia/Seoul'}))} · ${r.verseNumbers.map(n=>n+'절').join(' · ')}${r.reason==='reset'?' · 초기화 전 기록':''}</p></div><div class="history-actions"><button data-record="${escapeHtml(r.id)}" data-action="load">불러오기</button><button data-record="${escapeHtml(r.id)}" data-action="print">출력</button></div></article>`).join('');if(recordCount>records.length)container.insertAdjacentHTML('beforeend','<button class="history-more" data-load-more>이전 기록 더 보기</button>')}
async function loadCurrent({force=false,quiet=false}={}){
 if(!endpoint)return false;if(busy)return false;
 const data=await readShared(endpoint);connected=true;records=data.records||[];recordCount=data.recordCount||records.length;renderHistory();lastPoll=Date.now();
 if(!dirty||force){const changed=revision!==data.current.revision||force;revision=data.current.revision;work=deserializeWork(data.current.work);dirty=false;if(changed)renderWork();cacheDraft();if(!quiet)tell(data.current.revision?'저장된 노랫말을 불러왔어요.':'저장소가 연결됐어요. 첫 노랫말을 만들어 보세요.','success')}
 else if(data.current.revision!==revision){tell('다른 화면에서 저장한 새 노랫말이 있어요. 출력으로 내 글을 보관한 뒤 ‘저장된 노랫말 확인’을 눌러 주세요.','error')}
 return true
}
async function key(){if(editKey)return editKey;const dialog=$('#compose-password');$('#compose-password-input').value='';return new Promise(resolve=>{dialog.addEventListener('close',()=>{if(dialog.returnValue==='ok'){editKey=$('#compose-password-input').value;$('#compose-key').value=editKey;resolve(editKey)}else resolve('')},{once:true});dialog.showModal()})}
async function publish(action,{keepRecord=true}={}){
 if(busy)return;if(!endpoint){$('#compose-settings').open=true;tell('공동 저장을 하려면 먼저 선생님 설정에서 구글 저장소를 연결해 주세요.','error');return}
 if(!connected){try{await loadCurrent()}catch(e){tell(e.message,'error');return}}
 const secret=await key();if(!secret)return;
 busy=true;updateCount();tell(action==='reset'?'현재 노랫말을 기록에 남기고 있어요.':'친구들과 볼 노랫말을 저장하고 있어요.');
 try{const result=await writeShared(endpoint,{action,editKey:secret,baseRevision:revision,keepRecord,work:serializeWork(work)});revision=result.current.revision;work=deserializeWork(result.current.work);dirty=false;records=result.records||records;recordCount=result.recordCount||records.length;renderWork();renderHistory();cacheDraft();tell(action==='reset'?(keepRecord?'이전 노랫말은 제작 기록에 남기고, 빈칸으로 새로 시작했어요.':'새 기록을 남기지 않고 빈칸으로 초기화했어요. 기존 제작 기록은 그대로 있어요.'):'저장했어요. 같은 수업 주소를 연 친구들 화면에도 곧 반영돼요.','success')}
 catch(e){tell(e.message,'error')}finally{busy=false;updateCount()}
}
$('#compose-save').onclick=()=>publish('save');
$('#compose-reset').onclick=()=>{if(!filledVerses(work).length){tell('이미 빈칸이에요.');return}$('#compose-confirm').showModal()};
$('#compose-cancel').onclick=()=>$('#compose-confirm').close();$('#compose-confirm-reset').onclick=()=>{$('#compose-confirm').close();publish('reset',{keepRecord:true})};$('#compose-reset-discard').onclick=()=>{$('#compose-confirm').close();publish('reset',{keepRecord:false})};
$('#compose-history').addEventListener('click',async e=>{const more=e.target.closest('[data-load-more]');if(more){more.disabled=true;try{const data=await readShared(endpoint,'history',{offset:String(records.length)});records.push(...data.records);recordCount=data.recordCount;renderHistory()}catch(error){tell(error.message,'error');more.disabled=false}return}const button=e.target.closest('[data-record]');if(!button||busy)return;button.disabled=true;try{const result=await readShared(endpoint,'record',{id:button.dataset.record}),past=deserializeWork(result.record.work);if(button.dataset.action==='print')print(past);else{if(dirty&&!confirm('아직 저장하지 않은 글자를 이전 노랫말로 바꿀까요?'))return;work=past;dirty=true;renderWork();cacheDraft();tell('이전 노랫말을 불러왔어요. 저장을 누르면 친구들 화면에도 반영돼요.')}}catch(error){tell(error.message,'error')}finally{button.disabled=false}});
$('#compose-connect').onclick=async()=>{const value=$('#compose-endpoint').value.trim();if(!validEndpoint(value)){tell('Apps Script의 /exec로 끝나는 웹 앱 주소를 넣어 주세요.','error');return}if(dirty&&endpoint!==value&&!confirm('저장소를 바꾸면 이 화면의 초안 대신 연결한 저장소의 노랫말을 불러옵니다. 바꿀까요?'))return;endpoint=value;editKey=$('#compose-key').value;connected=false;safeSet('greatman-endpoint',endpoint);try{await loadCurrent({force:true});startPolling()}catch(e){tell(e.message,'error')}};
$('#compose-key').addEventListener('input',()=>editKey=$('#compose-key').value);
$('#compose-share').onclick=async()=>{if(!validEndpoint(endpoint)){tell('저장소를 먼저 연결해 주세요.','error');return}const url=new URL(location.href);url.searchParams.set('classroom',endpoint);url.hash='compose';try{await navigator.clipboard.writeText(url.href);tell('학생용 주소를 복사했어요. 편집 비밀번호는 포함되지 않아요.','success')}catch{const input=$('#compose-endpoint');input.value=url.href;input.select();tell('주소 복사가 막혀 있어요. 선택된 학생용 주소를 직접 복사한 뒤 연결 주소를 다시 확인해 주세요.')}};
$('#compose-refresh').onclick=async()=>{if(dirty&&!confirm('아직 저장하지 않은 글자를 저장소의 노랫말로 바꿀까요? 출력에서 PDF로 보관할 수 있어요.'))return;try{await loadCurrent({force:true})}catch(e){tell(e.message,'error')}};
function startPolling(){clearInterval(pollTimer);pollTimer=setInterval(async()=>{if(document.hidden||$('#compose').hidden||busy||Date.now()-lastPoll<12000)return;try{await loadCurrent({quiet:true})}catch{/* Keep draft and prior confirmed screen during a temporary outage. */}},15000)}
export function leaveComposer(){syllableInput.finish();stopAccompaniment()}
export async function enterComposer(){await ready;if(endpoint&&!dirty)try{await loadCurrent({quiet:true})}catch(e){tell(e.message,'error')}}
let player=null,loadingPlayer=false,wantPlay=false,rewindTimer;
function audioState(playing){$('#compose-play').textContent=playing?'Ⅱ 반주 일시정지':'▶ 반주 재생';$('#compose-play').setAttribute('aria-pressed',String(playing));$('#sing-play').textContent=playing?'Ⅱ 반주 일시정지':'▶ 반주 재생'}
function stopAccompaniment(){wantPlay=false;player?.pauseVideo?.();audioState(false)}
let accompanimentId='XGMb3JCd934';
async function youtubeReady(){if(window.YT?.Player)return;await new Promise((resolve,reject)=>{const previous=window.onYouTubeIframeAPIReady;window.onYouTubeIframeAPIReady=()=>{previous?.();resolve()};if(!document.querySelector('script[src="https://www.youtube.com/iframe_api"]')){const script=document.createElement('script');script.src='https://www.youtube.com/iframe_api';script.onerror=reject;document.head.append(script)}setTimeout(()=>window.YT?.Player?resolve():reject(Error('반주 연결이 늦어요. YouTube에서 열어 주세요.')),18000)})}
$('#compose-play').onclick=async()=>{stopMusic();if(player){wantPlay=player.getPlayerState()!==1;wantPlay?player.playVideo():player.pauseVideo();return}if(loadingPlayer)return;loadingPlayer=true;wantPlay=true;$('#compose-play').disabled=true;$('#compose-video').open=true;try{await youtubeReady();player=new YT.Player('compose-player',{host:'https://www.youtube-nocookie.com',videoId:accompanimentId,playerVars:{playsinline:1,rel:0,origin:location.origin},events:{onReady:event=>{loadingPlayer=false;$('#compose-play').disabled=false;if(wantPlay)event.target.playVideo();rewindTimer=setInterval(()=>{$('#compose-restart').hidden=!(player.getCurrentTime()>1&&[1,2,3].includes(player.getPlayerState()))},300)},onStateChange:event=>audioState(event.data===1),onError:()=>{loadingPlayer=false;$('#compose-play').disabled=false;audioState(false);tell('반주를 재생할 수 없어요. ‘반주를 YouTube에서 열기’를 눌러 주세요.','error')},onAutoplayBlocked:()=>tell('반주 영상 안의 재생 버튼을 한 번 눌러 주세요.')}})}catch(e){loadingPlayer=false;$('#compose-play').disabled=false;tell(e.message,'error')}};
$('#compose-restart').onclick=()=>{stopAccompaniment();player?.cueVideoById({videoId:accompanimentId,startSeconds:0});$('#compose-restart').hidden=true};
(async()=>{try{const config=await fetch(new URL('./composer-config.json?v=25',import.meta.url)).then(r=>r.json());endpoint=new URLSearchParams(location.search).get('classroom')||config.endpoint||safeGet('greatman-endpoint')||'';accompanimentId=config.accompanimentId||accompanimentId}catch{endpoint=safeGet('greatman-endpoint')||''}$('#compose-endpoint').value=endpoint;try{const draft=JSON.parse(safeGet(draftKey())||'null');if(draft){work=normalizeWork(draft.work);revision=draft.revision||0;dirty=Boolean(draft.dirty)}}catch{}renderWork();if(endpoint){try{await loadCurrent();startPolling()}catch(e){tell(e.message,'error')}}else tell('이 기기에 임시 보관돼요. 공동 저장은 선생님 설정에서 구글 저장소를 연결해 주세요.')})().then(()=>{if(!endpoint)tell('이 기기에 임시 보관돼요. 공동 저장은 선생님 설정에서 구글 저장소를 연결해 주세요.');readyResolve()});
window.addEventListener('beforeunload',e=>{if(dirty){e.preventDefault();e.returnValue=''}});

function renderSing(){const number=Number($('#sing-verse').value),lines=work.verses[number-1];$('#sing-title').textContent=work.title;$('#sing-lines').innerHTML=templates[number-1].map((line,l)=>{let c=0;return '<div class="sing-row">'+letters(line).map(ch=>/\s/u.test(ch)?'<span class="sing-gap"></span>':'<span class="sing-cell">'+escapeHtml(lines[l][c++]||'')+'</span>').join('')+'</div>'}).join('')}
$('#compose-sing').onclick=()=>{const selected=filledVerses(work);if(!selected.length){tell('먼저 한 글자 이상 적어 주세요.');return}$('#sing-verse').innerHTML=selected.map(v=>'<option value="'+v.number+'">'+v.number+'절</option>').join('');renderSing();$('#compose-sing-dialog').showModal()};
$('#sing-verse').onchange=renderSing;$('#sing-close').onclick=()=>$('#compose-sing-dialog').close();$('#sing-play').onclick=()=>$('#compose-play').click();
