const button=document.getElementById('lyrics-play');
const restart=document.getElementById('music-restart');
let restartTimer;
function updateRestart(){const time=player?.getCurrentTime?.()||0;const playback=player?.getPlayerState?.();restart.hidden=!(time>1&&[1,2,3].includes(playback))}
const box=document.getElementById('lyrics-music');
const status=document.getElementById('music-status');
let player=null,loading=null,wantsPlay=false;
function api(){if(window.YT?.Player)return Promise.resolve();if(loading)return loading;loading=new Promise((resolve,reject)=>{window.onYouTubeIframeAPIReady=resolve;const script=document.createElement('script');script.src='https://www.youtube.com/iframe_api';script.onerror=reject;document.head.append(script)});return loading}
function state(playing){button.textContent=playing?'Ⅱ 노래 일시정지':'▶ 노래 재생';button.setAttribute('aria-pressed',String(playing))}
export function stopMusic(){wantsPlay=false;player?.pauseVideo?.();state(false)}
button.addEventListener('click',async()=>{if(player){box.hidden=false;const playing=player.getPlayerState?.()===1;wantsPlay=!playing;if(playing)player.pauseVideo();else player.playVideo();return}if(wantsPlay){wantsPlay=false;state(false);return}wantsPlay=true;box.hidden=false;button.disabled=true;status.textContent='노래를 준비하고 있어요. 재생되지 않으면 영상의 재생 버튼을 눌러요.';try{await api();player=new YT.Player('lyrics-player',{host:'https://www.youtube-nocookie.com',videoId:'fP7sVxEUJ7g',width:'480',height:'270',playerVars:{playsinline:1,rel:0,origin:location.origin},events:{onReady:e=>{restartTimer??=setInterval(updateRestart,300);button.disabled=false;status.textContent='영상을 보며 노랫말 속 인물도 찾아봐요.';if(wantsPlay)e.target.playVideo()},onStateChange:e=>{state(e.data===1);updateRestart();if(e.data===0)status.textContent='노래가 끝났어요. 다시 재생할 수 있어요.'},onError:()=>{button.disabled=false;status.textContent='영상을 재생하지 못했어요. YouTube에서 열어 주세요.';state(false)},onAutoplayBlocked:()=>{status.textContent='영상의 재생 버튼을 누르면 노래가 시작돼요.';state(false)}}})}catch{button.disabled=false;loading=null;wantsPlay=false;status.textContent='노래에 연결하지 못했어요. YouTube에서 열거나 다시 시도해 주세요.';state(false)}});
document.getElementById('music-close').onclick=()=>{stopMusic();box.hidden=true};


restart.addEventListener('click',()=>{wantsPlay=false;restart.hidden=true;if(player?.seekTo){player.pauseVideo();player.seekTo(0,true)}state(false)});
