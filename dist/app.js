'use strict';
const $ = id => document.getElementById(id);
const video=$('video'), file=$('file'), speed=$('speed'), seek=$('seek'), status=$('status');
let url=null, preferred=1, generation=0;
let dance=null;
let playbackSerial=0;
let playbackIntent=false, countdownActive=false, countdownTimer=null, countdownSerial=0;
let loopDelay=0, skipAmount=3, tapTimer=null, lastTap=null, feedbackTimer=null;
try { const saved=localStorage.getItem('slowmo-speed'); if(saved!==null&&Number.isFinite(Number(saved))) preferred=Number(saved); } catch {}
const clampRate=n=>Math.min(2,Math.max(.25,Math.round(n*20)/20));
function paintRange(el){el.style.setProperty('--fill',`${100*(Number(el.value)-Number(el.min))/(Number(el.max)-Number(el.min))}%`);}
function setSpeed(n){if(dance?.locked)return;preferred=clampRate(n);speed.value=preferred;$('speedValue').innerHTML=`${preferred.toFixed(2)}<span>×</span>`;speed.setAttribute('aria-valuetext',`${preferred.toFixed(2)} times`);video.defaultPlaybackRate=preferred;video.playbackRate=preferred;paintRange(speed);document.querySelectorAll('[data-speed]').forEach(b=>b.setAttribute('aria-pressed',Number(b.dataset.speed)===preferred?'true':'false'));$('minus').disabled=preferred<=.25;$('plus').disabled=preferred>=2;dance?.speedChanged();try{localStorage.setItem('slowmo-speed',String(preferred));}catch{document.querySelector('.remember').textContent='Speed saved for this session';}}
setSpeed(preferred);
speed.addEventListener('input',()=>setSpeed(Number(speed.value)));
$('minus').onclick=()=>setSpeed(preferred-.05);$('plus').onclick=()=>setSpeed(preferred+.05);
document.querySelectorAll('[data-speed]').forEach(b=>b.onclick=()=>setSpeed(Number(b.dataset.speed)));
function playing(){const active=playbackIntent||countdownActive||(!video.paused&&!video.ended);$('play').setAttribute('aria-label',active?'Pause':'Play');$('playIcon').innerHTML=active?'<path d="M6 5h4v14H6zM14 5h4v14h-4z"/>':'<path d="m9 5 11 7-11 7z"/>';}
async function attemptPlay(){if(dance?.isComparing){playbackIntent=true;playing();return dance.playPair();}playbackIntent=true;playing();const current=generation,serial=++playbackSerial,valid=()=>current===generation&&serial===playbackSerial&&playbackIntent;try{await SlowMoMedia.guard(dance?.resumeAudio());if(!valid())return;await SlowMoMedia.playTogether([video],{isCurrent:valid});if(valid())status.textContent='';}catch(e){if(!valid())return;playbackIntent=false;if(e.name==='NotAllowedError')status.textContent='Ready — tap Play to start.';else if(e.name!=='AbortError')status.textContent='This video could not play. Try a compatible MP4 or another Safari-supported video.';}finally{playing();}}
function clock(t){if(!Number.isFinite(t))return '0:00';const s=Math.floor(t);return s>=3600?`${Math.floor(s/3600)}:${String(Math.floor(s/60)%60).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`:`${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`;}
function playbackBounds(){return dance?.comparisonBounds()||{start:0,end:video.duration};}
function time(){const bounds=playbackBounds(),d=bounds.end;seek.min=Number.isFinite(bounds.start)?bounds.start:0;seek.max=Number.isFinite(d)&&d>0?d:100;seek.value=video.currentTime||0;$('elapsed').textContent=clock(video.currentTime);$('duration').textContent=clock(d);seek.setAttribute('aria-valuetext',`${clock(video.currentTime)} of ${clock(d)}`);paintRange(seek);}
$('empty').addEventListener('click',e=>{if(!e.target.closest('label,button,a')&&!file.disabled)file.click();});
$('empty').addEventListener('keydown',e=>{if((e.key==='Enter'||e.key===' ')&&e.target===$('empty')){e.preventDefault();if(!file.disabled)file.click();}});
file.addEventListener('change',()=>{const selected=file.files[0];if(!selected)return;if(dance&&!dance.beforeReferenceChange(selected)){file.value='';return;}generation++;pausePlayback();clearTap();clearLoop();video.removeAttribute('src');video.load();if(url)URL.revokeObjectURL(url);url=URL.createObjectURL(selected);$('empty').hidden=true;$('empty').style.display='none';video.closest('.viewer').classList.add('loaded');$('filename').hidden=false;$('filename').textContent=selected.name;status.textContent='Opening video…';['play','back','forward','seek','setA','setB','enterFullscreen'].forEach(id=>$(id).disabled=true);video.src=url;video.playbackRate=preferred;video.defaultPlaybackRate=preferred;video.load();enterPlayer(true);attemptPlay();file.value='';});
video.addEventListener('loadedmetadata',()=>{dance?.referenceReady();video.playbackRate=preferred;['play','back','forward','seek','setA','setB','enterFullscreen'].forEach(id=>$(id).disabled=false);time();});
video.addEventListener('error',()=>{if(!video.getAttribute('src'))return;pausePlayback();showControls();status.textContent='Safari cannot play this video format. Try an H.264 MP4 or a compatible MOV. Your video has not been uploaded.';['play','back','forward','seek','setA','setB','enterFullscreen'].forEach(id=>$(id).disabled=true);});
video.addEventListener('playing',()=>status.textContent='');
['play','pause','ended'].forEach(e=>video.addEventListener(e,playing));
['timeupdate','durationchange','loadedmetadata','seeked'].forEach(e=>video.addEventListener(e,time));
$('play').onclick=()=>countdownActive||playbackIntent||!video.paused?pausePlayback():attemptPlay();
function jump(n){if(dance?.locked)return;interruptCountdown();const b=playbackBounds();if(Number.isFinite(b.end))video.currentTime=Math.max(loopOn?loopA:b.start,Math.min(loopOn?loopB-.02:b.end,video.currentTime+n));}
$('back').onclick=()=>jump(-skipAmount);$('forward').onclick=()=>jump(skipAmount);
seek.addEventListener('input',()=>{if(dance?.locked)return;interruptCountdown();if(Number.isFinite(video.duration)){const t=Number(seek.value);video.currentTime=loopOn&&loopB!==null?Math.max(loopA,Math.min(loopB-.02,t)):t;time();}});

window.addEventListener('pagehide',pausePlayback);
document.addEventListener('visibilitychange',()=>{if(document.hidden)pausePlayback();});
if('serviceWorker' in navigator)navigator.serviceWorker.register('/sw.js').catch(()=>{});

let loopA=null, loopB=null, loopOn=false;
const startHandle=$('loopA'), endHandle=$('loopB');
function precise(t){return clock(t)+'.'+String(Math.floor((t%1)*10));}
function renderLoop(){
 // Native whole-video repeat yields to a custom A/B section. Pause still stops playback.
 video.loop=!loopOn&&!dance?.isComparing&&!dance?.locked;
 const valid=loopA!==null&&loopB!==null;
 $('loopHandles').hidden=loopA===null;endHandle.hidden=!valid;
 if(loopA!==null){startHandle.min=playbackBounds().start||0;startHandle.max=playbackBounds().end||100;startHandle.value=loopA;startHandle.setAttribute('aria-valuetext',precise(loopA));}
 if(valid){endHandle.min=playbackBounds().start||0;endHandle.max=playbackBounds().end;endHandle.value=loopB;endHandle.setAttribute('aria-valuetext',precise(loopB));}
 $('setA').textContent=loopA===null?'Set A':'A '+precise(loopA);
 $('setB').textContent=loopB===null?'Set B':'B '+precise(loopB);
 const loopLocked=dance?.locked||(dance?.mode==='compare'&&!dance.aligned);
 $('loopToggle').disabled=loopLocked||!valid;$('clearLoop').disabled=loopLocked||loopA===null;startHandle.disabled=!!loopLocked;endHandle.disabled=!!loopLocked;
 $('loopToggle').textContent=loopOn?'A/B on':'A/B off';$('loopToggle').setAttribute('aria-pressed',String(loopOn));$('loopToggle').setAttribute('aria-label',loopOn?'Disable section looping':'Enable section looping');
 $('loopHint').textContent=loopA===null?'Video repeats · tap Set A, then Set B for a section.':!valid?'Tap Set B to finish your loop.':loopOn?'Repeating A–B · drag the handles to fine-tune.':'Full video repeats · enable A/B to use this section.';
 $('loopBand').hidden=!valid;
 if(valid){const b=playbackBounds(),d=b.end-b.start; $('loopBand').style.left=(100*(loopA-b.start)/d)+'%';$('loopBand').style.width=(100*(loopB-loopA)/d)+'%';}
}
function clearLoop(){interruptCountdown();loopA=null;loopB=null;loopOn=false;renderLoop();}
$('setA').onclick=()=>{interruptCountdown();loopA=Math.min(video.currentTime,Math.max(0,video.duration-.1));loopB=null;loopOn=false;status.textContent='';renderLoop();};
$('setB').onclick=()=>{
 interruptCountdown();
 if(loopA===null){loopA=playbackBounds().start||0;}
 if(video.currentTime<=loopA+.1){status.textContent='Set B after A. Play or scrub forward, then tap Set B.';return;}
 loopB=video.currentTime;loopOn=true;status.textContent='';renderLoop();video.currentTime=loopA;
};
$('loopToggle').onclick=()=>{interruptCountdown();loopOn=!loopOn;renderLoop();if(loopOn&&(video.currentTime<loopA||video.currentTime>=loopB))video.currentTime=loopA;};
$('clearLoop').onclick=clearLoop;
startHandle.addEventListener('input',()=>{interruptCountdown();loopA=Math.max(0,Math.min(Number(startHandle.value),(loopB??video.duration)-.1));renderLoop();if(loopOn&&(video.currentTime<loopA||video.currentTime>=loopB))video.currentTime=loopA;});
endHandle.addEventListener('input',()=>{interruptCountdown();loopB=Math.min(video.duration,Math.max(loopA+.1,Number(endHandle.value)));renderLoop();if(loopOn&&(video.currentTime<loopA||video.currentTime>=loopB))video.currentTime=loopA;});
function enforceLoop(){if(dance?.handleBoundary())return;if(!loopOn||loopB===null||video.seeking||countdownActive||video.paused)return;if(video.currentTime>=loopB)repeatSection();else if(video.currentTime<loopA-.05)video.currentTime=loopA;}
video.addEventListener('timeupdate',enforceLoop);
video.addEventListener('ended',()=>{if(dance?.handleEnded())return;if(loopOn&&playbackIntent&&!countdownActive)repeatSection();});
function watchLoop(){enforceLoop();if(video.requestVideoFrameCallback)video.requestVideoFrameCallback(watchLoop);else requestAnimationFrame(watchLoop);}
if(video.requestVideoFrameCallback)video.requestVideoFrameCallback(watchLoop);else requestAnimationFrame(watchLoop);

// Fullscreen the whole player, never the video alone: all controls stay in the top layer.
const player=$('player'), panel=$('playerPanel');
const standaloneQuery=window.matchMedia('(display-mode: standalone)');
const fullscreenElement=()=>document.fullscreenElement||document.webkitFullscreenElement;
const standalone=()=>standaloneQuery.matches||window.matchMedia('(display-mode: fullscreen)').matches||navigator.standalone===true;
let presentationEpoch=0, hadFullscreen=false;
let mainScrollPosition={x:0,y:0};
function setControls(visible){
 player.classList.toggle('controls-hidden',!visible);const dialogOpen=!!player.querySelector('.mode-dialog[open]');panel.inert=!visible||dialogOpen;
 document.querySelector('.player-toolbar').inert=!visible||dialogOpen;
 $('toggleControls').textContent=visible?'Hide controls':'Show controls';
 $('toggleControls').setAttribute('aria-expanded',String(visible));
}
function showControls(){setControls(true);}
function toggleControls(){setControls(player.classList.contains('controls-hidden'));}
function setImmersive(active){
 const wasImmersive=player.classList.contains('immersive');
 if(active&&!wasImmersive)mainScrollPosition={x:window.scrollX,y:window.scrollY};
 document.documentElement.classList.toggle('player-open',active);
 player.classList.toggle('immersive',active);document.body.classList.toggle('player-open',active);
 document.querySelector('header').inert=active;document.querySelector('footer').inert=active;
 syncDisplayTheme();
 if(active)window.scrollTo(0,0);
 else if(wasImmersive)requestAnimationFrame(()=>{if(!player.classList.contains('immersive'))window.scrollTo(mainScrollPosition.x,mainScrollPosition.y);});
 refreshViewport();
 showControls();
 if(!active){$('fsNotice').hidden=true;player.classList.remove('fill-video');$('fitToggle').textContent='Fill';$('fitToggle').setAttribute('aria-pressed','false');$('fitToggle').setAttribute('aria-label','Fill screen, cropping video edges');}
}
function updatePlayerDialogState(){
 const open=!!player.querySelector('.mode-dialog[open]'),hidden=player.classList.contains('controls-hidden');
 $('dialogShade').hidden=!open;panel.inert=open||hidden;document.querySelector('.player-toolbar').inert=open||hidden;$('toggleControls').inert=open;document.querySelector('.viewer').inert=open;
 document.querySelector('header').inert=open||player.classList.contains('immersive');document.querySelector('footer').inert=open||player.classList.contains('immersive');
}
function openPlayerDialog(id){
 const dialog=$(id);if(!dialog.open)dialog.show();dialog.setAttribute('aria-modal','true');updatePlayerDialogState();
 dialog.querySelector('button:not(:disabled)')?.focus({preventScroll:true});
}
document.querySelectorAll('.mode-dialog').forEach(dialog=>{
 dialog.addEventListener('close',()=>{updatePlayerDialogState();refreshViewport();if(player.classList.contains('immersive'))player.focus({preventScroll:true});});
 dialog.addEventListener('keydown',e=>{
  if(e.key==='Escape'){e.preventDefault();e.stopPropagation();if(dialog.id==='practiceDialog')dance?.releaseCamera();dialog.close();return;}
  if(e.key==='Tab'){const items=[...dialog.querySelectorAll('button:not(:disabled),select:not(:disabled),input:not(:disabled),video[controls],[tabindex]')].filter(el=>el.getClientRects().length);const first=items[0],last=items.at(-1);if(!dialog.contains(document.activeElement)){e.preventDefault();first?.focus({preventScroll:true});return;}if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus({preventScroll:true});}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus({preventScroll:true});}}
 });
});
function fullscreenNotice(failed=false,automatic=false){
 const active=fullscreenElement()===player;
 $('fsRetry').hidden=active;
 if(active){$('fsNotice').hidden=true;return;}
 if(standalone()){
  const available=!!(player.requestFullscreen||player.webkitRequestFullscreen);
  $('fsRetry').hidden=!available;$('fsNotice').hidden=false;
  $('fsNotice').textContent=!available?'Full screen is unavailable here. The video fits below the system status bar.':failed&&!automatic?'The system kept its status bar visible. The whole video fits below it.':'Tap Full screen to request the entire display.';
  return;
 }
 $('fsNotice').hidden=false;
 const available=!!(player.requestFullscreen||player.webkitRequestFullscreen);
 $('fsNotice').textContent=available?(failed&&!automatic?'Full screen was unavailable for this request. The player still fills the page; tap Full screen again after camera permissions.':'Tap Full screen above to hide the browser toolbar.'):'This browser cannot full-screen custom controls. Open SlowMo from your Home Screen for an app-sized player; browser toolbars cannot be hidden here.';
}
async function enterPlayer(automatic=false){
 if(!video.getAttribute('src'))return;
 const epoch=++presentationEpoch;
 setImmersive(true);
 if(fullscreenElement()===player){fullscreenNotice();return;}
 fullscreenNotice();
 // Called directly in the file-change or button handler, before any await.
 try{
  if(player.requestFullscreen)await player.requestFullscreen({navigationUI:'hide'});
  else if(player.webkitRequestFullscreen)await player.webkitRequestFullscreen();
  else {fullscreenNotice();return;}
  if(epoch!==presentationEpoch){if(fullscreenElement()===player)await exitNativeFullscreen();return;}
  delete player.dataset.fullscreenError;fullscreenNotice();
 }catch(error){player.dataset.fullscreenError=error.name+': '+error.message;if(epoch===presentationEpoch)fullscreenNotice(true,automatic);}
}
async function exitNativeFullscreen(){
 if(document.fullscreenElement&&document.exitFullscreen)await document.exitFullscreen();
 else if(document.webkitFullscreenElement&&document.webkitExitFullscreen)await document.webkitExitFullscreen();
}
async function closePlayer(){
 ++presentationEpoch;
 try{await exitNativeFullscreen();}catch{}
 setImmersive(false);$('enterFullscreen').focus({preventScroll:true});
}
function onFullscreenChange(){
 const active=fullscreenElement()===player;
 if(active){hadFullscreen=true;setImmersive(true);fullscreenNotice();}
 else if(hadFullscreen){
  // Permission prompts, camera capture and sharing can make iPadOS leave native
  // fullscreen. Preserve the app-sized player; only our Close action exits it.
  hadFullscreen=false;if(player.classList.contains('immersive')){setImmersive(true);fullscreenNotice();}
 }
}
$('enterFullscreen').onclick=()=>enterPlayer();$('fsRetry').onclick=()=>enterPlayer();
$('closePlayer').onclick=closePlayer;$('toggleControls').onclick=toggleControls;
$('fitToggle').onclick=()=>{
 const fill=player.classList.toggle('fill-video');$('fitToggle').textContent=fill?'Fit':'Fill';
 $('fitToggle').setAttribute('aria-pressed',String(fill));$('fitToggle').setAttribute('aria-label',fill?'Fit entire video without cropping':'Fill screen, cropping video edges');
};
document.addEventListener('fullscreenchange',onFullscreenChange);
document.addEventListener('webkitfullscreenchange',onFullscreenChange);
standaloneQuery.addEventListener?.('change',()=>{if(player.classList.contains('immersive'))fullscreenNotice();});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!fullscreenElement()&&!document.querySelector('dialog[open]')&&player.classList.contains('immersive')&&!dance?.locked)closePlayer();});

// Dance options affect presentation, wall-clock countdowns, and timeline seconds independently.
$('mirror').onclick=()=>{
 const mirrored=video.classList.toggle('mirrored');$('mirror').setAttribute('aria-pressed',String(mirrored));
 $('mirror').querySelector('span').textContent=mirrored?'Mirrored':'Mirror';
};
function setSkip(n){
 skipAmount=[1,2,3,5,10].includes(n)?n:3;$('skipAmount').value=String(skipAmount);
 $('back').querySelector('span').textContent=skipAmount;$('forward').querySelector('span').textContent=skipAmount;
 $('back').setAttribute('aria-label',`Skip backward ${skipAmount} second${skipAmount===1?'':'s'}`);$('forward').setAttribute('aria-label',`Skip forward ${skipAmount} second${skipAmount===1?'':'s'}`);
 try{localStorage.setItem('slowmo-skip',String(skipAmount));}catch{}
}
try{const saved=Number(localStorage.getItem('slowmo-skip'));if([1,2,3,5,10].includes(saved))skipAmount=saved;}catch{}
setSkip(skipAmount);$('skipAmount').onchange=()=>setSkip(Number($('skipAmount').value));
function cancelCountdown(){
 ++countdownSerial;clearTimeout(countdownTimer);countdownTimer=null;countdownActive=false;
 $('countdown').hidden=true;playing();
}
function pausePlayback(){++playbackSerial;playbackIntent=false;cancelCountdown();dance?.pauseCompanion();dance?.externalPause();video.pause();playing();}
function interruptCountdown(){if(countdownActive)pausePlayback();}
function repeatSection(){
 if(countdownActive||!loopOn||!playbackIntent)return;
 if(!loopDelay){video.currentTime=loopA;if(video.ended||video.paused)attemptPlay();return;}
 countdownActive=true;video.pause();if(video.currentTime>loopB)video.currentTime=loopB;playing();$('countdown').hidden=false;
 const serial=++countdownSerial,deadline=performance.now()+loopDelay*1000;
 function tick(){
  if(serial!==countdownSerial||!countdownActive)return;
  if(!loopOn||!playbackIntent){cancelCountdown();return;}
  const remaining=Math.max(0,Math.ceil((deadline-performance.now())/1000));
  if(!remaining){cancelCountdown();video.currentTime=loopA;attemptPlay();return;}
  $('countdownNumber').textContent=String(remaining);countdownTimer=setTimeout(tick,80);
 }
 tick();
}
$('cancelCountdown').onclick=pausePlayback;
$('loopDelay').onchange=()=>{
 const waiting=countdownActive;cancelCountdown();loopDelay=Number($('loopDelay').value);
 if(waiting&&playbackIntent){if(loopDelay)repeatSection();else {video.currentTime=loopA;attemptPlay();}}
};
video.addEventListener('play',()=>{playbackIntent=true;});
video.addEventListener('pause',()=>{if(!countdownActive&&!video.ended&&!dance?.ownsPause)playbackIntent=false;});
function clearTap(){clearTimeout(tapTimer);tapTimer=null;lastTap=null;}
function skipFeedback(direction){
 const el=$('skipFeedback');clearTimeout(feedbackTimer);el.hidden=false;
 el.textContent=`${direction<0?'−':'+'}${skipAmount}s`;el.dataset.side=direction<0?'left':'right';
 feedbackTimer=setTimeout(()=>{el.hidden=true;},650);
}
// Listen only on the video, so sliders, buttons and loop handles never seek by gesture.
function attachVideoGestures(target){
let pointerStart=null,suppressVideoClick=false;
target.addEventListener('pointerdown',e=>{pointerStart={x:e.clientX,y:e.clientY};suppressVideoClick=false;});
target.addEventListener('pointerup',e=>{if(pointerStart&&Math.hypot(e.clientX-pointerStart.x,e.clientY-pointerStart.y)>14){suppressVideoClick=true;clearTap();}pointerStart=null;});
target.addEventListener('pointercancel',()=>{pointerStart=null;suppressVideoClick=true;clearTap();});
target.addEventListener('dblclick',e=>e.preventDefault());
target.addEventListener('click',e=>{
 if(suppressVideoClick){suppressVideoClick=false;return;}
 if($('play').disabled||dance?.locked)return;
 const rect=target.getBoundingClientRect(),side=e.clientX<rect.left+rect.width/2?-1:1,now=performance.now();
 if(lastTap&&lastTap.target===target&&now-lastTap.time<300&&lastTap.side===side&&Math.hypot(e.clientX-lastTap.x,e.clientY-lastTap.y)<64){
  clearTap();jump(side*skipAmount);skipFeedback(side);return;
 }
 clearTap();lastTap={target,time:now,side,x:e.clientX,y:e.clientY};
 tapTimer=setTimeout(()=>{lastTap=null;tapTimer=null;if(player.classList.contains('immersive'))toggleControls();else $('play').click();},300);
});
}
attachVideoGestures(video);
player.addEventListener('pointerdown',e=>{if(e.target!==video&&e.target.id!=='practiceVideo')clearTap();},true);

// iPad Home Screen webviews can expose a different viewport from CSS vh/dvh.
// Use the reported visible rectangle at normal zoom, not the physical screen size.
let viewportFrame=null,viewportSettleTimer=null;
function measureViewport(){
 const vv=window.visualViewport;
 // Keep normal page zoom semantics; don't resize the player to a pinch-zoomed rectangle.
 if(vv&&Math.abs(vv.scale-1)>.01)return;
 const width=vv?.width||window.innerWidth,height=vv?.height||window.innerHeight;
 if(!(width>0&&height>0))return;
 const root=document.documentElement;
 const values={'--app-width':width+'px','--app-height':height+'px','--app-left':(vv?.offsetLeft||0)+'px','--app-top':(vv?.offsetTop||0)+'px'};
 for(const [name,value] of Object.entries(values))if(root.style.getPropertyValue(name)!==value)root.style.setProperty(name,value);
 root.classList.add('viewport-measured');
}
function refreshViewport(){
 if(viewportFrame===null)viewportFrame=requestAnimationFrame(()=>{viewportFrame=null;measureViewport();});
 clearTimeout(viewportSettleTimer);
 // Re-measure after the OS finishes rotating/restoring its webview, using fresh metrics.
 viewportSettleTimer=setTimeout(()=>{measureViewport();if(player.classList.contains('immersive')){window.scrollTo(0,0);player.scrollTop=0;}},250);
}
function syncDisplayTheme(){
 const active=player.classList.contains('immersive');
 document.querySelector('meta[name="theme-color"]').setAttribute('content',active?'#000000':'#f5f3fa');
}
window.addEventListener('resize',refreshViewport);
window.addEventListener('orientationchange',()=>{if(player.classList.contains('immersive')){document.activeElement?.blur?.();window.scrollTo(0,0);player.scrollTop=0;}refreshViewport();});
window.visualViewport?.addEventListener('resize',refreshViewport);
window.visualViewport?.addEventListener('scroll',refreshViewport);
window.addEventListener('pageshow',()=>{syncDisplayTheme();measureViewport();refreshViewport();});
document.addEventListener('visibilitychange',()=>{if(!document.hidden){syncDisplayTheme();refreshViewport();}});
document.addEventListener('fullscreenchange',refreshViewport);
document.addEventListener('webkitfullscreenchange',refreshViewport);
standaloneQuery.addEventListener?.('change',refreshViewport);
measureViewport();

// Local-only diagnostics for the installed iPad app. Never includes media URLs or names.
function createLayoutReport(){
 const rect=el=>{const r=el.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,bottom:r.bottom,right:r.right};};
 const style=el=>{const s=getComputedStyle(el);return {position:s.position,height:s.height,width:s.width,overflow:s.overflow,transform:s.transform,objectFit:s.objectFit};};
 const vv=window.visualViewport,root=document.documentElement,s=getComputedStyle(root);
 const boxes={};for(const [name,el] of Object.entries({html:root,body:document.body,main:document.querySelector('main'),player,viewer:document.querySelector('.viewer'),video})){boxes[name]={rect:rect(el),style:style(el),clientHeight:el.clientHeight,scrollHeight:el.scrollHeight};}
 return JSON.stringify({version:'layout-report-1',standalone:standalone(),navigatorStandalone:navigator.standalone??null,fullscreen:{active:!!fullscreenElement(),enabled:document.fullscreenEnabled??null,requestSupported:!!player.requestFullscreen,webkitRequestSupported:!!player.webkitRequestFullscreen,error:player.dataset.fullscreenError||null},screen:{width:screen.width,height:screen.height,availWidth:screen.availWidth,availHeight:screen.availHeight,pixelRatio:devicePixelRatio},window:{width:innerWidth,height:innerHeight,scrollX,scrollY},visualViewport:vv?{width:vv.width,height:vv.height,offsetTop:vv.offsetTop,offsetLeft:vv.offsetLeft,pageTop:vv.pageTop,pageLeft:vv.pageLeft,scale:vv.scale}:null,safeArea:Object.fromEntries(['top','right','bottom','left'].map(k=>[k,s.getPropertyValue('--safe-'+k).trim()])),measuredHeight:root.style.getPropertyValue('--app-height'),videoDimensions:{width:video.videoWidth,height:video.videoHeight},boxes},null,2);
}
document.querySelectorAll('[data-layout-report]').forEach(button=>button.addEventListener('click',async()=>{
 const report=createLayoutReport();$('layoutReportText').value=report;
 try{await navigator.clipboard.writeText(report);button.textContent='Copied';setTimeout(()=>button.textContent='Copy layout report',2500);}
 catch{$('layoutReportDialog').showModal();$('layoutReportText').focus();$('layoutReportText').select();}
}));
$('closeLayoutReport').onclick=()=>$('layoutReportDialog').close();
