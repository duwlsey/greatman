/** Keep a single IME input focused while the visible syllable cursor moves. */
export function attachSyllableInput({container,letters,onChange}){
 const proxy=document.createElement('textarea');proxy.className='compose-input-proxy';proxy.setAttribute('aria-label','노랫말 이어서 입력');proxy.setAttribute('autocomplete','off');proxy.setAttribute('autocapitalize','off');proxy.setAttribute('spellcheck','false');proxy.rows=1;proxy.hidden=true;document.body.append(proxy);
 let sequence=[],start=0,touched=0,active=null,composing=false;
 const chars=()=>letters(proxy.value).filter(c=>! /\s/u.test(c));
 function position(){if(!active||proxy.hidden)return;const r=active.getBoundingClientRect();Object.assign(proxy.style,{left:r.left+'px',top:r.top+'px',width:r.width+'px',height:r.height+'px'})}
 function cursor(index){container.querySelectorAll('.compose-current').forEach(el=>el.classList.remove('compose-current'));active=sequence[Math.min(index,sequence.length-1)];if(active){active.classList.add('compose-current');position()}}
 function finish(){proxy.hidden=true;proxy.value='';composing=false;active=null;container.querySelectorAll('.compose-current').forEach(el=>el.classList.remove('compose-current'))}
 function begin(cell){sequence=[...container.querySelectorAll('.compose-cell')].filter(input=>input.dataset.v===cell.dataset.v);start=sequence.indexOf(cell);touched=0;composing=false;proxy.value='';proxy.hidden=false;cursor(start);proxy.focus({preventScroll:true})}
 function write(){const value=chars(),available=sequence.length-start,count=Math.min(value.length,available);for(let i=0;i<Math.max(touched,count);i++){const cell=sequence[start+i];if(!cell)break;cell.value=value[i]||'';cell.dataset.filled=String(Boolean(value[i]));onChange(cell,value[i]||'')}touched=count;cursor(start+Math.min(Math.max(0,count-(composing?1:0)),available-1))}
 container.addEventListener('focusin',e=>{if(e.target.matches('.compose-cell')&&!e.target.disabled)begin(e.target)});
 // A new click starts a replacement at that cell; the native IME buffer stays intact while typing.
 proxy.addEventListener('compositionstart',()=>{composing=true});
 proxy.addEventListener('compositionend',()=>{composing=false;write()});
 proxy.addEventListener('input',write);
 proxy.addEventListener('keydown',e=>{if(e.isComposing||composing)return;let index=sequence.indexOf(active);
  if(e.key==='ArrowLeft')index--;else if(e.key==='ArrowRight'||e.key==='Enter')index++;else if(e.key==='Backspace'&&!proxy.value){index--;if(sequence[index]){onChange(sequence[index],'');sequence[index].value='';sequence[index].dataset.filled='false'}}else if(e.key==='Tab'){const target=sequence[index+(e.shiftKey?-1:0)];if(target){e.preventDefault();begin(target)}else finish();return}else if(e.key==='Escape'){finish();return}else return;
  if(sequence[index]){e.preventDefault();begin(sequence[index])}
 });
 proxy.addEventListener('blur',finish);
 window.addEventListener('scroll',position,true);window.addEventListener('resize',position);
 return {finish};
}
