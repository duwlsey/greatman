import assert from 'node:assert/strict';
import {attachSyllableInput} from '../composer-input.mjs';
const inputs=Array.from({length:12},(_,i)=>({dataset:{v:'0',l:'0',c:String(i)},value:'',disabled:false,getBoundingClientRect:()=>({left:i*30,top:100,width:28,height:35}),classList:{marked:false,add(){this.marked=true},remove(){this.marked=false}},matches:s=>s==='.compose-cell'}));
const handlers={};const container={addEventListener:(name,fn)=>handlers[name]=fn,querySelectorAll:s=>s==='.compose-cell'?inputs:inputs.filter(i=>i.classList.marked)};
let proxy;globalThis.document={body:{append(el){proxy=el}},createElement:()=>({style:{},listeners:{},setAttribute(){},addEventListener(name,fn){this.listeners[name]=fn},focus(){},hidden:true})};globalThis.window={addEventListener(){}};
attachSyllableInput({container,letters:s=>Array.from(s.normalize('NFC')),onChange:(el,v)=>{el.saved=v}});
handlers.focusin({target:inputs[0]});proxy.listeners.compositionstart();
for(const text of ['ㅎ','하','한']){proxy.value=text;proxy.listeners.input();assert.equal(inputs[0].value,text);assert(inputs[0].classList.marked)}
proxy.value='한ㄱ';proxy.listeners.input();assert.equal(inputs[0].value,'한');assert.equal(inputs[1].value,'ㄱ');assert(inputs[1].classList.marked);
proxy.value='한글';proxy.listeners.input();proxy.listeners.compositionend();proxy.listeners.input();assert.deepEqual(inputs.slice(0,3).map(i=>i.value),['한','글','']);assert(inputs[2].classList.marked,'Next syllable cursor should advance without ending IME focus');
proxy.value='한글 입력';proxy.listeners.input();assert.deepEqual(inputs.slice(0,4).map(i=>i.value),['한','글','입','력']);
proxy.value='한글';proxy.listeners.input();assert.deepEqual(inputs.slice(0,4).map(i=>i.value),['한','글','','']);
handlers.focusin({target:inputs[7]});proxy.value='새';proxy.listeners.input();assert.equal(inputs[7].value,'새');assert.equal(inputs[0].value,'한');
console.log('Syllable input passed: Korean composition, consecutive syllables, trailing input, paste spacing, backspace and replacement.');

proxy.listeners.blur();proxy.value='';proxy.listeners.compositionend();proxy.listeners.input();assert.equal(inputs[7].value,'새','Late IME events after blur must not erase visible lyrics');
