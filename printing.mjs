import {buildPrintMarkup} from './print-layout.mjs';
export function printLyrics(){
 let root=document.getElementById('print-lyrics');
 if(!root){root=document.createElement('div');root.id='print-lyrics';root.setAttribute('aria-hidden','true');document.body.append(root)}
 root.innerHTML=buildPrintMarkup();
 window.print();
}
document.getElementById('print-button').addEventListener('click',printLyrics);
