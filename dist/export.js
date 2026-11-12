(function(root,factory){const api=factory(typeof module==='object'&&module.exports?require('./media.js'):root.SlowMoMedia);if(typeof module==='object'&&module.exports)module.exports=api;else{root.SlowMoExport=api;api.install();}})(typeof globalThis!=='undefined'?globalThis:this,function(AsyncMedia){
'use strict';
function exportRange(mapping,referenceDuration,practiceDuration,section,limits=null){const bounds=mapping.bounds(referenceDuration,practiceDuration);if(limits){bounds.start=Math.max(bounds.start,limits.start);bounds.end=Math.min(bounds.end,limits.end);bounds.valid=bounds.end-bounds.start>.1;}if(!bounds.valid)throw new Error('There is no synchronized overlap to export.');if(!section)return bounds;if(!Number.isFinite(section.start)||!Number.isFinite(section.end)||section.start<bounds.start-.001||section.end>bounds.end+.001||section.end-section.start<.1)throw new Error('The A/B section must be inside the synchronized overlap.');return {...section,valid:true};}
function composition(referenceAspect,practiceAspect){if(![referenceAspect,practiceAspect].every(Number.isFinite)||!(referenceAspect>0&&practiceAspect>0))throw new Error('Video dimensions are unavailable.');const gap=4,label=28,available=692;const height=Math.min(available,(1280-gap)/(referenceAspect+practiceAspect));const even=n=>Math.max(2,Math.floor(n/2)*2);const left=even(height*referenceAspect),right=even(height*practiceAspect),pictureHeight=even(height);return {width:left+right+gap,height:pictureHeight+label,label,left,right,gap,pictureHeight};}
function rates(rate,scale){if(![rate,scale].every(Number.isFinite)||!(rate>0&&scale>0))throw new Error('Invalid comparison playback rate.');return {reference:rate,practice:rate*scale};}
function drift(reference,practice,mapping){return (mapping.practiceAtReference(reference)-practice)/mapping.scale;}
function recorderType(audio,Recorder){const choices=audio?['video/mp4;codecs=avc1.42E01E,mp4a.40.2','video/mp4;codecs=avc1,mp4a.40.2','video/webm;codecs=vp8,opus','video/webm']:['video/mp4;codecs=avc1.42E01E','video/mp4;codecs=avc1','video/webm;codecs=vp8','video/webm'];return choices.find(type=>Recorder.isTypeSupported?.(type))||null;}
const event=(target,name,ms=8000,signal,action)=>AsyncMedia.waitForEvent(target,name,{timeout:ms,signal,action});
const position=(media,time,signal,timeout=6000)=>AsyncMedia.seek(media,time,{signal,timeout});
// Wake both decoders before the encoder's clock starts. Some iPad video decoders
// need noticeably different startup times; simultaneous play() is not a sync barrier.
async function warmPair(reference,practice,check=()=>{},settle=()=>new Promise(resolve=>setTimeout(resolve,120)),signal){
 reference.muted=true;practice.muted=true;
 try{await AsyncMedia.playTogether([reference,practice],{signal});check();await AsyncMedia.guard(settle(),{signal});check();}
 finally{reference.pause();practice.pause();}
}
function correction(error,baseRate){return baseRate*(Math.abs(error)>.025?1+Math.max(-.03,Math.min(.03,error*.35)):1);}
function needsRealignment(error){return Math.abs(error)>.08;}
function install(){
 const practice=$('practiceVideo'),preview=$('exportPreview');let job=null,result=null,resultURL=null;
 const say=text=>$('exportStatus').textContent=text;
 function clearResult(){preview.pause();preview.removeAttribute('src');preview.load();if(resultURL)URL.revokeObjectURL(resultURL);resultURL=null;result=null;preview.hidden=true;$('exportActions').hidden=true;}
 function cancel(reason='Export cancelled. Your original videos are unchanged.'){if(job){job.cancelled=true;job.reason=reason;job.abort.abort();job.stop?.();}}
 $('openExport').onclick=()=>{if(!dance.isComparing||dance.locked)return;pausePlayback();$('exportRange').options[0].disabled=!(loopOn&&loopA!==null&&loopB!==null);$('exportRange').value=loopOn?'section':'full';$('exportSpeed').options[1].textContent='Current comparison · '+preferred.toFixed(2)+'×';say(result?'Your last export is ready. Create another to replace it.':'');openPlayerDialog('exportDialog');};
 $('closeExport').onclick=()=>{cancel();$('exportDialog').close();};$('exportDialog').addEventListener('close',()=>{if(!$('exportDialog').open){cancel();preview.pause();}});$('cancelExport').onclick=()=>cancel();
 document.addEventListener('visibilitychange',()=>{if(document.hidden)cancel('Export stopped because SlowMo left the screen. Keep it visible and try again.');});window.addEventListener('pagehide',()=>cancel());
 $('startExport').onclick=()=>start();
 async function start(){
  if(job||!dance.isComparing||dance.locked)return;const mapping=new SlowMoTimeline.TimeMapping(dance.mapping.referenceAnchor,dance.mapping.practiceAnchor,dance.mapping.scale);let range,layout,playRates;
  try{const limits=dance.comparisonBounds();if(!limits)throw new Error('These sync points leave no recorded overlap. Realign the videos.');range=exportRange(mapping,video.duration,dance.practiceDuration,$('exportRange').value==='section'?{start:loopA,end:loopB}:null,limits);layout=composition(video.videoWidth/video.videoHeight,practice.videoWidth/practice.videoHeight);playRates=rates($('exportSpeed').value==='current'?preferred:1,mapping.scale);if((range.end-range.start)/playRates.reference>300)throw new Error('Choose an A/B section of at most 5 minutes at the export speed.');if(!window.MediaRecorder||!HTMLCanvasElement.prototype.captureStream)throw new Error('Local video export is unavailable in this browser. Try an updated Safari browser.');}catch(e){say(e.message);return;}
  pausePlayback();clearResult();const current={cancelled:false,reason:'',stop:null,abort:new AbortController()};job=current;const signal=current.abort.signal;
  const snapshot={time:video.currentTime,practiceTime:practice.currentTime,referenceMuted:video.muted,practiceMuted:practice.muted,referenceRate:video.playbackRate,practiceRate:practice.playbackRate};
  dance.exporting=true;dance.pairBusy=true;dance.updateControls();renderLoop();player.classList.add('exporting');$('exportOptions').hidden=true;$('exportProgress').hidden=false;$('exportProgress').value=0;$('cancelExport').hidden=false;
  let canvas,stream,recorder,audio,wake,raf,blob,failed=null,startedAt=0,progressAt=performance.now(),lastTime=range.start,watchdog,recovering=false,recoveryPromise=null,recoveries=0,lastGood=range.start,finished=false;const listeners=[];
  const check=()=>{if(current.cancelled)throw new Error(current.reason);if(finished)throw new Error('Export stopped.');};
  try{
   say('Preparing synchronized video…');
   if($('exportAudio').checked){audio=await AsyncMedia.guard(dance.referenceAudio.capture().then(capture=>{if(signal.aborted){capture.release();throw AsyncMedia.abortError();}return capture;}),{signal});check();}
   await Promise.all([position(video,range.start,signal),position(practice,mapping.practiceAtReference(range.start),signal)]);check();
   video.playbackRate=playRates.reference;practice.playbackRate=playRates.practice;
   if(Math.abs(video.playbackRate-playRates.reference)>.01||Math.abs(practice.playbackRate-playRates.practice)>.01)throw new Error('This browser cannot encode the mapped playback speed. Choose a lower export speed.');
   await warmPair(video,practice,check,undefined,signal);check();await Promise.all([position(video,range.start,signal),position(practice,mapping.practiceAtReference(range.start),signal)]);check();
   video.muted=!audio;practice.muted=true;video.loop=false;
   canvas=document.createElement('canvas');canvas.width=layout.width;canvas.height=layout.height;const ctx=canvas.getContext('2d',{alpha:false});if(!ctx)throw new Error('The video renderer is unavailable. Close other apps and try again.');
   // Keep the capture surface rendered for WebKit, without displaying export UI in it.
   canvas.className='export-surface';canvas.setAttribute('aria-hidden','true');player.append(canvas);
   const mirrorReference=video.classList.contains('mirrored'),mirrorPractice=practice.classList.contains('mirrored');
   function pane(source,x,width,mirror){const scale=Math.min(width/source.videoWidth,layout.pictureHeight/source.videoHeight),w=source.videoWidth*scale,h=source.videoHeight*scale;ctx.save();ctx.translate(x+width/2,layout.label+layout.pictureHeight/2);if(mirror)ctx.scale(-1,1);ctx.drawImage(source,-w/2,-h/2,w,h);ctx.restore();}
   function draw(){ctx.fillStyle='#000';ctx.fillRect(0,0,canvas.width,canvas.height);pane(video,0,layout.left,mirrorReference);pane(practice,layout.left+layout.gap,layout.right,mirrorPractice);ctx.font='14px -apple-system, sans-serif';ctx.fillStyle='#ddd';ctx.fillText('Reference',12,19);ctx.fillText('Practice',layout.left+layout.gap+12,19);}
   draw();stream=canvas.captureStream(30);if(audio)stream.addTrack(audio.track);const type=recorderType(!!audio,MediaRecorder);if(!type)throw new Error('No compatible export codec was found. Try an updated Safari browser.');
   recorder=new MediaRecorder(stream,{mimeType:type,videoBitsPerSecond:3000000,audioBitsPerSecond:128000});let bytes=0;const chunks=[];
   recorder.addEventListener('dataavailable',e=>{if(e.data.size){chunks.push(e.data);bytes+=e.data.size;if(bytes>100*1024*1024)fail(new Error('Export reached the 100 MB memory limit. Choose a shorter section.'));}});
   function fail(error){failed=error;stop();}
   let settle;const stopped=new Promise(resolve=>settle=resolve);
   function stop(){finished=true;cancelAnimationFrame(raf);try{if(recorder.state!=='inactive')recorder.stop();else settle();}catch(error){failed=error;settle();}}
   current.stop=stop;recorder.addEventListener('stop',()=>{blob=new Blob(chunks,{type:recorder.mimeType||type});settle();},{once:true});recorder.addEventListener('error',()=>fail(new Error('The video encoder failed. Try a shorter section or close other apps.')),{once:true});
   // Some encoders emit start only after a fresh canvas frame. Keep drawing the
   // aligned, paused first picture while starting; never lose the section's opening.
   await AsyncMedia.guard(dance.resumeAudio(),{signal});check();wake=await AsyncMedia.guard(Promise.resolve(navigator.wakeLock?.request('screen')).catch(()=>null).then(lock=>{if(signal.aborted){lock?.release().catch(()=>{});return null;}return lock;}),{signal});check();
   function primeFrames(){draw();raf=requestAnimationFrame(primeFrames);}
   const started=event(recorder,'start',8000,signal,()=>recorder.start(250));primeFrames();await started;startedAt=performance.now();check();
   await AsyncMedia.playTogether([video,practice],{signal});check();cancelAnimationFrame(raf);
   if(video.paused||practice.paused)throw new Error('Tap Create video again to allow both videos to play.');
   const interrupted=e=>{if(!recovering&&recorder.state==='recording'&&video.currentTime<range.end-.08){if(e.type==='error')fail(new Error('A source video could not be decoded during export.'));else recoveryPromise=realign();}};
   for(const media of [video,practice])for(const name of ['waiting','pause','error']){media.addEventListener(name,interrupted);listeners.push([media,name,interrupted]);}
   let lastDraw=0;
   async function realign(){
    if(recovering||finished)return;
    if(++recoveries>3){fail(new Error('Both videos could not stay aligned after three retries. Try exporting at the current comparison speed or a shorter section.'));return;}
    recovering=true;say('Aligning playback…');
    try{
     await event(recorder,'pause',8000,signal,()=>recorder.pause());check();
     video.pause();practice.pause();
     // Return to the last accepted pair of frames. Paused recorder time is omitted
     // from the file, so decoder recovery does not add a frozen/silent interval.
     await Promise.all([position(video,lastGood,signal),position(practice,mapping.practiceAtReference(lastGood),signal)]);check();
     video.playbackRate=playRates.reference;practice.playbackRate=playRates.practice;draw();
     await AsyncMedia.playTogether([video,practice],{signal});check();
     await event(recorder,'resume',8000,signal,()=>recorder.resume());check();
     progressAt=performance.now();lastTime=video.currentTime;recovering=false;raf=requestAnimationFrame(tick);
    }catch(e){recovering=false;if(!finished)fail(e);}
   }
   function tick(now){if(current.cancelled){stop();return;}if(video.currentTime>=range.end-.015||video.ended){stop();return;}if(practice.ended){if(video.currentTime<range.end-.08){recoveryPromise=realign();return;}stop();return;}
    if(Math.abs(video.currentTime-lastTime)>.005){lastTime=video.currentTime;progressAt=now;}
    if(now-progressAt>2500){fail(new Error('Playback stalled during export. Try a shorter section.'));return;}
    const error=drift(video.currentTime,practice.currentTime,mapping);
    if(needsRealignment(error)){recoveryPromise=realign();return;}
    try{practice.playbackRate=correction(error,playRates.practice);}catch{fail(new Error('This device cannot maintain the mapped playback speed. Try current-speed export.'));return;}
    if(now-lastDraw>=30){draw();lastGood=video.currentTime;lastDraw=now;const progress=Math.max(0,Math.min(1,(video.currentTime-range.start)/(range.end-range.start)));$('exportProgress').value=progress;say('Creating video · '+Math.round(progress*100)+'% · '+clock((range.end-video.currentTime)/playRates.reference)+' remaining');}
    raf=requestAnimationFrame(tick);
   }
   raf=requestAnimationFrame(tick);watchdog=setTimeout(()=>fail(new Error('Export took too long. Keep SlowMo visible and try a shorter section.')),((range.end-range.start)/playRates.reference+40)*1000);
   await AsyncMedia.guard(stopped,{signal,timeout:((range.end-range.start)/playRates.reference+45)*1000});if(recoveryPromise)await recoveryPromise;finished=false;check();if(failed)throw failed;if(!blob?.size||performance.now()-startedAt<50)throw new Error('No playable video was captured. Try again.');
   result=blob;resultURL=URL.createObjectURL(blob);preview.src=resultURL;preview.hidden=false;
   await event(preview,'loadedmetadata',8000,signal);check();if(!preview.videoWidth||!preview.videoHeight)throw new Error('This browser could not play the exported file. Nothing was uploaded.');
   $('exportProgress').value=1;$('exportActions').hidden=false;say('Ready · '+(blob.type.includes('mp4')?'MP4':'WebM')+' · '+preview.videoWidth+' × '+preview.videoHeight+' · '+(blob.size/1048576).toFixed(1)+' MB. Preview before saving.');
  }catch(e){clearResult();say(current.cancelled?current.reason:e.message);}
  finally{
   current.abort.abort();cancelAnimationFrame(raf);clearTimeout(watchdog);current.stop=null;for(const [media,name,fn] of listeners)media.removeEventListener(name,fn);
   video.pause();practice.pause();if(recorder&&recorder.state!=='inactive')try{recorder.stop();}catch{}audio?.release();stream?.getVideoTracks().forEach(t=>t.stop());canvas?.remove();wake?.release().catch(()=>{});
   video.muted=snapshot.referenceMuted;practice.muted=snapshot.practiceMuted;video.playbackRate=snapshot.referenceRate;practice.playbackRate=snapshot.practiceRate;
   try{await Promise.all([position(video,snapshot.time,undefined,1500),position(practice,snapshot.practiceTime,undefined,1500)]);}catch{}
   playbackIntent=false;dance.pairBusy=false;dance.exporting=false;job=null;dance.updateControls();renderLoop();time();playing();player.classList.remove('exporting');$('exportOptions').hidden=false;$('cancelExport').hidden=true;
  }
 }
 function outputFile(){if(!result)return null;const mp4=result.type.includes('mp4');return new File([result],'SlowMo-comparison-'+new Date().toISOString().replace(/[:.]/g,'-')+(mp4?'.mp4':'.webm'),{type:mp4?'video/mp4':'video/webm'});}
 function download(){const file=outputFile();if(!file)return;const link=document.createElement('a');link.href=resultURL;link.download=file.name;document.body.append(link);link.click();link.remove();say('Download requested. Check Files / Downloads; share from Files to save to Photos if offered.');}
 $('downloadExport').onclick=download;$('shareExport').onclick=async()=>{const file=outputFile();if(!file)return;try{if(navigator.canShare?.({files:[file]})){await navigator.share({files:[file],title:'SlowMo comparison'});say('Share Sheet closed. Check Photos or Files for your saved video.');}else download();}catch(e){if(e.name!=='AbortError')say('Sharing is unavailable. Tap Download instead.');}};
}
return {exportRange,composition,rates,drift,recorderType,warmPair,correction,needsRealignment,install};
});
