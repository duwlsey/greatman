import {verses} from './data.mjs';
export const templates=verses.map(v=>v.split('\n'));
export const letters=text=>Array.from(String(text).normalize('NFC'));
export const slots=line=>letters(line).filter(c=>! /\s/u.test(c));
export function blankWork(){return {title:'',verses:templates.map(lines=>lines.map(line=>slots(line).map(()=>'')))}}
export function normalizeWork(raw={}){const w=blankWork();w.title=String(raw.title||w.title).slice(0,80);for(let v=0;v<5;v++)for(let l=0;l<w.verses[v].length;l++)for(let c=0;c<w.verses[v][l].length;c++)w.verses[v][l][c]=letters(raw.verses?.[v]?.[l]?.[c]||'')[0]||'';return w}
export function filledVerses(work){return work.verses.map((lines,index)=>({number:index+1,lines})).filter(v=>v.lines.some(line=>line.some(c=>c.trim())))}
export function serializeWork(work){return {title:work.title,verses:filledVerses(work)}}
export function deserializeWork(raw){if(Array.isArray(raw?.verses)&&raw.verses.some(v=>v?.number)){const w=blankWork();w.title=raw.title;for(const v of raw.verses)if(v.number>=1&&v.number<=5)w.verses[v.number-1]=v.lines;return normalizeWork(w)}return normalizeWork(raw)}
export function spacedLine(template,cells,empty='□'){let index=0;return letters(template).map(c=>/\s/u.test(c)?' ':cells[index++]||empty).join('')}
export const escapeHtml=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function workText(work){return [work.title,...filledVerses(work).flatMap(v=>['',`${v.number}절`,...v.lines.map((line,i)=>spacedLine(templates[v.number-1][i],line))])].join('\n')}
export function workPrintMarkup(work){return filledVerses(work).map(v=>`<article class="compose-print-sheet"><h1>${escapeHtml(work.title)}</h1><h2>${v.number}절</h2>${v.lines.map((line,l)=>{let i=0;return `<div class="compose-print-line">${letters(templates[v.number-1][l]).map(c=>/\s/u.test(c)?'<span class="compose-print-gap"></span>':`<span class="compose-print-cell">${escapeHtml(line[i++]||'')}</span>`).join('')}</div>`}).join('')}</article>`).join('')}

export function getSaveAction(work,clearRequested=false){if(filledVerses(work).length)return 'save';if(clearRequested)return 'reset';throw Error('노랫말 칸에 한 글자 이상 입력한 뒤 저장해 주세요. 제목만으로는 제작 기록이 남지 않아요.')}
