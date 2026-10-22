/** Shared read/write transport for a Google Apps Script Content Service web app. */
export function validEndpoint(value){return /^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(value)}
export function readShared(endpoint,action='read',extra={}){
 if(!validEndpoint(endpoint))return Promise.reject(Error('Apps Script 웹 앱 주소를 확인해 주세요.'));
 return new Promise((resolve,reject)=>{
  const token=crypto.randomUUID().replaceAll('-',''),callback='greatman_'+token;
  const frame=document.createElement('iframe');frame.hidden=true;frame.setAttribute('sandbox','allow-scripts');frame.setAttribute('aria-hidden','true');
  const url=new URL(endpoint);url.search=new URLSearchParams({action,callback,...extra,_:String(Date.now())});
  let timer;function cleanup(){clearTimeout(timer);window.removeEventListener('message',receive);frame.remove()}
  function receive(event){if(event.source!==frame.contentWindow||event.data?.token!==token)return;const data=event.data.data;cleanup();if(data?.ok)resolve(data);else reject(Error(data?.message||'저장소에 연결하지 못했어요.'))}
  window.addEventListener('message',receive);
  timer=setTimeout(()=>{cleanup();reject(Error('저장소 응답이 늦어요. 인터넷 연결과 웹 앱 공개 설정을 확인해 주세요.'))},18000);
  const source=url.href.replaceAll('&','&amp;').replaceAll('"','&quot;');
  frame.srcdoc='<script>window['+JSON.stringify(callback)+']=function(data){parent.postMessage({token:'+JSON.stringify(token)+',data:data},"*")};<'+ '/script><script src="'+source+'"><'+'/script>';
  document.body.append(frame);
 })
}
export async function writeShared(endpoint,payload){
 if(!validEndpoint(endpoint))throw Error('먼저 온라인 저장소를 연결해 주세요.');
 const requestId=crypto.randomUUID().replaceAll('-','');
 // The POST uses a simple content type; completion is verified by a separate read.
 try{await fetch(endpoint,{method:'POST',mode:'no-cors',body:new URLSearchParams({payload:JSON.stringify({...payload,requestId})}),redirect:'follow'})}catch{/* A redirected opaque response may fail even when Apps Script accepted the write. */}
 for(let attempt=0;attempt<6;attempt++){const result=await readShared(endpoint,'result',{requestId});if(result.done)return result;await new Promise(r=>setTimeout(r,1200+attempt*500))}
 throw Error('저장 결과를 확인하지 못했어요. 새로고침으로 확인한 뒤 다시 시도해 주세요. 입력한 내용은 이 기기에 남아 있어요.');
}
