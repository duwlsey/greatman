import {verses,lyricNames} from './data.mjs';
const escape=s=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const pattern=new RegExp(lyricNames.join('|'),'g');
export function buildPrintMarkup(){
 const verse=(text,i)=>`<section class="print-verse"><h2>${i+1}절</h2>${text.split('\n').map(line=>`<p class="print-line">${escape(line).replace(pattern,name=>`<span class="print-person">${name}</span>`)}</p>`).join('')}</section>`;
 return [[0,1],[2,3,4]].map((indexes,page)=>`<article class="print-sheet" data-print-page="${page+1}">${page===0?`<header class="print-heading"><h1>한국을 빛낸 100명의 위인들</h1><span>${page+1} / 2</span></header>`:''}<div class="print-verses">${indexes.map(i=>verse(verses[i],i)).join('')}</div></article>`).join('');
}
